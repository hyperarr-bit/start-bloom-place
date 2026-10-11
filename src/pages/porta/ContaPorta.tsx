import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, MoreHorizontal } from "lucide-react";
import { BotaoPorta } from "./BotaoPorta";
import { Eyebrow } from "./telas";

/**
 * TELA 6 DA PORTA — "Salve seu plano na sua conta" (v2, dono 10/10: "não é
 * necessário botar a confirmação de números no Gmail; deixar a opção de criar
 * conta com Google e Apple").
 *
 *   · [Continuar com a Apple] — signInWithOAuth apple na web (provider ligado, o
 *     /authorize vai pra Apple com o Services ID do app). Não aparece no Android:
 *     o app Android não tem "Entrar com a Apple", a conta ficaria sem porta de entrada;
 *   · [Continuar com o Google] — SEMPRE visível. No navegador do Instagram/Facebook
 *     o toque NÃO tenta o OAuth (o Google devolve 403 disallowed_useragent): abre o
 *     aviso "abra no navegador" (o pai guarda as respostas na URL pra elas irem junto);
 *   · "ou com e-mail": e-mail + senha (mín. 6) → [Criar conta e salvar]. SEM código.
 *     E-mail que já tem conta: tenta entrar com a mesma senha; se não der, pede a
 *     senha dela ("Esqueci a senha" → /reset-password). Nunca cria 2ª conta;
 *   · já logado neste navegador: "Salvar nesta conta" ou "Usar outro e-mail".
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
const AppleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

export type Resultado = { ok: boolean; erro?: string; existe?: boolean };

function CampoSenha({ valor, onMudar, onEnter, testid, placeholder = "Mínimo de 6 caracteres", autoComplete = "new-password" }: {
  valor: string; onMudar: (v: string) => void; onEnter: () => void; testid: string; placeholder?: string; autoComplete?: string;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative mt-1.5">
      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9aa3ad]" aria-hidden />
      <input
        id={testid}
        type={ver ? "text" : "password"}
        autoComplete={autoComplete}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }}
        placeholder={placeholder}
        data-testid={testid}
        className="w-full h-[52px] rounded-2xl border-2 border-[#ebe7ef] bg-white pl-12 pr-12 text-[17px] font-semibold text-[#16121c] outline-none focus:border-[#16121c] placeholder:text-[#b8b1c0] placeholder:font-normal"
      />
      <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Esconder senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#7d8691]">
        {ver ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}

export function ContaPorta({ emInApp, appDoWebview, mostrarApple, emailLogado, onApple, onGoogle, onGoogleBloqueado, onCriarConta, onEntrarComSenha, onSalvarNestaConta, onTrocarConta }: {
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
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [fase, setFase] = useState<"form" | "existe">("form");
  const [avisoGoogle, setAvisoGoogle] = useState(false);
  const [ocupado, setOcupado] = useState<null | "apple" | "google" | "criar" | "entrar" | "salvar">(null);
  const [erro, setErro] = useState<string | null>(null);
  const alvo = email.trim().toLowerCase();

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
      <div className="flex-1 flex flex-col" data-testid="porta-conta" data-fase="logado">
        <Eyebrow>Falta só isso</Eyebrow>
        <h1 className="text-[26px] font-black tracking-[-0.025em] leading-[1.1] mt-1.5">Salve seu plano na sua conta</h1>
        <p className="text-[15px] text-[#5b6570] leading-snug mt-2">Você já entrou neste aparelho.</p>
        <div className="mt-5 rounded-2xl border-2 border-[#16121c] bg-white p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#7d8691]">Sua conta</p>
          <p className="text-[17px] font-extrabold text-[#16121c] mt-1 break-all" data-testid="porta-conta-email-logado">{emailLogado}</p>
        </div>
        {erro && <p className="text-[13px] text-[#b42318] mt-3" role="alert">{erro}</p>}
        <BotaoPorta
          texto={ocupado === "salvar" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar nesta conta"}
          disabled={!!ocupado}
          onClick={() => void rodar("salvar", onSalvarNestaConta)}
          testid="porta-salvar-nesta-conta"
          secundario={{ texto: <>Usar <b>outro e-mail</b></>, onClick: () => { void onTrocarConta(); }, testid: "porta-trocar-conta" }}
        />
      </div>
    );
  }

  if (fase === "existe") {
    const ok = senha.length >= SENHA_MIN;
    const entrar = () => { if (ok) void rodar("entrar", () => onEntrarComSenha(alvo, senha)); };
    return (
      <div className="flex-1 flex flex-col" data-testid="porta-conta" data-fase="existe">
        <Eyebrow>Você já tem conta</Eyebrow>
        <h1 className="text-[26px] font-black tracking-[-0.025em] leading-[1.1] mt-1.5">Esse e-mail já tem conta</h1>
        <p className="text-[15px] text-[#5b6570] leading-snug mt-2">
          Entre com a senha de <b className="text-[#16121c] break-all">{alvo}</b> pra salvar o plano nela.{" "}
          <button type="button" className="underline underline-offset-2 font-semibold text-[#16121c]" onClick={() => { setFase("form"); setSenha(""); setErro(null); }} data-testid="porta-trocar-email">Trocar</button>
        </p>
        <label htmlFor="porta-senha-existente" className="mt-6 text-[12px] font-bold uppercase tracking-[0.1em] text-[#7d8691]">Sua senha</label>
        <CampoSenha valor={senha} onMudar={(v) => { setSenha(v); setErro(null); }} onEnter={entrar} testid="porta-senha-existente" placeholder="A senha da sua conta" autoComplete="current-password" />
        <p className="text-[13px] text-[#7d8691] mt-2.5 leading-snug">Criou com o Google ou a Apple? Volte e use o mesmo botão.</p>
        {erro && <p className="text-[13px] text-[#b42318] mt-2" role="alert">{erro}</p>}
        <BotaoPorta
          texto={ocupado === "entrar" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar e salvar"}
          disabled={!ok || !!ocupado}
          onClick={entrar}
          testid="porta-entrar-existente"
          secundario={{ texto: <>Esqueci <b>a senha</b></>, href: "/reset-password", testid: "porta-esqueci" }}
        />
      </div>
    );
  }

  const valido = emailValido(alvo) && senha.length >= SENHA_MIN;
  const criar = () => { if (valido) void rodar("criar", () => onCriarConta(alvo, senha)); };
  const tocarGoogle = () => {
    if (emInApp) { setAvisoGoogle(true); onGoogleBloqueado(); return; }
    void rodar("google", onGoogle);
  };
  return (
    <div className="flex-1 flex flex-col" data-testid="porta-conta" data-fase="form">
      <Eyebrow>Falta só isso</Eyebrow>
      <h1 className="text-[26px] font-black tracking-[-0.025em] leading-[1.1] mt-1.5">Salve seu plano na sua conta</h1>
      <p className="text-[15px] text-[#5b6570] leading-snug mt-1.5">Ele fica te esperando no app.</p>

      <div className="mt-5 space-y-2.5">
        {mostrarApple && (
          <button
            type="button"
            onClick={() => void rodar("apple", onApple)}
            disabled={!!ocupado}
            data-testid="porta-apple"
            className="w-full h-[52px] rounded-2xl bg-black text-white text-[16px] font-bold flex items-center justify-center gap-2.5 disabled:opacity-60"
          >
            {ocupado === "apple" ? <Loader2 className="w-5 h-5 animate-spin" /> : <><AppleIcon /> Continuar com a Apple</>}
          </button>
        )}
        <button
          type="button"
          onClick={tocarGoogle}
          disabled={!!ocupado}
          data-testid="porta-google"
          className="w-full h-[52px] rounded-2xl border-2 border-[#ebe7ef] bg-white text-[16px] font-bold text-[#16121c] flex items-center justify-center gap-2.5 disabled:opacity-60 active:bg-[#f7f5fa]"
        >
          {ocupado === "google" ? <Loader2 className="w-5 h-5 animate-spin" /> : <><GoogleIcon /> Continuar com o Google</>}
        </button>
        {avisoGoogle && (
          <div className="rounded-2xl border border-[#f1d38a] bg-[#fff8e1] px-3.5 py-3 flex items-start gap-3" role="alert" data-testid="porta-aviso-google">
            {/* o canto do navegador do Instagram: os ⋯ no alto, à direita */}
            <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-white border border-[#ebe7ef] text-[#16121c]" aria-hidden>
              <MoreHorizontal className="w-6 h-6" strokeWidth={2.6} />
            </span>
            <p className="text-[13.5px] leading-snug text-[#5c4300]">
              O Google não deixa entrar por dentro do {appDoWebview}. Toque em <b className="text-[#16121c]">⋯</b> no alto e em <b className="text-[#16121c]">Abrir no navegador</b>. Ou use {mostrarApple ? "a Apple ou o e-mail" : "o e-mail"}.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 my-4" aria-hidden>
        <span className="flex-1 h-px bg-[#ebe7ef]" />
        <span className="text-[12px] font-semibold text-[#7d8691]">ou com e-mail</span>
        <span className="flex-1 h-px bg-[#ebe7ef]" />
      </div>

      <div className="relative">
        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9aa3ad]" aria-hidden />
        <input
          id="porta-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErro(null); }}
          placeholder="Seu e-mail"
          aria-label="Seu e-mail"
          data-testid="porta-email"
          className="w-full h-[52px] rounded-2xl border-2 border-[#ebe7ef] bg-white pl-12 pr-4 text-[17px] font-semibold text-[#16121c] outline-none focus:border-[#16121c] placeholder:text-[#b8b1c0] placeholder:font-normal"
        />
      </div>
      <CampoSenha valor={senha} onMudar={(v) => { setSenha(v); setErro(null); }} onEnter={criar} testid="porta-senha" placeholder="Crie uma senha (mín. 6)" />
      <p className="text-[12.5px] text-[#7d8691] mt-2 leading-snug">É com esse e-mail e essa senha que você entra no app.</p>
      {erro && <p className="text-[13px] text-[#b42318] mt-2" role="alert">{erro}</p>}
      <p className="text-[11.5px] text-[#9aa3ad] mt-auto pt-4 leading-snug text-center">
        Ao continuar, você aceita os <a href="/termos" className="underline underline-offset-2">Termos</a> e a <a href="/privacidade" className="underline underline-offset-2">Privacidade</a>.
      </p>
      <BotaoPorta
        texto={ocupado === "criar" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar conta e salvar"}
        disabled={!valido || !!ocupado}
        onClick={criar}
        testid="porta-criar-conta"
      />
    </div>
  );
}
