// 유튜브 링크에서 제목·썸네일을 가져오는 서버 함수.
// (유튜브 oEmbed 는 브라우저에서 직접 부를 수 없어서 서버에서 대신 가져옴)
// 로그인한 사용자만 쓸 수 있도록 기본 JWT 확인을 켜 둔 채로 배포합니다.
// 배포: supabase functions deploy youtube-info

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = await req.json();
    const parsed = new URL(url);
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) return json({ error: "유튜브 링크가 아니에요" }, 400);

    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(parsed.toString())}`,
    );
    if (!res.ok) return json({ error: "영상 정보를 찾지 못했어요" }, 404);

    const info = await res.json();
    return json({
      title: info.title ?? null,
      author: info.author_name ?? null,
      thumbnail_url: info.thumbnail_url ?? null,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
