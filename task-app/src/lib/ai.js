// AI 도움받기 설정 (이 기기에만 저장)
//  - 기본: 질문을 복사해 사용자가 쓰는 AI 사이트(ChatGPT·Claude·Gemini 등)에 붙여넣고, 답을 다시 붙여넣기
//  - 선택: 사용자가 자기 Anthropic API 키를 넣으면 이 기기에서 바로 AI에게 묻고 답을 받음
//    키는 이 브라우저에만 저장되고, 우리 서버를 거치지 않고 Anthropic으로 직접 전송됩니다.

export const AI_SITES = [
  { key: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { key: 'claude', name: 'Claude', url: 'https://claude.ai/new' },
  { key: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app' },
  { key: 'wrtn', name: '뤼튼', url: 'https://wrtn.ai/' },
];

export const AI_MODELS = [
  { id: 'claude-opus-5', name: 'Claude Opus 5 (가장 똑똑함)' },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5 (더 저렴함)' },
];

const KEY = 'tk-ai-settings';

export function loadAiSettings() {
  try {
    return { site: 'chatgpt', apiKey: '', model: AI_MODELS[0].id, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { site: 'chatgpt', apiKey: '', model: AI_MODELS[0].id };
  }
}

export function saveAiSettings(patch) {
  const next = { ...loadAiSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 모드 등)에서는 이번 화면에서만 유지
  }
  return next;
}

export function siteOf(settings) {
  return AI_SITES.find((s) => s.key === settings.site) ?? AI_SITES[0];
}

// 자기 API 키로 바로 묻기 → 답 글자. SDK는 이 기능을 쓸 때만 내려받음(평소 앱은 가볍게).
export async function askWithOwnKey(prompt, settings = loadAiSettings()) {
  if (!settings.apiKey) throw new Error('API 키가 없어요. 설정 → AI 도움받기에서 넣어 주세요.');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
  const opus = settings.model === 'claude-opus-5';
  try {
    const response = await client.beta.messages.create({
      model: settings.model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      // Opus 5: 안전 분류기가 거절하면 서버가 권장 모델로 자동 재시도
      ...(opus ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') throw new Error('AI가 이 요청에 답하지 않았어요. 내용을 조금 바꿔 다시 해 보세요.');
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    if (!text.trim()) throw new Error('AI 답이 비어 있어요. 다시 시도해 주세요.');
    return text;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('API 키가 올바르지 않아요. 설정에서 다시 확인해 주세요.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('이 API 키로는 선택한 모델을 쓸 수 없어요.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('잠시 요청이 너무 많아요. 조금 뒤 다시 해 주세요.');
    if (e instanceof Anthropic.APIError) throw new Error(`AI 호출 실패 (${e.status ?? '연결'}): 충전 잔액이나 네트워크를 확인해 주세요.`);
    throw e;
  }
}
