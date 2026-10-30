// 유튜브 영상의 제목·채널·썸네일·유튜브 분류를 가져오는 서버 함수.
// - YOUTUBE_API_KEY 비밀값이 있으면 YouTube Data API 로 분류(categoryId)까지 가져옴
// - 없거나 실패하면 oEmbed 로 제목·채널·썸네일만 가져옴 (분류 없음)
// 로그인한 사용자만 쓸 수 있도록 기본 JWT 확인을 켜 둔 채로 배포합니다.
// 배포: supabase functions deploy youtube-info

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
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${YOUTUBE_API_KEY}`,
  );
  if (!res.ok) {
    console.error("YouTube Data API 실패", res.status, await res.text());
    return null;
  }
  const s = (await res.json()).items?.[0]?.snippet;
  if (!s) return null;
  return {
    title: s.title ?? null,
    author: s.channelTitle ?? null,
    channel_key: s.channelId ?? null,
    yt_category_id: s.categoryId ?? null,
    thumbnail_url: s.thumbnails?.high?.url ?? s.thumbnails?.medium?.url ?? null,
  };
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
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { id } = await req.json();
    if (typeof id !== "string" || !/^[\w-]{11}$/.test(id)) return json({ error: "영상 ID가 올바르지 않아요" }, 400);

    const info = (YOUTUBE_API_KEY && (await fromDataApi(id))) || (await fromOEmbed(id));
    if (!info) return json({ error: "영상 정보를 찾지 못했어요" }, 404);
    return json(info);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
