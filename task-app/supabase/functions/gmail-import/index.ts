// Gmail 라벨(기본 "업무")이 붙은 메일을 읽어 AI가 업무 제안을 만들고 '받은 제안함'에 넣습니다.
// 업무 생성은 사용자가 앱에서 확정할 때만 합니다.
//  - 앱에서 "메일 확인" 버튼: 로그인 사용자 권한으로 실행
//  - pg_cron 예약: x-cron-secret 헤더로 실행 (schema_phase2.sql 7번)
// 배포: supabase functions deploy gmail-import --no-verify-jwt  (예약 호출에는 로그인 토큰이 없어서)
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/common.ts";
import { getGoogleAccessToken } from "../_shared/google.ts";
import { aiErrorResponse } from "../_shared/claude.ts";
import { extractTask } from "../_shared/extract.ts";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_NEW_PER_RUN = 10; // 한 번에 AI로 분석할 최대 메일 수 (비용 보호)
const MAX_BODY_CHARS = 30000; // 아주 긴 메일(뉴스레터 등)은 앞부분만 분석

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };

function decodeBase64Url(data: string) {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function findPart(part: Part, mime: string): string | null {
  if (part.mimeType === mime && part.body?.data) return decodeBase64Url(part.body.data);
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}

function bodyText(payload: Part) {
  const plain = findPart(payload, "text/plain");
  if (plain) return plain;
  const html = findPart(payload, "text/html");
  if (!html) return "";
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

const todayKST = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

async function importFor(db: SupabaseClient, userId: string, refreshToken: string) {
  const { data: settings } = await db.from("settings").select("gmail_label").eq("user_id", userId).maybeSingle();
  const labelName = settings?.gmail_label || "업무";
  const { data: cats } = await db.from("categories").select("name").eq("user_id", userId).order("sort_order");
  const categoryNames = (cats ?? []).map((c) => c.name);

  const token = await getGoogleAccessToken(refreshToken);
  const gmail = async (path: string) => {
    const res = await fetch(`${GMAIL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`gmail_${res.status}`);
    return res.json();
  };

  const { labels = [] } = await gmail("/labels");
  const label = labels.find((l: { name: string }) => l.name === labelName);
  if (!label) return { imported: 0, error: "label_not_found", label: labelName };

  const { messages = [] } = await gmail(`/messages?labelIds=${label.id}&maxResults=30&q=${encodeURIComponent("newer_than:14d")}`);
  const ids: string[] = messages.map((m: { id: string }) => m.id);
  if (!ids.length) return { imported: 0 };

  const { data: seen } = await db.from("inbox").select("source_id")
    .eq("user_id", userId).eq("source", "gmail").in("source_id", ids);
  const seenIds = new Set((seen ?? []).map((r) => r.source_id));
  const fresh = ids.filter((id) => !seenIds.has(id)).slice(0, MAX_NEW_PER_RUN);

  let imported = 0;
  for (const id of fresh) {
    const msg = await gmail(`/messages/${id}?format=full`);
    const header = (name: string) =>
      msg.payload?.headers?.find((h: { name: string }) => h.name.toLowerCase() === name)?.value ?? "";
    const subject = header("subject");
    const sender = header("from");
    const body = (bodyText(msg.payload ?? {}) || msg.snippet || "").slice(0, MAX_BODY_CHARS);

    const proposal = await extractTask(
      `제목: ${subject}\n보낸 사람: ${sender}\n\n${body}`,
      categoryNames,
      todayKST(),
      "업무 메일",
    );
    const { error } = await db.from("inbox").insert({
      user_id: userId,
      source: "gmail",
      source_id: id,
      subject,
      sender,
      received_at: new Date(Number(msg.internalDate)).toISOString(),
      proposal,
      // 할 일이 없는 안내 메일은 제안함에 띄우지 않되, 다시 분석하지 않도록 기록은 남김
      status: proposal.is_task ? "pending" : "dismissed",
    });
    if (!error && proposal.is_task) imported++;
  }
  return { imported };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 예약 실행: 서비스 키로 토큰이 저장된 모든 사용자(= 본인) 처리
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: tokens } = await admin.from("google_tokens").select("user_id, refresh_token");
      // 고급 구글 연동이 허락된 사람(관리자 또는 관리자가 켜 준 사용자)만 처리
      const { data: admins } = await admin.from("allowed_emails").select("email");
      const { data: profiles } = await admin.from("profiles").select("user_id, email, google_advanced");
      const adminEmails = new Set((admins ?? []).map((a) => a.email.toLowerCase()));
      const permitted = new Set((profiles ?? [])
        .filter((p) => p.google_advanced || adminEmails.has(p.email.toLowerCase()))
        .map((p) => p.user_id));
      const results = [];
      for (const t of tokens ?? []) {
        if (permitted.has(t.user_id)) results.push(await importFor(admin, t.user_id, t.refresh_token));
      }
      return json({ results });
    }

    // 앱에서 버튼으로 실행: 로그인 토큰 확인
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await db.auth.getUser();
    const { data: allowed } = await db.rpc("google_advanced_allowed");
    if (!user || !allowed) return json({ error: "not_allowed" }, 403);

    const { data: tokenRow } = await db.from("google_tokens").select("refresh_token").maybeSingle();
    if (!tokenRow) return json({ error: "no_google_token" }, 400);
    return json(await importFor(db, user.id, tokenRow.refresh_token));
  } catch (e) {
    return aiErrorResponse(e);
  }
});
