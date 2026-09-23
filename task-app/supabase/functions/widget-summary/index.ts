// 바탕화면·홈 화면 위젯용 읽기 전용 요약: 오늘의 다음 행동과 경고만.
//   GET /functions/v1/widget-summary?key=<위젯 키>&format=json|text|html
// 위젯 키는 앱 설정 화면에서 만듭니다. 키를 아는 사람은 요약을 볼 수 있으니 공유하지 마세요.
// 배포: supabase functions deploy widget-summary --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2";
import { assess, rank, todayKST, type Task } from "../_shared/briefing.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function badge(i: ReturnType<typeof assess>) {
  if (i.overdue) return `${-i.daysLeft!}일 지남`;
  if (i.dueSoon) return i.daysLeft === 0 ? "오늘 마감" : `D-${i.daysLeft}`;
  if (i.noReply) return `${i.waitDays}일 무응답`;
  if (i.neglected) return `${i.idle}일 방치`;
  return "";
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const format = url.searchParams.get("format") ?? "json";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 6), 20);
  if (!key || key.length < 20) return new Response("key required", { status: 401 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: settings } = await admin.from("settings")
    .select("user_id, neglect_days, waiting_days").eq("widget_token", key).maybeSingle();
  if (!settings) return new Response("invalid key", { status: 401 });

  const { data: tasks } = await admin.from("tasks")
    .select("title, next_action, due_date, last_activity_at, waiting_on, waiting_since, steps(due_date, done)")
    .eq("user_id", settings.user_id).eq("status", "active");

  const today = todayKST();
  const rows = (tasks as Task[] ?? [])
    .map((t) => ({ t, i: assess(t, today, settings.neglect_days, settings.waiting_days) }))
    .sort((a, b) => rank(a.i) - rank(b.i) || (a.i.due ?? "9999").localeCompare(b.i.due ?? "9999"));
  const items = rows.slice(0, limit).map(({ t, i }) => ({
    title: t.title,
    next_action: t.waiting_on ? `⏳ ${t.waiting_on} 대기` : t.next_action,
    alert: badge(i),
  }));
  const summary = {
    date: today,
    active: rows.length,
    alerts: rows.filter(({ i }) => rank(i) < 3).length,
    items,
  };

  const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
  if (format === "text") {
    const lines = items.map((x) => `${x.alert ? `[${x.alert}] ` : ""}${x.title}\n  → ${x.next_action}`);
    return new Response(`업무 ${summary.active} · 경고 ${summary.alerts}\n${lines.join("\n")}`, {
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (format === "html") {
    const li = items.map((x) =>
      `<li><b>${esc(x.title)}</b>${x.alert ? ` <span class="a">${esc(x.alert)}</span>` : ""}<div>→ ${esc(x.next_action)}</div></li>`
    ).join("");
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="refresh" content="600">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>업무 챙김</title>
<style>body{margin:0;padding:16px;font-family:-apple-system,'Malgun Gothic',sans-serif;background:transparent;color:#fff;text-shadow:0 1px 3px #000a}
h1{font-size:15px;margin:0 0 8px;opacity:.85}ul{list-style:none;margin:0;padding:0}li{margin:0 0 10px;font-size:14px}
li div{opacity:.9}.a{background:#e5484d;color:#fff;border-radius:8px;padding:0 6px;font-size:12px;text-shadow:none}</style></head>
<body><h1>업무 ${summary.active} · 경고 ${summary.alerts}</h1><ul>${li}</ul></body></html>`;
    return new Response(html, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  }
  return new Response(JSON.stringify(summary), { headers: { ...headers, "Content-Type": "application/json" } });
});
