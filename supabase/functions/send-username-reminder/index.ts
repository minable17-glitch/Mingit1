import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // 그 이메일로 가입된 계정이 있는지 여부와 무관하게 항상 같은 응답을 줘서
  // 등록된 이메일 목록을 외부에서 추측할 수 없게 함.
  const okResponse = () =>
    new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || !email.trim()) {
      return okResponse();
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: teachers } = await supabase
      .from("teachers")
      .select("username")
      .eq("email", email.trim());

    if (teachers && teachers.length > 0) {
      const usernames = teachers.map((t) => t.username);
      const listHtml = usernames.map((u) => `<li><b>${u}</b></li>`).join("");

      const resendKey = Deno.env.get("RESEND_API_KEY");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "새싹책방 <onboarding@resend.dev>",
          to: [email.trim()],
          subject: "새싹책방 아이디 안내",
          html: `<p>이 이메일로 가입된 아이디예요:</p><ul>${listHtml}</ul>`,
        }),
      });
    }

    return okResponse();
  } catch (e) {
    return new Response(JSON.stringify({ ok: true, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
