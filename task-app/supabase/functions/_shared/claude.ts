// Claude 호출 공통: JSON 스키마로 답을 받아 파싱까지 해서 돌려줍니다.
import Anthropic from "npm:@anthropic-ai/sdk";
import { json } from "./common.ts";

export class AiError extends Error {
  constructor(public code: string, public status = 502) {
    super(code);
  }
}

export async function askJSON<T>(opts: {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 사용
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort ?? "medium", format: { type: "json_schema", schema: opts.schema } },
      // 안전 분류기가 거절하면 서버가 권장 모델로 자동 재시도
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      messages: opts.messages,
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiError("rate_limited", 429);
    if (e instanceof Anthropic.APIError) throw new AiError(`api_${e.status}`);
    throw e;
  }
  if (response.stop_reason === "refusal") throw new AiError("refused", 422);
  if (response.stop_reason === "max_tokens") throw new AiError("truncated");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new AiError("empty");
  return JSON.parse(text.text) as T;
}

export function aiErrorResponse(e: unknown) {
  if (e instanceof AiError) return json({ error: e.code }, e.status);
  return json({ error: String(e instanceof Error ? e.message : e) }, 500);
}
