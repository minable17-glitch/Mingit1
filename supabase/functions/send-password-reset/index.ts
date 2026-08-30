import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // 아이디가 실제로 있는지, 이메일이 등록돼 있는지와 무관하게 항상 같은 응답을 줘서
  // 등록된 아이디 목록을 외부에서 추측할 수 없게 함.
  const okResponse = () =>
    new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { username } = await req.json();
    if (!username || typeof username !== "string" || !username.trim()) {
      return okResponse();
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: teacher } = await supabase
      .from("teachers")
      .select("id, email")
      .eq("username", username.trim())
      .maybeSingle();

    if (teacher?.email) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await supabase
        .from("teachers")
        .update({ reset_code: code, reset_code_expires_at: expiresAt })
        .eq("id", teacher.id);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "새싹책방 <onboarding@resend.dev>",
          to: [teacher.email],
          subject: "새싹책방 비밀번호 재설정 인증코드",
          html: `<p>비밀번호 재설정 인증코드는 <b style="font-size:20px">${code}</b> 입니다.</p><p>15분 안에 입력해주세요. 요청하지 않으셨다면 이 메일은 무시하셔도 돼요.</p>`,
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
