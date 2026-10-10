import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { BotaoPorta } from "./BotaoPorta";
import { Eyebrow } from "./telas";

/**
 * TELA 6 DA PORTA — "Salve seu plano na sua conta".
 *
 *   · "Continuar com Google" (o OAuth da web, o mesmo do /entrar). Escondido
 *     no navegador do Instagram/Facebook: o Google BLOQUEIA login em webview
 *     embutida (disallowed_useragent) — o /entrar já esconde pelo mesmo motivo;
 *   · e-mail com código de 8 números (signInWithOtp, sem senha). Cria a conta
 *     se não existir; se existir, entra nela normalmente;
 *   · já logado neste navegador: "Salvar nesta conta" ou "Usar outro e-mail".
 *
 * Apple na web ficou DE FORA por enquanto: o provider está ligado e o /authorize
 * manda pra Apple com o Services ID certo (conferido 10/10), mas o login inteiro
 * na web não foi testado de ponta a ponta. Ligar = um botão chamando
 * entrarComApple() (lib/auth-nativo), depois de 1 login real no Safari.
 */
export const TAMANHO_CODIGO = 8;
const emailValido = (e: string) => /^\S+@\S+\.\S{2,}$/.test(e.trim());

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.6 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5c-.5.4 6.9-5 6.9-15.1 0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);

export type Resultado = { ok: boolean; erro?: string };

export function ContaPorta({ emInApp, emailLogado, onGoogle, onEnviarCodigo, onConferir, onSalvarNestaConta, onTrocarConta }: {
  emInApp: boolean;
  emailLogado: string | null;
  onGoogle: () => Promise<Resultado>;
  onEnviarCodigo: (email: string) => Promise<Resultado>;
  onConferir: (email: string, codigo: string) => Promise<Resultado>;
  onSalvarNestaConta: () => Promise<Resultado>;
  onTrocarConta: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [fase, setFase] = useState<"email" | "codigo">("email");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState<null | "google" | "email" | "codigo" | "salvar">(null);
  const [erro, setErro] = useState<string | null>(null);
  const alvo = email.trim().toLowerCase();

  const rodar = async (qual: NonNullable<typeof ocupado>, f: () => Promise<Resultado>, depois?: () => void) => {
    if (ocupado) return;
    setErro(null);
    setOcupado(qual);
    const r = await f();
    setOcupado(null);
    if (!r.ok) setErro(r.erro ?? "Algo falhou. Tenta de novo.");
    else depois?.();
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

  if (fase === "codigo") {
    const ok = codigo.length === TAMANHO_CODIGO;
    return (
      <div className="flex-1 flex flex-col" data-testid="porta-conta" data-fase="codigo">
        <Eyebrow>Confira seu e-mail</Eyebrow>
        <h1 className="text-[26px] font-black tracking-[-0.025em] leading-[1.1] mt-1.5">Digite o código</h1>
        <p className="text-[15px] text-[#5b6570] leading-snug mt-2">
          Mandei {TAMANHO_CODIGO} números pra <b className="text-[#16121c] break-all">{alvo}</b>.{" "}
          <button type="button" className="underline underline-offset-2 font-semibold text-[#16121c]" onClick={() => { setFase("email"); setCodigo(""); setErro(null); }} data-testid="porta-trocar-email">Trocar</button>
        </p>
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, "").slice(0, TAMANHO_CODIGO)); setErro(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && ok) void rodar("codigo", () => onConferir(alvo, codigo)); }}
          placeholder={"0".repeat(TAMANHO_CODIGO)}
          aria-label="Código do e-mail"
          data-testid="porta-codigo"
          className="mt-5 w-full h-14 rounded-2xl border-2 border-[#ebe7ef] bg-white px-4 text-center text-[24px] font-extrabold tracking-[0.32em] text-[#16121c] outline-none focus:border-[#16121c] placeholder:text-[#d5d0db]"
        />
        <p className="text-[13px] text-[#7d8691] mt-2.5 leading-snug">Não chegou em 1 minuto? Olhe o spam ou a aba Promoções.</p>
        {erro && <p className="text-[13px] text-[#b42318] mt-2" role="alert">{erro}</p>}
        <BotaoPorta
          texto={ocupado === "codigo" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar e salvar"}
          disabled={!ok || !!ocupado}
          onClick={() => void rodar("codigo", () => onConferir(alvo, codigo))}
          testid="porta-conferir"
          secundario={{ texto: <>Mandar o código <b>de novo</b></>, disabled: !!ocupado, onClick: () => void rodar("email", () => onEnviarCodigo(alvo)), testid: "porta-reenviar" }}
        />
      </div>
    );
  }

  const valido = emailValido(alvo);
  return (
    <div className="flex-1 flex flex-col" data-testid="porta-conta" data-fase="email">
      <Eyebrow>Falta só isso</Eyebrow>
      <h1 className="text-[26px] font-black tracking-[-0.025em] leading-[1.1] mt-1.5">Salve seu plano na sua conta</h1>
      <p className="text-[15px] text-[#5b6570] leading-snug mt-2">Ele fica te esperando no app.</p>

      {!emInApp && (
        <>
          <button
            type="button"
            onClick={() => void rodar("google", onGoogle)}
            disabled={!!ocupado}
            data-testid="porta-google"
            className="mt-6 w-full h-[52px] rounded-2xl border-2 border-[#ebe7ef] bg-white text-[16px] font-bold text-[#16121c] flex items-center justify-center gap-2.5 disabled:opacity-60 active:bg-[#f7f5fa]"
          >
            {ocupado === "google" ? <Loader2 className="w-5 h-5 animate-spin" /> : <><GoogleIcon /> Continuar com Google</>}
          </button>
          <div className="flex items-center gap-3 my-4" aria-hidden>
            <span className="flex-1 h-px bg-[#ebe7ef]" />
            <span className="text-[12px] font-semibold text-[#7d8691]">ou com seu e-mail</span>
            <span className="flex-1 h-px bg-[#ebe7ef]" />
          </div>
        </>
      )}

      <label htmlFor="porta-email" className={`text-[12px] font-bold uppercase tracking-[0.1em] text-[#7d8691] ${emInApp ? "mt-6" : ""}`}>Seu e-mail</label>
      <div className="relative mt-1.5">
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
          onKeyDown={(e) => { if (e.key === "Enter" && valido) void rodar("email", () => onEnviarCodigo(alvo), () => setFase("codigo")); }}
          placeholder="voce@gmail.com"
          data-testid="porta-email"
          className="w-full h-14 rounded-2xl border-2 border-[#ebe7ef] bg-white pl-12 pr-4 text-[17px] font-semibold text-[#16121c] outline-none focus:border-[#16121c] placeholder:text-[#b8b1c0] placeholder:font-normal"
        />
      </div>
      <p className="text-[13px] text-[#7d8691] mt-2.5 leading-snug">Sem senha. A gente manda um código pro seu e-mail.</p>
      {erro && <p className="text-[13px] text-[#b42318] mt-2" role="alert">{erro}</p>}
      <p className="text-[11.5px] text-[#9aa3ad] mt-auto pt-6 leading-snug text-center">
        Ao continuar, você aceita os <a href="/termos" className="underline underline-offset-2">Termos</a> e a <a href="/privacidade" className="underline underline-offset-2">Privacidade</a>.
      </p>
      <BotaoPorta
        texto={ocupado === "email" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Receber código"}
        disabled={!valido || !!ocupado}
        onClick={() => void rodar("email", () => onEnviarCodigo(alvo), () => setFase("codigo"))}
        testid="porta-enviar-codigo"
      />
    </div>
  );
}
