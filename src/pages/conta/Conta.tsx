/**
 * /conta/senha e /conta/email (29/10) — criar/trocar a senha e trocar o e-mail ESTANDO LOGADA, sem suporte manual.
 * O miolo (validação, Supabase, erros) é lib/conta-acesso; aqui só as telas. Abrem pelo "Minha conta" (AccountDrawer),
 * na Home nova (aba Você) e na clássica (menu do avatar) — por isso as rotas moram fora do /voce (que só existe com abas).
 *
 * TECLADO DO iPHONE: as telas são página cheia, os campos e o botão ficam no ALTO, um embaixo do outro, sem nada fixo
 * no rodapé — com o teclado aberto (área visível ~508 px no 390×844, ~331 px no SE) o botão continua acima dele; e o
 * "Enter" do teclado também envia. Nada aqui reage a resize/scroll (o loop do post-it de 20/10 vinha disso).
 */
import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Eye, EyeOff, MailCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useHomeNova } from "@/hooks/use-home-nova";
import { SUAVIDADE_HOME_NOVA } from "@/lib/home-nova";
import { useFundoDaTelaE } from "@/components/home-nova/e/fundo-da-tela";
import { TRACO } from "@/components/home-nova/e/paleta";
import { voltar } from "@/lib/navegacao-ios";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { supabase } from "@/integrations/supabase/client";
import {
  SENHA_MINIMA, EMAIL_VALIDO, avisarEmailAntigo, comoEntra, limparEmail, linkDoSuporte, pedirCodigoDeSeguranca,
  podeGerenciarConta, salvarSenha, trocarEmail,
} from "@/lib/conta-acesso";
import "@/components/home-nova/home-nova.css";
import "@/components/home-nova/e/home-e.css";

/* ───────────── a moldura: E (Home nova) ou clássica, como a /voce/aparencia ───────────── */

function Moldura({ titulo, testid, children }: { titulo: string; testid: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const nova = useHomeNova(user).ligada;
  useFundoDaTelaE(nova);
  // quem chegou pelo menu volta pra onde estava; aba nova/link direto cai na Você (abas) ou na Home
  const sair = () => voltar(navigate, nova ? "/voce" : "/home");
  if (nova) {
    return (
      <div className="hn he min-h-dvh" data-testid={testid} data-layout="e" data-suave={SUAVIDADE_HOME_NOVA}>
        <main className="max-w-lg mx-auto px-4 pt-2 pb-8">
          <header className="flex items-center gap-2.5 pt-1">
            <button type="button" onClick={sair} aria-label="Voltar" className="w-10 h-10 -ml-1 rounded-full grid place-items-center bg-card shrink-0" style={{ boxShadow: "var(--hn-sombra)" }}>
              <ArrowLeft className="w-5 h-5" strokeWidth={TRACO} />
            </button>
            <h1 className="text-[24px] leading-[1.15] font-bold tracking-[-0.025em] truncate">{titulo}</h1>
          </header>
          <section className="hn-card mt-5 p-4">{children}</section>
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-dvh bg-background flex flex-col" data-testid={testid}>
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-lg md:max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <button type="button" onClick={sair} aria-label="Voltar" className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">{titulo}</h1>
        </div>
      </header>
      <main className="flex-1 max-w-lg md:max-w-2xl mx-auto w-full px-4 pt-5 pb-8">{children}</main>
    </div>
  );
}

const CAMPO = "mt-1.5 h-14 w-full rounded-xl border-[1.5px] border-border bg-background px-4 text-[17px] text-foreground outline-none focus:border-primary";
const BOTAO = "mt-4 h-14 w-full rounded-2xl bg-foreground text-[16px] font-bold text-background disabled:opacity-45 active:opacity-90";
const ROTULO = "mt-4 first:mt-0 block text-[13px] font-semibold text-muted-foreground";

/**
 * Com o teclado aberto num celular baixo (SE: área visível ~331 px) o botão pode ficar logo abaixo da borda do teclado.
 * Ao focar um campo, UMA checagem 350 ms depois (o teclado já subiu): se o fundo do botão passou da área visível
 * (visualViewport), rola só o que falta. Sem ouvir resize/scroll — nada de laço (o post-it de 20/10).
 */
let checagemPendente: number | undefined;
export function mostrarBotaoAcimaDoTeclado(botao: HTMLElement | null, espera = 350): void {
  // vários focos seguidos (foco + focusin, trocar de campo) = uma checagem só, a do último
  window.clearTimeout(checagemPendente);
  checagemPendente = window.setTimeout(() => {
    if (!botao) return;
    const vv = window.visualViewport;
    const fundoVisivel = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const falta = botao.getBoundingClientRect().bottom + 12 - fundoVisivel;
    if (falta > 0) window.scrollBy({ top: falta, behavior: "smooth" });
  }, espera);
}

function Erro({ children, testid }: { children: ReactNode; testid?: string }) {
  return <p role="alert" data-testid={testid} className="mt-3 text-[13.5px] font-semibold leading-snug text-destructive">{children}</p>;
}

function Pronto({ titulo, children, onOk, testid }: { titulo: string; children: ReactNode; onOk: () => void; testid: string }) {
  return (
    <div data-testid={testid}>
      <span className="w-11 h-11 rounded-full grid place-items-center bg-primary/10 text-primary" aria-hidden><Check className="w-5 h-5" /></span>
      <h2 className="mt-3 text-[20px] font-bold tracking-tight">{titulo}</h2>
      <div className="mt-1.5 text-[15px] leading-snug text-muted-foreground space-y-2">{children}</div>
      <button type="button" className={BOTAO} onClick={onOk}>Ok</button>
    </div>
  );
}

/** Sem e-mail (conta anônima) → a tela não serve: manda pra Home (lá está a folha "Salve seu acesso"). */
function SoComEmail({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!podeGerenciarConta(user)) {
    return (
      <div className="px-4 pt-10 text-center" data-testid="conta-sem-email">
        <p className="text-[15px] text-muted-foreground">Salve seu e-mail primeiro pra poder criar senha ou trocar o e-mail.</p>
        <button type="button" className={BOTAO} onClick={() => navigate("/home", { replace: true })}>Voltar pro app</button>
      </div>
    );
  }
  return <>{children}</>;
}

/* ───────────── /conta/senha ───────────── */

export function TrocarSenha() {
  return <Moldura titulo="Senha" testid="tela-conta-senha"><SoComEmail><FormSenha /></SoComEmail></Moldura>;
}

function FormSenha() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const entra = comoEntra(user);
  const criando = !entra.senha;
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [ver, setVer] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [pedeCodigo, setPedeCodigo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const botao = useRef<HTMLButtonElement | null>(null);

  async function salvar() {
    if (ocupado) return;
    setErro(null); setOcupado(true);
    const r = await salvarSenha(senha, confirma, pedeCodigo ? codigo.trim() : undefined);
    setOcupado(false);
    if (!("erro" in r)) {
      trackEvent("conta_senha_ok", { criou: criando, codigo: pedeCodigo });
      setPronto(true);
      void supabase.auth.refreshSession().catch(() => null); // o user_metadata.tem_senha aparece no "Minha conta"
      return;
    }
    trackEvent("conta_senha_erro", { motivo: r.erro });
    if (r.erro === "reautenticar" && !pedeCodigo) {
      const mandou = await pedirCodigoDeSeguranca();
      setPedeCodigo(true);
      setErro(mandou ? null : "Não consegui mandar o código agora. Toque em “Mandar outro código”.");
      return;
    }
    setErro(r.mensagem);
  }

  if (pronto) {
    return (
      <Pronto titulo={criando ? "Senha criada" : "Senha trocada"} testid="conta-senha-pronto" onOk={() => voltar(navigate, "/home")}>
        <p>No computador, abra <b className="text-foreground">coreaplicativo.com.br/entrar</b> e entre com <b className="text-foreground break-all">{user?.email}</b> e essa senha.</p>
        {(entra.google || entra.apple) && <p>Entrar com {entra.google ? "o Google" : "a Apple"} continua funcionando.</p>}
      </Pronto>
    );
  }

  const enviar = (e: React.FormEvent) => { e.preventDefault(); void salvar(); };
  const podeEnviar = senha.length >= SENHA_MINIMA && confirma.length > 0 && (!pedeCodigo || codigo.trim().length >= 6);
  return (
    <form onSubmit={enviar} noValidate data-testid="conta-senha-form" onFocus={(e) => { if (e.target instanceof HTMLInputElement) mostrarBotaoAcimaDoTeclado(botao.current); }}>
      <p className="text-[15px] leading-snug text-muted-foreground" data-testid="conta-senha-intro">
        {criando
          ? `Você entra com ${entra.rotulo}. Crie uma senha pra entrar também com o e-mail — no computador, por exemplo.`
          : "Escolha a senha nova. Ela vale no app e no site."}
      </p>
      <input type="email" autoComplete="username" value={user?.email ?? ""} readOnly hidden aria-hidden />
      <label htmlFor="conta-senha-nova" className={`${ROTULO} mt-4`}>Senha nova</label>
      <div className="relative">
        <input id="conta-senha-nova" type={ver ? "text" : "password"} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          value={senha} onChange={(e) => { setSenha(e.target.value); setErro(null); }} placeholder={`Mínimo ${SENHA_MINIMA} caracteres`} className={`${CAMPO} pr-12`} />
        <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Esconder senha" : "Mostrar senha"}
          className="absolute right-1 top-[calc(50%+3px)] -translate-y-1/2 w-11 h-11 grid place-items-center text-muted-foreground">
          {ver ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      </div>
      <label htmlFor="conta-senha-confirma" className={ROTULO}>Repita a senha</label>
      <input id="conta-senha-confirma" type={ver ? "text" : "password"} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false}
        value={confirma} onChange={(e) => { setConfirma(e.target.value); setErro(null); }} className={CAMPO} enterKeyHint={pedeCodigo ? "next" : "done"} />
      {pedeCodigo && (
        <>
          <label htmlFor="conta-senha-codigo" className={ROTULO}>Código que mandamos pro seu e-mail</label>
          <input id="conta-senha-codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="000000" value={codigo}
            onChange={(e) => { setCodigo(e.target.value.replace(/\s/g, "")); setErro(null); }} className={`${CAMPO} tracking-[0.25em]`} data-testid="conta-senha-codigo" />
        </>
      )}
      {erro && <Erro testid="conta-senha-erro">{erro}</Erro>}
      <button ref={botao} type="submit" disabled={!podeEnviar || ocupado} className={BOTAO} data-testid="conta-senha-salvar">
        {ocupado ? "Salvando…" : criando ? "Criar senha" : "Salvar senha"}
      </button>
      {pedeCodigo && (
        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13.5px] font-semibold text-muted-foreground">
          <button type="button" className="underline underline-offset-4" onClick={() => { void pedirCodigoDeSeguranca().then((ok) => setErro(ok ? null : "Não consegui mandar o código agora. Tente em alguns minutos.")); }}>Mandar outro código</button>
          <a className="underline underline-offset-4" href={linkDoSuporte("Não recebo o código pra trocar a senha")}>Falar com o suporte</a>
        </div>
      )}
    </form>
  );
}

/* ───────────── /conta/email ───────────── */

export function TrocarEmail() {
  return <Moldura titulo="E-mail" testid="tela-conta-email"><SoComEmail><FormEmail /></SoComEmail></Moldura>;
}

function FormEmail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const atual = user?.email ?? "";
  const jaPendente = (user as { new_email?: string | null } | null)?.new_email ?? null;
  const [novo, setNovo] = useState("");
  const [confirma, setConfirma] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<{ texto: string; suporte: boolean } | null>(null);
  const [fim, setFim] = useState<null | { estado: "aplicado" | "pendente"; email: string }>(null);
  const [reenviado, setReenviado] = useState(false);
  // "usar outro e-mail" com uma troca pendente que veio do servidor (user.new_email): mostra o formulário de novo
  const [outro, setOutro] = useState(false);
  const botao = useRef<HTMLButtonElement | null>(null);

  async function pedir(emailNovo: string, emailConfirma: string) {
    if (ocupado) return;
    setErro(null); setOcupado(true);
    const r = await trocarEmail(emailNovo, emailConfirma, atual);
    setOcupado(false);
    if (!("erro" in r)) {
      trackEvent("conta_email_ok", { estado: r.estado, nativo: isNativeShell() });
      if (r.estado === "pendente") avisarEmailAntigo();
      setFim({ estado: r.estado, email: r.email });
      void supabase.auth.refreshSession().catch(() => null);
      return true;
    }
    trackEvent("conta_email_erro", { motivo: r.erro });
    setErro({ texto: r.mensagem, suporte: r.erro === "em_uso" });
    return false;
  }

  if (fim?.estado === "aplicado") {
    return (
      <Pronto titulo="E-mail trocado" testid="conta-email-aplicado" onOk={() => voltar(navigate, "/home")}>
        <p>Agora você entra com <b className="text-foreground break-all">{fim.email}</b>. Seu plano e seus dados continuam iguais.</p>
      </Pronto>
    );
  }

  const pendente = fim?.email ?? (outro ? null : jaPendente);
  if (pendente) {
    return (
      <div data-testid="conta-email-pendente">
        <span className="w-11 h-11 rounded-full grid place-items-center bg-primary/10 text-primary" aria-hidden><MailCheck className="w-5 h-5" /></span>
        <h2 className="mt-3 text-[20px] font-bold tracking-tight">Confirme no seu e-mail</h2>
        <div className="mt-1.5 text-[15px] leading-snug text-muted-foreground space-y-2">
          <p>Mandamos um link pra <b className="text-foreground break-all">{pendente}</b>. Toque nele pra concluir a troca.</p>
          <p>Se chegar um link também em <b className="text-foreground break-all">{atual}</b>, confirme os dois. Até lá, você entra com o e-mail de hoje.</p>
          <p>Não chegou? Olhe o spam ou mande de novo.</p>
        </div>
        {erro && <Erro testid="conta-email-erro">{erro.texto}</Erro>}
        {reenviado && !erro && <p className="mt-3 text-[13.5px] font-semibold text-foreground" role="status">Mandamos de novo.</p>}
        <button type="button" className={BOTAO} onClick={() => voltar(navigate, "/home")}>Ok</button>
        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13.5px] font-semibold text-muted-foreground">
          <button type="button" className="underline underline-offset-4" data-testid="conta-email-reenviar" disabled={ocupado}
            onClick={() => { setReenviado(false); void pedir(pendente, pendente).then((ok) => setReenviado(!!ok)); }}>Mandar de novo</button>
          <button type="button" className="underline underline-offset-4" onClick={() => { setFim(null); setNovo(""); setConfirma(""); setErro(null); setReenviado(false); setOutro(true); }}>Usar outro e-mail</button>
          <a className="underline underline-offset-4" href={linkDoSuporte("Não consigo trocar meu e-mail")}>Falar com o suporte</a>
        </div>
      </div>
    );
  }

  const enviar = (e: React.FormEvent) => { e.preventDefault(); void pedir(novo, confirma); };
  const valido = EMAIL_VALIDO.test(limparEmail(novo)) && confirma.trim().length > 0;
  return (
    <form onSubmit={enviar} noValidate data-testid="conta-email-form" onFocus={(e) => { if (e.target instanceof HTMLInputElement) mostrarBotaoAcimaDoTeclado(botao.current); }}>
      <p className="text-[15px] leading-snug text-muted-foreground">
        Hoje você entra com <b className="text-foreground break-all">{atual}</b>.
      </p>
      <label htmlFor="conta-email-novo" className={`${ROTULO} mt-4`}>E-mail novo</label>
      <input id="conta-email-novo" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
        placeholder="voce@email.com" value={novo} onChange={(e) => { setNovo(e.target.value); setErro(null); }} className={CAMPO} />
      <label htmlFor="conta-email-confirma" className={ROTULO}>Repita o e-mail novo</label>
      <input id="conta-email-confirma" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
        value={confirma} onChange={(e) => { setConfirma(e.target.value); setErro(null); }} className={CAMPO} enterKeyHint="done" />
      {erro && (
        <Erro testid="conta-email-erro">
          {erro.texto}{" "}
          {erro.suporte && <a className="underline underline-offset-4" href={linkDoSuporte("E-mail já está em outra conta")} data-testid="conta-email-suporte">Falar com o suporte</a>}
        </Erro>
      )}
      <button ref={botao} type="submit" disabled={!valido || ocupado} className={BOTAO} data-testid="conta-email-salvar">
        {ocupado ? "Enviando…" : "Trocar e-mail"}
      </button>
      <p className="mt-3 text-[12.5px] leading-snug text-muted-foreground text-center">Seu plano e seus dados continuam iguais. Vamos mandar um link pra confirmar.</p>
    </form>
  );
}
