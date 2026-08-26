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
 * Produto: assinatura — anual R$ 97,90 (herói, = R$ 8,16/mês) + mensal
 * R$ 24,90. Downsell pós-cancelamento da folha: R$ 19,90/mês no Pix,
 * pré-pago de 30 dias, renovação manual (decisão do dono 16/08).
 *
 * A web NUNCA vê este arquivo: /app só renderiza ele no shell (App.tsx);
 * /funil-radar continua congelado como era.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowRight, Bell, Check, Loader2, Moon, Sun, Sunrise } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AREAS, DOOR_AREAS, FUNNEL_AREA_KEY, type AreaKey } from "@/lib/funnel";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
// 18/08: iniciarTeste/armarGuiaSemente/agendarReguaDoTeste saíram — o teste
// caseiro morreu pra entrada nova (trial é da folha do Google agora).
import { estadoTeste } from "@/lib/teste-gratis";
import { pedirPermissao } from "@/lib/notificacoes";
import { pedirAvaliacaoSePuder } from "@/lib/avaliacao";
import { barraClaraEnquantoMontado } from "@/lib/status-bar";
import {
  SignupScreen, ConfirmScreen, LiberandoScreen, POS_COMPRA_OAUTH_KEY,
} from "@/pages/funis/radar/ComecarRadar";
// A venda de assinatura mora num componente só (as 3 superfícies do app usam
// o mesmo) — ver o cabeçalho do PaywallAssinatura.
import { PaywallAssinatura } from "@/components/paywall/PaywallAssinatura";
// v60: a welcome azul da grade viva vira a T0 do funil (promessa antes de
// pergunta) — mesma tela do /inicio, overlay fixed autocontido.
import { AppWelcome } from "@/components/app/AppWelcome";

const FUNIL = "teste";

// v60 (18/08, blueprint fusão BitePal aprovado pelo dono): welcome azul na
// frente, mecanismo entre dor e horário, sininho no lugar da tela estática
// de notificação, loading teatral antes do gate. Leis aplicadas: cor é modo
// (céu = pergunta, grafite = emoção), todo input devolve algo, prova
// intercalada, CTA grafite, single-select avança sozinho.
type Step =
  | "welcome" | "promessas" | "porta" | "dor" | "antesdepois" | "mecanismo" | "horario" | "notif"
  | "montando" | "resultado" | "compromissos" | "contrato" | "offer" | "signup" | "confirm" | "liberando";

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

// Grafite da AppWelcome — o CTA e as telas de emoção falam esta cor, não o
// magenta (lei BitePal: cor de marca cheia só nos picos).
const GRAFITE = "#16121c";
const FUNDO_ESCURO =
  "radial-gradient(85% 42% at 50% 0%, rgba(126,198,246,.16) 0%, rgba(126,198,246,0) 70%), #16121c";

/** Cascata da welcome aplicada às opções de toda tela de pergunta. */
const chove = (i: number) => ({
  initial: { opacity: 0, y: -16, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { delay: 0.08 + i * 0.055, type: "spring" as const, stiffness: 300, damping: 22 },
});

/** CTA pílula grafite — a mesma pegada do "Começar" da welcome. */
const CTA_GRAFITE =
  "w-full min-h-[54px] rounded-full text-[16.5px] font-extrabold text-white active:scale-[0.985] transition-transform grid place-items-center";

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

/** O ECO da dor (v60, lei BitePal "todo input devolve algo"): tocou na
 *  opção, o app responde na hora com o que resolve AQUELA dor — razão
 *  dado/recebido 1:1, a diferença entre conversa e formulário. */
const ECO: Record<string, string> = {
  gasto_invisivel: "O CORE te mostra pra onde cada real vai — em tempo real.",
  esqueco_contas: "Cada conta com lembrete antes de vencer. Juros nunca mais.",
  nao_guardo: "Meta de guardar + acompanhamento — o app segura sua mão.",
  sem_visao: "Um painel só com tudo: entrou, saiu, sobrou.",
  largo_dia3: "Constância é sistema, não força de vontade. A gente arma o seu.",
  esqueco_tarefas: "Sua cabeça esquece. Seu painel não.",
  procrastino: "Um passo pequeno por dia — e o app te cobra na hora certa.",
  sem_tempo: "Vendo o dia inteiro num lugar só, o tempo aparece.",
  constancia: "Check de treino + sequência viva — desistir fica difícil.",
  sem_plano: "Plano de treino pronto pra seguir e marcar.",
  comer_mal: "Diário de dieta simples — clareza sem neura.",
  sozinho: "O app treina junto: lembra, marca e comemora com você.",
  agua: "Lembrete de água no seu horário + contador de copos.",
  sono: "Registro de sono — o padrão aparece em poucos dias.",
  remedio: "Vitamina e remédio com alarme na hora certa.",
  checkup: "Consultas e exames com data marcada no painel.",
  so_cabeca: "Meta escrita vira plano — com o próximo passo sempre visível.",
  esqueco: "A meta fica viva no painel, te esperando todo dia.",
  sem_progresso: "Barra de progresso real — ver andar vicia.",
  sem_passo: "O CORE quebra a meta em passos de 10 minutos.",
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

/** Barra contínua fina (estilo BitePal) — o preenchimento ANDA com spring
 *  a cada passo, em vez de blocos acendendo. */
function Progresso({ n }: { n: 1 | 2 | 3 | 4 }) {
  return (
    <div className="h-1 rounded-full bg-black/10 mb-6 overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-accent"
        initial={false}
        animate={{ width: `${(n / 4) * 100}%` }}
        transition={{ type: "spring", stiffness: 170, damping: 26 }}
      />
    </div>
  );
}

/** T1 (v60) — UMA função só: escolher a área. Toque avança sozinho (lei
 *  BitePal: single-select sem Next); CTA e timeline saíram — a timeline do
 *  trial mora agora na tela do gate, onde é a estrela. Cards chovem em
 *  cascata igual a grade da welcome (mesmo spring, mesma família). */
function PortaTeste({ onPick }: { onPick: (a: AreaKey | "tudo") => void }) {
  const [sel, setSel] = useState<AreaKey | "tudo" | null>(null);
  const escolher = (k: AreaKey | "tudo") => {
    if (sel) return; // primeira escolha vale — nada de trocar no meio do voo
    setSel(k);
    trackEvent("funnel_quiz_answer", { q: "porta_area", a: k, funil: FUNIL });
    window.setTimeout(() => onPick(k), 430);
  };
  return (
    <div className="w-full flex-1 flex flex-col">
      <Progresso n={1} />
      <motion.h1
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="text-[29px] font-black tracking-[-0.03em] leading-[1.08]"
      >
        Qual área tá mais fora<br />de controle hoje?
      </motion.h1>
      <p className="text-muted-foreground text-[13.5px] mt-2 mb-1">
        Seu CORE começa por ela. As outras 15 vêm junto.
      </p>
      {/* 23/08 (dono): o "entrar" saiu DESTA tela — quem tem conta usa o
          "Já tenho conta? Entrar" da welcome, um passo antes. Pergunta limpa. */}
      <div className="space-y-2.5">
        {PORTA_OPCOES.map((o, i) => (
          <motion.button
            key={o.key}
            {...chove(i)}
            onClick={() => escolher(o.key)}
            className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[15px] font-semibold ${
              sel === o.key ? "border-accent bg-accent/5 shadow-md" : "border-transparent bg-white shadow-sm"
            } ${sel && sel !== o.key ? "opacity-45" : ""} transition-opacity`}
            whileTap={{ scale: 0.97 }}
          >
            {/* layoutId casa com o tile da welcome: no Começar ele VOA da
                grade pro card (shared element). "tudo" não tem par — entra
                normal pela cascata. */}
            <motion.span
              layoutId={o.key === "tudo" ? undefined : `apw-tile-${o.emoji}`}
              className="w-10 h-10 rounded-xl grid place-items-center text-[19px] shrink-0 shadow-[0_10px_18px_-10px_rgba(20,60,110,.4)]"
              style={{ background: TILE_CORES[i % TILE_CORES.length], rotate: i % 2 ? "3deg" : "-3deg" }}
            >
              {o.key === "tudo" ? (
                <span className="grid grid-cols-2 text-[9px] leading-[1.05]"><span>💰</span><span>📅</span><span>💪</span><span>🎯</span></span>
              ) : o.emoji}
            </motion.span>
            {o.label}
            {sel === o.key && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="ml-auto">
                <Check className="w-4 h-4 text-accent" strokeWidth={3.5} />
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/** T2 (v60) — a dor com ECO: a resposta devolve na hora o que o CORE faz
 *  por AQUELA dor, e só então a tela vira. */
function DorScreen({ area, onPick }: { area: AreaKey; onPick: (id: string) => void }) {
  const d = DOR[area];
  const [sel, setSel] = useState<string | null>(null);
  const escolher = (id: string) => {
    if (sel) return;
    setSel(id);
    trackEvent("funnel_quiz_answer", { q: "dor", a: id, area, funil: FUNIL });
    window.setTimeout(() => onPick(id), 1250);
  };
  return (
    <div className="w-full flex-1 flex flex-col">
      <Progresso n={2} />
      <motion.h1
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="text-[29px] font-black tracking-[-0.03em] leading-[1.08]"
      >
        {d.pergunta}
      </motion.h1>
      <p className="text-muted-foreground text-[13.5px] mt-2 mb-5">Isso define o que o app resolve primeiro.</p>
      <div className="space-y-2.5">
        {d.opcoes.map((o, i) => (
          <motion.button
            key={o.id}
            {...chove(i)}
            onClick={() => escolher(o.id)}
            whileTap={{ scale: 0.97 }}
            className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[15px] font-semibold ${
              sel === o.id ? "border-accent bg-accent/5 shadow-md" : "border-transparent bg-white shadow-sm"
            } ${sel && sel !== o.id ? "opacity-45" : ""} transition-opacity`}
          >
            <span
              className="w-10 h-10 rounded-xl grid place-items-center text-[19px] shrink-0 shadow-[0_10px_18px_-10px_rgba(20,60,110,.4)]"
              style={{ background: TILE_CORES[(i + 2) % TILE_CORES.length], rotate: i % 2 ? "-3deg" : "3deg" }}
            >
              {o.emoji}
            </span>
            {o.label}
          </motion.button>
        ))}
      </div>
      {/* O eco — desce como resposta de conversa, não como validação de form */}
      <AnimatePresence>
        {sel && ECO[sel] && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 24, delay: 0.15 }}
            className="mt-4 rounded-2xl px-4 py-3.5 text-[13.5px] font-semibold text-white shadow-lg"
            style={{ background: GRAFITE }}
          >
            <span className="block text-[10px] uppercase tracking-widest opacity-60 mb-0.5">o CORE resolve assim</span>
            {ECO[sel]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** T2.5 (v60, NOVA) — o interstitial de mecanismo: a única tela "cheia"
 *  entre perguntas (lei da prova intercalada — nunca 3 perguntas seguidas
 *  sem uma tela de convencimento). Grafite = modo emoção. */
function MecanismoScreen({ onNext }: { onNext: () => void }) {
  const PILARES: Array<[string, string, string, string]> = [
    ["✍️", "#fdeccb", "Anota em 10 segundos", "Gasto, treino, hábito — sem fricção."],
    ["📊", "#d9e4fb", "Vê tudo num painel só", "16 módulos, uma vida inteira na sua frente."],
    ["🔔", "#fbd8e8", "O app te lembra sozinho", "Você não precisa lembrar de lembrar."],
  ];
  return (
    <div className="w-full flex-1 flex flex-col px-1">
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/50 mt-2"
      >
        Por que funciona
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.4 }}
        className="text-[28px] font-black tracking-[-0.03em] leading-[1.06] text-white mt-1 mb-5"
      >
        Não é disciplina.<br />É visibilidade.
      </motion.h1>
      <div className="space-y-3">
        {PILARES.map(([emo, cor, titulo, sub], i) => (
          <motion.div
            key={titulo}
            initial={{ opacity: 0, y: -14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.34 + i * 0.14, type: "spring", stiffness: 300, damping: 22 }}
            className="flex items-center gap-3.5 rounded-2xl bg-white/[0.07] border border-white/10 px-4 py-3.5"
          >
            <span
              className="w-11 h-11 rounded-xl grid place-items-center text-[20px] shrink-0"
              style={{ background: cor, rotate: i % 2 ? "3deg" : "-3deg" }}
            >
              {emo}
            </span>
            <span>
              <span className="block text-[15px] font-extrabold text-white leading-tight">{titulo}</span>
              <span className="block text-[12.5px] text-white/55 leading-snug mt-0.5">{sub}</span>
            </span>
          </motion.div>
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}
        className="text-center text-[12.5px] text-white/60 mt-4"
      >
        <span className="text-[#f0a500]">★★★★★</span> <b className="text-white/90">+1000 pessoas</b> organizando a vida
      </motion.p>
      <div className="mt-auto pt-4 pb-1">
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          onClick={onNext}
          className={`${CTA_GRAFITE} bg-white !text-[#16121c] shadow-[0_18px_38px_-10px_rgba(0,0,0,.55)]`}
        >
          <span className="flex items-center gap-1.5">Continuar <ArrowRight className="w-4 h-4" /></span>
        </motion.button>
      </div>
    </div>
  );
}

/** T3 (v60) — horário com PREVIEW AO VIVO: tocou, a notificação de exemplo
 *  se redesenha na hora com o horário escolhido (padrão da roleta do
 *  BitePal que atualiza a "eating window" em tempo real). */
function HorarioScreen({ area, onPick }: { area: AreaKey; onPick: (id: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const preview = PUSH_PREVIEW[area][1] ?? PUSH_PREVIEW[area][0];
  const horaSel = HORARIOS.find((h) => h.id === sel)?.hora;
  const escolher = (id: string) => {
    if (sel) return;
    setSel(id);
    trackEvent("funnel_quiz_answer", { q: "horario", a: id, funil: FUNIL });
    window.setTimeout(() => onPick(id), 1350);
  };
  return (
    <div className="w-full flex-1 flex flex-col">
      <Progresso n={3} />
      <motion.h1
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="text-[29px] font-black tracking-[-0.03em] leading-[1.08]"
      >
        Que horário funciona<br />melhor pra você?
      </motion.h1>
      <p className="text-muted-foreground text-[13.5px] mt-2 mb-5">
        É quando o CORE te dá um toque — um por dia, no máximo.
      </p>
      <div className="space-y-2.5">
        {HORARIOS.map((h, i) => (
          <motion.button
            key={h.id}
            {...chove(i)}
            onClick={() => escolher(h.id)}
            whileTap={{ scale: 0.97 }}
            className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-[15px] font-semibold ${
              sel === h.id ? "border-accent bg-accent/5 shadow-md" : "border-transparent bg-white shadow-sm"
            } ${sel && sel !== h.id ? "opacity-45" : ""} transition-opacity`}
          >
            <span className="w-10 h-10 rounded-xl grid place-items-center text-accent bg-accent/10 shrink-0">{h.emoji}</span>
            {h.label}
            <span className="ml-auto text-[12px] font-bold text-muted-foreground">{h.hora}</span>
          </motion.button>
        ))}
      </div>
      {/* preview ao vivo — chega como notificação de verdade, já no horário escolhido */}
      <AnimatePresence>
        {sel && (
          <motion.div
            initial={{ opacity: 0, y: -22, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.12 }}
            className="mt-4 rounded-2xl bg-white shadow-[0_18px_40px_-14px_rgba(20,60,110,.45)] px-4 py-3 border border-black/[0.05]"
          >
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              <span className="w-3.5 h-3.5 rounded bg-accent inline-block" /> CORE · todo dia {horaSel}
            </div>
            <div className="text-[13.5px] font-bold leading-tight">{preview.titulo}</div>
            <div className="text-[12px] text-muted-foreground leading-snug mt-0.5">{preview.corpo}</div>
          </motion.div>
        )}
      </AnimatePresence>
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
  // Vibração sincronizada com cada notificação pousando — o celular "recebe"
  // o lembrete de mentirinha. Best-effort: sem API, sem drama.
  useEffect(() => {
    const ids = previews.map((_, i) =>
      window.setTimeout(() => { try { navigator.vibrate?.(30); } catch { /* sem vibra */ } }, 750 + i * 620),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="w-full flex-1 flex flex-col px-1">
      {/* Bloco central flutua no meio da tela — sem o vão morto entre as
          notificações e o CTA que aparecia em tela alta. */}
      <div className="flex-1 flex flex-col justify-center pb-3">
      {/* O SININHO — pico de emoção do funil (72% já ativavam com a tela
          estática; esta é a versão "se o BitePal tivesse lembretes") */}
      <div className="relative grid place-items-center mb-2 h-[108px]">
        {[0, 1].map((r) => (
          <motion.span
            key={r}
            className="absolute w-[84px] h-[84px] rounded-full border border-white/20"
            animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut", delay: 0.4 + r * 0.65 }}
          />
        ))}
        <motion.div
          className="w-[84px] h-[84px] rounded-full bg-white/10 border border-white/15 grid place-items-center"
          animate={{ rotate: [0, -17, 13, -8, 4, 0] }}
          transition={{ delay: 0.3, duration: 1.15, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.4 }}
          style={{ transformOrigin: "50% 12%" }}
        >
          <Bell className="w-9 h-9 text-white" strokeWidth={1.7} fill="rgba(255,255,255,.14)" />
        </motion.div>
      </div>
      <motion.h1
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}
        className="text-[27px] font-black tracking-[-0.03em] leading-[1.1] text-white text-center"
      >
        Você escolheu {AREAS[area].nome}.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="text-white/60 text-[13.5px] mt-1.5 mb-5 text-center"
      >
        É assim que o CORE aparece na sua tela — um toque por dia, no seu horário.
      </motion.p>
      <div className="space-y-3">
        {previews.map((p, i) => (
          <motion.div
            key={p.titulo}
            initial={{ opacity: 0, y: -110, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.62 + i * 0.62, type: "spring", stiffness: 260, damping: 17 }}
            className="rounded-2xl bg-white text-[#16121c] px-4 py-3 shadow-[0_22px_44px_-14px_rgba(0,0,0,.6)]"
          >
            <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-widest text-black/45 mb-1">
              <span className="w-3.5 h-3.5 rounded bg-accent inline-block" />
              CORE · {p.quando === "no seu horário" ? `todo dia ${horaLabel}` : p.quando}
              <span className="ml-auto normal-case tracking-normal">agora</span>
            </div>
            <div className="text-[13.5px] font-bold leading-tight">{p.titulo}</div>
            <div className="text-[12px] text-black/60 leading-snug mt-0.5">{p.corpo}</div>
          </motion.div>
        ))}
      </div>
      </div>
      <div className="mt-auto pt-4 pb-1">
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}
          onClick={() => void seguir(true)}
          disabled={indo}
          className={`${CTA_GRAFITE} bg-white !text-[#16121c] shadow-[0_18px_38px_-10px_rgba(0,0,0,.55)]`}
        >
          {indo ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex items-center gap-1.5">Ativar meus lembretes <Bell className="w-4 h-4" /></span>}
        </motion.button>
        <button onClick={() => void seguir(false)} disabled={indo} className="w-full text-center text-[12.5px] text-white/50 mt-3 py-1">
          Agora não — continuar
        </button>
      </div>
    </div>
  );
}

/** T5 (v60, NOVA) — loading teatral: o plano ganha valor porque a pessoa VÊ
 *  ele ser montado (labor illusion, "Personalizing plan 76%" do BitePal).
 *  O progresso tem PAUSAS de propósito — barra que voa não convence. */
function MontandoScreen({ area, hora, onDone }: { area: AreaKey; hora: string | null; onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const horaLabel = HORARIOS.find((h) => h.id === hora)?.hora ?? "19:30";
  const ITENS = [
    { at: 22, texto: "Lendo suas respostas" },
    { at: 50, texto: `Armando seus lembretes de ${horaLabel}` },
    { at: 80, texto: "Preparando os 16 módulos" },
    // dia-agnóstico de propósito: o Nº de dias grátis vem do catálogo da Play
    // (3→7 em 23/08) e esta tela roda ANTES do prefetch — quem promete número
    // é o paywall, que lê da folha.
    { at: 100, texto: "Liberando seu teste grátis" },
  ];
  const fim = useRef(false);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const t = Date.now() - t0;
      let p: number;
      if (t < 1150) p = (t / 1150) * 38;
      else if (t < 1450) p = 38;
      else if (t < 2550) p = 38 + ((t - 1450) / 1100) * 41;
      else if (t < 2900) p = 79;
      else p = Math.min(100, 79 + ((t - 2900) / 820) * 21);
      setPct(Math.round(p));
      if (p >= 100 && !fim.current) {
        fim.current = true;
        window.clearInterval(id);
        window.setTimeout(onDone, 550);
      }
    }, 50);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const R = 54;
  const CIRC = 2 * Math.PI * R;
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center px-1">
      <div className="relative w-[148px] h-[148px] grid place-items-center mb-7">
        <svg width="148" height="148" viewBox="0 0 148 148" className="-rotate-90">
          <circle cx="74" cy="74" r={R} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth="9" />
          <circle
            cx="74" cy="74" r={R} fill="none" stroke="hsl(330 65% 50%)" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset 120ms linear" }}
          />
        </svg>
        <span className="absolute text-[34px] font-black tracking-[-0.03em]">{pct}%</span>
      </div>
      <h1 className="text-[24px] font-black tracking-[-0.03em] mb-6 text-center">
        Montando seu CORE<br />de {AREAS[area].nome}…
      </h1>
      <div className="w-full max-w-[300px] space-y-3 mb-8">
        {ITENS.map((it, i) => {
          const feito = pct >= it.at;
          const ativo = !feito && (i === 0 || pct >= ITENS[i - 1].at);
          return (
            <div key={it.texto} className={`flex items-center gap-2.5 text-[13.5px] font-semibold ${feito ? "" : ativo ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
              {feito ? (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  className="w-5 h-5 rounded-full bg-emerald-500 text-white grid place-items-center shrink-0">
                  <Check className="w-3 h-3" strokeWidth={3.5} />
                </motion.span>
              ) : ativo ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground shrink-0" />
              ) : (
                <span className="w-5 h-5 rounded-full border-2 border-black/10 shrink-0" />
              )}
              {it.texto}
            </div>
          );
        })}
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        <span className="text-[#f0a500]">★★★★★</span> <b className="text-foreground">+1000 pessoas</b> organizando a vida
      </p>
    </div>
  );
}


/* ---------------------------------------------- telas do funil Me+ (23/08)
 * Pivô à vista aprovado pelo dono: o que nos faltava (dado: 74% olham o
 * paywall e não tocam) era o INVESTIMENTO da pessoa antes do preço — o Me+
 * resolve com promessa → antes/depois → resultado → micro-compromissos →
 * contrato assinado. Adaptado com números REAIS (nada de "31 milhões"). */

/** T0.5 — promessas automáticas (prime emocional, ~4s, toque pula). */
function PromessasScreen({ onDone }: { onDone: () => void }) {
  const FRAMES = [
    { bg: "#fdeccb", emoji: "🗂️", t: "Mais organização" },
    { bg: "#cdeeee", emoji: "🔁", t: "Mais constância" },
    { bg: "#d9e4fb", emoji: "✨", t: "Sua vida inteira num lugar" },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= FRAMES.length) { onDone(); return; }
    const id = window.setTimeout(() => setI((v) => v + 1), 1150);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  const f = FRAMES[Math.min(i, FRAMES.length - 1)];
  return (
    <button
      onClick={onDone}
      className="fixed inset-0 z-[5] w-full grid place-items-center transition-colors duration-500"
      style={{ background: f.bg }}
      aria-label="Pular apresentação"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={f.t}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.32 }}
          className="text-center px-8"
        >
          <div className="text-[56px] leading-none mb-4">{f.emoji}</div>
          <div className="text-[30px] font-black tracking-[-0.02em] text-[#16121c]">{f.t}</div>
        </motion.div>
      </AnimatePresence>
    </button>
  );
}

/** Interstitial antes/depois (Me+ tem ilustração; nós contamos com as dores
 *  REAIS da área escolhida — personalização barata que ilustração não dá). */
function AntesDepoisScreen({ area, onNext }: { area: AreaKey; onNext: () => void }) {
  const HOJE: Record<AreaKey, string[]> = {
    dinheiro: ["Contas na cabeça", "Gasto que some", "Culpa no fim do mês"],
    rotina: ["Começa e larga", "Dia que não rende", "Tarefa esquecida"],
    corpo: ["Treino sem plano", "Semana sim, mês não", "Desânimo sozinho"],
    saude: ["Água esquecida", "Sono bagunçado", "Remédio atrasado"],
    metas: ["Meta só na cabeça", "Zero progresso visível", "Sempre 'segunda-feira'"],
  };
  const DEPOIS = ["Lembrete que chega na hora", "Tudo num painel só", "Progresso que dá pra VER"];
  return (
    <div className="w-full flex-1 flex flex-col pt-2">
      <h1 className="text-[24px] font-black tracking-[-0.02em] leading-tight text-center mb-5">
        Você conhece essa<br />sensação?
      </h1>
      <div className="grid grid-cols-2 gap-2.5">
        <motion.div {...chove(0)} className="rounded-2xl bg-black/[0.05] border border-black/[0.06] p-3.5">
          <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-black/40 mb-2">Hoje</div>
          {HOJE[area].map((l) => (
            <div key={l} className="flex items-start gap-1.5 text-[12.5px] font-semibold text-black/55 py-1 leading-snug">
              <span className="mt-[1px]">😵‍💫</span> {l}
            </div>
          ))}
        </motion.div>
        <motion.div {...chove(1)} className="rounded-2xl border p-3.5" style={{ background: "linear-gradient(180deg,#eaf5fd,#f7fbff)", borderColor: "rgba(126,198,246,.45)" }}>
          <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-[#1c76c8] mb-2">Com o CORE</div>
          {DEPOIS.map((l) => (
            <div key={l} className="flex items-start gap-1.5 text-[12.5px] font-bold text-[#16121c] py-1 leading-snug">
              <Check className="w-3.5 h-3.5 mt-[2px] shrink-0 text-emerald-600" strokeWidth={3} /> {l}
            </div>
          ))}
        </motion.div>
      </div>
      <div className="mt-auto pt-5 pb-1">
        <motion.button {...chove(2)} onClick={onNext} className={CTA_GRAFITE} style={{ background: GRAFITE }}>
          <span className="flex items-center gap-1.5">Continuar <ArrowRight className="w-4 h-4" /></span>
        </motion.button>
      </div>
    </div>
  );
}

/** Resultado do quiz (Me+: medidores) — o espelho motivacional com o único
 *  número que é NOSSO de verdade: 2+ registros na 1ª semana = fica. */
function ResultadoScreen({ area, onNext }: { area: AreaKey; onNext: () => void }) {
  const [enche, setEnche] = useState(false);
  useEffect(() => { const id = window.setTimeout(() => setEnche(true), 350); return () => window.clearTimeout(id); }, []);
  const barras = [
    { rot: `Organização em ${AREAS[area].nome} hoje`, pct: 26, cor: "#e0654a" },
    { rot: "Potencial com um sistema do teu lado", pct: 91, cor: "#127a56" },
  ];
  return (
    <div className="w-full flex-1 flex flex-col pt-2">
      <div className="text-center mb-5">
        <div className="inline-flex px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-wider mb-2">
          Seu resultado
        </div>
        <h1 className="text-[24px] font-black tracking-[-0.02em] leading-tight">
          Seu ponto de partida
        </h1>
      </div>
      <div className="rounded-2xl border border-border bg-white p-4 space-y-4">
        {barras.map((b) => (
          <div key={b.rot}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[12.5px] font-bold">{b.rot}</span>
              <span className="text-[13px] font-black tabular-nums" style={{ color: b.cor }}>{b.pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-black/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-1000 ease-out"
                style={{ width: enche ? `${b.pct}%` : "0%", background: b.cor }}
              />
            </div>
          </div>
        ))}
      </div>
      <motion.p {...chove(2)} className="text-[12.5px] text-muted-foreground text-center leading-snug mt-4 px-2">
        Dado real de quem usa o CORE: registrar <b className="text-foreground">2+ vezes na primeira semana</b>{" "}
        é o que separa quem vira a chave de quem desiste.
      </motion.p>
      <div className="mt-auto pt-5 pb-1">
        <motion.button {...chove(3)} onClick={onNext} className={CTA_GRAFITE} style={{ background: GRAFITE }}>
          <span className="flex items-center gap-1.5">Ver meu plano <ArrowRight className="w-4 h-4" /></span>
        </motion.button>
      </div>
    </div>
  );
}

/** Micro-compromissos (Me+: "Você quer criar bons hábitos?" Não/Claro!) —
 *  3 sims em sequência; consistência é o vento a favor do paywall. */
function CompromissosScreen({ onDone }: { onDone: () => void }) {
  const PERGUNTAS = [
    { emoji: "🗓️", p: "Você quer organizar seu dia?" },
    { emoji: "🔁", p: "Quer construir hábitos que ficam?" },
    { emoji: "🚀", p: "Topa virar sua melhor versão?" },
  ];
  const [i, setI] = useState(0);
  const responder = (sim: boolean) => {
    trackEvent("funnel_quiz_answer", { step: `compromisso_${i + 1}`, answer: sim ? "claro" : "nao", funil: FUNIL });
    if (i >= PERGUNTAS.length - 1) onDone();
    else setI(i + 1);
  };
  const q = PERGUNTAS[i];
  return (
    <div className="w-full flex-1 flex flex-col pt-2">
      <AnimatePresence mode="wait">
        <motion.div
          key={q.p}
          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.24 }}
          className="flex-1 flex flex-col"
        >
          <div className="flex-1 grid place-items-center">
            <div className="text-center px-4">
              <div className="text-[64px] leading-none mb-5">{q.emoji}</div>
              <h1 className="text-[26px] font-black tracking-[-0.02em] leading-tight">{q.p}</h1>
              <div className="flex justify-center gap-1.5 mt-5">
                {PERGUNTAS.map((_, k) => (
                  <span key={k} className={`w-2 h-2 rounded-full ${k <= i ? "bg-accent" : "bg-black/10"}`} />
                ))}
              </div>
            </div>
          </div>
          <div className="pb-1 space-y-2.5">
            <button onClick={() => responder(true)} className={CTA_GRAFITE} style={{ background: GRAFITE }}>
              Claro!
            </button>
            <button onClick={() => responder(false)} className="w-full text-center text-[13px] text-muted-foreground py-2">
              Não
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Contrato assinado com o dedo (assinatura do Me+, o pico de compromisso).
 *  Canvas cru de pointer events — sem lib. "Pular" existe: fricção opcional. */
function ContratoScreen({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const desenhando = useRef(false);
  const tracos = useRef(0);
  const [assinou, setAssinou] = useState(false);
  const [festa, setFesta] = useState(false);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const comeca = (e: React.PointerEvent<HTMLCanvasElement>) => {
    desenhando.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!desenhando.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#16121c"; ctx.lineWidth = 4; ctx.lineCap = "round";
    const { x, y } = pos(e);
    ctx.lineTo(x, y); ctx.stroke();
    tracos.current += 1;
    if (tracos.current > 12 && !assinou) setAssinou(true);
  };
  const limpar = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    tracos.current = 0;
    setAssinou(false);
  };
  const fechar = (pulou: boolean) => {
    trackEvent("funnel_click", { cta: pulou ? "contrato_pulou" : "contrato_assinou", funil: FUNIL });
    if (pulou) { onDone(); return; }
    setFesta(true);
    window.setTimeout(onDone, 950);
  };
  return (
    <div className="w-full flex-1 flex flex-col pt-2 relative">
      {festa && (
        <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
          {Array.from({ length: 26 }).map((_, k) => (
            <motion.span
              key={k}
              initial={{ opacity: 1, x: `${(k * 137) % 100}vw`, y: -24, rotate: 0 }}
              animate={{ opacity: [1, 1, 0], y: "104vh", rotate: 320 }}
              transition={{ duration: 1.05 + (k % 5) * 0.12, ease: "easeIn" }}
              className="absolute w-2.5 h-2.5 rounded-[2px]"
              style={{ background: TILE_CORES[k % TILE_CORES.length] }}
            />
          ))}
        </div>
      )}
      <h1 className="text-[24px] font-black tracking-[-0.02em] leading-tight text-center mb-2">
        Assina esse compromisso<br />com você?
      </h1>
      <p className="text-[13px] text-muted-foreground text-center mb-4 px-3">
        <b className="text-foreground">"Eu vou dar 10 minutos por dia pro que importa. Começando hoje."</b>
      </p>
      <div className="rounded-2xl border-2 border-dashed border-black/15 bg-white relative">
        <canvas
          ref={canvasRef}
          width={640}
          height={300}
          className="w-full h-[150px] touch-none rounded-2xl"
          onPointerDown={comeca}
          onPointerMove={move}
          onPointerUp={() => { desenhando.current = false; }}
          onPointerLeave={() => { desenhando.current = false; }}
        />
        {!assinou && (
          <span className="absolute inset-0 grid place-items-center text-[13px] text-black/25 font-semibold pointer-events-none">
            ✍️ assina aqui com o dedo
          </span>
        )}
        {assinou && (
          <button onClick={limpar} className="absolute top-2 right-3 text-[11px] text-muted-foreground underline underline-offset-2">
            limpar
          </button>
        )}
      </div>
      <div className="mt-auto pt-5 pb-1">
        <button
          onClick={() => fechar(false)}
          disabled={!assinou}
          className={`${CTA_GRAFITE} disabled:opacity-40`}
          style={{ background: GRAFITE }}
        >
          <span className="flex items-center gap-1.5">Assinei — abrir meu plano <ArrowRight className="w-4 h-4" /></span>
        </button>
        <button onClick={() => fechar(true)} className="w-full text-center text-[12.5px] text-muted-foreground mt-3 py-1">
          Agora não
        </button>
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
    if (estadoTeste().fase === "expirado") return "offer";
    // v60: entrada fresca começa na WELCOME azul (a grade viva dos módulos)
    // — promessa antes de pergunta. Era a maior fuga do funil: 29% morriam
    // na porta quando ela era a primeira coisa que a pessoa via.
    return "welcome";
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
    trackEvent("funnel_view", { step, funil: FUNIL });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* Nos aparelhos edge-to-edge o relógio segue o tema claro do app — em cima
     do grafite (mecanismo/sininho) ficaria ilegível. Ícones claros enquanto
     a tela escura vive; restaura ao sair. ANTES dos early-returns de
     propósito (rules of hooks). */
  useEffect(() => {
    if (!(step === "mecanismo" || step === "notif")) return;
    return barraClaraEnquantoMontado("light");
  }, [step]);

  /* Reabertura >30min parado no meio das perguntas = visita nova (recomeça
     da porta). Oferta/cadastro nunca resetam — lead quente não perde o lugar. */
  useEffect(() => {
    let escondidoDesde = 0;
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "hidden") { escondidoDesde = Date.now(); return; }
      if (!escondidoDesde || Date.now() - escondidoDesde < 30 * 60_000) return;
      escondidoDesde = 0;
      const s = stepRef.current;
      // Varredura 23/08: resultado/compromissos/contrato entraram na lista —
      // quem ASSINOU o contrato e voltou 31min depois recomeçava 11 telas.
      if (userRef.current || s === "resultado" || s === "compromissos" || s === "contrato" || s === "offer" || s === "signup" || s === "confirm" || s === "liberando") return;
      trackEvent("app_welcome_reset", { de: s, funil: FUNIL });
      // welcome, não porta: a porta perdeu o link de login (23/08) — resetar
      // pra ela escondia o único "Entrar" do funil.
      setStep("welcome");
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, []);

  // Assinante logado não tem o que fazer aqui.
  if (user && isSubscribed) return <Navigate to="/home" replace />;
  // Convidado com teste RODANDO que caiu no /app sem pedir nada específico:
  // o lugar dele é o app (o RootGate já faz isso; deep link cai aqui).
  if (!user && estadoTeste().fase === "ativo" && !params.get("step") && (step === "porta" || step === "welcome")) {
    return <Navigate to="/home" replace />;
  }

  /** Fim do quiz (pivô 23/08, funil Me+): sininho → MONTANDO (loading
   *  teatral) → RESULTADO → compromissos ("Claro!" ×3) → CONTRATO assinado
   *  com o dedo → paywall À VISTA. O trial morreu: compromisso vem antes do
   *  preço, e o preço é pagamento único (Pix na folha do Google). */
  const abrirApp = (_pediuNotif: boolean) => setStep("montando");
  const montou = () => {
    trackEvent("funnel_click", { cta: "pos_montando", area: area ?? "dinheiro", funil: FUNIL });
    setStep("resultado");
  };

  const telaCheia = step === "offer" || step === "signup" || step === "confirm" || step === "liberando";
  // Cor é código de modo (lei BitePal): céu = pergunta, grafite = emoção,
  // branco = venda/conta.
  const escura = step === "mecanismo" || step === "notif";
  /* AVALIAÇÃO NO PICO — RELIGADA 26/08.
   *
   * Este gatilho existia desde 14/08, mas morava no ComecarRadar. Quando o
   * funil do app virou este arquivo, o Radar ficou só na WEB — e
   * pedirAvaliacaoSePuder recusa fora do shell nativo. Resultado medido: 244
   * pedidos até 14/08 e ZERO desde então. O app passou doze dias sem nunca
   * pedir nota a ninguém, com 288 pessoas ativas na última semana.
   *
   * "resultado" é o equivalente do diagnóstico do Radar: o segundo de maior
   * empolgação, ANTES de qualquer atrito de preço — é assim que BitePal e
   * Brainrot acumulam milhares de avaliações. As travas (1×/90 dias, 3 na
   * vida, só no shell) moram em pedirAvaliacaoSePuder. */
  useEffect(() => {
    if (step !== "resultado") return;
    const t = window.setTimeout(() => { void pedirAvaliacaoSePuder("plano_pronto", { forte: true }); }, 2600);
    return () => window.clearTimeout(t);
  }, [step]);

  return (
    <LayoutGroup>
    <div
      style={{
        ...LIGHT_VARS,
        background: telaCheia ? "#ffffff" : CEU_SUAVE,
        // O shell (.app-safe-shell) empurra o conteúdo com 48px de padding
        // BRANCO pra fugir da status bar — nas telas escuras virava uma faixa
        // acesa no topo. Puxa o fundo pra debaixo da status bar e devolve o
        // respiro como padding interno, agora pintado com a NOSSA cor.
        marginTop: "calc(var(--app-safe-top, 0px) * -1)",
        paddingTop: "var(--app-safe-top, 0px)",
      }}
      className={`relative min-h-dvh ${telaCheia ? "" : "h-dvh overflow-hidden"} text-foreground flex flex-col`}
    >
      {/* Véu grafite: o modo escuro entra em CROSS-FADE (trocar o background
          seco fazia a tela clara sair por cima do preto num flash feio). */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: FUNDO_ESCURO }}
        initial={false}
        animate={{ opacity: escura ? 1 : 0 }}
        transition={{ duration: 0.45, ease: "easeInOut" }}
      />
      {/* Welcome azul FORA da AnimatePresence de slide: ela é overlay fixed —
          wrapper só de opacidade (transform quebraria o position:fixed). */}
      <AnimatePresence>
        {step === "welcome" && (
          <motion.div key="welcome" exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            <AppWelcome
              onComecar={() => setStep("promessas")}
              onEntrar={() => { /* "Já tenho conta" = LOGIN, não cadastro (bug 20/08: caía na tela de criar conta) */ navigate("/auth"); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Promessas FORA do slide (varredura): é overlay fixed — dentro do
          motion.div com transform o fixed ancorava no container e a tela
          pastel deslizava com moldura em volta. Mesmo desenho da welcome. */}
      {step === "promessas" && <PromessasScreen onDone={() => setStep("porta")} />}
      {/* offer (23/08): CENTRADO de propósito (estilo Me+, tela preenchida) —
          a barra de CTA fixa segura o rodapé em qualquer altura
 */}
      <div className={`relative z-[1] flex-1 flex flex-col ${step === "offer" ? "items-center justify-center px-5 pt-4 pb-0" : telaCheia ? "items-center justify-center px-5 py-10" : "px-5 pt-4 pb-6"}`}>
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
                  setStep("antesdepois");
                }}
              />
            )}
            {step === "antesdepois" && <AntesDepoisScreen area={area ?? "dinheiro"} onNext={() => setStep("mecanismo")} />}
            {step === "mecanismo" && <MecanismoScreen onNext={() => setStep("horario")} />}
            {step === "horario" && (
              <HorarioScreen
                area={area ?? "dinheiro"}
                onPick={(id) => {
                  setHora(id);
                  try { localStorage.setItem("core-lembrete-hora", id); } catch { /* noop */ }
                  setStep("notif");
                }}
              />
            )}
            {step === "notif" && <NotifScreen area={area ?? "dinheiro"} hora={hora} onDone={abrirApp} />}
            {step === "montando" && <MontandoScreen area={area ?? "dinheiro"} hora={hora} onDone={montou} />}
            {step === "resultado" && <ResultadoScreen area={area ?? "dinheiro"} onNext={() => setStep("compromissos")} />}
            {step === "compromissos" && <CompromissosScreen onDone={() => setStep("contrato")} />}
            {step === "contrato" && <ContratoScreen onDone={() => setStep("offer")} />}
            {step === "offer" && (
              <PaywallAssinatura
                contexto="funil"
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
    </LayoutGroup>
  );
}
