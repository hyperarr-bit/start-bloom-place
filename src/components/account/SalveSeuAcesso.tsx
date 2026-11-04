/**
 * "SALVE SEU ACESSO" (29/10) — a folha obrigatória de quem PAGOU numa conta anônima e ainda não tem e-mail.
 *
 * Caso real (lp-analise/pix, 29/10): o pagante #10 pagou R$ 27,90 na landing (/organizar) pelo navegador do Instagram,
 * não deixou e-mail e ficou com o acesso só no token daquele navegador — sem "esqueci a senha", sem outro aparelho, sem
 * como avisarmos. Quem paga no /hoje ou na landing e pula o e-mail cai no app assim. Esta folha aparece por cima do app
 * até o e-mail entrar:
 *   · e-mail livre        → entra na MESMA conta (updateUser; autoconfirm — lib/sessao-anonima) → a folha some;
 *   · e-mail que tem conta → explica; manda o código do e-mail → entra na conta e o pix-vincular TRANSFERE a compra
 *                            (a sessão anônima fica guardada antes da troca) — ou "Falar com o suporte" (contato@).
 *                            Nunca 2ª conta e nunca liberar_vitalicio (memória cliente_pagou_ficou_fora).
 * Só aparece com TUDO isto: sessão anônima (is_anonymous) + sem e-mail + assinatura ativa (já lida) + site (nunca no app
 * da loja — lá não existe sessão anônima: o signInAnonymously só roda nos funis da web, que o SoNaWeb tira do app) +
 * fora de iframe (a demo da landing). Fechar e reabrir: enquanto a conta não tiver e-mail, volta; com e-mail, nunca mais.
 */
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";

export const EMAIL_SALVE_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** As condições da folha (puras — o teste cobre cada uma). */
export function deveMostrarSalveAcesso(a: {
  user: Pick<User, "email" | "is_anonymous"> | null;
  isSubscribed: boolean;
  subLoaded: boolean;
  nativo: boolean;
  emIframe: boolean;
}): boolean {
  if (!a.user || a.nativo || a.emIframe) return false;
  if (a.user.email) return false;
  if (a.user.is_anonymous !== true) return false;
  return a.subLoaded && a.isSubscribed;
}

const emIframe = (): boolean => { try { return window.self !== window.top; } catch { return true; } };

type Fase = "email" | "salvando" | "codigo" | "entrando" | "aviso";
let vistoNestaCarga = false;

export default function SalveSeuAcesso() {
  const { user, isSubscribed, subLoaded } = useAuth();
  const [fase, setFase] = useState<Fase>("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);

  const mostrar = deveMostrarSalveAcesso({ user, isSubscribed, subLoaded, nativo: isNativeShell(), emIframe: emIframe() });

  useEffect(() => {
    if (!mostrar || vistoNestaCarga) return;
    vistoNestaCarga = true;
    trackEvent("salve_acesso_visto", {});
  }, [mostrar]);

  if (!mostrar && fase !== "aviso") return null;

  const limpo = email.trim().toLowerCase();

  async function salvar() {
    if (!EMAIL_SALVE_OK.test(limpo)) { setErro("Esse e-mail parece errado. Confere?"); trackEvent("salve_acesso_erro", { motivo: "invalido" }); return; }
    setErro(null); setFase("salvando");
    try {
      const m = await import("@/pages/hoje/conta");
      const r = await m.salvarEmailDaCompra(limpo);
      if (r.ok === true) {
        trackEvent("salve_acesso_ok", { via: "nova" });
        await supabase.auth.refreshSession().catch(() => null); // o AuthProvider relê o usuário (agora com e-mail) → a folha some
        return;
      }
      if ("existe" in r) {
        // e-mail com conta: a anônima já ficou guardada (salvarEmailDaCompra) → código → pix-vincular
        trackEvent("salve_acesso_erro", { motivo: "tem_conta" });
        const { error } = await supabase.auth.signInWithOtp({ email: limpo, options: { shouldCreateUser: false } });
        setFase("codigo");
        if (error) setErro("Não consegui mandar o código agora. Toque em “Mandar de novo”.");
        return;
      }
      trackEvent("salve_acesso_erro", { motivo: "falhou" });
      setErro(r.erro); setFase("email");
    } catch {
      trackEvent("salve_acesso_erro", { motivo: "falhou" });
      setErro("Não consegui salvar agora. Tenta de novo em alguns segundos."); setFase("email");
    }
  }

  async function entrar() {
    setErro(null); setFase("entrando");
    try {
      const { error } = await supabase.auth.verifyOtp({ email: limpo, token: codigo.trim(), type: "email" });
      if (error) { setErro("Código errado ou vencido. Confere no seu e-mail."); setFase("codigo"); trackEvent("salve_acesso_erro", { motivo: "codigo_errado" }); return; }
      const m = await import("@/pages/hoje/conta");
      const t = await m.trazerCompraParaConta();
      trackEvent("salve_acesso_ok", { via: "codigo", compra: t });
      if (t === "movida") return; // a conta tem e-mail e a compra → a folha some
      setAviso(t === "nao_moveu"
        ? "Sua conta já tinha o CORE ativo, então a compra de agora ficou guardada à parte. Fale com a gente em contato@coreaplicativo.com.br pra devolvermos o valor."
        : "Você entrou na sua conta. Se o CORE não aparecer liberado, fale com a gente em contato@coreaplicativo.com.br que a gente junta a compra.");
      setFase("aviso");
    } catch {
      setErro("Não consegui entrar agora. Tenta de novo em alguns segundos."); setFase("codigo");
    }
  }

  async function reenviar() {
    setErro(null);
    const { error } = await supabase.auth.signInWithOtp({ email: limpo, options: { shouldCreateUser: false } });
    if (error) setErro("Não consegui mandar o código agora. Tenta de novo em alguns segundos.");
  }

  const suporte = `mailto:contato@coreaplicativo.com.br?subject=${encodeURIComponent("Juntar minha compra do CORE")}&body=${encodeURIComponent(
    `Oi! Paguei o CORE e quero que a compra vá pra minha conta ${limpo || "(meu e-mail)"}.\n\nCódigo da compra: ${user?.id ?? ""}`,
  )}`;

  const ocupado = fase === "salvando" || fase === "entrando";
  return (
    <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/50 sm:items-center" data-testid="salve-acesso">
      <div role="dialog" aria-modal="true" aria-labelledby="salve-acesso-titulo"
        className="w-full max-w-md rounded-t-3xl bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 text-foreground shadow-2xl sm:rounded-3xl">
        {fase === "aviso" ? (
          <>
            <h2 id="salve-acesso-titulo" className="text-[22px] font-extrabold tracking-tight">Pronto, você entrou</h2>
            <p className="mt-2 text-[15px] leading-snug text-muted-foreground">{aviso}</p>
            <button type="button" className="mt-5 h-14 w-full rounded-2xl bg-foreground text-[16px] font-bold text-background" onClick={() => { setFase("email"); setAviso(null); }}>
              Entendi
            </button>
          </>
        ) : fase === "codigo" || fase === "entrando" ? (
          <>
            <h2 id="salve-acesso-titulo" className="text-[22px] font-extrabold tracking-tight">Esse e-mail já tem conta</h2>
            <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
              Mandamos um código pra <b className="text-foreground">{limpo}</b>. Entre com ele e a sua compra vai junto pra essa conta.
            </p>
            <label htmlFor="salve-acesso-codigo" className="mt-5 block text-[13px] font-semibold text-muted-foreground">Código de 8 números</label>
            <input id="salve-acesso-codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="00000000" value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 8))}
              onKeyDown={(e) => { if (e.key === "Enter" && codigo.length >= 8 && !ocupado) void entrar(); }}
              className="mt-2 h-14 w-full rounded-xl border-[1.5px] border-border bg-background px-4 text-[18px] tracking-[0.3em] outline-none focus:border-primary" />
            {erro && <p role="alert" className="mt-2 text-[13.5px] font-semibold text-destructive">{erro}</p>}
            <button type="button" disabled={codigo.length < 8 || ocupado} onClick={() => void entrar()}
              className="mt-4 h-14 w-full rounded-2xl bg-foreground text-[16px] font-bold text-background disabled:opacity-45">
              {fase === "entrando" ? "Entrando…" : "Entrar e juntar minha compra"}
            </button>
            <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13.5px] font-semibold text-muted-foreground">
              <button type="button" className="underline underline-offset-4" onClick={() => void reenviar()}>Mandar de novo</button>
              <button type="button" className="underline underline-offset-4" onClick={() => { setFase("email"); setCodigo(""); setErro(null); setTimeout(() => campo.current?.focus(), 0); }}>Usar outro e-mail</button>
              <a className="underline underline-offset-4" href={suporte} onClick={() => trackEvent("salve_acesso_suporte", {})}>Falar com o suporte</a>
            </div>
          </>
        ) : (
          <>
            <h2 id="salve-acesso-titulo" className="text-[22px] font-extrabold tracking-tight">Salve seu acesso</h2>
            <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
              Seu CORE está pago. Coloque seu e-mail pra entrar em qualquer aparelho — sem ele, o acesso fica só neste navegador.
            </p>
            <label htmlFor="salve-acesso-email" className="mt-5 block text-[13px] font-semibold text-muted-foreground">Seu e-mail</label>
            <input id="salve-acesso-email" ref={campo} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              placeholder="voce@email.com" value={email} onChange={(e) => { setEmail(e.target.value); setErro(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !ocupado) void salvar(); }}
              className="mt-2 h-14 w-full rounded-xl border-[1.5px] border-border bg-background px-4 text-[17px] outline-none focus:border-primary" />
            {erro && <p role="alert" className="mt-2 text-[13.5px] font-semibold text-destructive">{erro}</p>}
            <button type="button" disabled={!EMAIL_SALVE_OK.test(limpo) || ocupado} onClick={() => void salvar()}
              className="mt-4 h-14 w-full rounded-2xl bg-foreground text-[16px] font-bold text-background disabled:opacity-45">
              {fase === "salvando" ? "Salvando…" : "Salvar meu acesso"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
