// 2단계 AI 기능 모음. 모두 "제안만" 하고 저장은 앱에서 사용자가 확정할 때 합니다.
//  - mode "triage":  빠른 던져넣기 (한 줄 → 어느 업무에 붙일지 / 새 업무인지)
//  - mode "extract": 공문 붙여넣기 (본문 → 업무·기한·제출물·단계)
//  - mode "review":  금요일 주간 회고 대화
//  - mode "small":   공강(짜투리) 시간에 할 작은 행동 추천
import { corsHeaders, json, userClient } from "../_shared/common.ts";
import { aiErrorResponse, askJSON } from "../_shared/claude.ts";
import { extractTask } from "../_shared/extract.ts";

type TaskBrief = {
  id: string;
  title: string;
  category?: string;
  next_action?: string;
  due?: string | null;
  idle?: number;
  waiting_on?: string | null;
};

const taskLines = (tasks: TaskBrief[]) =>
  tasks.map((t) =>
    [
      `- [${t.id}] ${t.title}`,
      t.category && `분류: ${t.category}`,
      t.due && `마감: ${t.due}`,
      t.next_action && `다음 행동: ${t.next_action}`,
      t.idle !== undefined && `${t.idle}일째 활동 없음`,
      t.waiting_on && `대기 중: ${t.waiting_on}`,
    ].filter(Boolean).join(" | ")
  ).join("\n") || "(진행 중 업무 없음)";

const idEnum = (tasks: TaskBrief[]) => [...tasks.map((t) => t.id), ""];

// ── 던져넣기 ────────────────────────────────
async function triage(body: { text: string; tasks: TaskBrief[]; categories: string[]; today: string }) {
  return askJSON({
    effort: "low",
    system: `교사가 떠오른 할 일이나 소식을 한 줄로 던져 넣으면, 진행 중인 업무 중 어디에 붙일지 판단합니다.
- 기존 업무와 관련 있으면 kind="attach", task_id에 그 업무 ID.
  attach_as: 해야 할 새 작업이면 "step", 진행 상황·정보면 "note", 지금 가장 먼저 할 일이면 "next_action".
  content: 붙일 내용을 다듬은 한 줄.
- 어느 업무와도 관련 없으면 kind="new", task_id="", new_title·category_name·due_date(YYYY-MM-DD 또는 "")를 채움. content에는 첫 다음 행동.
- reason: 왜 그렇게 판단했는지 한 문장.
사용하지 않는 필드는 빈 문자열로 둡니다.`,
    schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["attach", "new"] },
        task_id: { type: "string", enum: idEnum(body.tasks) },
        attach_as: { type: "string", enum: ["step", "note", "next_action", ""] },
        content: { type: "string" },
        new_title: { type: "string" },
        category_name: { type: "string", enum: [...body.categories, ""] },
        due_date: { type: "string" },
        reason: { type: "string" },
      },
      required: ["kind", "task_id", "attach_as", "content", "new_title", "category_name", "due_date", "reason"],
      additionalProperties: false,
    },
    messages: [{
      role: "user",
      content: `오늘: ${body.today}\n분류: ${body.categories.join(", ")}\n\n진행 중 업무:\n${taskLines(body.tasks)}\n\n던져 넣은 내용: ${body.text}`,
    }],
  });
}

// ── 주간 회고 ────────────────────────────────
type Turn = { role: "user" | "assistant"; content: string };
async function review(body: {
  history: Turn[];
  today: string;
  week: { start: string; completed: string[]; activity: string[]; active: TaskBrief[] };
}) {
  const asked = body.history.filter((t) => t.role === "assistant").length;
  const context = [
    `오늘: ${body.today} (이번 주 시작: ${body.week.start})`,
    `이번 주 완료한 업무:\n${body.week.completed.map((t) => `- ${t}`).join("\n") || "(없음)"}`,
    `이번 주 활동 기록:\n${body.week.activity.join("\n") || "(없음)"}`,
    `진행 중 업무:\n${taskLines(body.week.active)}`,
  ].join("\n\n");

  const messages: Turn[] = [
    { role: "user", content: `${context}\n\n주간 회고를 시작해 주세요.` },
    ...body.history.map((t) => ({ role: t.role, content: t.content })),
  ];
  if (asked >= 3) messages.push({ role: "user", content: "이제 회고를 마무리해 주세요." });

  return askJSON({
    system: `금요일 5분 주간 회고를 진행하는 다정하고 간결한 동료입니다.
- 첫 답: 이번 주를 2~3문장으로 정리(완료한 것은 인정해 주고, 멈춰 있는 업무를 짚음)한 뒤 질문 하나.
- 질문은 한 번에 하나, 전체 최대 3개. 다음 주를 준비하는 데 필요한 것만 묻습니다
  (예: 멈춘 업무가 왜 멈췄는지, 다음 주 가장 중요한 일, 내려놓을 일).
- 답을 듣고 도움이 되면 suggestions에 구체적 변경을 제안: 업무별 다음 행동 바꾸기(next_action),
  마감 조정(due_date, YYYY-MM-DD), 완료 처리(complete, value는 빈 문자열). 사용자가 확정해야 반영됩니다.
- 충분하면 finished=true, summary에 이번 주 회고 요약과 다음 주 초점을 3~5줄로. 아니면 summary는 빈 문자열.
- message는 사용자에게 보여줄 말(요약·질문·마무리 인사).`,
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              task_id: { type: "string", enum: idEnum(body.week.active) },
              change: { type: "string", enum: ["next_action", "due_date", "complete"] },
              value: { type: "string" },
              reason: { type: "string" },
            },
            required: ["task_id", "change", "value", "reason"],
            additionalProperties: false,
          },
        },
        finished: { type: "boolean" },
        summary: { type: "string" },
      },
      required: ["message", "suggestions", "finished", "summary"],
      additionalProperties: false,
    },
    messages,
  });
}

// ── 짜투리 모드 ──────────────────────────────
async function small(body: { minutes: number; tasks: TaskBrief[]; today: string }) {
  return askJSON({
    effort: "low",
    system: `교사의 공강(짜투리) 시간에 끝낼 수 있는 작은 행동을 최대 3개 추천합니다.
- 주어진 분 안에 끝나는 구체적 행동만 (예: "견적 요청 메일 1통 보내기", "평가 기준표 1번 문항 쓰기").
- 마감이 가깝거나 오래 멈춘 업무를 우선합니다. 대기 중(결재·회신) 업무는 "확인 연락" 같은 행동만.
- minutes는 예상 소요 분. 합이 주어진 시간을 넘지 않게.`,
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              task_id: { type: "string", enum: idEnum(body.tasks) },
              action: { type: "string" },
              minutes: { type: "integer" },
            },
            required: ["task_id", "action", "minutes"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
    messages: [{
      role: "user",
      content: `오늘: ${body.today}\n가용 시간: ${body.minutes}분\n\n진행 중 업무:\n${taskLines(body.tasks)}`,
    }],
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = userClient(req);
  // AI는 관리자 또는 관리자가 켜 준 사용자만 (API 비용 보호)
  const { data: allowed } = await supabase.rpc("ai_allowed");
  if (!allowed) return json({ error: "ai_not_enabled" }, 403);

  try {
    const body = await req.json();
    switch (body.mode) {
      case "triage":
        return json(await triage(body));
      case "extract":
        return json(await extractTask(body.text, body.categories, body.today, "공문"));
      case "review":
        return json(await review(body));
      case "small":
        return json(await small(body));
      default:
        return json({ error: "unknown_mode" }, 400);
    }
  } catch (e) {
    return aiErrorResponse(e);
  }
});
