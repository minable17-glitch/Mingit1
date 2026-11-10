create role anon; create role authenticated;
create schema extensions; create extension if not exists pgcrypto with schema extensions;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
alter database postgres set timezone to 'Asia/Seoul';
