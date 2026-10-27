// 회원 탈퇴: 로그인한 본인의 계정과 모든 데이터(업무·단계·기록·설정·템플릿 등)를 영구 삭제합니다.
// 모든 표가 auth.users 에 "on delete cascade" 로 묶여 있어 계정을 지우면 데이터도 함께 지워집니다. 첨부 파일은 먼저 따로 지웁니다.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, userClient } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { data: { user } } = await userClient(req).auth.getUser();
    if (!user) return json({ error: "not_logged_in" }, 401);
    const { confirm } = await req.json();
    if (confirm !== "탈퇴") return json({ error: "confirm_required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // 첨부 파일(비공개 저장소 task-files 의 본인 폴더)도 지움 — 저장소 파일은 계정과 자동으로 묶여 있지 않음
    for (;;) {
      const { data: files } = await admin.storage.from("task-files").list(user.id, { limit: 100 });
      if (!files?.length) break;
      const { error: rmErr } = await admin.storage.from("task-files").remove(files.map((f) => `${user.id}/${f.name}`));
      if (rmErr) break;
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
