// 구글 캘린더 연동
//  - { action: "sync", task_id }      업무·단계 마감을 종일 일정으로 만들거나 고치거나 지움
//  - { action: "block", task_id, date, start, minutes }  작업 시간 블록 일정 생성
//  - { action: "delete", event_ids }  업무 삭제 전에 연결된 일정 지우기
import { corsHeaders, json, userClient } from "../_shared/common.ts";

const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

async function getAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`google_token_${res.status}`);
  return (await res.json()).access_token as string;
}

function nextDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

// 종일 일정 하나를 원하는 상태로 맞추고, 최종 일정 ID(없으면 null)를 돌려줌
async function reconcile(
  token: string,
  eventId: string | null,
  desired: { summary: string; date: string } | null,
): Promise<string | null> {
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  if (!desired) {
    if (eventId) {
      const res = await fetch(`${CAL}/${eventId}`, { method: "DELETE", headers: auth });
      if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`calendar_delete_${res.status}`);
    }
    return null;
  }

  const body = JSON.stringify({
    summary: desired.summary,
    start: { date: desired.date },
    end: { date: nextDay(desired.date) },
    transparency: "transparent", // 종일 마감이 '바쁨'으로 잡히지 않게
  });

  if (eventId) {
    const res = await fetch(`${CAL}/${eventId}`, { method: "PATCH", headers: auth, body });
    if (res.ok) return eventId;
    // 사용자가 캘린더에서 직접 지운 경우 새로 만듦
    if (res.status !== 404 && res.status !== 410) throw new Error(`calendar_patch_${res.status}`);
  }
  const res = await fetch(CAL, { method: "POST", headers: auth, body });
  if (!res.ok) throw new Error(`calendar_insert_${res.status}`);
  return (await res.json()).id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = userClient(req);
  try {
    const payload = await req.json();

    const { data: tokenRow } = await supabase.from("google_tokens").select("refresh_token").maybeSingle();
    if (!tokenRow) return json({ error: "no_google_token" }, 400);
    const token = await getAccessToken(tokenRow.refresh_token);

    if (payload.action === "delete") {
      for (const id of payload.event_ids ?? []) await reconcile(token, id, null);
      return json({ ok: true });
    }

    const { data: task, error } = await supabase
      .from("tasks").select("*").eq("id", payload.task_id).single();
    if (error || !task) return json({ error: "task_not_found" }, 404);

    if (payload.action === "block") {
      const { date, start, minutes } = payload as { date: string; start: string; minutes: number };
      const startAt = new Date(`${date}T${start}:00+09:00`);
      const endAt = new Date(startAt.getTime() + minutes * 60000);
      const res = await fetch(CAL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `[작업] ${task.title}`,
          description: task.next_action ? `다음 행동: ${task.next_action}` : undefined,
          start: { dateTime: startAt.toISOString(), timeZone: "Asia/Seoul" },
          end: { dateTime: endAt.toISOString(), timeZone: "Asia/Seoul" },
        }),
      });
      if (!res.ok) throw new Error(`calendar_block_${res.status}`);
      return json({ ok: true, event_id: (await res.json()).id });
    }

    // action === "sync"
    const { data: settings } = await supabase.from("settings").select("calendar_steps").maybeSingle();
    const includeSteps = settings?.calendar_steps ?? true;

    const taskEventId = await reconcile(
      token,
      task.calendar_event_id,
      task.due_date ? { summary: `[마감] ${task.title}`, date: task.due_date } : null,
    );
    await supabase.from("tasks")
      .update({ calendar_event_id: taskEventId, calendar_dirty: false })
      .eq("id", task.id);

    const { data: steps } = await supabase.from("steps").select("*").eq("task_id", task.id);
    for (const step of steps ?? []) {
      const want = includeSteps && step.due_date
        ? { summary: `[단계] ${task.title} · ${step.title}`, date: step.due_date }
        : null;
      const id = await reconcile(token, step.calendar_event_id, want);
      if (id !== step.calendar_event_id) {
        await supabase.from("steps").update({ calendar_event_id: id }).eq("id", step.id);
      }
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
