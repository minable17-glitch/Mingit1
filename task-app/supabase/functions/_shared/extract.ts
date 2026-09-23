// 공문·메일 본문에서 업무 하나를 뽑아내는 공통 로직 (공문 붙여넣기, Gmail 가져오기)
import { askJSON } from "./claude.ts";

export type Extracted = {
  is_task: boolean;
  title: string;
  category_name: string;
  due_date: string;
  deliverables: string[];
  steps: { title: string; due_date: string }[];
  next_action: string;
  summary: string;
};

const SYSTEM = `당신은 한국 학교 교사의 업무 비서입니다. 공문이나 업무 메일을 읽고 교사가 해야 할 업무 하나로 정리합니다.
- is_task: 교사가 실제로 할 일이 있으면 true. 단순 안내·광고·참고용이면 false (이때 나머지는 빈 값).
- title: 업무 이름을 짧게 (예: "2026 학교폭력 실태조사 결과 제출").
- category_name: 주어진 분류 중 가장 알맞은 것 하나.
- due_date: 문서에 적힌 최종 제출·처리 기한(YYYY-MM-DD) 그대로. 연도가 없으면 오늘 이후 가장 가까운 날짜로. 없으면 빈 문자열.
- steps 마감은 교내 결재에 걸리는 시간을 고려해 최종 기한보다 여유 있게, 주말이 아닌 평일로 잡습니다.
- deliverables: 제출물·준비물 목록 (서식명, 부수, 제출 방법 포함).
- steps: 실행 순서대로 2~6개, 각 단계 마감은 오늘과 최종 기한 사이에 배분.
- next_action: 오늘 바로 할 15~30분짜리 첫 행동.
- summary: 교사가 알아야 할 핵심 2~3문장 (대상, 방법, 유의사항).
문서에 없는 사실은 지어내지 않습니다.`;

export function extractSchema(categoryNames: string[]) {
  return {
    type: "object",
    properties: {
      is_task: { type: "boolean" },
      title: { type: "string" },
      category_name: { type: "string", enum: categoryNames },
      due_date: { type: "string" },
      deliverables: { type: "array", items: { type: "string" } },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" }, due_date: { type: "string" } },
          required: ["title", "due_date"],
          additionalProperties: false,
        },
      },
      next_action: { type: "string" },
      summary: { type: "string" },
    },
    required: ["is_task", "title", "category_name", "due_date", "deliverables", "steps", "next_action", "summary"],
    additionalProperties: false,
  };
}

export function extractTask(text: string, categoryNames: string[], today: string, sourceLabel: string) {
  return askJSON<Extracted>({
    system: SYSTEM,
    schema: extractSchema(categoryNames),
    messages: [{
      role: "user",
      content: `오늘: ${today}\n분류: ${categoryNames.join(", ")}\n\n다음 ${sourceLabel}을 업무로 정리해 주세요.\n\n<document>\n${text}\n</document>`,
    }],
  });
}
