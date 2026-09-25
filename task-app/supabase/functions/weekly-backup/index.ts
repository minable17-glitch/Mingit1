// 주 1회 전체 데이터를 Supabase Storage 의 `backups` 버킷에 JSON 으로 저장합니다.
// pg_cron 이 x-backup-secret 헤더와 함께 호출합니다 (schema.sql 8번 참고).
import { createClient } from "npm:@supabase/supabase-js@2";
import { json } from "../_shared/common.ts";

const TABLES = ["categories", "tasks", "steps", "activity_log", "settings", "templates", "weekly_reviews", "profiles"];
const KEEP_DAYS = 35; // 개인정보처리방침: 백업은 최대 5주 보관

Deno.serve(async (req) => {
  if (req.headers.get("x-backup-secret") !== Deno.env.get("BACKUP_SECRET")) {
    return json({ error: "forbidden" }, 403);
  }
  // 예약 작업은 로그인 사용자가 없으므로 서비스 키로 전체를 읽음
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const dump: Record<string, unknown> = { exported_at: new Date().toISOString() };
  for (const t of TABLES) {
    const { data, error } = await admin.from(t).select("*");
    if (error) return json({ error: `${t}: ${error.message}` }, 500);
    dump[t] = data;
  }

  const name = `backup-${new Date().toISOString().slice(0, 10)}.json`;
  const { error } = await admin.storage.from("backups").upload(
    name,
    new Blob([JSON.stringify(dump)], { type: "application/json" }),
    { upsert: true },
  );
  if (error) return json({ error: error.message }, 500);

  // 오래된 백업 삭제 (탈퇴한 사람의 데이터가 백업에 오래 남지 않도록)
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  const { data: files } = await admin.storage.from("backups").list("", { limit: 1000 });
  const old = (files ?? [])
    .map((f) => f.name)
    .filter((n) => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(n) && n.slice(7, 17) < cutoff);
  if (old.length) await admin.storage.from("backups").remove(old);
  return json({ ok: true, file: name, removed: old.length });
});
