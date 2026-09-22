/**
 * ENTRAR COM CÓDIGO POR E-MAIL — o caminho que não existia (15/09).
 *
 * Caso real de 15/09, 11:51: cliente pagou o mensal no iPhone, o cadastro
 * disse "esse e-mail já tem conta", ela não lembrava a senha, tocou em
 * recuperar (o link vai pro SITE), reabriu o app três vezes, tentou a Apple
 * (falhou) e desistiu — com a compra feita e sem acesso. Todo caminho de
 * volta dependia de senha ou de um provedor. Este não depende de nada:
 * a pessoa toca, recebe um código de 8 dígitos no e-mail (o mesmo e-mail
 * do "link de acesso" do Supabase, que agora traz o código junto), digita
 * aqui e a sessão entra na hora — no app, sem sair pro navegador.
 *
 * Só serve pra conta que EXISTE (`shouldCreateUser: false`): quem digita um
 * e-mail sem conta recebe o mesmo aviso, e o cadastro continua sendo o
 * caminho. Quem chama decide o que fazer com a sessão (`onSession`) — no
 * funil é seguir pro "Liberando", que liga a compra à conta.
 */
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

const TAMANHO = 8;

export function EntrarComCodigo({ email, funil, onSession, className = "", rotulo = "Entrar sem senha — receber código por e-mail" }: {
  email: string;
  /** Texto do botão (o checkout Pix já explica em cima e usa um curto). */
  rotulo?: string;
  funil: string;
  onSession: () => void;
  className?: string;
}) {
  const [fase, setFase] = useState<"botao" | "enviando" | "codigo" | "conferindo">("botao");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const alvo = email.trim().toLowerCase();
  const emailOk = /\S+@\S+\.\S+/.test(alvo);

  const enviar = async () => {
    if (!emailOk) { setErro("Confere o e-mail ali em cima antes."); return; }
    setErro(null); setFase("enviando");
    trackEvent("funnel_click", { cta: "codigo_email_enviar", funil });
    const { error } = await supabase.auth.signInWithOtp({ email: alvo, options: { shouldCreateUser: false } });
    if (error) {
      trackEvent("funnel_error", { where: "codigo_email_enviar", funil, message: (error.message || "").slice(0, 200) });
      setErro(/rate|limit|security purposes/i.test(error.message || "")
        ? "Já mandei um código há pouco. Confere a caixa de entrada e o spam."
        : /signups not allowed|not found/i.test(error.message || "")
          ? "Não achei conta com esse e-mail. Confere se é o mesmo do cadastro."
          : "Não consegui mandar o código. Tenta de novo em alguns segundos.");
      setFase("botao");
      return;
    }
    setFase("codigo");
  };

  const conferir = async () => {
    const t = codigo.replace(/\D/g, "");
    if (t.length !== TAMANHO) { setErro(`O código tem ${TAMANHO} números.`); return; }
    setErro(null); setFase("conferindo");
    const { error } = await supabase.auth.verifyOtp({ email: alvo, token: t, type: "email" });
    if (error) {
      trackEvent("funnel_error", { where: "codigo_email_conferir", funil, message: (error.message || "").slice(0, 200) });
      setErro(/expired/i.test(error.message || "") ? "Esse código venceu. Pede outro." : "Código não bateu. Confere os 8 números do e-mail.");
      setFase("codigo");
      return;
    }
    trackEvent("funnel_click", { cta: "signup_success", via: "codigo_email", funil });
    onSession();
  };

  if (fase === "botao" || fase === "enviando") {
    return (
      <div className={`text-center ${className}`}>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={fase === "enviando"}
          className="w-full h-12 rounded-xl border-2 border-foreground text-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          data-testid="entrar-com-codigo"
        >
          {fase === "enviando" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MailCheck className="w-4 h-4" /> {rotulo}</>}
        </button>
        {erro && <p className="text-[12.5px] text-destructive mt-2" role="alert">{erro}</p>}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-card p-3 text-left ${className}`} data-testid="codigo-email">
      <p className="text-[13px] font-semibold">Mandei um código de {TAMANHO} números pra <span className="break-all">{alvo}</span>.</p>
      <p className="text-[12px] text-muted-foreground mt-0.5 mb-2.5">Vale por 1 hora. Se não chegar em 1 minuto, olha o spam.</p>
      <div className="flex gap-2">
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, "").slice(0, TAMANHO)); setErro(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") void conferir(); }}
          placeholder="00000000"
          aria-label="Código do e-mail"
          className="flex-1 min-w-0 h-12 rounded-xl border border-border bg-background px-3 text-lg font-bold tracking-[0.3em] outline-none focus:ring-2 focus:ring-foreground/20"
        />
        <button
          type="button"
          onClick={() => void conferir()}
          disabled={fase === "conferindo" || codigo.length !== TAMANHO}
          className="h-12 px-4 rounded-xl bg-foreground text-background text-sm font-bold disabled:opacity-50 shrink-0"
        >
          {fase === "conferindo" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
        </button>
      </div>
      {erro && <p className="text-[12.5px] text-destructive mt-2" role="alert">{erro}</p>}
      <button type="button" onClick={() => { setCodigo(""); setErro(null); setFase("botao"); }} className="text-[12px] text-muted-foreground underline underline-offset-2 mt-2">
        Mandar outro código
      </button>
    </div>
  );
}
