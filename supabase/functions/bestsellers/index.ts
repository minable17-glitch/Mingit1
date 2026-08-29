Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const ttbKey = Deno.env.get("ALADIN_TTB_KEY");
    const url = `https://www.aladin.co.kr/ttb/api/ItemList.aspx?ttbkey=${ttbKey}&QueryType=Bestseller&MaxResults=20&start=1&SearchTarget=Book&output=js&Version=20131101&Cover=Big`;
    const res = await fetch(url);
    if (!res.ok) {
      return new Response(JSON.stringify({ books: [], error: "fetch_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    if (data.errorCode) {
      return new Response(JSON.stringify({ books: [], error: data.errorMessage || "aladin_error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const books = (data.item || []).map((d) => ({
      title: (d.title || "").split(" - ")[0].trim(),
      author: (d.author || "").split(",")[0].replace(/\(.*?\)/g, "").trim(),
      cover: d.cover || "",
      isbn: d.isbn13 || d.isbn || "",
      publisher: d.publisher || "",
      price: typeof d.priceSales === "number" && d.priceSales > 0 ? d.priceSales : null,
      contents: (d.description || "").replace(/<[^>]+>/g, ""),
      url: d.link || "",
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
