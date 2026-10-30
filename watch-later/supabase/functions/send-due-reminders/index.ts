// 알림 시간이 된 영상을 찾아 웹 푸시를 보내는 서버 함수.
//
// 세 가지 방식으로 불립니다.
//  1) pg_cron (1분마다) — 헤더 x-cron-secret 이 CRON_SECRET 과 같아야 함
//  2) pg_cron (매시 정각, body {"mode":"digest"}) — 주간 정리 알림
//  3) 앱의 "테스트 알림" 버튼 — 로그인한 사용자 본인 기기로만 테스트 알림 전송
//
// 필요한 비밀값(Edge Function Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// 배포: supabase functions deploy send-due-reminders --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Payload = {
  title: string;
  body: string;
  url: string;
  image?: string | null;
  tag?: string;
};

// 한 사용자의 모든 기기로 알림 전송. 성공한 기기 수와 등록된 기기 수를 돌려줌.
async function sendToUser(userId: string, payload: Payload) {
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw error;

  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 12, urgency: "high" },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // 앱을 지웠거나 알림을 끈 기기 → 목록에서 정리
        await admin.from("push_subscriptions").delete().eq("id", s.id);
      } else {
        console.error("push 실패", status, (e as Error).message);
      }
    }
  }
  return { sent, devices: subs?.length ?? 0 };
}

async function sendDueReminders() {
  // 보낼 대상을 먼저 "처리 중"으로 표시(notified_at 채움)해서
  // 함수가 겹쳐 실행돼도 같은 알림이 두 번 가지 않게 함
  const now = new Date().toISOString();
  const { data: items, error } = await admin
    .from("watch_items")
    .update({ notified_at: now })
    .lte("remind_at", now)
    .is("notified_at", null)
    .is("watched_at", null)
    .select("id, user_id, url, title, thumbnail_url");
  if (error) throw error;

  let sentCount = 0;
  for (const item of items ?? []) {
    const { sent, devices } = await sendToUser(item.user_id, {
      title: "▶ 지금 볼 시간이에요",
      body: item.title || item.url,
      url: item.url,
      image: item.thumbnail_url,
      tag: item.id,
    });
    sentCount += sent;
    const status = sent > 0 ? "sent" : devices === 0 ? "no_device" : "failed";
    await admin.from("watch_items").update({ notify_status: status }).eq("id", item.id);
  }
  return { items: items?.length ?? 0, sent: sentCount };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// 사용자 시간대 기준 지금 요일(0=일)과 시(0~23)
function localDowHour(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", hourCycle: "h23" })
    .formatToParts(now);
  return {
    dow: WEEKDAYS.indexOf(parts.find((p) => p.type === "weekday")!.value),
    hour: Number(parts.find((p) => p.type === "hour")!.value),
  };
}

async function sendWeeklyDigests() {
  const { data: settings, error } = await admin.from("user_settings").select("*").eq("digest_enabled", true);
  if (error) throw error;

  const now = new Date();
  const weekAgo = now.getTime() - 7 * 86400000;
  let sent = 0;
  for (const s of settings ?? []) {
    let local;
    try {
      local = localDowHour(now, s.timezone || "Asia/Seoul");
    } catch {
      local = localDowHour(now, "Asia/Seoul");
    }
    if (local.dow !== s.digest_dow || local.hour !== s.digest_hour) continue;
    // 같은 주에 두 번 보내지 않기
    if (s.last_digest_at && now.getTime() - new Date(s.last_digest_at).getTime() < 6 * 86400000) continue;
    await admin.from("user_settings").update({ last_digest_at: now.toISOString() }).eq("user_id", s.user_id);

    const { data: items } = await admin
      .from("watch_items")
      .select("created_at, watched_at, categories(name)")
      .eq("user_id", s.user_id);
    const all = items ?? [];
    const unwatched = all.filter((i) => !i.watched_at).length;
    const savedThisWeek = all.filter((i) => new Date(i.created_at).getTime() >= weekAgo);
    const watchedThisWeek = all.filter((i) => i.watched_at && new Date(i.watched_at).getTime() >= weekAgo).length;
    if (!unwatched && !savedThisWeek.length) continue;

    const counts = new Map<string, number>();
    for (const i of savedThisWeek) {
      // deno-lint-ignore no-explicit-any
      const name = (i as any).categories?.name;
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    const lines = [
      unwatched ? `안 본 영상 ${unwatched}개가 기다리고 있어요.` : "모든 영상을 다 봤어요! 👏",
      `이번 주 ${savedThisWeek.length}개 저장 · ${watchedThisWeek}개 시청`,
      top ? `가장 많이 저장한 분야: ${top}` : "",
    ].filter(Boolean);

    const result = await sendToUser(s.user_id, {
      title: "📺 이번 주 영상 정리",
      body: lines.join("\n"),
      url: s.app_url ? `${s.app_url}#/my` : SUPABASE_URL,
      tag: "weekly-digest",
    });
    sent += result.sent;
  }
  return { digests: sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) 예약 실행
    if (CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET) {
      const body = await req.json().catch(() => ({}));
      return json(body.mode === "digest" ? await sendWeeklyDigests() : await sendDueReminders());
    }

    // 2) 로그인한 사용자의 테스트 알림
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const result = await sendToUser(userData.user.id, {
      title: "🔔 테스트 알림",
      body: "이 알림이 보이면 준비 완료! 누르면 앱이 열려요.",
      url: new URL(req.headers.get("origin") ?? SUPABASE_URL).origin,
      tag: "test",
    });
    return json(result);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
