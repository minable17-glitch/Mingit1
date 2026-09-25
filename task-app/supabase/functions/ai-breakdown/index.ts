// AI 업무 쪼개기: 질문을 하나씩(최대 3개) 한 뒤 세부 단계·단계별 마감·첫 다음 행동을 제안합니다.
// 저장은 하지 않습니다. 사용자가 화면에서 확정할 때만 앱이 저장합니다.
import { corsHeaders, json, userClient } from "../_shared/common.ts";
import { aiErrorResponse, askJSON } from "../_shared/claude.ts";

const MAX_QUESTIONS = 3;

const SYSTEM = `당신은 여러 업무를 동시에 맡은 한국 교사의 업무 정리를 돕는 비서입니다.
업무 하나를 실행 가능한 세부 단계로 쪼개는 것이 목표입니다.

진행 방식:
- 좋은 계획에 꼭 필요한 정보가 빠져 있으면 질문을 한 번에 하나만 합니다. 짧고 답하기 쉽게 묻습니다.
- 질문은 전체 대화에서 최대 ${MAX_QUESTIONS}개입니다. 충분히 알면 더 묻지 말고 바로 제안합니다.
- 제안할 때는 단계 3~8개를 순서대로 냅니다. 각 단계 이름은 동사로 끝나는 구체적 행동으로 씁니다(예: "예산 항목별 견적 2곳 받기").
- 단계별 마감(YYYY-MM-DD)은 오늘 날짜와 업무 최종 마감 사이에 무리 없이 배분하고, 주말이 아닌 평일로 잡습니다. 최종 마감이 없으면 합리적으로 추정하거나 비워 둡니다(빈 문자열).
- next_action은 첫 단계를 오늘 바로 시작할 수 있는 15~30분짜리 행동 하나로 씁니다.
- 한국 학교의 학사일정·결재 절차·공문 관행을 고려합니다.`;

const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["question", "proposal"] },
    question: { type: "string", description: "kind가 question일 때 질문. proposal이면 빈 문자열." },
    steps: {
      type: "array",
      description: "kind가 proposal일 때 단계 목록. question이면 빈 배열.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          due_date: { type: "string", description: "YYYY-MM-DD 또는 빈 문자열" },
        },
        required: ["title", "due_date"],
        additionalProperties: false,
      },
    },
    next_action: { type: "string", description: "proposal일 때 첫 다음 행동. question이면 빈 문자열." },
  },
  required: ["kind", "question", "steps", "next_action"],
  additionalProperties: false,
};

type Turn = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 로그인한 허용 사용자만 AI를 부를 수 있게 확인 (AI 비용 보호)
  const supabase = userClient(req);
  // AI는 관리자 또는 관리자가 켜 준 사용자만 (API 비용 보호)
  const { data: allowed } = await supabase.rpc("ai_allowed");
  if (!allowed) return json({ error: "ai_not_enabled" }, 403);

  try {
    const { task, history = [], today } = await req.json() as {
      task: { title: string; due_date?: string | null; category?: string };
      history: Turn[];
      today: string;
    };

    const questionsAsked = history.filter((t) => t.role === "assistant").length;
    const intro = [
      `오늘: ${today}`,
      `업무: ${task.title}`,
      `분류: ${task.category ?? "-"}`,
      `최종 마감: ${task.due_date || "정하지 않음"}`,
      "이 업무를 세부 단계로 쪼개 주세요.",
    ].join("\n");

    const messages: Turn[] = [
      { role: "user", content: intro },
      ...history.map((t) => ({ role: t.role, content: t.content })),
    ];
    if (questionsAsked >= MAX_QUESTIONS) {
      messages.push({ role: "user", content: "질문은 여기까지입니다. 지금까지 정보로 바로 제안해 주세요." });
    }

    const result = await askJSON<{ kind: string }>({ system: SYSTEM, schema: SCHEMA, messages });

    // 질문 한도를 넘겼는데도 질문이면 제안을 강제할 수 없으므로 오류로 알림
    if (result.kind === "question" && questionsAsked >= MAX_QUESTIONS) {
      return json({ error: "too_many_questions" }, 502);
    }
    return json(result);
  } catch (e) {
    return aiErrorResponse(e);
  }
});
