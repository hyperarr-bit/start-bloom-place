/**
 * DEPOIS DE PAGO no funil app web (14/11, /funil-app) — decisão do dono: criar senha → tela OBRIGATÓRIA com App Store +
 * Google Play e "Entre com este e-mail" (+ "Usar no navegador agora"). Sem upsell, sem order bump.
 *
 *   liberando  espera o acesso chegar NESTA sessão (check-subscription, a cada 2 s, até 30 s): o stripe-webhook credita a
 *              conta da sessão (anônima → ganha o e-mail da folha) ou, se o e-mail já tinha conta, a conta DELE.
 *   senha      sessão com acesso e sem senha (anônima) → "Crie uma senha" (updateUser). E-mail em uso / sem acesso nesta
 *              sessão em 30 s → pula pras lojas com "Entre com este e-mail" (a compra está na conta do e-mail).
 *   lojas      App Store + Google Play + "Entre com este e-mail: …" + "Usar no navegador agora" (→ o app na web).
 * Eventos: appweb_liberado {em_ms, sessao}, appweb_senha_criada, appweb_conta_existente, appweb_lojas_vistas, appweb_loja,
 * appweb_navegador.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { limparBatismo } from "@/lib/sessao-anonima";
import { URL_APP_STORE, urlPlay } from "@/landing/regras";
import { JORNADA_APP_WEB } from "@/lib/funil-app-web";
import { apagarPedido, gravarPedido, lerPedido } from "@/lib/stripe-app-web";

const F = { funil: JORNADA_APP_WEB };
const ESPERA_MS = 30_000;

type Etapa = "liberando" | "senha" | "lojas";

async function acessoNestaSessao(): Promise<{ assinante: boolean; anonimo: boolean; email: string | null }> {
  const { data: s } = await supabase.auth.getSession();
  if (!s?.session) return { assinante: false, anonimo: true, email: null };
  // o webhook pode ter acabado de pôr o e-mail na conta anônima: o token novo traz
  await supabase.auth.refreshSession().catch(() => null);
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user ?? null;
  const { data } = await supabase.functions.invoke("check-subscription").catch(() => ({ data: null }));
  return { assinante: !!(data as { subscribed?: boolean } | null)?.subscribed, anonimo: user ? user.is_anonymous !== false : true, email: user?.email ?? null };
}

export function PosCompraWeb() {
  const navigate = useNavigate();
  const pedido = useRef(lerPedido());
  const email = pedido.current?.email ?? "";
  const [etapa, setEtapa] = useState<Etapa>(() => (pedido.current?.senhaCriada ? "lojas" : "liberando"));
  const [contaExistente, setContaExistente] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (etapa !== "liberando") return;
    let vivo = true;
    const t0 = Date.now();
    const tentar = async () => {
      while (vivo && Date.now() - t0 < ESPERA_MS) {
        const a = await acessoNestaSessao().catch(() => null);
        if (!vivo) return;
        if (a?.assinante) {
          trackEvent("appweb_liberado", { ...F, em_ms: Date.now() - t0, sessao: a.anonimo ? "anonima" : "conta" });
          setEtapa(a.anonimo ? "senha" : "lojas");
          if (!a.anonimo) marcarSenha();
          return;
        }
        await new Promise((ok) => window.setTimeout(ok, 2000));
      }
      if (!vivo) return;
      // pago, mas o acesso não está NESTA sessão: a compra foi pra conta que o e-mail já tinha
      trackEvent("appweb_conta_existente", { ...F, motivo: "sem_acesso_na_sessao" });
      setContaExistente(true);
      marcarSenha();
      setEtapa("lojas");
    };
    void tentar();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa]);

  useEffect(() => { if (etapa === "lojas") trackEvent("appweb_lojas_vistas", { ...F, conta_existente: contaExistente }); }, [etapa, contaExistente]);

  const marcarSenha = () => { const p = lerPedido(); if (p) gravarPedido({ ...p, senhaCriada: true }); };

  const criarSenha = async () => {
    if (salvando) return;
    if (senha.length < 6) { setErro("A senha precisa de pelo menos 6 caracteres."); return; }
    setSalvando(true); setErro(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const temEmail = !!u?.user?.email;
      const { error } = await supabase.auth.updateUser({ password: senha, ...(temEmail || !email ? {} : { email }) });
      if (error) {
        if (/already|registered|exists|taken/i.test(error.message || "")) {
          trackEvent("appweb_conta_existente", { ...F, motivo: "email_em_uso" });
          setContaExistente(true); marcarSenha(); setEtapa("lojas"); return;
        }
        setErro("Não deu pra salvar a senha. Tente de novo.");
        trackEvent("appweb_erro", { ...F, etapa: "senha" });
        return;
      }
      limparBatismo();
      try { const { data } = await supabase.auth.getUser(); if (data?.user?.id) { const { persistLeadSource } = await import("@/lib/lead-source"); await persistLeadSource(supabase, data.user.id); } } catch { /* atribuição nunca impede o acesso */ }
      trackEvent("appweb_senha_criada", { ...F });
      marcarSenha();
      setEtapa("lojas");
    } finally { setSalvando(false); }
  };

  const usarNoNavegador = () => {
    trackEvent("appweb_navegador", { ...F, conta_existente: contaExistente });
    apagarPedido();
    if (contaExistente) navigate(`/entrar${email ? `?email=${encodeURIComponent(email)}` : ""}`);
    else navigate("/", { replace: true });
  };

  return (
    <div className="w-full max-w-sm mx-auto text-center pt-10 pb-10" data-testid={`appweb-pos-${etapa}`}>
      {etapa === "liberando" && (
        <>
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-black/40" />
          <h1 className="mt-4 text-[24px] font-extrabold tracking-tight">Liberando seu CORE…</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">Leva só uns segundos.</p>
        </>
      )}

      {etapa === "senha" && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-[#16a34a] text-white grid place-items-center shadow-[0_0_0_10px_#ecfdf3]"><Check className="w-8 h-8" strokeWidth={3} /></div>
          <h1 className="mt-5 text-[24px] font-extrabold tracking-tight">Pronto! Seu CORE está liberado.</h1>
          {email && <p className="mt-2 text-[14px] text-muted-foreground">Seu e-mail: <b className="text-foreground break-all">{email}</b></p>}
          <label htmlFor="appweb-senha" className="block text-left mt-6 mb-1.5 text-[14px] font-bold">Crie uma senha</label>
          <input id="appweb-senha" data-testid="appweb-senha" type="password" autoComplete="new-password" minLength={6} value={senha}
            onChange={(e) => { setSenha(e.target.value); setErro(null); }} onKeyDown={(e) => { if (e.key === "Enter") void criarSenha(); }}
            className="w-full h-[50px] rounded-xl border-[1.5px] border-black/15 px-3.5 text-[16px] bg-white focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15" placeholder="mínimo 6 caracteres" />
          {erro && <p className="mt-1.5 text-left text-[13.5px] font-semibold text-[#b42318]" role="alert">{erro}</p>}
          <button type="button" disabled={salvando} onClick={() => void criarSenha()} data-testid="appweb-senha-continuar"
            className="mt-4 w-full min-h-[56px] rounded-full bg-[#16121c] text-white text-[17px] font-extrabold disabled:opacity-70 inline-flex items-center justify-center gap-2">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continuar"}
          </button>
        </>
      )}

      {etapa === "lojas" && (
        <>
          <h1 className="text-[24px] font-extrabold tracking-tight">Baixe o CORE no seu celular</h1>
          <div className="flex justify-center gap-2.5 mt-5 flex-wrap">
            <a href={URL_APP_STORE} target="_blank" rel="noopener" data-loja="ios" data-testid="appweb-loja-ios" onClick={() => trackEvent("appweb_loja", { ...F, loja: "ios" })}>
              <img src="/selos/app-store.svg" alt="Baixar na App Store" width={144} height={48} className="h-12 w-auto" />
            </a>
            <a href={urlPlay("funil_app")} target="_blank" rel="noopener" data-loja="android" data-testid="appweb-loja-android" onClick={() => trackEvent("appweb_loja", { ...F, loja: "android" })}>
              <img src="/selos/google-play.png" alt="Disponível no Google Play" width={124} height={48} className="h-12 w-auto" />
            </a>
          </div>
          <div className="mt-6 rounded-2xl border-[1.5px] border-accent/30 bg-accent/5 px-4 py-3.5 text-[14px]" data-testid="appweb-entre-com-email">
            Entre com este e-mail:{email ? <b className="block text-[16px] text-foreground break-all mt-0.5">{email}</b> : " o da compra"}
            <span className="block mt-1.5 text-[12.5px] text-muted-foreground">No app, toque em “Já tenho conta? Entrar”.</span>
          </div>
          <button type="button" onClick={usarNoNavegador} data-testid="appweb-navegador"
            className="mt-6 w-full min-h-[52px] rounded-full border-[1.5px] border-black/15 text-[16px] font-bold">
            Usar no navegador agora
          </button>
          <p className="mt-4 text-[12.5px] text-muted-foreground">Dúvida? <a className="font-bold underline" href="mailto:contato@coreaplicativo.com.br">contato@coreaplicativo.com.br</a></p>
        </>
      )}
    </div>
  );
}
