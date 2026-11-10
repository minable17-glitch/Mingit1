-- Supabase Realtime의 realtime.messages 와 realtime.topic() 흉내 (로컬 점검용)
create schema realtime;
create table realtime.messages (id bigserial primary key, topic text not null, extension text not null, payload jsonb, private boolean default true);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
grant usage on schema realtime to authenticated; grant select, insert on realtime.messages to authenticated; grant usage on sequence realtime.messages_id_seq to authenticated;
