/**
 * FUNIL DO TESTE GRÁTIS (v53, 16/08) — a porta nova do app da loja.
 *
 * Desenho do dono + blueprint aprovado: 4 telas de pergunta e o APP ABRE.
 *   porta (área + timeline do teste) → dor (1 pergunta da área) → horário
 *   → notificações (promessa antes do pedido) → módulo REAL em modo guiado.
 *
 * O que NÃO tem aqui, de propósito:
 *  - demo: o teste de 3 dias substitui ela (usar o app real > ver o app);
 *  - paywall na entrada: ele mudou de LUGAR — mora no dia 3 (step "offer"),
 *    quando existe algo construído que a pessoa não quer perder;
 *  - cadastro: continua DEPOIS do pagamento (v48 provou com dinheiro);
 *  - mini-demo/telas fictícias: a semente é plantada DENTRO do módulo de
 *    verdade (GuiaSemente), mesma identidade, mesmo componente do pagante.
 *
 * Produto: assinatura — anual R$ 159,90 (herói, = R$ 13,32/mês) + mensal
 * R$ 24,90. Downsell pós-cancelamento da folha: R$ 19,90/mês no Pix,
 * pré-pago de 30 dias, renovação manual (decisão do dono 16/08).
 *
 * A web NUNCA vê este arquivo: /app só renderiza ele no shell (App.tsx);
 * /funil-radar continua congelado como era.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, Check, Loader2, Moon, Sun, Sunrise } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNativeShell, APP_PRECOS } from "@/lib/native-shell";
import { AREAS, DOOR_AREAS, FUNNEL_AREA_KEY, type AreaKey } from "@/lib/funnel";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { estadoTeste, iniciarTeste, armarGuiaSemente } from "@/lib/teste-gratis";
import {
  agendarReguaDoTeste, agendarResgateDoPlano, cancelarReguaDoTeste,
  cancelarResgateDoPlano, pedirPermissao,
} from "@/lib/notificacoes";
import {
  SignupScreen, ConfirmScreen, LiberandoScreen, POS_COMPRA_OAUTH_KEY,
} from "@/pages/funis/radar/ComecarRadar";
import { AppLegalFooter } from "@/components/paywall/PaywallFlow";

const FUNIL = "teste";

type Step = "porta" | "dor" | "horario" | "notif" | "offer" | "signup" | "confirm" | "liberando";

// Mesma pele das outras telas do shell: funil sempre claro + céu suave.
const LIGHT_VARS = {
  "--background": "0 0% 100%",
  "--foreground": "0 0% 15%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 0% 15%",
  "--primary": "0 0% 20%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "40 20% 96%",
  "--secondary-foreground": "0 0% 15%",
  "--muted": "40 15% 95%",
  "--muted-foreground": "0 0% 45%",
  "--accent": "330 65% 50%",
  "--accent-foreground": "0 0% 100%",
  "--border": "0 0% 90%",
  "--input": "0 0% 90%",
  "--ring": "0 0% 20%",
} as CSSProperties;
const CEU_SUAVE = "linear-gradient(180deg,#eaf5fd 0%,#f7fbff 30%,#ffffff 62%)";
const TILE_CORES = ["#fdeccb", "#cdeeee", "#d9e4fb", "#e6def8", "#fbd8e8"];

const slide = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -28 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

/* ------------------------------------------------------------ conteúdo */

/** Porta: DOOR_AREAS + a válvula "tudo" (vai pra dinheiro, igual o radar —
 *  é a área com mais dado e a semente mais universal: uma conta que vence). */
const PORTA_OPCOES: Array<{ key: AreaKey | "tudo"; emoji: string; label: string }> = [
  ...DOOR_AREAS.map((a) => ({ key: a as AreaKey | "tudo", emoji: AREAS[a].emoji, label: AREAS[a].label })),
  { key: "tudo", emoji: "😵", label: "Tudo, sinceramente" },
];

/** T2 — a dor da área. Uma pergunta só: o que personaliza a semente e o
 *  recap do D3. Quiz de 2 respostas obrigatórias no total (porta + dor):
 *  a web sangra 37% até a 4ª pergunta. */
const DOR: Record<AreaKey, { pergunta: string; opcoes: Array<{ id: string; emoji: string; label: string }> }> = {
  dinheiro: {
    pergunta: "O que mais te aperta no dinheiro?",
    opcoes: [
      { id: "gasto_invisivel", emoji: "💳", label: "Gasto sem perceber" },
      { id: "esqueco_contas", emoji: "📅", label: "Esqueço contas e pago juros" },
      { id: "nao_guardo", emoji: "🏦", label: "Não consigo guardar" },
      { id: "sem_visao", emoji: "🤷", label: "Não sei pra onde vai" },
    ],
  },
  rotina: {
    pergunta: "O que mais bagunça sua rotina?",
    opcoes: [
      { id: "largo_dia3", emoji: "📉", label: "Começo e largo no dia 3" },
      { id: "esqueco_tarefas", emoji: "🧠", label: "Esqueço o que tinha que fazer" },
      { id: "procrastino", emoji: "⏳", label: "Procrastino demais" },
      { id: "sem_tempo", emoji: "🌀", label: "Sinto que o dia não rende" },
    ],
  },
  corpo: {
    pergunta: "O que mais te trava no treino e dieta?",
    opcoes: [
      { id: "constancia", emoji: "📉", label: "Falta constância" },
      { id: "sem_plano", emoji: "🏋️", label: "Treino sem plano" },
      { id: "comer_mal", emoji: "🍔", label: "Não sei o que comer" },
      { id: "sozinho", emoji: "😮‍💨", label: "Desanimo sozinho" },
    ],
  },
  saude: {
    pergunta: "O que mais escapa no seu cuidado?",
    opcoes: [
      { id: "agua", emoji: "💧", label: "Esqueço de beber água" },
      { id: "sono", emoji: "😴", label: "Sono todo bagunçado" },
      { id: "remedio", emoji: "💊", label: "Esqueço vitamina/remédio" },
      { id: "checkup", emoji: "🩺", label: "Adio exames e consultas" },
    ],
  },
  metas: {
    pergunta: "O que acontece com as suas metas?",
    opcoes: [
      { id: "so_cabeca", emoji: "💭", label: "Ficam só na cabeça" },
      { id: "esqueco", emoji: "🗓️", label: "Começo e esqueço" },
      { id: "sem_progresso", emoji: "📊", label: "Não vejo progresso" },
      { id: "sem_passo", emoji: "🧭", label: "Nunca sei o próximo passo" },
    ],
  },
};

/** T4 — a promessa por área: preview REAL do que o CORE manda (a infra
 *  desses lembretes existe — notificacoes.ts agenda por módulo). */
const PUSH_PREVIEW: Record<AreaKey, Array<{ quando: string; titulo: string; corpo: string }>> = {
  dinheiro: [
    { quando: "amanhã", titulo: "Conta de luz vence amanhã", corpo: "Marca como paga quando resolver — sem juros bobos." },
    { quando: "no seu horário", titulo: "Fechando o dia 💰", corpo: "Anota os gastos de hoje? Leva 10 segundos." },
  ],
  rotina: [
    { quando: "no seu horário", titulo: "Hora do seu hábito", corpo: "Marca o de hoje — a sequência é o que segura você." },
    { quando: "amanhã", titulo: "Seu dia, organizado", corpo: "3 coisas de hoje te esperando no painel." },
  ],
  corpo: [
    { quando: "no seu horário", titulo: "Treino de hoje 💪", corpo: "Seu plano tá pronto — registra quando terminar." },
    { quando: "amanhã", titulo: "Fechando a dieta", corpo: "Bateu a meta de hoje? Marca lá, 10 segundos." },
  ],
  saude: [
    { quando: "no seu horário", titulo: "Seu cuidado de hoje", corpo: "Água, sono, vitamina — marca o que já fez." },
    { quando: "amanhã", titulo: "Como você dormiu?", corpo: "Registra — o padrão aparece em uma semana." },
  ],
  metas: [
    { quando: "no seu horário", titulo: "Um passo na sua meta", corpo: "O de hoje leva 10 minutos. Progresso visível vicia." },
    { quando: "amanhã", titulo: "Sua meta continua viva", corpo: "Olha o quanto já andou — não deixa esfriar." },
  ],
};

/** O que a faixa do GuiaSemente vai instruir — mostrado aqui só como
 *  continuidade de copy; a instrução mesmo mora no componente global. */
const HORARIOS = [
  { id: "manha", emoji: <Sunrise className="w-5 h-5" />, label: "De manhã, começando o dia", hora: "8:30" },
  { id: "almoco", emoji: <Sun className="w-5 h-5" />, label: "Na pausa do almoço", hora: "12:30" },
  { id: "noite", emoji: <Moon className="w-5 h-5" />, label: "À noite, fechando o dia", hora: "19:30" },
] as const;

/* ---------------------------------------------------------- componentes */

function Progresso({ n }: { n: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex gap-1.5 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i <= n ? "bg-accent" : "bg-black/10"}`} />
      ))}
    </div>
  );
}

/** T1 — a única decisão da tela + a promessa do teste no 1º toque.
 *  A timeline "como funciona" volta da era assinatura (saiu 06/08 com o
 *  vitalício), adaptada: sem cartão, o Dia 3 é DECISÃO, não cobrança. */
function PortaTeste({ onPick }: { onPick: (a: AreaKey | "tudo") => void }) {
  const [sel, setSel] = useState<AreaKey | "tudo" | null>(null);
  return (
    <div className="w-full flex-1 flex flex-col">
      <Progresso n={1} />
      <h1 className="text-[24px] font-bold tracking-tight leading-tight">
        Qual área tá mais fora de<br />controle hoje?
      </h1>
      <p className="text-muted-foreground text-[13.5px] mt-1.5 mb-5">
        Seu teste grátis começa por ela. As outras 15 vêm junto.
      </p>
      <div className="space-y-2.5">
        {PORTA_OPCOES.map((o, i) => (
          <button
            key={o.key}
            onClick={() => { setSel(o.key); trackEvent("funnel_quiz_answer", { q: "porta_area", a: o.key, funil: FUNIL }); }}
            className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[15px] font-semibold transition-all active:scale-[0.99] ${
              sel === o.key ? "border-accent bg-accent/5 shadow-sm" : "border-transparent bg-white shadow-sm"
            }`}
          >
            <span
              className="w-9 h-9 rounded-xl grid place-items-center text-[18px] shrink-0"
              style={{ background: TILE_CORES[i % TILE_CORES.length] }}
            >
              {o.emoji}
            </span>
            {o.label}
            {sel === o.key && <Check className="w-4 h-4 text-accent ml-auto" strokeWidth={3} />}
          </button>
        ))}
      </div>
      <div className="mt-auto pt-5">
        <Button
          size="lg"
          className="w-full min-h-12 text-base font-bold"
          disabled={!sel}
          onClick={() => sel && onPick(sel)}
        >
          Começar meu teste grátis <ArrowRight className="w-4 h-4" />
        </Button>
        <div className="mt-3.5 pt-3 border-t border-dashed border-black/10 space-y-1.5">
          {[
            ["Hoje", "tudo liberado — sem cartão, sem cadastro"],
            ["Dia 2", "a gente te avisa que tá acabando"],
            ["Dia 3", "você decide. Sem cartão = impossível te cobrar"],
          ].map(([t, s]) => (
            <div key={t} className="flex gap-2.5 text-[11.5px] leading-snug">
              <b className="w-9 shrink-0 font-extrabold text-foreground">{t}</b>
              <span className="text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DorScreen({ area, onPick }: { area: AreaKey; onPick: (id: string) => void }) {
  const d = DOR[area];
  return (
    <div className="w-full flex-1 flex flex-col">
      <Progresso n={2} />
      <h1 className="text-[24px] font-bold tracking-tight leading-tight">{d.pergunta}</h1>
      <p className="text-muted-foreground text-[13.5px] mt-1.5 mb-5">Isso define o que o app resolve primeiro.</p>
      <div className="space-y-2.5">
        {d.opcoes.map((o, i) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className="w-full flex items-center gap-3 rounded-2xl border-2 border-transparent bg-white shadow-sm px-4 py-3 text-left text-[15px] font-semibold transition-all active:scale-[0.99] active:border-accent"
          >
            <span className="w-9 h-9 rounded-xl grid place-items-center text-[18px] shrink-0" style={{ background: TILE_CORES[(i + 2) % TILE_CORES.length] }}>
              {o.emoji}
            </span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HorarioScreen({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="w-full flex-1 flex flex-col">
      <Progresso n={3} />
      <h1 className="text-[24px] font-bold tracking-tight leading-tight">
        Que horário funciona<br />melhor pra você?
      </h1>
      <p className="text-muted-foreground text-[13.5px] mt-1.5 mb-5">
        É quando o CORE te dá um toque — um por dia, no máximo.
      </p>
      <div className="space-y-2.5">
        {HORARIOS.map((h) => (
          <button
            key={h.id}
            onClick={() => onPick(h.id)}
            className="w-full flex items-center gap-3 rounded-2xl border-2 border-transparent bg-white shadow-sm px-4 py-3.5 text-left text-[15px] font-semibold transition-all active:scale-[0.99] active:border-accent"
          >
            <span className="w-9 h-9 rounded-xl grid place-items-center text-accent bg-accent/10 shrink-0">{h.emoji}</span>
            {h.label}
            <span className="ml-auto text-[12px] font-bold text-muted-foreground">{h.hora}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** T4 — promessa ANTES do pedido: mostra exatamente o que vai chegar (da
 *  área escolhida) e só então pede a permissão. Última tela de funil: o
 *  toque seguinte abre o app DE VERDADE em modo guiado. */
function NotifScreen({ area, hora, onDone }: { area: AreaKey; hora: string | null; onDone: (pediu: boolean) => void }) {
  const [indo, setIndo] = useState(false);
  const previews = PUSH_PREVIEW[area];
  const horaLabel = HORARIOS.find((h) => h.id === hora)?.hora ?? "19:30";
  const seguir = async (pedir: boolean) => {
    if (indo) return;
    setIndo(true);
    trackEvent("funnel_click", { cta: pedir ? "notif_ativar" : "notif_pular", funil: FUNIL });
    if (pedir) {
      try { await pedirPermissao(); } catch { /* permissão nunca trava o funil */ }
    }
    onDone(pedir);
  };
  return (
    <div className="w-full flex-1 flex flex-col">
      <Progresso n={4} />
      <h1 className="text-[24px] font-bold tracking-tight leading-tight">
        Você escolheu <span className="text-accent">{AREAS[area].nome}</span>.
      </h1>
      <p className="text-muted-foreground text-[13.5px] mt-1.5 mb-5">
        Então é assim que a gente te ajuda — direto na tela do celular:
      </p>
      <div className="space-y-2.5">
        {previews.map((p) => (
          <div key={p.titulo} className="rounded-2xl bg-[#26221f]/95 text-white/95 px-4 py-3 shadow-lg">
            <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-widest opacity-70 mb-1">
              <span className="w-3.5 h-3.5 rounded bg-accent inline-block" /> CORE · {p.quando === "no seu horário" ? `hoje ${horaLabel}` : p.quando}
            </div>
            <div className="text-[13.5px] font-bold leading-tight">{p.titulo}</div>
            <div className="text-[12px] opacity-80 leading-snug mt-0.5">{p.corpo}</div>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-5">
        <Button size="lg" className="w-full min-h-12 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => void seguir(true)} disabled={indo}>
          {indo ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Ativar meus lembretes <Bell className="w-4 h-4" /></>}
        </Button>
        <button onClick={() => void seguir(false)} disabled={indo} className="w-full text-center text-[12.5px] text-muted-foreground mt-3 py-1">
          Agora não — abrir meu app
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- paywall do D3 */

type Recap = { texto: string };

/** Recap REAL do que a pessoa construiu no teste (guest storage). Se não fez
 *  nada, degrada pra semente/promessa — sempre há algo a perder. */
function useRecap(area: AreaKey | null): Recap[] {
  const { get } = useUserData();
  const linhas: Recap[] = [];
  try {
    const dueDays = get<Array<{ bills?: unknown[] }>>("finance-dueDays", []) ?? [];
    const contas = dueDays.reduce((n, d) => n + (Array.isArray(d?.bills) ? d.bills.length : 0), 0);
    if (contas > 0) linhas.push({ texto: `${contas} conta${contas > 1 ? "s" : ""} armada${contas > 1 ? "s" : ""} com lembrete` });
    const habitos = get<string[]>("rotina-habits", []) ?? [];
    if (habitos.length > 0) linhas.push({ texto: `${habitos.length} hábito${habitos.length > 1 ? "s" : ""} no painel` });
    const metas = get<unknown[]>("goals-board-v2", []) ?? [];
    if (metas.length > 0) linhas.push({ texto: `${metas.length} meta${metas.length > 1 ? "s" : ""} saindo do papel` });
    const treinos = get<unknown[]>("saude-workouts-v2", []) ?? [];
    if (Array.isArray(treinos) && treinos.length > 0) linhas.push({ texto: "Plano de treino montado" });
  } catch { /* recap nunca derruba o paywall */ }
  if (linhas.length === 0) {
    linhas.push({ texto: area ? `Seu painel de ${AREAS[area].nome} te esperando` : "Seu painel te esperando do jeito que você deixou" });
  }
  linhas.push({ texto: "Seus 3 dias de progresso — tudo fica salvo" });
  return linhas.slice(0, 3);
}

function PaywallTeste({ area, d3, onPagoSemConta }: { area: AreaKey | null; d3: boolean; onPagoSemConta: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const recap = useRecap(area);
  const teste = estadoTeste();
  const [plano, setPlano] = useState<"anual" | "mensal">("anual");
  const [oferta, setOferta] = useState<"cheia" | "downsell">("cheia");
  const [comprando, setComprando] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cancelamentos = useRef(0);

  useEffect(() => {
    trackEvent("app_paywall_view", { funil: FUNIL, modo: "assinatura", d3, dia: teste.fase === "ativo" ? teste.dia : teste.fase });
    // Aquece catálogo + pré-pago: quando o dedo chegar no CTA o produto já
    // está em memória (lição do Moto fraco, 07/08).
    void (async () => {
      const rc = await import("@/lib/revenuecat");
      await rc.initRevenueCat();
      await rc.prefetchAssinaturas();
    })();
    // Abandonou o paywall do D3? As 2 notificações de resgate são o único
    // canal de volta (cadastro é pós-compra: não existe e-mail ainda).
    void agendarResgateDoPlano(area ? AREAS[area].nome : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pagou = async (fn: () => Promise<boolean>, produto: string) => {
    if (comprando) return;
    setComprando(true);
    setErro(null);
    setPendente(false);
    trackEvent("funnel_click", { cta: "app_paywall_cta", funil: FUNIL, produto, oferta });
    const rc = await import("@/lib/revenuecat");
    const ok = await fn();
    if (ok) {
      trackEvent("app_sheet_success", { funil: FUNIL, produto });
      void cancelarResgateDoPlano();
      void cancelarReguaDoTeste();
      if (!user) { onPagoSemConta(); return; }
      window.location.href = "/";
      return;
    }
    const motivo = rc.motivoUltimaCompra();
    if (motivo === "pendente") {
      setPendente(true);
    } else if (motivo === "cancelou") {
      cancelamentos.current += 1;
      if (oferta === "cheia" && rc.temMensalPix()) {
        setOferta("downsell");
        trackEvent("app_downsell_view", { plano: "mensal_pix", origem: "cancelou_folha", funil: FUNIL });
      } else if (cancelamentos.current >= 2) {
        trackEvent("app_resgate_view", { funil: FUNIL });
      }
    } else if (motivo === "produto_ausente" || motivo === "catalogo") {
      setErro("Atualize o CORE na Play Store pra assinar — esta versão ficou sem o catálogo.");
    } else if (motivo) {
      setErro("O Google não concluiu o pagamento. Tenta de novo em instantes.");
    }
    setComprando(false);
  };

  const precoAnual = APP_PRECOS.anual.preco;
  const precoMensal = APP_PRECOS.mensal.preco;

  return (
    <div className="w-full max-w-sm mx-auto pb-6">
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-wider mb-3">
          {d3 || teste.fase === "expirado" ? "Seu teste terminou" : `Dia ${teste.fase === "ativo" ? teste.dia : 3} do seu teste`}
        </div>
        <h2 className="text-[26px] font-bold tracking-tight leading-tight">Seus 3 dias no CORE</h2>
      </div>

      <div className="rounded-2xl border border-border bg-white p-4 mb-4">
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">O que você construiu</div>
        {recap.map((r) => (
          <div key={r.texto} className="flex items-center gap-2.5 text-[13.5px] font-semibold py-1">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white grid place-items-center shrink-0">
              <Check className="w-3 h-3" strokeWidth={3.5} />
            </span>
            {r.texto}
          </div>
        ))}
      </div>

      {oferta === "downsell" ? (
        <div className="rounded-2xl border-2 border-accent bg-accent/5 p-4 mb-4">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-accent mb-1">Sem cartão? Sem problema</div>
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-bold">1 mês de CORE</span>
            <span className="text-[20px] font-extrabold">{APP_PRECOS.mensalPix.preco}</span>
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-snug mt-1.5">
            Paga no <b className="text-foreground">Pix, dentro do Google</b> — vale 30 dias e renova
            <b className="text-foreground"> só se você quiser</b>. Sem assinatura presa no cartão.
          </p>
        </div>
      ) : (
        <>
          <p className="text-[13px] text-muted-foreground text-center mb-3">
            <b className="text-foreground">Tudo isso fica salvo</b> se você continuar. Escolhe como:
          </p>
          <button
            onClick={() => setPlano("anual")}
            className={`w-full text-left rounded-2xl border-2 p-4 mb-2.5 relative transition-colors ${plano === "anual" ? "border-accent bg-accent/5" : "border-border bg-white"}`}
          >
            <span className="absolute -top-2.5 left-4 bg-accent text-white text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wide">MAIS ESCOLHIDO</span>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-extrabold">Anual</span>
              <span className="text-[19px] font-extrabold">{precoAnual}<small className="text-[11px] font-bold text-muted-foreground">/ano</small></span>
            </div>
            <div className="text-[12px] font-semibold text-muted-foreground mt-0.5">
              = {APP_PRECOS.anual.porMes}/mês · economiza {APP_PRECOS.anual.economiaAno} no ano
            </div>
          </button>
          <button
            onClick={() => setPlano("mensal")}
            className={`w-full text-left rounded-2xl border-2 p-3.5 mb-4 transition-colors ${plano === "mensal" ? "border-accent bg-accent/5" : "border-border bg-white"}`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-bold">Mensal</span>
              <span className="text-[16px] font-extrabold">{precoMensal}<small className="text-[11px] font-bold text-muted-foreground">/mês</small></span>
            </div>
            <div className="text-[11.5px] font-medium text-muted-foreground mt-0.5">cancele quando quiser</div>
          </button>
        </>
      )}

      {pendente && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-3 mb-3">
          <b>Pagamento em processamento no Google.</b> Se você gerou um Pix, paga no app do seu banco —
          o acesso libera sozinho aqui.
          <button
            className="block w-full text-center font-bold underline underline-offset-2 mt-1.5"
            onClick={async () => {
              const rc = await import("@/lib/revenuecat");
              await rc.restaurar();
              const ok = await rc.sincronizarAssinatura(2);
              if (ok) { void cancelarResgateDoPlano(); void cancelarReguaDoTeste(); if (!user) onPagoSemConta(); else window.location.href = "/"; }
            }}
          >
            Já paguei — atualizar
          </button>
        </div>
      )}
      {erro && <p className="text-[12.5px] text-destructive text-center mb-3">{erro}</p>}

      <Button
        size="lg"
        className="w-full min-h-12 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
        disabled={comprando}
        onClick={async () => {
          const rc = await import("@/lib/revenuecat");
          if (oferta === "downsell") void pagou(() => rc.comprarMensalPix(), APP_PRECOS.mensalPix.id);
          else void pagou(() => rc.comprar(APP_PRECOS[plano].id), APP_PRECOS[plano].id);
        }}
      >
        {comprando ? <Loader2 className="w-4 h-4 animate-spin" /> : oferta === "downsell"
          ? <>Pagar 1 mês no Pix <ArrowRight className="w-4 h-4" /></>
          : <>Continuar com meu CORE <ArrowRight className="w-4 h-4" /></>}
      </Button>
      <p className="text-[10.5px] text-muted-foreground text-center mt-2">
        {oferta === "downsell"
          ? "Pagamento único pelo Google Play · 30 dias de acesso · renovação manual"
          : "Pagamento pelo Google Play · cancele quando quiser"}
      </p>
      {teste.fase === "ativo" && !d3 && (
        <button onClick={() => navigate("/home")} className="w-full text-center text-[12px] text-muted-foreground underline underline-offset-2 mt-3 py-1">
          Continuar meu teste — decido no dia 3
        </button>
      )}
      <div className="mt-4">
        <AppLegalFooter />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- orquestra */

export default function ComecarTeste() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, isSubscribed, loading: authLoading } = useAuth();
  const d3 = params.get("d3") === "1";
  const [step, setStep] = useState<Step>(() => {
    const s = params.get("step");
    if (s === "signup" || s === "plano") return "signup";
    if (s === "offer" || s === "trial") return "offer";
    // Sem step explícito: teste expirado cai direto na decisão do D3.
    return estadoTeste().fase === "expirado" ? "offer" : "porta";
  });
  const [area, setArea] = useState<AreaKey | null>(() => {
    try {
      const a = localStorage.getItem(FUNNEL_AREA_KEY);
      return a && a in AREAS ? (a as AreaKey) : null;
    } catch { return null; }
  });
  const [hora, setHora] = useState<string | null>(() => {
    try { return localStorage.getItem("core-lembrete-hora"); } catch { return null; }
  });
  const [posCompra, setPosCompra] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const stepRef = useRef(step);
  stepRef.current = step;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    trackEvent("funnel_view", { step: step === "offer" ? "offer_d3" : step, funil: FUNIL });
  }, [step]);

  /* Retomadas do "pagou e ainda não tem conta" — mesmo desenho da v48:
     OAuth volta com a flag → liberando; app morto entre folha e cadastro →
     compra local (vitalícia OU assinatura) manda direto pro signup. */
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      let flagOauth = false;
      try { flagOauth = localStorage.getItem(POS_COMPRA_OAUTH_KEY) === "1"; } catch { /* noop */ }
      if (flagOauth) {
        try { localStorage.removeItem(POS_COMPRA_OAUTH_KEY); } catch { /* noop */ }
        setPosCompra(true);
        setStep("liberando");
      }
      return;
    }
    let vivo = true;
    import("@/lib/revenuecat")
      .then(async (m) => (await m.compraVitaliciaLocal()) || (await m.compraAssinaturaLocal()))
      .then((tem) => {
        if (!vivo || !tem || userRef.current) return;
        trackEvent("app_pos_compra_retomada", { funil: FUNIL });
        setPosCompra(true);
        setStep("signup");
      })
      .catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  /* Reabertura >30min parado no meio das perguntas = visita nova (recomeça
     da porta). Oferta/cadastro nunca resetam — lead quente não perde o lugar. */
  useEffect(() => {
    let escondidoDesde = 0;
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "hidden") { escondidoDesde = Date.now(); return; }
      if (!escondidoDesde || Date.now() - escondidoDesde < 30 * 60_000) return;
      escondidoDesde = 0;
      const s = stepRef.current;
      if (userRef.current || s === "offer" || s === "signup" || s === "confirm" || s === "liberando") return;
      trackEvent("app_welcome_reset", { de: s, funil: FUNIL });
      setStep("porta");
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, []);

  // Assinante logado não tem o que fazer aqui.
  if (user && isSubscribed) return <Navigate to="/home" replace />;
  // Convidado com teste RODANDO que caiu no /app sem pedir nada específico:
  // o lugar dele é o app (o RootGate já faz isso; deep link cai aqui).
  if (!user && estadoTeste().fase === "ativo" && !params.get("step") && step === "porta") {
    return <Navigate to="/home" replace />;
  }

  /** Fim do funil: liga o relógio, agenda a régua e abre o MÓDULO REAL em
   *  modo guiado. A ordem importa — o gate das rotas de módulo só deixa
   *  convidado passar com teste ATIVO. */
  const abrirApp = (pediuNotif: boolean) => {
    const a = area ?? "dinheiro";
    const estado = iniciarTeste(a);
    if (pediuNotif && estado.fase === "ativo") {
      void agendarReguaDoTeste(a, estado.inicio, hora);
    }
    armarGuiaSemente(a);
    trackEvent("funnel_click", { cta: "teste_abrir_app", area: a, funil: FUNIL });
    navigate(`/${AREAS[a].module}`, { replace: true });
  };

  const telaCheia = step === "offer" || step === "signup" || step === "confirm" || step === "liberando";
  return (
    <div
      style={{ ...LIGHT_VARS, ...(telaCheia ? {} : { background: CEU_SUAVE }) }}
      className={`min-h-dvh ${telaCheia ? "bg-white" : "h-dvh overflow-hidden"} text-foreground flex flex-col`}
    >
      <div className={`flex-1 flex flex-col ${telaCheia ? "items-center justify-center px-5 py-10" : "px-5 pt-4 pb-6"}`}>
        <AnimatePresence mode="wait">
          <motion.div key={step} {...slide} className={telaCheia ? "w-full" : "w-full flex-1 flex flex-col"}>
            {step === "porta" && (
              <PortaTeste
                onPick={(k) => {
                  const a: AreaKey = k === "tudo" ? "dinheiro" : k;
                  setArea(a);
                  try { localStorage.setItem(FUNNEL_AREA_KEY, a); } catch { /* noop */ }
                  setStep("dor");
                }}
              />
            )}
            {step === "dor" && (
              <DorScreen
                area={area ?? "dinheiro"}
                onPick={(id) => {
                  try { localStorage.setItem("core-teste-dor", id); } catch { /* noop */ }
                  trackEvent("funnel_quiz_answer", { q: "dor", a: id, area: area ?? "dinheiro", funil: FUNIL });
                  setStep("horario");
                }}
              />
            )}
            {step === "horario" && (
              <HorarioScreen
                onPick={(id) => {
                  setHora(id);
                  try { localStorage.setItem("core-lembrete-hora", id); } catch { /* noop */ }
                  trackEvent("funnel_quiz_answer", { q: "horario", a: id, funil: FUNIL });
                  setStep("notif");
                }}
              />
            )}
            {step === "notif" && <NotifScreen area={area ?? "dinheiro"} hora={hora} onDone={abrirApp} />}
            {step === "offer" && (
              <PaywallTeste
                area={area}
                d3={d3}
                onPagoSemConta={() => { setPosCompra(true); setStep("signup"); }}
              />
            )}
            {step === "signup" && (
              <SignupScreen
                posCompra={posCompra}
                onSession={() => setStep(posCompra ? "liberando" : "offer")}
                onConfirm={(e) => { setConfirmEmail(e); setStep("confirm"); }}
              />
            )}
            {step === "confirm" && <ConfirmScreen email={confirmEmail} />}
            {step === "liberando" && <LiberandoScreen />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
