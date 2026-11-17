/**
 * /indique — "PERDI MEU LINK" do indique e ganhe (17/11). A pessoa digita o e-mail da compra; se ela comprou o CORE na /oferta, o
 * link do painel vai PRA ESSE E-MAIL (quem recebe é a prova; sem senha). A resposta é sempre a mesma: a página nunca diz se o
 * e-mail existe. Função `afiliados`, action indique_recuperar (envs INDIQUE_WEB=on e INDIQUE_EMAIL=on). É também o destino do bloco
 * "Indique e ganhe" do e-mail de acesso. Mesma cara da tela cheia (src/lib/indique-estilo.ts).
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { estiloIndique, type EstiloIndique } from "@/lib/indique-estilo";
import { COMISSAO_POR_AMIGA_CENTS, reaisBr } from "../../supabase/functions/_shared/indique";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function IndiqueRecuperarVista({ enviar, estilo = "bitepal" }: { enviar: (email: string) => Promise<"ok" | "desligado" | "erro">; estilo?: EstiloIndique }) {
  const [email, setEmail] = useState("");
  const [fase, setFase] = useState<"form" | "enviando" | "enviado">("form");
  const [erro, setErro] = useState<string | null>(null);
  const bitepal = estilo !== "site";
  const mandar = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_OK.test(e)) { setErro("Confira o e-mail: parece que falta alguma coisa."); return; }
    setErro(null); setFase("enviando");
    const r = await enviar(e).catch(() => "erro" as const);
    if (r === "ok") setFase("enviado");
    else { setFase("form"); setErro(r === "desligado" ? "Isso ainda não está disponível. Volte em breve." : "Não deu pra enviar agora. Tente de novo em instantes."); }
  };
  return (
    <div className={`min-h-screen ${bitepal ? "bg-[#F3F2F7] text-[#17111C]" : "bg-white text-[#262626]"}`} data-testid="indique-recuperar" style={{ fontFamily: "Inter, -apple-system, sans-serif" }}>
      <div style={{ background: bitepal ? "linear-gradient(180deg,#FBC6DF 0%,#F8DDEA 50%,rgba(243,242,247,0) 100%)" : "linear-gradient(180deg,#fde6f1 0%,#fff3f9 50%,#fff 100%)" }}>
        <main className="mx-auto max-w-[440px] px-5 pt-4 pb-14 min-h-screen flex flex-col">
          <div className="flex items-center justify-between h-10"><span className="text-[15px] font-black tracking-[.14em]">CORE</span><span className="text-[12px] font-bold uppercase tracking-[.1em] text-[#C42A73]">Indique e ganhe</span></div>
          <div className="mt-10" aria-hidden>
            <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-white border-[3px] border-[#17111C] shadow-[0_3px_0_#17111C] text-[26px] -rotate-6">👩🏻</span>
            <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-white border-[3px] border-[#17111C] shadow-[0_3px_0_#17111C] text-[26px] rotate-6 -ml-2">👩🏽‍🦱</span>
          </div>
          {fase === "enviado" ? (
            <>
              <h1 className={`${bitepal ? "text-[40px]" : "text-[32px]"} font-black tracking-[-0.045em] leading-[1] mt-5`}>Olhe seu e-mail 💌</h1>
              <p className="text-[16px] leading-relaxed mt-4 text-[#3d3545]" data-testid="recuperar-enviado">
                Se esse e-mail é de quem já assina o CORE, seu link de indicação chega nele em instantes. Não chegou em 5 minutos? Olhe o spam e as promoções.
              </p>
              <button type="button" onClick={() => { setFase("form"); setEmail(""); }} className="mt-6 self-start text-[14px] font-semibold underline underline-offset-4 text-[#3d3545] min-h-[44px]">Usar outro e-mail</button>
            </>
          ) : (
            <>
              <h1 className={`${bitepal ? "text-[40px]" : "text-[32px]"} font-black tracking-[-0.045em] leading-[1] mt-5`}>Já comprou o CORE? Pegue seu link</h1>
              <p className="text-[16px] leading-relaxed mt-4 text-[#3d3545]">
                Cada amiga que comprar pelo seu link = <b className="text-[#17111C]">{reaisBr(COMISSAO_POR_AMIGA_CENTS)} no seu Pix</b>, sem limite de amigas. Digite o e-mail da sua conta e mandamos seu link de indicação pra ele.
              </p>
              <label className="block text-[13px] font-bold mt-7" htmlFor="recuperar-email">E-mail da sua conta</label>
              <input id="recuperar-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void mandar(); }}
                placeholder="voce@email.com" data-testid="recuperar-campo"
                className="w-full h-[56px] mt-2 rounded-2xl bg-white border border-[#e2dfe6] px-4 text-[16px] shadow-[0_8px_20px_-16px_rgba(23,17,28,.5)]" />
              {erro && <p className="text-[13.5px] text-red-700 mt-2" role="alert" data-testid="recuperar-erro">{erro}</p>}
              <div className="mt-auto pt-8">
                <button type="button" onClick={() => void mandar()} disabled={fase === "enviando"} data-testid="recuperar-enviar"
                  className={`w-full h-[58px] rounded-full text-white text-[17px] font-extrabold disabled:opacity-70 ${bitepal ? "bg-[#17111C]" : "bg-[#d02c7d]"}`}>
                  {fase === "enviando" ? "Enviando…" : "Mandar pro meu e-mail"}
                </button>
                <p className="text-[12.5px] text-[#4a4252] mt-3 text-center">Sem senha: o link chega só nesse e-mail. Se perder de novo, é só voltar aqui.</p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function IndiqueRecuperar() {
  const enviar = async (email: string): Promise<"ok" | "desligado" | "erro"> => {
    const { data, error } = await supabase.functions.invoke("afiliados", { body: { action: "indique_recuperar", email } });
    const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
    const d = (data ?? (ctx?.json ? await ctx.json().catch(() => null) : null) ?? {}) as { ok?: boolean; motivo?: string };
    return d.ok === true ? "ok" : d.motivo === "desligado" ? "desligado" : "erro";
  };
  return <IndiqueRecuperarVista enviar={enviar} estilo={estiloIndique()} />;
}
