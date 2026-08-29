Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return new Response(JSON.stringify({ books: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("KAKAO_API_KEY");
    const url = `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(query.trim())}&size=15`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    if (!res.ok) {
      return new Response(JSON.stringify({ books: [], error: "search_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const books = (data.documents || []).map((d) => ({
      title: (d.title || "").replace(/<[^>]+>/g, ""),
      author: (d.authors || []).join(", "),
      cover: d.thumbnail || "",
      isbn: d.isbn || "",
      publisher: d.publisher || "",
      price: typeof d.price === "number" && d.price > 0 ? d.price : null,
      contents: (d.contents || "").replace(/<[^>]+>/g, ""),
    }));
    return new Response(JSON.stringify({ books }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ books: [], error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
