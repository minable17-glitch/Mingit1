// Claude(또는 MCP를 지원하는 다른 AI 채팅)와 업무 챙김을 잇는 커넥터 서버.
// AI 채팅에서 "이거 업무 챙김에 등록해 줘", "오늘 뭐부터 해야 해?" 하면 AI가 아래 도구를 불러 직접 읽고 씁니다.
// AI 이용료는 각자 쓰는 AI 채팅 요금제에 포함되고, 이 서버는 AI를 부르지 않습니다.
//   POST /functions/v1/mcp?token=<연결 키>   (MCP Streamable HTTP, 상태 없이 JSON으로 응답)
// 연결 키는 앱 설정 화면에서 만듭니다. 키를 아는 사람은 업무를 읽고 추가할 수 있으니 공유하지 마세요.
// 배포: config.toml 에서 토큰 검사 끔 (AI 채팅 서버가 로그인 없이 부르므로 연결 키로 확인)
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { assess, rank, todayKST, type Task } from "../_shared/briefing.ts";

const SUPPORTED = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const PLACEHOLDER_NEXT_ACTION = "첫 단계 정하기";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INSTRUCTIONS = `업무 챙김은 교사의 업무 목록 앱입니다. 업무(task) 아래에 순서가 있는 단계(step)가 있고, 업무마다 '지금 할 다음 행동' 하나와 마감일이 있습니다.
- 사용자가 대화에서 정리한 계획을 등록해 달라고 하면 add_task 로 업무 하나를 만들고, 할 일을 이야기한 순서대로 steps 에 넣으세요. 업무 이름은 짧게(40자 이내), 원문이나 긴 설명은 note 에 넣으세요.
- 이미 있는 업무와 관련된 내용이면 먼저 list_tasks 로 확인하고 add_to_task 로 붙이세요. 같은 업무를 두 번 만들지 마세요.
- 날짜는 YYYY-MM-DD, 한국 시간 기준입니다. 연도가 없으면 가까운 미래로 보세요.
- 등록하기 전에 무엇을 등록할지 사용자에게 짧게 보여 주고 확인받으면 좋습니다.
- 학생 이름 등 개인정보는 업무에 넣지 마세요.`;

const DATE = { type: "string", description: "YYYY-MM-DD (선택)", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };

const TOOLS = [
  {
    name: "get_briefing",
    title: "오늘의 브리핑",
    description: "진행 중인 업무를 급한 순서(마감 지남 → 임박 → 방치·무응답 → 나머지)로, 각 업무의 다음 행동과 함께 보여 줍니다. '오늘 뭐부터 해?' 같은 질문에 쓰세요.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_tasks",
    title: "업무 목록",
    description: "진행 중인 업무 전체를 id, 분류, 마감, 다음 행동, 단계(id·완료 여부)와 함께 돌려줍니다. 분류 목록도 함께 나옵니다. 기존 업무에 붙이거나 단계를 체크하기 전에 쓰세요.",
    inputSchema: {
      type: "object",
      properties: { search: { type: "string", description: "업무 이름에 들어 있는 말로 좁히기 (선택)" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "add_task",
    title: "새 업무 등록",
    description: "새 업무를 만듭니다. steps 는 해야 할 순서대로. next_action 을 비우면 첫 단계가 다음 행동이 됩니다.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "짧은 업무 이름 (40자 이내)", maxLength: 80 },
        category: { type: "string", description: "분류 이름 (예: 담임, 수업, 행정업무). 비우거나 맞는 분류가 없으면 기타로" },
        due_date: DATE,
        steps: {
          type: "array",
          description: "순서대로의 단계",
          items: {
            type: "object",
            properties: { title: { type: "string", maxLength: 120 }, due_date: DATE },
            required: ["title"],
            additionalProperties: false,
          },
          maxItems: 30,
        },
        next_action: { type: "string", description: "지금 바로 할 한 가지 (선택)" },
        note: { type: "string", description: "원문·요약·제출물 등 메모 (선택)" },
      },
      required: ["title"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "add_to_task",
    title: "기존 업무에 추가",
    description: "이미 있는 업무에 단계(step)를 덧붙이거나, 메모(note)를 남기거나, 다음 행동(next_action)을 바꿉니다. task_id 는 list_tasks 에서.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        kind: { type: "string", enum: ["step", "note", "next_action"] },
        content: { type: "string", maxLength: 2000 },
        due_date: { ...DATE, description: "단계 마감 (kind=step 일 때만, 선택)" },
      },
      required: ["task_id", "kind", "content"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "check_step",
    title: "단계 완료 체크",
    description: "단계 하나를 완료로 체크합니다(done=false 면 되돌림). 모든 단계가 끝나면 업무가 완료되어 보관함으로 갑니다. step_id 는 list_tasks 에서.",
    inputSchema: {
      type: "object",
      properties: { step_id: { type: "string" }, done: { type: "boolean", default: true } },
      required: ["step_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

type Ctx = { db: SupabaseClient; userId: string; neglect: number; waiting: number };
type Step = { id: string; title: string; due_date: string | null; done: boolean; position: number };
type FullTask = Omit<Task, "steps"> & { id: string; category_id: string; latest_note: string | null; steps: Step[] };

class ToolError extends Error {}

const now = () => new Date().toISOString();
const validDate = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d)) ? d : null);

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function log(c: Ctx, taskId: string, kind: string, content: string) {
  await c.db.from("activity_log").insert({ user_id: c.userId, task_id: taskId, kind, content: `${content} (AI 채팅)` });
}

async function loadTasks(c: Ctx): Promise<FullTask[]> {
  const rows = check(await c.db.from("tasks")
    .select("id, title, category_id, next_action, due_date, latest_note, last_activity_at, waiting_on, waiting_since, steps(id, title, due_date, done, position)")
    .eq("user_id", c.userId).eq("status", "active")) as FullTask[];
  for (const t of rows) t.steps.sort((a, b) => a.position - b.position);
  return rows;
}

async function ownedTask(c: Ctx, taskId: string): Promise<FullTask> {
  const t = check(await c.db.from("tasks")
    .select("id, title, category_id, next_action, due_date, latest_note, last_activity_at, waiting_on, waiting_since, status, steps(id, title, due_date, done, position)")
    .eq("user_id", c.userId).eq("id", taskId).maybeSingle()) as FullTask | null;
  if (!t) throw new ToolError("그 업무를 찾지 못했어요. list_tasks 로 id를 다시 확인하세요.");
  t.steps.sort((a, b) => a.position - b.position);
  return t;
}

function badge(i: ReturnType<typeof assess>) {
  if (i.overdue) return `⚠ ${-i.daysLeft!}일 지남`;
  if (i.dueSoon) return i.daysLeft === 0 ? "⚠ 오늘 마감" : `⚠ D-${i.daysLeft}`;
  if (i.noReply) return `⏳ ${i.waitDays}일 무응답`;
  if (i.neglected) return `💤 ${i.idle}일 방치`;
  return i.due ? `D-${i.daysLeft}` : "";
}

async function getBriefing(c: Ctx) {
  const today = todayKST();
  const rows = (await loadTasks(c))
    .map((t) => ({ t, i: assess(t, today, c.neglect, c.waiting) }))
    .sort((a, b) => rank(a.i) - rank(b.i) || (a.i.due ?? "9999").localeCompare(b.i.due ?? "9999"));
  if (!rows.length) return `오늘(${today}) 진행 중인 업무가 없어요.`;
  const lines = rows.map(({ t, i }, n) => {
    const done = t.steps.filter((s) => s.done).length;
    const next = t.waiting_on ? `${t.waiting_on} 회신 대기 중` : t.next_action;
    return `${n + 1}. ${t.title}${badge(i) ? ` [${badge(i)}]` : ""}${i.due ? ` 마감 ${i.due}` : ""}\n   → 다음 행동: ${next}${t.steps.length ? ` (단계 ${done}/${t.steps.length})` : ""}`;
  });
  return `오늘은 ${today}입니다. 진행 중인 업무 ${rows.length}개 (급한 순):\n${lines.join("\n")}`;
}

async function listTasks(c: Ctx, args: { search?: string }) {
  const cats = check(await c.db.from("categories").select("id, name").eq("user_id", c.userId).order("sort_order")) as { id: string; name: string }[];
  const catName = Object.fromEntries(cats.map((x) => [x.id, x.name]));
  let tasks = await loadTasks(c);
  const q = args.search?.replace(/\s/g, "");
  if (q) tasks = tasks.filter((t) => t.title.replace(/\s/g, "").includes(q));
  const out = {
    today: todayKST(),
    categories: cats.map((x) => x.name),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      category: catName[t.category_id] ?? "",
      due_date: t.due_date,
      next_action: t.next_action,
      waiting_on: t.waiting_on,
      latest_note: t.latest_note ? t.latest_note.slice(0, 200) : null,
      steps: t.steps.map((s) => ({ id: s.id, title: s.title, due_date: s.due_date, done: s.done })),
    })),
  };
  return JSON.stringify(out, null, 1);
}

async function addTask(c: Ctx, a: { title: string; category?: string; due_date?: string; steps?: { title: string; due_date?: string }[]; next_action?: string; note?: string }) {
  const title = a.title?.trim();
  if (!title) throw new ToolError("업무 이름(title)이 비어 있어요.");
  const cats = check(await c.db.from("categories").select("id, name, sort_order").eq("user_id", c.userId).order("sort_order")) as { id: string; name: string; sort_order: number }[];
  const want = a.category?.replace(/\s/g, "");
  // 분류를 안 정했거나 맞는 분류가 없으면 '기타' (없으면 만듦)
  const cat = (want && (cats.find((x) => x.name.replace(/\s/g, "") === want) ?? cats.find((x) => x.name.includes(want) || want.includes(x.name))))
    || cats.find((x) => x.name.trim() === "기타")
    || check(await c.db.from("categories").insert({
      user_id: c.userId, name: "기타", color: "#94a3b8", sort_order: cats.reduce((m, x) => Math.max(m, x.sort_order ?? 0), -1) + 1,
    }).select("id, name").single()) as { id: string; name: string };
  const steps = (a.steps ?? []).map((s) => ({ title: s.title?.trim(), due_date: validDate(s.due_date) })).filter((s) => s.title);
  const due = validDate(a.due_date);
  const nextAction = a.next_action?.trim() || steps[0]?.title || PLACEHOLDER_NEXT_ACTION;

  const task = check(await c.db.from("tasks").insert({
    user_id: c.userId,
    title: title.slice(0, 80),
    category_id: cat.id,
    due_date: due,
    next_action: nextAction,
    latest_note: a.note?.trim() || null,
    calendar_dirty: Boolean(due || steps.some((s) => s.due_date)),
  }).select("id").single()) as { id: string };
  if (steps.length) {
    check(await c.db.from("steps").insert(steps.map((s, i) => ({ user_id: c.userId, task_id: task.id, position: i, title: s.title, due_date: s.due_date }))));
  }
  await log(c, task.id, "create", title);
  if (a.note?.trim()) await log(c, task.id, "note", a.note.trim());
  return `등록했어요: "${title}" (분류 ${cat.name}${due ? `, 마감 ${due}` : ""}, 단계 ${steps.length}개). 다음 행동: ${nextAction}\ntask_id: ${task.id}`;
}

async function addToTask(c: Ctx, a: { task_id: string; kind: string; content: string; due_date?: string }) {
  const t = await ownedTask(c, a.task_id);
  const content = a.content?.trim();
  if (!content) throw new ToolError("내용(content)이 비어 있어요.");
  if (a.kind === "step") {
    const position = t.steps.reduce((m, s) => Math.max(m, s.position + 1), 0);
    const due = validDate(a.due_date);
    check(await c.db.from("steps").insert({ user_id: c.userId, task_id: t.id, position, title: content.slice(0, 120), due_date: due }));
    const patch: Record<string, unknown> = { last_activity_at: now() };
    if (t.next_action === PLACEHOLDER_NEXT_ACTION || t.steps.every((s) => s.done)) patch.next_action = content.slice(0, 120);
    if (due) patch.calendar_dirty = true;
    check(await c.db.from("tasks").update(patch).eq("id", t.id).eq("user_id", c.userId));
    await log(c, t.id, "edit", `단계 추가: ${content}`);
    return `"${t.title}"에 단계를 추가했어요: ${content}${due ? ` (${due})` : ""}`;
  }
  if (a.kind === "note") {
    check(await c.db.from("tasks").update({ latest_note: content, last_activity_at: now() }).eq("id", t.id).eq("user_id", c.userId));
    await log(c, t.id, "note", content);
    return `"${t.title}"에 메모를 남겼어요.`;
  }
  if (a.kind === "next_action") {
    check(await c.db.from("tasks").update({ next_action: content.slice(0, 200), last_activity_at: now() }).eq("id", t.id).eq("user_id", c.userId));
    await log(c, t.id, "edit", `다음 행동: ${content}`);
    return `"${t.title}"의 다음 행동을 바꿨어요: ${content}`;
  }
  throw new ToolError("kind 는 step, note, next_action 중 하나여야 해요.");
}

async function checkStep(c: Ctx, a: { step_id: string; done?: boolean }) {
  const step = check(await c.db.from("steps").select("id, task_id, title").eq("user_id", c.userId).eq("id", a.step_id).maybeSingle()) as { id: string; task_id: string; title: string } | null;
  if (!step) throw new ToolError("그 단계를 찾지 못했어요. list_tasks 로 step id를 다시 확인하세요.");
  const done = a.done ?? true;
  check(await c.db.from("steps").update({ done, done_at: done ? now() : null }).eq("id", step.id).eq("user_id", c.userId));
  const t = await ownedTask(c, step.task_id);
  await log(c, t.id, "check", `${done ? "완료" : "되돌림"}: ${step.title}`);
  const remaining = t.steps.filter((s) => !s.done);
  if (!remaining.length && t.steps.length) {
    check(await c.db.from("tasks").update({ status: "done", completed_at: now(), last_activity_at: now() }).eq("id", t.id).eq("user_id", c.userId));
    await log(c, t.id, "complete", t.title);
    return `"${step.title}" 완료! 모든 단계가 끝나서 "${t.title}" 업무를 완료 처리했어요.`;
  }
  check(await c.db.from("tasks").update({ next_action: remaining[0].title, last_activity_at: now() }).eq("id", t.id).eq("user_id", c.userId));
  return `"${step.title}" ${done ? "완료" : "되돌림"}. 다음 행동: ${remaining[0].title} (남은 단계 ${remaining.length}개)`;
}

async function callTool(c: Ctx, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_briefing": return await getBriefing(c);
    case "list_tasks": return await listTasks(c, args as { search?: string });
    case "add_task": return await addTask(c, args as Parameters<typeof addTask>[1]);
    case "add_to_task": return await addToTask(c, args as Parameters<typeof addToTask>[1]);
    case "check_step": return await checkStep(c, args as Parameters<typeof checkStep>[1]);
    default: throw new ToolError(`모르는 도구: ${name}`);
  }
}

// 연결 키 → 사용자. 관리자가 가입을 막았거나 목록에 없는 사람이면 거절 (앱의 is_allowed 와 같은 기준)
async function resolveUser(db: SupabaseClient, token: string): Promise<Ctx | null> {
  const { data: s } = await db.from("settings").select("user_id, neglect_days, waiting_days").eq("mcp_token", token).maybeSingle();
  if (!s) return null;
  const { data: profile } = await db.from("profiles").select("user_id").eq("user_id", s.user_id).maybeSingle();
  if (!profile) {
    const { data: u } = await db.auth.admin.getUserById(s.user_id);
    const email = u?.user?.email?.toLowerCase();
    if (!email) return null;
    const { data: admin } = await db.from("allowed_emails").select("email").ilike("email", email).maybeSingle();
    const { data: cfg } = await db.from("app_config").select("signup_open").eq("id", 1).maybeSingle();
    if (!admin && cfg?.signup_open === false) return null;
  }
  return { db, userId: s.user_id, neglect: s.neglect_days ?? 3, waiting: s.waiting_days ?? 3 };
}

type RpcMsg = { jsonrpc: "2.0"; id?: string | number | null; method?: string; params?: Record<string, unknown> };

async function handle(msg: RpcMsg, ctx: Ctx) {
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  if (msg.id === undefined) return null; // 알림(notifications/*)은 답하지 않음
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return reply({
        protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "task-keeper", title: "업무 챙김", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping": return reply({});
    case "tools/list": return reply({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (!TOOLS.some((t) => t.name === name)) return fail(-32602, `모르는 도구: ${name}`);
      try {
        const text = await callTool(ctx, name, args);
        return reply({ content: [{ type: "text", text }], isError: false });
      } catch (e) {
        const text = e instanceof ToolError ? e.message : `처리하지 못했어요: ${(e as Error).message}`;
        return reply({ content: [{ type: "text", text }], isError: true });
      }
    }
    case "resources/list": return reply({ resources: [] });
    case "prompts/list": return reply({ prompts: [] });
    default: return fail(-32601, `지원하지 않는 요청: ${msg.method}`);
  }
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response("업무 챙김 MCP 커넥터입니다. AI 채팅의 커넥터 설정에 이 주소를 넣어 쓰세요.", {
      status: 405, headers: { ...cors, Allow: "POST, OPTIONS", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (token.length < 20) return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "연결 키가 없어요. 앱 설정에서 받은 주소를 그대로 넣으세요." } }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ctx = await resolveUser(db, token);
  if (!ctx) return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "연결 키가 맞지 않거나 사용이 허락되지 않은 계정이에요. 앱 설정에서 새 주소를 받으세요." } }, 401);

  let body: RpcMsg | RpcMsg[];
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON이 아니에요" } }, 400);
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(m, ctx)))).filter(Boolean);
    return out.length ? jsonResponse(out) : new Response(null, { status: 202, headers: cors });
  }
  const out = await handle(body, ctx);
  return out ? jsonResponse(out) : new Response(null, { status: 202, headers: cors });
});
