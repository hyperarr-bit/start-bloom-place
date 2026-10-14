import { useRef, useState } from "react";
import { Eye, EyeOff, Loader2, MoreHorizontal } from "lucide-react";
import { BotaoCard, TituloCard } from "./telas";

/**
 * PASSO 5 DA PORTA — a CONTA, dentro do card (v5, 12/10, desenho da Dinzo: "Pronto! Agora crie sua conta").
 *
 *   · "Pronto! Seu plano de 3 dias está montado." + "Agora crie sua conta pra abrir no app.";
 *   · iPhone: "3 dias grátis no app · nada cobrado hoje" (o teste de 3 dias só existe no iPhone). NUNCA
 *     "sem cartão": a Apple pede forma de pagamento pro teste. Android/computador: sem promessa de teste;
 *   · [Continuar com a Apple] 1º, preto, com "1 toque, sem senha" — não aparece no Android (o app Android não
 *     entra com a Apple, a conta ficaria sem porta de entrada);
 *   · [Continuar com o Google] — no navegador do Instagram/Facebook o toque NÃO tenta o OAuth (403
 *     disallowed_useragent): abre o aviso "⋯ → Abrir no navegador" (o pai põe as respostas na URL);
 *   · "ou com e-mail": e-mail + senha (mín. 6) → [Criar conta], SEMPRE ativo: tocou com dado faltando, não
 *     envia, diz embaixo do campo o que falta e foca o campo (evento porta_conta_erro). E-mail que já tem conta:
 *     tenta a mesma senha; se não der, pede a senha dela. Nunca cria 2ª conta;
 *   · já logado neste navegador: "Continuar com esta conta" ou "Usar outro e-mail".
 */
export const SENHA_MIN = 6;
const emailValido = (e: string) => /^\S+@\S+\.\S{2,}$/.test(e.trim());

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.6 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5c-.5.4 6.9-5 6.9-15.1 0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);
/* Glifo oficial da Apple (diretriz de marca: botão preto, logo à esquerda) */
export const AppleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);


export type Resultado = { ok: boolean; erro?: string; existe?: boolean };

const CAMPO = "w-full h-[52px] rounded-[12px] border bg-white px-4 text-[16px] text-[#16121c] outline-none focus:border-[#16121c] placeholder:text-[#a9a3af]";

function CampoSenha({ valor, onMudar, onEnter, testid, placeholder, autoComplete = "new-password", inputRef, erroId }: {
  valor: string; onMudar: (v: string) => void; onEnter: () => void; testid: string; placeholder: string; autoComplete?: string;
  inputRef?: React.Ref<HTMLInputElement>; erroId?: string;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <input
        id={testid}
        ref={inputRef}
        aria-invalid={erroId ? true : undefined}
        aria-describedby={erroId}
        aria-label={placeholder}
        type={ver ? "text" : "password"}
        autoComplete={autoComplete}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }}
        placeholder={placeholder}
        data-testid={testid}
        className={`${CAMPO} pr-12 ${erroId ? "border-[#e5484d]" : "border-[#e3e0e6]"}`}
      />
      <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Esconder senha" : "Mostrar senha"} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#8a8490]">
        {ver ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}

/** v5: o título, o texto e a linha do teste da conta. A promessa do teste SÓ no iPhone. Nunca "sem cartão". */
export const TITULO_CONTA = "Pronto! Seu plano de 3 dias está montado.";
export const TEXTO_CONTA = "Agora crie sua conta pra abrir no app.";
export const LINHA_TESTE = "3 dias grátis no app · nada cobrado hoje";
export const LEGENDA_APPLE = "1 toque, sem senha";

/** As mensagens de campo do "Criar conta" (o botão nunca fica cinza). */
export const ERRO_CAMPO = {
  email_vazio: "Digite seu e-mail",
  email_invalido: "E-mail inválido",
  senha: "A senha precisa de 6 letras ou números",
} as const;
export type CampoConta = "email" | "senha";
type ErrosCampo = Partial<Record<CampoConta, string>>;
type Falta = { campo: CampoConta; motivo: "vazio" | "invalido" | "curta"; msg: string };

/** Puro: o que falta pra criar a conta (vazio = pode enviar). Ordem = ordem dos campos na tela. */
export function validarConta(email: string, senha: string): Falta[] {
  const out: Falta[] = [];
  const e = email.trim();
  if (!e) out.push({ campo: "email", motivo: "vazio", msg: ERRO_CAMPO.email_vazio });
  else if (!emailValido(e)) out.push({ campo: "email", motivo: "invalido", msg: ERRO_CAMPO.email_invalido });
  if (senha.length < SENHA_MIN) out.push({ campo: "senha", motivo: senha.length ? "curta" : "vazio", msg: ERRO_CAMPO.senha });
  return out;
}

/* 12/10 (dono): sai a linha "3 dias grátis no app · nada cobrado hoje" desta tela — o teste é apresentado no app
 * ("Você ganhou 3 dias grátis") e no sucesso. `mostrarTeste` fica na assinatura pra não mexer em quem chama. */
/* 14/10: o funil-demo (/experimente) usa a MESMA conta com outro título/texto (`titulo`/`texto`); sem eles, os da Porta. */
function TopoDaConta({ titulo = TITULO_CONTA, texto = TEXTO_CONTA }: { mostrarTeste: boolean; titulo?: string; texto?: string }) {
  return (
    <>
      <TituloCard testid="porta-conta-titulo">{titulo}</TituloCard>
      <p className="mt-1.5 text-[15px] leading-snug text-[#6b6670]" data-testid="porta-conta-texto">{texto}</p>
    </>
  );
}

const ErroDoCampo = ({ id, msg }: { id: string; msg?: string }) =>
  msg ? <p id={id} className="text-[13px] font-semibold text-[#b42318] mt-1 ml-1" role="alert" data-testid={id}>{msg}</p> : null;

const Termos = () => (
  <p className="text-[12px] text-[#8a8490] mt-3.5 leading-snug text-center" data-testid="porta-termos">
    Ao continuar, você aceita os <a href="/termos" className="underline underline-offset-2">Termos de Uso</a> e a <a href="/privacidade" className="underline underline-offset-2">Política de Privacidade</a>.
  </p>
);

export function ContaPorta({ mostrarTeste, emInApp, appDoWebview, mostrarApple, emailLogado, onApple, onGoogle, onGoogleBloqueado, onCriarConta, onEntrarComSenha, onSalvarNestaConta, onTrocarConta, onErroCampo, titulo, texto }: {
  /** iPhone: "3 dias grátis no app · nada cobrado hoje" */
  mostrarTeste: boolean;
  /** 14/10 (funil-demo): título e texto do topo da conta. Sem eles, os da Porta (TITULO_CONTA / TEXTO_CONTA). */
  titulo?: string;
  texto?: string;
  emInApp: boolean;
  /** "Instagram" | "Facebook" — o nome no aviso do Google */
  appDoWebview: string;
  mostrarApple: boolean;
  emailLogado: string | null;
  onApple: () => Promise<Resultado>;
  onGoogle: () => Promise<Resultado>;
  onGoogleBloqueado: () => void;
  onCriarConta: (email: string, senha: string) => Promise<Resultado>;
  onEntrarComSenha: (email: string, senha: string) => Promise<Resultado>;
  onSalvarNestaConta: () => Promise<Resultado>;
  onTrocarConta: () => Promise<void>;
  /** tocou em "Criar conta" com campo faltando (o pai manda o porta_conta_erro) */
  onErroCampo?: (campo: CampoConta, motivo: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [errosCampo, setErrosCampo] = useState<ErrosCampo>({});
  const emailRef = useRef<HTMLInputElement | null>(null);
  const senhaRef = useRef<HTMLInputElement | null>(null);
  const [senha, setSenha] = useState("");
  const [fase, setFase] = useState<"form" | "existe">("form");
  const [avisoGoogle, setAvisoGoogle] = useState(false);
  const [ocupado, setOcupado] = useState<null | "apple" | "google" | "criar" | "entrar" | "salvar">(null);
  const [erro, setErro] = useState<string | null>(null);
  const alvo = email.trim().toLowerCase();
  const girando = <Loader2 className="w-5 h-5 animate-spin" />;

  const rodar = async (qual: NonNullable<typeof ocupado>, f: () => Promise<Resultado>) => {
    if (ocupado) return;
    setErro(null);
    setOcupado(qual);
    const r = await f();
    setOcupado(null);
    if (r.existe) { setFase("existe"); setSenha(""); setErro(null); return; }
    if (!r.ok) setErro(r.erro ?? "Algo falhou. Tenta de novo.");
  };

  if (emailLogado) {
    return (
      <div className="mt-6" data-testid="porta-conta" data-fase="logado">
        <TopoDaConta mostrarTeste={mostrarTeste} titulo={titulo} texto={texto} />
        <div className="mt-4 rounded-[12px] border border-[#e3e0e6] bg-[#faf9fb] px-4 py-3">
          <p className="text-[12.5px] text-[#6b6670]">Você já entrou neste aparelho</p>
          <p className="text-[16px] font-semibold text-[#16121c] mt-0.5 break-all" data-testid="porta-conta-email-logado">{emailLogado}</p>
        </div>
        {erro && <p className="text-[13px] text-[#b42318] mt-3" role="alert">{erro}</p>}
        <BotaoCard
          texto={ocupado === "salvar" ? girando : "Continuar com esta conta"}
          disabled={!!ocupado}
          onClick={() => void rodar("salvar", onSalvarNestaConta)}
          testid="porta-salvar-nesta-conta"
          className="mt-4"
        />
        <button type="button" onClick={() => { void onTrocarConta(); }} className="mt-2 w-full h-10 text-[14px] text-[#6b6670]" data-testid="porta-trocar-conta">
          Usar <b className="text-[#16121c]">outro e-mail</b>
        </button>
      </div>
    );
  }

  if (fase === "existe") {
    const ok = senha.length >= SENHA_MIN;
    const entrar = () => { if (ok) void rodar("entrar", () => onEntrarComSenha(alvo, senha)); };
    return (
      <div className="mt-6" data-testid="porta-conta" data-fase="existe">
        <TituloCard testid="porta-conta-titulo">Esse e-mail já tem conta</TituloCard>
        <p className="text-[15px] text-[#6b6670] leading-snug mt-1.5">
          Entre com a senha de <b className="text-[#16121c] break-all">{alvo}</b> pra salvar o plano nela.{" "}
          <button type="button" className="underline underline-offset-2 font-semibold text-[#16121c]" onClick={() => { setFase("form"); setSenha(""); setErro(null); }} data-testid="porta-trocar-email">Trocar</button>
        </p>
        <div className="mt-4">
          <CampoSenha valor={senha} onMudar={(v) => { setSenha(v); setErro(null); }} onEnter={entrar} testid="porta-senha-existente" placeholder="A senha da sua conta" autoComplete="current-password" />
        </div>
        <p className="text-[13px] text-[#8a8490] mt-2 leading-snug">Criou com o Google ou a Apple? Volte e use o mesmo botão.</p>
        {erro && <p className="text-[13px] text-[#b42318] mt-2" role="alert">{erro}</p>}
        <BotaoCard texto={ocupado === "entrar" ? girando : "Entrar e salvar"} disabled={!ok || !!ocupado} onClick={entrar} testid="porta-entrar-existente" className="mt-4" />
        <a href="/reset-password" className="mt-2 flex items-center justify-center h-10 text-[14px] text-[#6b6670] no-underline" data-testid="porta-esqueci"><span>Esqueci <b className="text-[#16121c]">a senha</b></span></a>
      </div>
    );
  }

  const criar = () => {
    if (ocupado) return;
    const falta = validarConta(email, senha);
    if (falta.length) {
      // não envia: diz embaixo de cada campo o que falta e leva o cursor pro 1º
      setErro(null);
      setErrosCampo(Object.fromEntries(falta.map((f) => [f.campo, f.msg])) as ErrosCampo);
      for (const f of falta) onErroCampo?.(f.campo, f.motivo);
      const alvoFoco = falta[0].campo === "email" ? emailRef.current : senhaRef.current;
      try { alvoFoco?.focus(); } catch { /* noop */ }
      return;
    }
    setErrosCampo({});
    void rodar("criar", () => onCriarConta(alvo, senha));
  };
  const tocarGoogle = () => {
    if (emInApp) { setAvisoGoogle(true); onGoogleBloqueado(); return; }
    void rodar("google", onGoogle);
  };
  return (
    <div className="mt-6" data-testid="porta-conta" data-fase="form">
      <TopoDaConta mostrarTeste={mostrarTeste} titulo={titulo} texto={texto} />

      <div className="mt-4">
        {mostrarApple && (
          <>
            <button
              type="button"
              onClick={() => void rodar("apple", onApple)}
              disabled={!!ocupado}
              data-testid="porta-apple"
              className="w-full h-[52px] rounded-[12px] bg-black text-white text-[16px] font-semibold flex items-center justify-center gap-2.5 disabled:opacity-60 active:scale-[.985] transition-transform"
            >
              {ocupado === "apple" ? girando : <><AppleIcon /> Continuar com a Apple</>}
            </button>
            <p className="mt-1.5 mb-2.5 text-center text-[12.5px] text-[#8a8490]" data-testid="porta-apple-legenda">{LEGENDA_APPLE}</p>
          </>
        )}
        <button
          type="button"
          onClick={tocarGoogle}
          disabled={!!ocupado}
          data-testid="porta-google"
          className="w-full h-[52px] rounded-[12px] border border-[#e3e0e6] bg-white text-[16px] font-semibold text-[#16121c] flex items-center justify-center gap-2.5 disabled:opacity-60 active:bg-[#f5f3f7]"
        >
          {ocupado === "google" ? girando : <><GoogleIcon /> Continuar com o Google</>}
        </button>
        {avisoGoogle && (
          <div className="mt-2.5 rounded-[12px] border border-[#f1d38a] bg-[#fff8e1] px-3.5 py-3 flex items-start gap-3" role="alert" data-testid="porta-aviso-google">
            {/* o canto do navegador do Instagram: os ⋯ no alto, à direita */}
            <span className="shrink-0 grid place-items-center w-9 h-9 rounded-[10px] bg-white border border-[#ebe7ef] text-[#16121c]" aria-hidden>
              <MoreHorizontal className="w-5 h-5" strokeWidth={2.6} />
            </span>
            <p className="text-[13.5px] leading-snug text-[#5c4300]">
              O Google não deixa entrar por dentro do {appDoWebview}. Toque em <b className="text-[#16121c]">⋯</b> no alto e em <b className="text-[#16121c]">Abrir no navegador</b>. Ou use {mostrarApple ? "a Apple ou o e-mail" : "o e-mail"}.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 my-4" aria-hidden>
        <span className="flex-1 h-px bg-[#ebe8ee]" />
        <span className="text-[13px] text-[#8a8490]">ou com e-mail</span>
        <span className="flex-1 h-px bg-[#ebe8ee]" />
      </div>

      <input
        id="porta-email"
        ref={emailRef}
        aria-invalid={errosCampo.email ? true : undefined}
        aria-describedby={errosCampo.email ? "porta-erro-email" : undefined}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(e) => { setEmail(e.target.value); setErro(null); if (errosCampo.email) setErrosCampo((x) => ({ ...x, email: undefined })); }}
        placeholder="Seu e-mail"
        aria-label="Seu e-mail"
        data-testid="porta-email"
        className={`${CAMPO} ${errosCampo.email ? "border-[#e5484d]" : "border-[#e3e0e6]"}`}
      />
      <ErroDoCampo id="porta-erro-email" msg={errosCampo.email} />
      <div className="mt-2.5">
        <CampoSenha
          valor={senha}
          onMudar={(v) => { setSenha(v); setErro(null); if (errosCampo.senha) setErrosCampo((x) => ({ ...x, senha: undefined })); }}
          onEnter={criar}
          testid="porta-senha"
          placeholder="Crie uma senha (mín. 6)"
          inputRef={senhaRef}
          erroId={errosCampo.senha ? "porta-erro-senha" : undefined}
        />
      </div>
      <ErroDoCampo id="porta-erro-senha" msg={errosCampo.senha} />
      {erro && <p className="text-[13px] text-[#b42318] mt-2" role="alert">{erro}</p>}
      <BotaoCard texto={ocupado === "criar" ? girando : "Criar conta"} disabled={!!ocupado} onClick={criar} testid="porta-criar-conta" className="mt-3.5" />
      <Termos />
    </div>
  );
}
