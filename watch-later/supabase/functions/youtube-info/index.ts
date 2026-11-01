// 유튜브 영상(또는 인스타 게시물)의 제목·채널·썸네일·유튜브 분류를 가져오는 서버 함수.
// - body { id } → 유튜브, body { instagram: url } → 인스타 공식 퍼가기 화면에서 계정·글·이미지를 읽음
// - YOUTUBE_API_KEY 비밀값이 있으면 YouTube Data API 로 분류(categoryId)·영상 길이까지 가져옴
// - 없거나 실패하면 oEmbed 로 제목·채널·썸네일만 가져옴 (분류·길이 없음)
// 로그인한 사용자만 쓸 수 있도록 함수 안에서 로그인 토큰을 확인합니다.
// (새 Supabase 프로젝트의 로그인 키 방식과 맞추기 위해 대시보드의 Verify JWT 는 꺼 둡니다)
// 배포: supabase functions deploy youtube-info --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fromDataApi(id: string) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${id}&key=${YOUTUBE_API_KEY}`,
  );
  if (!res.ok) {
    console.error("YouTube Data API 실패", res.status, await res.text());
    return null;
  }
  const video = (await res.json()).items?.[0];
  const s = video?.snippet;
  if (!s) return null;
  return {
    title: s.title ?? null,
    author: s.channelTitle ?? null,
    channel_key: s.channelId ?? null,
    yt_category_id: s.categoryId ?? null,
    thumbnail_url: s.thumbnails?.high?.url ?? s.thumbnails?.medium?.url ?? null,
    duration_sec: parseDuration(video.contentDetails?.duration),
  };
}

// "PT1H2M30S" → 3750 (초). 생방송 등 길이가 없으면 null
function parseDuration(iso?: string) {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, min, sec] = m.map((x) => Number(x) || 0);
  const total = d * 86400 + h * 3600 + min * 60 + sec;
  return total || null;
}

async function fromOEmbed(id: string) {
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`);
  if (!res.ok) return null;
  const info = await res.json();
  return {
    title: info.title ?? null,
    author: info.author_name ?? null,
    channel_key: info.author_url ?? null,
    yt_category_id: null,
    thumbnail_url: info.thumbnail_url ?? null,
    duration_sec: null,
  };
}

// 인스타: 공개 게시물의 퍼가기 화면(embed/captioned)에서 계정 이름·글·이미지를 읽음 (안 되면 빈 값)
function decodeHtml(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

async function fromInstagram(url: string) {
  const m = url.match(/^https:\/\/www\.instagram\.com\/(p|reel|tv)\/([\w-]+)\/$/);
  if (!m) return null;
  const res = await fetch(`${url}embed/captioned/`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36" },
  });
  if (!res.ok) return { title: null, author: null, channel_key: null, thumbnail_url: null };
  const html = await res.text();
  const username = html.match(/class="UsernameText"[^>]*>([^<]+)</)?.[1]?.trim() ?? null;
  const img = html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/)?.[1] ?? null;
  let caption = html.match(/class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments/)?.[1] ?? "";
  caption = decodeHtml(caption).trim();
  if (username && caption.startsWith(username)) caption = caption.slice(username.length).trim();
  const firstLine = caption.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return {
    title: firstLine ? firstLine.slice(0, 90) : null,
    author: username ? `@${username}` : null,
    channel_key: username ? `ig:${username}` : null,
    yt_category_id: null,
    thumbnail_url: img ? decodeHtml(img) : null,
    duration_sec: null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!userData?.user) return json({ error: "로그인이 필요해요" }, 401);

    const body = await req.json();
    if (typeof body.instagram === "string") return json((await fromInstagram(body.instagram)) ?? { error: "인스타 링크가 아니에요" });
    const { id } = body;
    if (typeof id !== "string" || !/^[\w-]{11}$/.test(id)) return json({ error: "영상 ID가 올바르지 않아요" }, 400);

    const info = (YOUTUBE_API_KEY && (await fromDataApi(id))) || (await fromOEmbed(id));
    if (!info) return json({ error: "영상 정보를 찾지 못했어요" }, 404);
    return json(info);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
