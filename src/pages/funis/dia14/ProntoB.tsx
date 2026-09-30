/**
 * PRONTO — a tela depois do Pix confirmado no FUNIL B (30/09).
 *
 * No Funil B a pessoa paga SEM conta: o QR nasce numa sessão anônima (ver o
 * cabeçalho de sessao-anonima.ts) e o e-mail pode ou não ter entrado na tela
 * do QR (copiar exige e-mail; escanear, não). Esta tela fecha a conta DEPOIS
 * do dinheiro, nesta ordem:
 *   1. confirma (selo verde) e mostra o que já é dela — o item que ela anotou
 *      na Missão da demo, a vitória que escolheu no quiz, os 16 módulos;
 *   2. se a sessão ainda deve senha (`precisaBatizar`): pede a senha (e o
 *      e-mail, se faltar) e grava NA MESMA conta que é dona da compra
 *      (`batizarConta` = updateUser). Nunca `signUp`: criaria outro usuário e
 *      deixaria a compra órfã. Se o e-mail já tem conta, o caminho é ENTRAR
 *      nela por código — e o `use-auth` traz a compra junto
 *      (`vincularCompraAnonima`), porque `guardarCompraAnonima` rodou no mount,
 *      antes de qualquer botão que troque de sessão;
 *   3. pronto: o item da demo vai pra conta (chaves reais do módulo, 1× por
 *      conta, só com a conta carregada), as duas lojas com o toque certo
 *      ("Já tenho conta? Entrar") e o botão pro módulo da área escolhida.
 *
 * Identidade de planner (feedback_identidade_planner): faixa colorida com
 * título em caixa alta, tabela com grade e quadradinho marcado, post-it.
 * Nada de timer que dispare ação: quem avança é ela.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BotoesDasLojas } from "@/components/LojasCard";
import { EntrarComCodigo } from "@/components/auth/EntrarComCodigo";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { Faixa, PostIt } from "@/pages/funis/dia14/pecas-roi2";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { NOME_DO_MODULO, rotuloDoItem, type ItemDaDemo } from "@/lib/demo-guiada";
import { levarItemParaConta } from "@/lib/demo-guiada-registro";
import { batizarConta, emailDaSessao, guardarCompraAnonima, precisaBatizar } from "@/lib/sessao-anonima";

const FUNIL = "b";
/** A cor da marca, cravada (como no BoasVindasPago): o `primary` do tema é grafite. */
const MAGENTA = "hsl(330 65% 50%)";
const EMAIL_OK = /^\S+@\S+\.\S+$/;
const SENHA_MIN = 6;

type Estado = "carregando" | "senha" | "pronto";

export default function ProntoB({ area, item, respostas = {} }: {
  area: AreaKey | null;
  /** o item da demo (c= na URL, já validado) — vai pra conta DEPOIS da senha */
  item: ItemDaDemo | null;
  /** respostas do quiz que viraram registros na demo ({gasto?, vitoria?, consistencia?}) — só copy */
  respostas: Record<string, string>;
}) {
  const [estado, setEstado] = useState<Estado>("carregando");
  /** O e-mail que a sessão tinha ao montar (null = escaneou o QR sem e-mail). */
  const [emailDaConta, setEmailDaConta] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("funnel_view", { step: "pronto", funil: FUNIL, tem_item: !!item, area });
    // ANTES de qualquer botão que possa trocar de sessão (o código por e-mail,
    // no caso "já tem conta"): guarda a sessão anônima que é dona do Pix.
    void guardarCompraAnonima();
    let vivo = true;
    void (async () => {
      const [email, deveSenha] = await Promise.all([emailDaSessao(), precisaBatizar()]);
      if (!vivo) return;
      // o usuário ANÔNIMO do Supabase vem com email "" (não null): "" = sem e-mail, pede o campo
      setEmailDaConta(email || null);
      setEstado(deveSenha ? "senha" : "pronto");
    })();
    return () => { vivo = false; };
    // só no mount: é a foto da sessão na hora em que o Pix confirmou
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto text-center" data-testid="pronto-b">
      {/* o mesmo selo do "confirmed" do PixCheckout — a confirmação vem antes de pedir qualquer coisa */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 13 }}
        className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-5"
      >
        <Check className="w-10 h-10" strokeWidth={3} />
      </motion.div>
      <h1 className="text-[26px] font-bold tracking-tight leading-tight">Pronto! Os 16 módulos são seus.</h1>
      <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed">
        Pagamento único confirmado — <strong className="text-foreground">nenhuma cobrança depois</strong>.
      </p>

      <JaEhSeu item={item} vitoria={respostas.vitoria} />

      <div className="mt-4">
        {estado === "carregando" && (
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-center gap-2 text-[13px] text-muted-foreground" data-testid="pronto-b-carregando">
            <Loader2 className="w-4 h-4 animate-spin" /> Guardando seu acesso…
          </div>
        )}
        {estado === "senha" && (
          <CardSenha
            emailFixo={emailDaConta}
            onPronto={(email) => { setEmailDaConta(email); setEstado("pronto"); }}
          />
        )}
        {estado === "pronto" && <Entrar area={area} item={item} emailSugerido={emailDaConta} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ o que já é seu */

const Linha = ({ children, destaque = false }: { children: ReactNode; destaque?: boolean }) => (
  <div className={`flex items-center gap-2.5 px-3 py-2.5 text-[13.5px] leading-snug ${destaque ? "bg-[#FFF8D6]" : ""}`}>
    <Quadradinho marcado tam={16} />
    <span className="min-w-0 flex-1">{children}</span>
  </div>
);

/** A folha do planner: faixa verde + tabela com grade, cada linha com o quadradinho marcado. */
function JaEhSeu({ item, vitoria }: { item: ItemDaDemo | null; vitoria?: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-left" data-testid="pronto-b-construiu">
      <Faixa cor="verde">O que já é seu</Faixa>
      <div className="mt-3 rounded-xl border border-border overflow-hidden divide-y divide-border">
        {item && (
          <Linha destaque>
            <strong className="font-bold">{rotuloDoItem(item)}</strong> já está em {NOME_DO_MODULO[item.tipo]}
          </Linha>
        )}
        {vitoria && <Linha>Vitória da semana: {vitoria}</Linha>}
        <Linha>16 módulos no mesmo acesso</Linha>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ a senha */

function CardSenha({ emailFixo, onPronto }: {
  /** o e-mail que já está na sessão (fixo: não se mexe nele) ou null (pede) */
  emailFixo: string | null;
  /** a conta fechou (senha gravada, ou entrou por código na conta que já existia) */
  onPronto: (email: string) => void;
}) {
  const semEmail = !emailFixo;
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<null | "email_em_uso" | "falhou">(null);
  const campoEmail = useRef<HTMLInputElement>(null);

  const alvo = (emailFixo ?? email).trim().toLowerCase();
  const emailOk = !!emailFixo || EMAIL_OK.test(alvo);
  const valido = emailOk && senha.length >= SENHA_MIN;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido || enviando) return;
    setErro(null);
    setEnviando(true);
    trackEvent("funnel_click", { cta: "batismo_submit", funil: FUNIL, sem_email: semEmail });
    /* Mesma conta, nunca signUp. `batizarConta` só usa o e-mail quando a
     * sessão não tem nenhum; com e-mail fixo ela o ignora (reenviar o mesmo
     * endereço cairia no fluxo de TROCA, que exige confirmação). */
    const r = await batizarConta(senha, "", alvo);
    if (r.erro === "email_em_uso") {
      trackEvent("funnel_error", { where: "batismo_email_em_uso", funil: FUNIL });
      setErro("email_em_uso");
      setEnviando(false);
      return;
    }
    if (r.erro) {
      trackEvent("funnel_error", { where: "batismo", funil: FUNIL, message: (r.mensagem || "").slice(0, 200) });
      setErro("falhou");
      setEnviando(false);
      return;
    }
    trackEvent("funnel_click", { cta: "batismo_ok", funil: FUNIL });
    onPronto(alvo);
  };

  const outroEmail = () => {
    setErro(null);
    setEmail("");
    setTimeout(() => campoEmail.current?.focus(), 0);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4 text-left" data-testid="pronto-b-senha">
      <Faixa>Cria sua senha</Faixa>
      <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug">
        É com ela que você entra no app do celular e em qualquer aparelho.
      </p>

      <div className="mt-3.5 space-y-2.5">
        {emailFixo ? (
          <div
            className="flex items-center gap-2 min-h-12 px-3 py-2 rounded-xl border border-border bg-muted/40 font-mono text-[13px]"
            aria-label="E-mail da conta"
            data-testid="pronto-b-email"
          >
            <Quadradinho marcado tam={14} />
            <span className="min-w-0 break-all">{emailFixo}</span>
          </div>
        ) : (
          <div>
            <p className="text-[12.5px] text-muted-foreground leading-snug mb-1.5">
              Pra onde mando o acesso? Sem isso não dá pra entrar em outro aparelho.
            </p>
            <Input
              ref={campoEmail}
              type="email"
              inputMode="email"
              placeholder="Seu e-mail"
              autoComplete="email"
              aria-label="Seu e-mail"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (erro) setErro(null); }}
              className="h-12"
            />
          </div>
        )}

        <div className="relative">
          <Input
            type={mostrar ? "text" : "password"}
            placeholder={`Crie uma senha (mín. ${SENHA_MIN})`}
            autoComplete="new-password"
            aria-label="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="h-12 pr-11"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setMostrar((v) => !v)}
            className="absolute right-0 top-0 h-12 w-11 grid place-items-center text-muted-foreground hover:text-foreground"
          >
            {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {/* a regra fica escrita ENQUANTO não é cumprida (o placeholder some no 1º caractere) */}
        {senha.length > 0 && senha.length < SENHA_MIN && (
          <p className="text-[12px] text-muted-foreground -mt-1">
            A senha precisa de pelo menos {SENHA_MIN} caracteres ({senha.length}/{SENHA_MIN}).
          </p>
        )}
      </div>

      {erro === "falhou" && (
        <p role="alert" className="mt-2.5 text-[13px] text-destructive leading-snug" data-testid="pronto-b-erro">
          Não consegui salvar sua senha. Tenta de novo — sua compra não se perde.
        </p>
      )}

      {erro === "email_em_uso" ? (
        <div className="mt-3 space-y-2.5" data-testid="pronto-b-email-em-uso">
          <p role="alert" className="text-[13px] leading-snug">
            Esse e-mail já tem conta no CORE. <b>Entra nela e a compra vai junto.</b>
          </p>
          {/* Entrar por código TROCA de sessão; a compra segue porque a anônima
              foi guardada no mount e o use-auth roda vincularCompraAnonima. */}
          <EntrarComCodigo email={alvo} funil="pronto_b" onSession={() => onPronto(alvo)} />
          {semEmail && (
            <button
              type="button"
              onClick={outroEmail}
              className="w-full text-center text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              usar outro e-mail
            </button>
          )}
        </div>
      ) : (
        <Button
          type="submit"
          size="lg"
          disabled={!valido || enviando}
          className="mt-3.5 w-full h-12 text-[15px] font-bold rounded-xl"
          data-testid="pronto-b-criar"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Criar senha e entrar <ArrowRight className="w-4 h-4" /></>}
        </Button>
      )}
    </form>
  );
}

/* ------------------------------------------------------------ pronto: entrar */

/**
 * Grava o item da demo na conta — a mesma ideia do useLevarItemParaConta do
 * Construiu: só com a conta carregada do servidor (gravar antes apagaria o que
 * uma conta antiga já tinha), {system:true} (não é gesto de agora), 1× por
 * conta. "Por conta", e não "1× e pronto": quem cai em "já tem conta" e entra
 * por código TROCA de usuário depois que esta tela montou — a gravação de
 * antes ficou na anônima, e a conta em que ela entrou precisa da dela. O
 * registro é idempotente (idDoItem), então repetir na mesma conta não duplica.
 */
function useLevarItemParaConta(item: ItemDaDemo | null) {
  const { user } = useAuth();
  const { get, set, loaded, isGuest } = useUserData();
  const feitoPara = useRef<string | null>(null);
  useEffect(() => {
    if (!item || !user || isGuest || !loaded || feitoPara.current === user.id) return;
    feitoPara.current = user.id;
    let chaves: string[] = [];
    try {
      chaves = levarItemParaConta(item, (k) => get<unknown>(k, undefined), (k, v) => set(k, v, { system: true }));
    } catch (e) {
      trackEvent("demo_guia_conta", { guia: "on", funil: FUNIL, tipo: item.tipo, ok: false, erro: String(e).slice(0, 120) });
      return;
    }
    trackEvent("demo_guia_conta", { guia: "on", funil: FUNIL, tipo: item.tipo, ok: true, chaves: chaves.join(",") || "ja_tinha" });
  }, [item, user, isGuest, loaded, get, set]);
}

function Entrar({ area, item, emailSugerido }: { area: AreaKey | null; item: ItemDaDemo | null; emailSugerido: string | null }) {
  // o e-mail final é o da sessão de agora (pode ser a conta em que ela entrou
  // por código); enquanto não responde, o que ela acabou de usar
  const [email, setEmail] = useState<string | null>(emailSugerido);
  useEffect(() => {
    let vivo = true;
    void emailDaSessao().then((e) => { if (vivo && e) setEmail(e); });
    return () => { vivo = false; };
  }, []);
  useLevarItemParaConta(item);

  const destino = area ? `/${AREAS[area].module}` : "/financas";
  const abrir = () => {
    trackEvent("funnel_click", { cta: "pronto_abrir_app", funil: FUNIL });
    window.location.href = destino;
  };

  return (
    <div className="space-y-3.5" data-testid="pronto-b-entrar">
      {email && (
        <PostIt className="mx-1">
          Sua conta: <b className="font-bold break-all">{email}</b> — é com ela que você entra em qualquer aparelho.
        </PostIt>
      )}

      {/* a maior causa de reembolso na web é achar que comprou "um site": as duas
          lojas e o toque certo no app (o botão grande de lá é "Começar", que cria conta nova) */}
      <div className="rounded-2xl border border-border bg-card p-4 text-left" data-testid="pronto-b-lojas">
        <Faixa>Baixa o app no celular</Faixa>
        <p className="mt-1.5 mb-3 text-[12.5px] text-muted-foreground leading-snug">
          O CORE está na App Store e no Google Play. Entra com o mesmo e-mail — sua compra já está lá.
        </p>
        <BotoesDasLojas origem="pos_compra_b" />
        <p className="mt-3 text-[12px] text-muted-foreground leading-snug" data-testid="pronto-b-como-entrar">
          No app, toque em <b className="text-foreground">“Já tenho conta? Entrar”</b> — não em “Começar”.{" "}
          <a
            href="/como-entrar"
            className="font-semibold underline underline-offset-2 text-foreground"
            onClick={() => trackEvent("como_entrar_click", { origem: "pos_compra_b" })}
          >
            Ver o passo a passo
          </a>
        </p>
      </div>

      <Button
        type="button"
        size="lg"
        onClick={abrir}
        style={{ background: MAGENTA }}
        className="w-full h-14 text-base font-bold rounded-2xl text-white hover:opacity-90"
        data-testid="pronto-b-abrir"
      >
        Abrir meu CORE <ArrowRight className="w-5 h-5" />
      </Button>
    </div>
  );
}
