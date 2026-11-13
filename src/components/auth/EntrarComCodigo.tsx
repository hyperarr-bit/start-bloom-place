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
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { linkDoSuporte } from "@/lib/conta-acesso";

const TAMANHO = 8;
/** Intervalo do Supabase entre dois códigos pro mesmo e-mail; quando ele responde com outro número, vale o dele. */
const ESPERA_REENVIO_S = 60;

const relogio = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function EntrarComCodigo({ email, funil, onSession, className = "", rotulo = "Entrar sem senha — receber código por e-mail", cheio = false, guiado = false, enviarAoAbrir = false, aviso, children }: {
  email: string;
  /** Botão cheio (quando o código é o caminho principal da tela, ex.: o "Planejar meu 2027"). */
  cheio?: boolean;
  /** Texto do botão (o checkout Pix já explica em cima e usa um curto). */
  rotulo?: string;
  funil: string;
  onSession: () => void;
  className?: string;
  /** Tela nova do /entrar (chave ENTRAR_CODIGO): contagem pra reenviar, código vencido com reenviar e e-mail sem conta
   *  com caminho pro suporte. Sem esta prop o componente segue igual — ele também mora no funil e no checkout. */
  guiado?: boolean;
  /** Só com `guiado`: pede o código sozinho ao montar (quem tentou criar conta com e-mail que já existe). */
  enviarAoAbrir?: boolean;
  /** Só com `guiado`: frase acima de "Mandei um código". */
  aviso?: string;
  /** Só com `guiado`: o campo de e-mail, acima do botão. Com ele, o cartão do código ganha "Trocar e-mail". */
  children?: ReactNode;
}) {
  const [fase, setFase] = useState<"botao" | "enviando" | "codigo" | "conferindo">("botao");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const alvo = email.trim().toLowerCase();
  const emailOk = /\S+@\S+\.\S+/.test(alvo);
  /* Só o modo guiado usa daqui até `enviarGuiado`. O prazo é um horário, não um contador: no app o relógio do JS para
   * enquanto a pessoa está no e-mail, e a contagem tem que estar certa na volta. */
  const [reenvioEm, setReenvioEm] = useState(0);
  const [faltam, setFaltam] = useState(0);
  const [reenviando, setReenviando] = useState(false);
  const [semConta, setSemConta] = useState(false);
  const [vencido, setVencido] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const pediuAoAbrir = useRef(false);

  useEffect(() => {
    if (!reenvioEm) return;
    const atualizar = () => setFaltam(Math.max(0, Math.ceil((reenvioEm - Date.now()) / 1000)));
    atualizar();
    const t = setInterval(atualizar, 1000);
    return () => clearInterval(t);
  }, [reenvioEm]);

  useEffect(() => { setSemConta(false); }, [alvo]);

  const enviarGuiado = async () => {
    if (!emailOk) { setErro("Confere o e-mail ali em cima antes."); return; }
    const reenvio = fase === "codigo";
    setErro(null); setInfo(null); setSemConta(false); setVencido(false);
    if (reenvio) setReenviando(true); else setFase("enviando");
    trackEvent("funnel_click", { cta: reenvio ? "codigo_email_reenviar" : "codigo_email_enviar", funil });
    const { error } = await supabase.auth.signInWithOtp({ email: alvo, options: { shouldCreateUser: false } });
    setReenviando(false);
    if (!error) {
      setCodigo("");
      setReenvioEm(Date.now() + ESPERA_REENVIO_S * 1000);
      if (reenvio) setInfo("Mandei outro código. Só ele vale agora.");
      setFase("codigo");
      return;
    }
    const msg = error.message || "";
    trackEvent("funnel_error", { where: "codigo_email_enviar", funil, message: msg.slice(0, 200) });
    /* "For security purposes, you can only request this after N seconds": esse e-mail recebeu um código há pouco.
     * Não é erro pra pessoa: abre o campo do código, que é o que ela precisa, com a contagem que o servidor deu. */
    const seguranca = msg.match(/security purposes.*?(\d+)\s*second/i);
    if (seguranca || /security purposes/i.test(msg)) {
      setReenvioEm(Date.now() + (seguranca ? Number(seguranca[1]) : ESPERA_REENVIO_S) * 1000);
      setInfo("Já mandei um código há pouco. Confere a caixa de entrada e o spam.");
      setFase("codigo");
      return;
    }
    if (/signups not allowed|not found/i.test(msg)) { setSemConta(true); setFase("botao"); return; }
    setErro(/rate|limit/i.test(msg) ? "Muitos pedidos agora. Tenta de novo em 1 minuto." : "Não consegui mandar o código. Tenta de novo em alguns segundos.");
    setFase(reenvio ? "codigo" : "botao");
  };

  useEffect(() => {
    if (!guiado || !enviarAoAbrir || pediuAoAbrir.current) return;
    pediuAoAbrir.current = true; // o StrictMode monta duas vezes: dois pedidos cairiam no limite de envio
    void enviarGuiado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setErro(null); setInfo(null); setVencido(false); setFase("conferindo");
    const { error } = await supabase.auth.verifyOtp({ email: alvo, token: t, type: "email" });
    if (error) {
      trackEvent("funnel_error", { where: "codigo_email_conferir", funil, message: (error.message || "").slice(0, 200) });
      /* O Supabase responde "Token has expired or is invalid" tanto pro vencido quanto pro número errado — e pedir de
       * novo invalida o anterior. O aviso diz os dois casos porque daqui não dá pra saber qual foi. */
      if (guiado && /expired|invalid/i.test(error.message || "")) { setVencido(true); setFase("codigo"); return; }
      setErro(/expired/i.test(error.message || "") ? "Esse código venceu. Pede outro." : "Código não bateu. Confere os 8 números do e-mail.");
      setFase("codigo");
      return;
    }
    trackEvent("funnel_click", { cta: "signup_success", via: "codigo_email", funil });
    onSession();
  };

  if (guiado && (fase === "botao" || fase === "enviando")) {
    return (
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (fase === "botao") void enviarGuiado(); }} className={`space-y-3 ${className}`}>
        {children}
        {semConta && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3" role="alert" data-testid="email-sem-conta">
            <p className="text-sm font-semibold text-foreground">Não achei esse e-mail. A compra foi com outro?</p>
            <a href={linkDoSuporte("Não consigo entrar no CORE")} onClick={() => trackEvent("funnel_click", { cta: "codigo_email_suporte", funil })} className="inline-block mt-1 text-[13px] font-semibold text-foreground underline underline-offset-2" data-testid="email-sem-conta-suporte">
              Falar com o suporte
            </a>
          </div>
        )}
        {erro && <p className="text-[12.5px] text-destructive" role="alert">{erro}</p>}
        <button
          type="submit"
          disabled={fase === "enviando"}
          className="w-full h-12 rounded-xl bg-foreground text-background text-base font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          data-testid="entrar-com-codigo"
        >
          {fase === "enviando" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MailCheck className="w-4 h-4" /> {rotulo}</>}
        </button>
      </form>
    );
  }

  if (guiado) {
    const podeReenviar = faltam === 0 && !reenviando;
    return (
      <div className={`rounded-xl border border-border bg-card p-3 text-left ${className}`} data-testid="codigo-email">
        {aviso && <p className="text-[13px] font-semibold mb-1" data-testid="codigo-aviso">{aviso}</p>}
        <p className="text-[13px] font-semibold">Mandei um código de {TAMANHO} números pra <span className="block [overflow-wrap:anywhere]">{alvo}</span></p>
        <p className="text-[12px] text-muted-foreground mt-0.5 mb-2.5">Vale por 1 hora. Se não chegar em 1 minuto, olha o spam.</p>
        <div className="flex gap-2">
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, "").slice(0, TAMANHO)); setErro(null); setVencido(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") void conferir(); }}
            placeholder="00000000"
            aria-label="Código do e-mail"
            className="flex-1 min-w-0 h-12 rounded-xl border border-border bg-background px-3 text-lg font-bold tracking-[0.2em] outline-none focus:ring-2 focus:ring-foreground/20"
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
        {info && <p className="text-[12.5px] text-muted-foreground mt-2" role="status" data-testid="codigo-info">{info}</p>}
        {erro && <p className="text-[12.5px] text-destructive mt-2" role="alert">{erro}</p>}
        {vencido && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-2.5 mt-2.5" role="alert" data-testid="codigo-vencido">
            <p className="text-[13px] font-semibold text-foreground">Esse código venceu ou não bateu.</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Só o último e-mail vale.</p>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 mt-2.5">
          <button
            type="button"
            onClick={() => void enviarGuiado()}
            disabled={!podeReenviar}
            data-testid="codigo-reenviar"
            className={vencido && podeReenviar
              ? "h-10 px-4 rounded-xl bg-foreground text-background text-[13px] font-bold"
              : "text-[12.5px] underline underline-offset-2 disabled:no-underline text-muted-foreground"}
          >
            {reenviando ? <Loader2 className="w-4 h-4 animate-spin" /> : faltam > 0 ? `Mandar outro código em ${relogio(faltam)}` : "Mandar outro código"}
          </button>
          {children && (
            <button type="button" onClick={() => { setCodigo(""); setErro(null); setInfo(null); setVencido(false); setFase("botao"); }} className="text-[12.5px] text-muted-foreground underline underline-offset-2 shrink-0" data-testid="codigo-trocar-email">
              Trocar e-mail
            </button>
          )}
        </div>
      </div>
    );
  }

  if (fase === "botao" || fase === "enviando") {
    return (
      <div className={`text-center ${className}`}>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={fase === "enviando"}
          className={`w-full h-12 rounded-xl border-2 border-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 ${cheio ? "bg-foreground text-background" : "text-foreground"}`}
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
