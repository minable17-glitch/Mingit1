// 캘린더 구독 링크: 구글 캘린더의 "URL로 추가"에 넣으면 업무·단계 마감이 종일 일정으로 보입니다.
// 구글 권한(심사)이 필요 없는 방식이라 모든 사용자가 쓸 수 있습니다. 구글은 몇 시간마다 새로 읽어 갑니다.
//   GET /functions/v1/calendar-feed?token=<구독 키>
// 배포: config.toml 에서 토큰 검사 끔 (구글 캘린더가 로그인 없이 읽어 가므로)
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCalendar } from "../_shared/ics.ts";

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token");
  if (!token || token.length < 20) return new Response("token required", { status: 401 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: settings } = await admin.from("settings")
    .select("user_id, calendar_steps").eq("calendar_token", token).maybeSingle();
  if (!settings) return new Response("invalid token", { status: 401 });

  const { data: tasks } = await admin.from("tasks")
    .select("id, title, next_action, due_date, steps(id, title, due_date, done)")
    .eq("user_id", settings.user_id).eq("status", "active");

  const body = buildCalendar(tasks ?? [], settings.calendar_steps);

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="task-keeper.ics"',
    },
  });
});
