// 시간 알림(웹 푸시)
//   GET  /functions/v1/push                         → { publicKey }  알림 구독에 쓰는 공개 키 (처음이면 서명 키를 만들어 저장)
//   POST /functions/v1/push { action: "tick" }      → 시간이 된 알림 보내기. 1분마다 예약 작업(pg_cron)이 x-reminder-secret 과 함께 부름
//   POST /functions/v1/push { action: "test" }      → 로그인한 사용자의 기기로 시험 알림 (Authorization: Bearer <로그인 토큰>)
// 배포: config.toml 에서 토큰 검사 끔 (예약 작업은 비밀값으로, 시험 알림은 로그인 토큰을 직접 확인)
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
type Reminder = { id: string; user_id: string; task_id: string | null; title: string; remind_at: string };

// 서명 키(VAPID): server_config 에 한 번 만들어 두고 계속 씀
async function vapid(db: SupabaseClient) {
  const read = async () => (await db.from("server_config").select("value").eq("key", "vapid").maybeSingle()).data?.value;
  let stored = await read();
  if (!stored) {
    const keys = await webpush.generateVapidKeys({ extractable: true });
    await db.from("server_config").upsert({ key: "vapid", value: await webpush.exportVapidKeys(keys) }, { onConflict: "key", ignoreDuplicates: true });
    stored = await read(); // 동시에 두 번 만들어졌으면 먼저 저장된 것을 씀
  }
  const keys = await webpush.importVapidKeys(stored, { extractable: false });
  return { keys, publicKey: await webpush.exportApplicationServerKey(keys) };
}

async function sendTo(db: SupabaseClient, server: webpush.ApplicationServer, subs: Sub[], payload: unknown) {
  let sent = 0;
  let failed = 0;
  for (const s of subs) {
    try {
      await server.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
        .pushTextMessage(JSON.stringify(payload), { urgency: webpush.Urgency.High, ttl: 3600 });
      sent++;
    } catch (e) {
      failed++;
      const status = e instanceof webpush.PushMessageError ? e.response.status : 0;
      // 기기에서 알림을 끄거나 앱을 지운 경우: 구독 정리
      if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      else console.warn("push failed", status, (e as Error).message);
    }
  }
  return { sent, failed };
}

const payloadOf = (r: Pick<Reminder, "id" | "title" | "task_id">) => ({
  title: "🔔 업무 챙김",
  body: r.title,
  tag: r.id,
  url: r.task_id ? `/?task=${r.task_id}` : "/",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    if (req.method === "GET") {
      const { publicKey } = await vapid(db);
      return json({ publicKey });
    }
    if (req.method !== "POST") return json({ error: "method" }, 405);
    const body = await req.json().catch(() => ({}));
    const { keys } = await vapid(db);
    const server = await webpush.ApplicationServer.new({ contactInformation: Deno.env.get("SUPABASE_URL")!, vapidKeys: keys });

    if (body.action === "test") {
      const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      const { data } = await db.auth.getUser(token);
      if (!data?.user) return json({ error: "login_required" }, 401);
      const { data: subs } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").eq("user_id", data.user.id);
      if (!subs?.length) return json({ error: "no_device" }, 400);
      const result = await sendTo(db, server, subs as Sub[], { title: "🔔 업무 챙김", body: "알림이 잘 와요! 정해 둔 시간에 이렇게 알려 드릴게요.", tag: "test", url: "/" });
      return json(result);
    }

    if (body.action === "tick") {
      const secret = Deno.env.get("REMINDER_SECRET");
      if (!secret || req.headers.get("x-reminder-secret") !== secret) return json({ error: "forbidden" }, 403);
      const now = new Date();
      // 시간이 된 알림을 먼저 '보냄'으로 표시해서 가져옴 (겹쳐 실행돼도 두 번 가지 않게)
      const { data: due, error } = await db.from("reminders")
        .update({ sent_at: now.toISOString() })
        .is("sent_at", null).lte("remind_at", now.toISOString())
        .select("id, user_id, task_id, title, remind_at");
      if (error) throw error;
      const fresh = (due as Reminder[]).filter((r) => now.getTime() - Date.parse(r.remind_at) < 12 * 3600e3); // 12시간 넘게 밀린 건 조용히 넘김
      if (!fresh.length) return json({ due: due?.length ?? 0, sent: 0 });
      const users = [...new Set(fresh.map((r) => r.user_id))];
      const { data: subs } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", users);
      let sent = 0;
      let failed = 0;
      for (const r of fresh) {
        const res = await sendTo(db, server, ((subs ?? []) as Sub[]).filter((s) => s.user_id === r.user_id), payloadOf(r));
        sent += res.sent;
        failed += res.failed;
      }
      return json({ due: due.length, sent, failed });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
