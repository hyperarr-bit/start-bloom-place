/**
 * O PÓS-COMPRA DO iPHONE — cadastro, liberação e confirmação (01/09).
 *
 * POR QUE ESTE ARQUIVO EXISTE, com o histórico que o justifica.
 *
 * O paywall do iOS já era arquivo próprio. Estas telas não eram — vinham do
 * `ComecarRadar`, compartilhadas com o Android. E foi exatamente aqui que
 * TODOS os problemas do teste real apareceram, um a um, no aparelho do dono:
 *
 *   1. só existia "Continuar com Google" (regra 4.8 quer a opção da Apple);
 *   2. "Rapidinho: como você pagou? Pix · Cartão · Saldo Google" — 3.1.1,
 *      numa tela que aparece DEPOIS de alguém pagar;
 *   3. "Garantia de 7 dias" — promessa que na Apple não é nossa pra fazer;
 *   4. "o Google leva alguns segundos pra confirmar" na tela de liberação;
 *   5. o botão do Google, que no iOS **não volta** do navegador — a pessoa
 *      pagaria e ficaria sem conseguir criar conta.
 *
 * Nenhum foi pego por revisão de código, typecheck ou pelos testes do
 * paywall. Todos por alguém comprando de verdade. O padrão é claro: o
 * vazamento nunca esteve na tela de venda — esteve no que vem DEPOIS dela.
 *
 * Por isso a fronteira aqui é o sistema de arquivos, e não um `if`: quem
 * mexer no funil do Android não alcança este arquivo, e quem escrever este
 * arquivo é obrigado a olhar cada tela.
 *
 * O que continua compartilhado: as telas de PERGUNTA do quiz. Elas perguntam
 * qual área da vida está fora de controle — não sabem o que é loja, preço nem
 * pagamento, e as duas plataformas nunca vão divergir nelas.
 *
 * Coberto por `cadastro-pos-compra-ios.test.tsx`.
 */
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Loader2, MailCheck, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { entrarComApple } from "@/lib/auth-nativo";
import { getAuthRedirectUrl } from "@/lib/utils";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { AREA_TUTORIAL, FUNNEL_AREA_KEY, type AreaKey } from "@/lib/funnel";
import { BoasVindasPago } from "@/components/onboarding/BoasVindasPago";


/* Glifo oficial da Apple: as diretrizes de marca não aceitam emoji nem ícone
 * genérico, e o botão tem que ser preto com o logo à esquerda do texto. */
const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);

/** Selos do rodapé. Sem "Garantia de 7 dias": na Apple quem reembolsa é a
 *  Apple, pelo formulário dela — prometer garantia própria vira dívida de
 *  suporte com quem vier cobrar depois. */
const SelosIOS = () => (
  <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-muted-foreground">
    <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Dados criptografados</span>
    <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Compra protegida na sua conta</span>
  </div>
);

export function SignupIOS({
  onSession, onConfirm, posCompra,
}: { onSession: () => void; onConfirm: (email: string) => void; posCompra?: boolean }) {
  const { signUp, signIn } = useAuth();
  const { set: setUserData } = useUserData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);

  /**
   * LIGA O TUTORIAL — e tem que rodar em TODO caminho que cria conta.
   *
   * Bug do teste real (01/09): quem entrou pela Apple caiu no app **sem
   * tutorial nenhum**. A marca só era gravada no cadastro por e-mail; o
   * caminho social chama `onSession()` direto e pulava isto. No Android o
   * furo não aparecia porque o Google RECARREGA o app na volta e o fluxo
   * passava por outro lugar — mais uma consequência do login nativo não
   * recarregar nada.
   *
   * Vale pra qualquer área (lição de 05/08): o tour do módulo depende desta
   * MESMA marca, e sem ela a pessoa entra sem nada — 5 dos 20 pagantes de um
   * dia entraram assim, inclusive a primeira compra pela Play.
   */
  const ligarTutorial = () => {
    try {
      const vidaArea = localStorage.getItem(FUNNEL_AREA_KEY);
      setUserData("force-new-user-tutorial", "true");
      localStorage.setItem("force-new-user-tutorial", "true");
      const chave = vidaArea && vidaArea in AREA_TUTORIAL ? AREA_TUTORIAL[vidaArea as AreaKey] : null;
      if (chave) setUserData("tutorial-selected-modules", [chave]);
    } catch { /* noop */ }
  };

  const camposFocados = useRef<Set<string>>(new Set());
  const focoCampo = (campo: string) => () => {
    if (camposFocados.current.has(campo)) return;
    camposFocados.current.add(campo);
    trackEvent("funnel_signup_field", { field: campo, funil: "ios" });
  };
  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6 && (existingAccount || !!name.trim());

  /* Destrava o botão se a pessoa volta pro app sem ter logado. O único
   * `setLoading(false)` natural está no caminho de erro — e desistir no meio
   * não é erro, então sem isto o botão gira pra sempre. */
  useEffect(() => {
    let remover: (() => void) | undefined;
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const h = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) setAppleLoading(false);
        });
        remover = () => { void h.remove(); };
      } catch { /* sem plugin: nada a destravar */ }
    })();
    return () => remover?.();
  }, []);

  /*
   * O LOGIN NATIVO NÃO RECARREGA A PÁGINA — e é por isso que a primeira
   * versão disto "funcionava" sem logar ninguém: a folha da Apple abria, a
   * pessoa concluía, a sessão ENTRAVA, e a tela ficava parada. A telemetria
   * mostrou o sintoma exato: 3 cliques em `signup_apple` e ZERO erro.
   *
   * O caminho do Google volta do navegador RECARREGANDO o app, e é o
   * recarregamento que faz o funil reparar na sessão. Aqui não há volta nem
   * reload: `signInWithIdToken` resolve na hora, em silêncio. Então quem
   * avança a tela é este código.
   *
   * E "não deu erro" ≠ "logou": cancelar na folha também volta sem erro (de
   * propósito). Só a sessão distingue os dois.
   */
  const handleApple = async () => {
    if (loading || appleLoading) return;
    setErr(null);
    setAppleLoading(true);
    trackEvent("funnel_click", { cta: "signup_apple", funil: "ios", pos_compra: !!posCompra });
    const { error } = await entrarComApple();
    if (error) {
      trackEvent("funnel_error", { where: "signup_apple", funil: "ios", message: (error.message || "").slice(0, 200) });
      setErr(error.message || "Não consegui abrir a Apple. Tente de novo.");
      setAppleLoading(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setAppleLoading(false); return; }
    // Conta nova pela Apple é conta nova igual: liga o tutorial antes de sair
    // desta tela, senão a pessoa entra no app sem nada.
    ligarTutorial();
    trackEvent("funnel_click", { cta: "signup_success", via: "apple", funil: "ios", pos_compra: !!posCompra });
    setAppleLoading(false);
    onSession();
  };

  const recuperarSenha = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) { setErr("Digite seu e-mail pra receber o link."); return; }
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: getAuthRedirectUrl("/update-password"),
    });
    trackEvent("funnel_click", { cta: "signup_reset_password", funil: "ios" });
    setErr(error ? error.message : "Enviamos um link de recuperação pro seu e-mail. ✓");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    setErr(null);
    setLoading(true);

    // Já tinha conta: loga direto em vez de tentar criar de novo.
    if (existingAccount) {
      const { error: signInErr } = await signIn(email.trim().toLowerCase(), password);
      if (signInErr) {
        setErr("Senha incorreta. Tente de novo ou recupere abaixo.");
        setLoading(false);
        return;
      }
      trackEvent("funnel_click", { cta: "signup_success", via: "existing_login", funil: "ios" });
      setLoading(false);
      onSession();
      return;
    }

    trackEvent("funnel_click", { cta: "signup_submit", funil: "ios" });
    const { error, session } = await signUp(email.trim().toLowerCase(), password, name.trim());
    if (error) {
      trackEvent("funnel_error", { where: "signup_submit", funil: "ios", message: (error.message || "").slice(0, 200) });
      if (/already registered|already been registered|user already/i.test(error.message || "")) {
        // Tenta logar com a senha que ela ACABOU de digitar — caminho curto.
        const { error: signInErr } = await signIn(email.trim().toLowerCase(), password);
        if (!signInErr) {
          trackEvent("funnel_click", { cta: "signup_success", via: "existing_login", funil: "ios" });
          setLoading(false);
          onSession();
          return;
        }
        setExistingAccount(true);
        setErr("Esse e-mail já tem conta. Entre com sua senha — ou recupere abaixo.");
        setLoading(false);
        return;
      }
      setErr(error.message || "Não consegui criar a conta. Tente outro e-mail.");
      setLoading(false);
      return;
    }

    try { setUserData("user-name", name.trim()); } catch { /* noop */ }
    ligarTutorial();

    trackEvent("funnel_click", { cta: "signup_success", funil: "ios", instant: !!session });
    fireMetaEvent("CompleteRegistration", { content_name: "signup" });
    setLoading(false);
    if (session) onSession();
    else onConfirm(email.trim().toLowerCase());
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-7">
        {posCompra ? (
          <>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-3">
              <Check className="w-3.5 h-3.5" strokeWidth={3} /> Pagamento confirmado
            </div>
            <h2 className="text-[26px] font-bold tracking-tight leading-tight">
              Agora crie sua conta pra<br />guardar seu acesso.
            </h2>
            <p className="text-muted-foreground text-sm mt-2">
              Seu acesso fica guardado nela — é com ela que você entra em qualquer aparelho.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-[26px] font-bold tracking-tight leading-tight">
              Só falta 1 passo pra você<br />começar a usar o CORE.
            </h2>
            <p className="text-muted-foreground text-sm mt-2">Crie sua conta pra destravar seu plano personalizado.</p>
          </>
        )}
      </div>

      {/*
        SÓ A APPLE, e não é escolha estética. O botão do Google depende do
        retorno do navegador pra `core://auth`, que o SFSafariViewController
        bloqueia no iOS — foi o que travou o login da Apple antes de virar
        nativo. Aqui a tela aparece DEPOIS do pagamento: um botão que não
        volta faria a pessoa pagar e não conseguir criar conta.
        A regra 4.8 é atendida pela Apple, e o e-mail é o caminho universal.
      */}
      <Button
        type="button"
        onClick={handleApple}
        disabled={loading || appleLoading}
        className="w-full h-12 gap-2 text-[15px] font-semibold bg-black text-white hover:bg-black/90"
      >
        {appleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><AppleIcon /> Continuar com a Apple</>}
      </Button>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">ou com e-mail</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Input placeholder="Seu nome" value={name} onFocus={focoCampo("nome")} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-12" />
        <Input type="email" placeholder="Seu melhor e-mail" value={email} onFocus={focoCampo("email")} onChange={(e) => { setEmail(e.target.value); if (existingAccount) { setExistingAccount(false); setErr(null); } }} autoComplete="email" className="h-12" />
        <Input type="password" placeholder={existingAccount ? "Sua senha" : "Crie uma senha (mín. 6)"} value={password} onFocus={focoCampo("senha")} onChange={(e) => setPassword(e.target.value)} autoComplete={existingAccount ? "current-password" : "new-password"} className="h-12" />
        {/* A regra fica escrita ENQUANTO não é cumprida: o placeholder some no
            1º caractere e quem digitava 4 letras via o botão apagado sem
            explicação (relato do dono, 06/08). */}
        {!existingAccount && password.length > 0 && password.length < 6 && (
          <p className="text-[12px] text-muted-foreground -mt-1.5">
            A senha precisa de pelo menos 6 caracteres ({password.length}/6).
          </p>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={!valid || loading}>
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : existingAccount
              ? <>Entrar e continuar <ArrowRight className="w-4 h-4" /></>
              : posCompra
                ? <>Salvar meu acesso <ArrowRight className="w-4 h-4" /></>
                : <>Criar minha conta <ArrowRight className="w-4 h-4" /></>}
        </Button>
        {existingAccount && (
          <button type="button" onClick={recuperarSenha} className="block mx-auto text-[12.5px] text-muted-foreground underline underline-offset-2">
            Esqueci minha senha
          </button>
        )}
      </form>

      <div className="mt-4"><SelosIOS /></div>
    </div>
  );
}

/**
 * LIBERANDO — a ponte entre "criou a conta" e "app aberto" pra quem pagou
 * ANTES de ter conta. O servidor confere no RevenueCat e grava o acesso.
 */
export function LiberandoIOS() {
  const { get: getUserData } = useUserData();
  const nome = getUserData<string>("core-user-name", "") || getUserData<string>("user-name", "");
  const [demorou, setDemorou] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => { if (vivo) setDemorou(true); }, 9000);
    void (async () => {
      const rc = await import("@/lib/revenuecat");
      await rc.initRevenueCat();
      let ok = await rc.sincronizarAssinatura(3);
      if (!ok) {
        // A folha fechou mas o RC ainda não viu a transação nesta conta:
        // restaurar força a leitura do recibo e re-sincroniza.
        await rc.restaurar();
        ok = await rc.sincronizarAssinatura(3);
      }
      trackEvent("app_pos_compra_liberado", { ok, funil: "ios" });
      if (vivo) setPronto(true);
    })();
    return () => { vivo = false; clearTimeout(t); };
  }, []);

  if (pronto) {
    return <BoasVindasPago imediato nome={nome} onComecar={() => { window.location.href = "/"; }} />;
  }
  return (
    <div className="w-full max-w-sm mx-auto text-center py-16">
      <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-5" />
      <h2 className="text-[24px] font-bold tracking-tight leading-tight mb-2">Guardando seu acesso…</h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {/* Quem confirma aqui é a Apple. A versão compartilhada dizia "o
            Google" — errado no fato e menção a loja concorrente (3.1.1) na
            tela que a pessoa encara logo depois de pagar. */}
        {demorou
          ? "Quase lá — a Apple leva alguns segundos pra confirmar."
          : "Vinculando sua compra à sua conta nova."}
      </p>
    </div>
  );
}

/** Confirmação de e-mail (só no cadastro sem sessão imediata). */
export function ConfirmIOS({ email }: { email: string }) {
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="w-20 h-20 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-5">
        <MailCheck className="w-10 h-10" />
      </div>
      <h2 className="text-[26px] font-bold tracking-tight leading-tight mb-2">Falta 1 clique: confirme<br />seu e-mail.</h2>
      <p className="text-muted-foreground leading-relaxed mb-6">
        Mandamos um link pra <strong className="text-foreground">{email}</strong>. Confirme e <strong>seu plano te espera</strong> do outro lado.
      </p>
      <Button asChild size="lg" className="w-full h-12 text-base">
        <Link to="/auth">Já confirmei — entrar</Link>
      </Button>
      <p className="text-xs text-muted-foreground mt-3">Não chegou? Veja o spam ou aguarde 1 minuto.</p>
    </div>
  );
}
