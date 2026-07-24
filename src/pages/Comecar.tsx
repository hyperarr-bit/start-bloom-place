import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSearchParams, useLocation, Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, Sparkles, ShieldCheck,
  Lock, MailCheck, Loader2, ChevronLeft, ChevronRight, Circle, CheckCircle2,
} from "lucide-react";
import { PaywallFlow } from "@/components/paywall/PaywallFlow";
import { PortaPerguntaApp } from "@/components/app/PortaPerguntaApp";
import { AppWelcome } from "@/components/app/AppWelcome";
import { SeuPlanoScreen } from "@/components/funnel/SeuPlanoScreen";
import { isNativeShell } from "@/lib/native-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";
import {
  QUIZ, GASTO_ANCHOR, isInAppBrowser,
  AREAS, AREA_TRACKS, AREA_PROOF, ALL_MODULE_ICONS, FUNNEL_AREA_KEY, DOOR_AREAS,
  type AreaKey, type QuizQ,
} from "@/lib/funnel";

// Marca que o OAuth partiu do funil: o /auth/callback lê isso pra devolver o
// usuário NOVO pro paywall do funil (em vez de pular direto pro app).
export const FUNNEL_OAUTH_KEY = "funnel-oauth-pending";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.6 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5c-.5.4 6.9-5 6.9-15.1 0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);

/**
 * Funil "sem LP" (mobile-first, tráfego frio) — modelo PAGO com paywall:
 *   início → quiz → DEMO no app real (/preview/financas, dados de exemplo)
 *   → cadastro → PAYWALL (assinar) → checkout Cakto → app ativo.
 * Se o lead tenta sair do paywall: roleta → downsell (ofertas limitadas).
 * A demo é o app de verdade: o slide final manda pra /preview/financas?funnel=1,
 * que tem um CTA "Quase lá" voltando pra cá em ?step=signup.
 */

type Step = "start" | "crenca" | "quiz" | "confianca" | "progress" | "result" | "central" | "plano" | "signup" | "offer" | "confirm";

const DEMO_URL = "/preview/financas?funnel=1";
/** Demo do funil vitrine: abre no módulo da área escolhida, com a barra de
 *  navegação entre os módulos do criativo (tour=vida). A área de metas cai
 *  direto na aba Metas — a promessa da porta, não o "Sobre mim". */
const demoUrlFor = (area: AreaKey) =>
  `/preview/${AREAS[area].module}?funnel=1&tour=vida${area === "metas" ? "&tab=metas" : ""}`;

// Funil sempre em tema claro (fundo branco), mesmo se o visitante estiver no dark.
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

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

const slide = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -28 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

// APP DAS LOJAS (dono, 23/07 à noite: "gostei do 2"): perguntas na pele do
// mockup de 21/07 — céu suave de fundo (continuidade com o welcome céu
// forte), tiles pastel por posição e card com sombra. Web fica como está.
const TILE_CORES_APP = ["#fdeccb", "#cdeeee", "#d9e4fb", "#e6def8", "#fbd8e8"];
const CEU_SUAVE_APP = "linear-gradient(180deg,#eaf5fd 0%,#f7fbff 30%,#ffffff 62%)";

const PREP_STEPS = [
  "Identificando seu perfil financeiro",
  "Montando seu painel inicial",
  "Separando os recursos mais importantes",
  "Finalizando seu plano personalizado",
];

const RESULT_ITEMS = [
  "Ver para onde seu dinheiro está indo",
  "Organizar contas e vencimentos",
  "Acompanhar saldo disponível",
  "Criar metas e desejos",
  "Testar um painel financeiro simples no dia a dia",
];

const TrustRow = () => (
  <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-muted-foreground">
    <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Dados criptografados</span>
    <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Sem cartão agora</span>
    <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Cancele quando quiser</span>
  </div>
);

/* ------------------------------------------------------------------- quiz */

// Perguntas em QUIZ (src/lib/funnel.ts). A tela de impacto entra depois da
// pergunta de "gasto" — usa a resposta da pessoa como âncora de dor em R$.
const PROOF_AFTER_KEY = "gasto";


/* ------------------------- telas novas do arco web (23/07, teste só-web) */

/** Micro-feedback por resposta (lei nº 1 do BitePal: todo input devolve
 *  algo). "gasto" fica de fora — a tela de impacto já é a devolução dele. */
/** Micro-feedback POR RESPOSTA (lei nº 1 do BitePal: todo input devolve
 *  algo ESPECÍFICO — reação genérica é a definição do que não fazer).
 *  "gasto" fica de fora: o diagnóstico já é a devolução dele. */
const FEEDBACK_QUIZ: Record<string, { padrao: string; por?: Record<string, string> }> = {
  atrapalha: {
    padrao: "Anotado — é por aqui que seu plano começa.",
    por: {
      "Gasto sem perceber": "O vazamento invisível — 8 em 10 começam por aqui.",
      "Esqueço contas": "Juros por esquecimento: o custo mais evitável que existe.",
      "Não consigo guardar dinheiro": "Guardar sem visibilidade é nadar contra a maré.",
      "Não sei pra onde meu dinheiro vai": "Esse é o sintoma nº 1 de falta de painel.",
      "Quero organizar tudo": "Boa — organização geral é exatamente o forte do CORE.",
      "Acordo sem plano nenhum": "Dia sem plano é dia decidido pelos outros.",
      "Perco horas no celular": "O celular cobra caro — o painel devolve as horas.",
      "Começo mil coisas e não termino": "Foco é ver pouco de cada vez — o painel corta o resto.",
      "Esqueço tarefas e compromissos": "Lembrar é trabalho do app, não seu.",
      "Começo a treinar e desisto": "Desistir é o padrão sem progresso visível.",
      "Como mal e nem percebo": "O invisível cobra caro — registrar muda na hora.",
      "Não tenho plano de treino nem dieta": "Plano pronto é literalmente o começo do app.",
      "Falta constância, não vontade": "Exato — e constância é sistema, não caráter.",
    },
  },
  controle: {
    padrao: "Bom ponto de partida — o CORE puxa tudo pra um lugar só.",
    por: {
      "Não controlo": "73% chegam assim. É exatamente disso que o plano cuida.",
      "Bloco de notas": "Anotar ajuda. Mas nota não soma, não avisa, não compara.",
      "Planilha": "Respeito. Mas planilha espera você lembrar dela — o CORE te procura.",
      "App de banco": "Ele mostra o extrato de UM banco. Sua vida não cabe num extrato.",
      "Outro app": "Então você já tenta — faltava um que junte tudo num lugar só.",
    },
  },
  consistencia: {
    padrao: "Normal: sem sistema, todo mundo larga. Com sistema, fica.",
    por: {
      "Uns 3 dias": "É a média de todo mundo sem sistema. Com lembrete, o jogo vira.",
      "Uma semana": "Você chega perto — falta o sistema segurar a segunda semana.",
      "Um mês, aí largo": "Um mês na raça é força. Imagina com o app carregando junto.",
      "Nunca consegui manter": "Não é sobre você: sem sistema, ninguém mantém.",
      "Essa vai ser a primeira": "Melhor hora — começar já com sistema.",
      "Umas 2 ou 3": "Recomeço faz parte. Dessa vez, com registro.",
      "Perdi a conta": "Não é falta de vontade — é falta de sistema que segure.",
      "Tô na ativa, mas sem controle": "Você já faz o difícil. Falta só enxergar o progresso.",
    },
  },
  compromisso: {
    padrao: "Fechado 🤝 5 minutos é tudo que o plano pede.",
    por: { "Topo, se for bem simples": "É simples de verdade — um toque e pronto." },
  },
  vitoria: {
    padrao: "Essa vira a meta nº 1 do seu plano.",
    por: {
      "Entender meus gastos": "Em 7 dias você olha o painel e SABE. Essa é a proposta.",
      "Parar de esquecer contas": "O app avisa antes de vencer — nunca mais multa boba.",
      "Criar minha primeira meta": "Meta com progresso visível — a que finalmente anda.",
      "Saber quanto posso gastar": "Seu número livre do mês, calculado todo dia.",
      "Organizar tudo em um painel": "É literalmente o que a demo vai te mostrar já já.",
      "Manter um hábito 7 dias seguidos": "7 dias seguidos: exatamente a missão da sua semana 1.",
      "Acordar sabendo o que fazer": "Primeira coisa que o painel resolve, logo de manhã.",
      "Uma semana sem esquecer nada": "Com lembrete automático, essa é quase garantida.",
      "Minha semana inteira num painel": "É literalmente a tela inicial do app.",
    },
  },
};
const feedbackPara = (key: string, answer: string): string | null => {
  if (key === "gasto") return null;
  const f = FEEDBACK_QUIZ[key];
  return f ? f.por?.[answer] ?? f.padrao : null;
};

/** CRENÇA (BitePal "why it works"): instala o mecanismo antes do quiz —
 *  motivação despenca, sistema fica. Curvas do v3 (w2), adaptadas. */
/** Mecanismo POR ÁREA — a crença mostra o produto que ELA escolheu na porta
 *  (bug 24/07: era finanças pra todo mundo). Cada área: 3 passos com
 *  micro-visual próprio. */
type MecVisual = { tipo: "pill"; texto: string } | { tipo: "barras" } | { tipo: "alerta"; texto: string };
const MEC_AREA: Record<AreaKey, Array<{ titulo: string; sub: string; vis: MecVisual }>> = {
  dinheiro: [
    { titulo: "Registra em 5 segundos", sub: "café, mercado, conta — um toque", vis: { tipo: "pill", texto: "☕ R$ 8,50" } },
    { titulo: "O app organiza sozinho", sub: "categorias, somas e limites automáticos", vis: { tipo: "barras" } },
    { titulo: "Ele te procura — não o contrário", sub: "avisa antes da conta, mostra o padrão", vis: { tipo: "alerta", texto: "🔔 Luz vence amanhã" } },
  ],
  rotina: [
    { titulo: "Seus hábitos em um painel", sub: "monta a semana em 1 minuto", vis: { tipo: "pill", texto: "💧 Beber água ✓" } },
    { titulo: "O dia acorda planejado", sub: "tarefas e hábitos já na ordem certa", vis: { tipo: "barras" } },
    { titulo: "Ele te lembra na hora certa", sub: "nada depende da sua memória", vis: { tipo: "alerta", texto: "🔔 Academia em 30min" } },
  ],
  corpo: [
    { titulo: "Refeição registrada num toque", sub: "sem pesar, sem planilha", vis: { tipo: "pill", texto: "🍳 Café da manhã ✓" } },
    { titulo: "Treino do dia já montado", sub: "plano pronto, é só seguir", vis: { tipo: "barras" } },
    { titulo: "Progresso que aparece", sub: "evolução visível toda semana", vis: { tipo: "alerta", texto: "📈 3 treinos essa semana" } },
  ],
  saude: [
    { titulo: "Check-in de 10 segundos", sub: "como você tá, num toque", vis: { tipo: "pill", texto: "❤️ Hoje: bem ✓" } },
    { titulo: "Tudo registrado num lugar", sub: "sintomas, remédios, consultas", vis: { tipo: "barras" } },
    { titulo: "Avisos do que importa", sub: "remédio, consulta, retorno", vis: { tipo: "alerta", texto: "🔔 Remédio às 20h" } },
  ],
  metas: [
    { titulo: "Meta quebrada em passos", sub: "do sonho pro passo de hoje", vis: { tipo: "pill", texto: "🎯 Passo 1 feito ✓" } },
    { titulo: "Um passo pequeno por dia", sub: "5 minutos, sem se enganar", vis: { tipo: "barras" } },
    { titulo: "Progresso que você VÊ", sub: "a barra enchendo toda semana", vis: { tipo: "alerta", texto: "📈 Meta 40% concluída" } },
  ],
};

function CrencaScreen({ area, onNext, onBack }: { area: AreaKey; onNext: () => void; onBack: () => void }) {
  const cards = MEC_AREA[area] ?? MEC_AREA.dinheiro;
  const spring = (i: number) => ({
    initial: { opacity: 0, y: 16, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { delay: 0.15 + i * 0.12, type: "spring" as const, stiffness: 280, damping: 22 },
  });
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} aria-label="Voltar" className="-ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full bg-accent rounded-full" initial={{ width: "12%" }} animate={{ width: "15%" }} transition={{ duration: 0.35, ease: "easeOut" }} />
        </div>
      </div>
      <h2 className="text-[27px] font-black tracking-tight leading-[1.12] mb-6">Como o CORE<br />funciona</h2>
      <div className="space-y-2.5">
        {cards.map((c, i) => (
          <motion.div key={c.titulo} {...spring(i)} className="flex items-center gap-3 rounded-2xl border border-[#eef0f3] bg-white p-3.5 shadow-[0_10px_24px_-14px_rgba(20,40,70,0.25)]">
            <span className="w-6 h-6 rounded-full bg-foreground text-background grid place-items-center text-[11.5px] font-extrabold shrink-0">{i + 1}</span>
            <span className="flex-1 leading-tight">
              <b className="block text-[13.5px]">{c.titulo}</b>
              <small className="text-[11px] text-muted-foreground">{c.sub}</small>
            </span>
            {c.vis.tipo === "pill" && (
              <span className="flex items-center gap-1.5 rounded-xl bg-secondary/70 px-2.5 py-2 text-[11px] font-bold shrink-0">
                {c.vis.texto}
                <motion.span animate={{ scale: [1, 1.18, 1] }} transition={{ delay: 1, duration: 0.5, repeat: 2 }}
                  className="w-[18px] h-[18px] rounded-full bg-accent text-accent-foreground grid place-items-center text-[12px] leading-none">+</motion.span>
              </span>
            )}
            {c.vis.tipo === "barras" && (
              <span className="flex items-end gap-[3px] h-8 shrink-0" aria-hidden>
                {[["100%", "hsl(var(--accent))"], ["68%", "#f2d4e4"], ["52%", "#fdeccb"], ["38%", "#cdeeee"], ["26%", "#d9e4fb"]].map(([h, cor], bi) => (
                  <motion.i key={bi} className="w-[9px] rounded-t-[3px] block" style={{ background: cor as string }}
                    initial={{ height: 0 }} animate={{ height: h as string }} transition={{ delay: 0.7 + bi * 0.08, duration: 0.4, ease: "easeOut" }} />
                ))}
              </span>
            )}
            {c.vis.tipo === "alerta" && (
              <motion.span
                className="rounded-lg bg-[#fff7e8] border border-[#f5e3bd] px-2 py-1.5 text-[9.5px] font-bold text-[#8a6d1f] shrink-0"
                animate={{ rotate: [0, -3, 3, -2, 0] }} transition={{ delay: 1.4, duration: 0.5 }}
              >{c.vis.texto}</motion.span>
            )}
          </motion.div>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground text-center mt-5">
        nada depende da sua força de vontade — é <b className="text-foreground">visibilidade automática</b>
      </p>
      <Button size="lg" className="w-full h-12 text-base mt-5 rounded-full font-bold" onClick={onNext}>
        Fazer meu diagnóstico <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function ConfiancaScreen({ answers, onNext, onBack }: {
  answers: Record<string, string>; onNext: () => void; onBack: () => void;
}) {
  // As respostas REAIS dela viram os papéis que escorrem pro cofre — a
  // privacidade deixa de ser texto e vira cena ("isso aqui é seu").
  const gastoChip = answers.gasto && answers.gasto !== "Não faço ideia"
    ? `${answers.gasto.replace(" a ", "–")} por mês` : null;
  const chips = [answers.atrapalha, gastoChip, answers.vitoria].filter(Boolean).slice(0, 3) as string[];
  if (!chips.length) chips.push("Suas respostas");
  const rot = ["-2.5deg", "1.8deg", "-1.2deg"];
  const desl = [-26, 24, 0];
  return (
    <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} aria-label="Voltar" className="-ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-accent rounded-full" style={{ width: "100%" }} />
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center text-center pb-6">
        <div className="flex flex-col items-center">
          {chips.map((c, i) => (
            <motion.span
              key={c}
              initial={{ opacity: 0, y: -24, x: desl[i], rotate: 0 }}
              animate={{ opacity: 1, y: 0, x: desl[i], rotate: rot[i] }}
              transition={{ delay: 0.2 + i * 0.22, type: "spring", stiffness: 300, damping: 20 }}
              className="rounded-full border border-[#eef0f3] bg-white px-3.5 py-1.5 text-[11.5px] font-bold text-[#3c4652] shadow-[0_8px_18px_-12px_rgba(20,40,70,0.25)] -mt-0.5 first:mt-0"
            >{c}</motion.span>
          ))}
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
            className="text-[#c3cad2] text-[15px] my-2" aria-hidden>↓</motion.span>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.05, type: "spring", stiffness: 260, damping: 14 }}
            className="w-16 h-16 rounded-[20px] grid place-items-center text-[27px] shadow-[0_16px_34px_-10px_rgba(22,18,28,0.55)]"
            style={{ background: "linear-gradient(135deg,#16121c,#3a3344)" }}
          >🔒</motion.div>
        </div>
        <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.25 }}
          className="text-[26px] font-black tracking-tight leading-[1.12] mt-5">Obrigado por<br />confiar na gente</motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.45 }}
          className="text-[13.5px] text-muted-foreground leading-relaxed mt-2">
          Suas respostas viram sua análise —<br />e ficam <b className="text-foreground">só com você</b>.<br />Nunca vendidas, nunca compartilhadas.
        </motion.p>
      </div>
      <Button size="lg" className="w-full h-12 text-base rounded-full font-bold" onClick={onNext}>
        Montar minha análise <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

/** PONTE-DEMO: substitui o radar no web (23/07 — o gráfico tinha números
 *  fabricados, mesma doença do gauge; o diagnóstico real já aconteceu no
 *  quiz+impacto). Uma frase honesta e a nossa arma: o app de verdade. */
type Achado = { emoji: string; cor: string; titulo: string; sub: string; nivel: "ALTO" | "RISCO" | "META" | "OCULTO" };
const NIVEL_CLS: Record<Achado["nivel"], string> = {
  ALTO: "bg-destructive/10 text-destructive",
  OCULTO: "bg-destructive/10 text-destructive",
  RISCO: "bg-amber-500/15 text-amber-700",
  META: "bg-accent/10 text-accent",
};
/** Os 2 primeiros achados por área (o 3º é sempre o objetivo declarado). */
const ACHADOS_AREA: Record<Exclude<AreaKey, "dinheiro">, [Omit<Achado, "nivel">, Omit<Achado, "nivel">]> = {
  rotina: [
    { emoji: "⏰", cor: "#cdeeee", titulo: "Horas perdidas no improviso", sub: "dia decidido na hora custa tempo todo dia" },
    { emoji: "📅", cor: "#d9e4fb", titulo: "Hábitos sem sistema que segure", sub: "motivação sozinha larga na 2ª semana" },
  ],
  corpo: [
    { emoji: "🔁", cor: "#d7f0dd", titulo: "Recomeços sem registro", sub: "sem progresso visível, desistir é o padrão" },
    { emoji: "🍎", cor: "#fdeccb", titulo: "Treino e dieta no improviso", sub: "sem plano, cada dia é uma decisão nova" },
  ],
  saude: [
    { emoji: "❤️", cor: "#fbd8e8", titulo: "Sinais sem acompanhamento", sub: "o que não se registra vira susto" },
    { emoji: "📋", cor: "#cdeeee", titulo: "Sem check-in de rotina", sub: "cuidado que depende de lembrar, falha" },
  ],
  metas: [
    { emoji: "🕰️", cor: "#e6def8", titulo: "Meta parada há meses", sub: "sem passos pequenos, meta grande congela" },
    { emoji: "🧭", cor: "#d9e4fb", titulo: "Sem plano quebrado em etapas", sub: "direção sem próximo passo não anda" },
  ],
};
function PonteDemoScreen({ area, answers: answersProp, onDemo }: {
  area: AreaKey; answers: Record<string, string>; onDemo: () => void;
}) {
  // Volta da demo pode ser page-load novo: respostas caem pro localStorage
  // (mesma fonte do SeuPlanoScreen/PaywallFlow).
  const answers = (() => {
    if (answersProp && Object.keys(answersProp).length) return answersProp;
    try { return JSON.parse(localStorage.getItem("funnel-quiz-answers") || "{}"); } catch { return {}; }
  })();
  const anchor = area === "dinheiro" ? GASTO_ANCHOR[answers.gasto ?? ""] ?? null : null;
  const achados: Achado[] = area === "dinheiro"
    ? [
        anchor
          ? { emoji: "💸", cor: "#fdeccb", titulo: "Vazamento estimado", sub: `${anchor.month}/mês pela sua estimativa`, nivel: "ALTO" }
          : { emoji: "💸", cor: "#fdeccb", titulo: "Vazamento sem medida", sub: "você disse que não faz ideia — é o pior tipo", nivel: "OCULTO" },
        answers.atrapalha === "Esqueço contas"
          ? { emoji: "🔔", cor: "#cdeeee", titulo: "Contas sem sistema de aviso", sub: "você disse que esquece — e ninguém te avisa", nivel: "RISCO" }
          : { emoji: "🔔", cor: "#cdeeee", titulo: "Vencimentos por memória", sub: "sem aviso, vencimento vira multa", nivel: "RISCO" },
        { emoji: "🎯", cor: "#e6def8", titulo: "Seu objetivo", sub: `“${answers.vitoria ?? "organizar tudo num painel"}”`, nivel: "META" },
      ]
    : [
        { ...ACHADOS_AREA[area as Exclude<AreaKey, "dinheiro">][0], nivel: "ALTO" },
        { ...ACHADOS_AREA[area as Exclude<AreaKey, "dinheiro">][1], nivel: "RISCO" },
        { emoji: "🎯", cor: "#e6def8", titulo: "Seu objetivo", sub: `“${answers.vitoria ?? "sair do papel"}”`, nivel: "META" },
      ];
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#2e9e52] mb-1.5">✓ Análise pronta</div>
      <h2 className="text-[27px] font-black tracking-tight leading-[1.1] mb-5">
        Seu ponto de partida:<br /><span className="text-accent">{AREAS[area].nome}</span>
      </h2>
      <div className="rounded-2xl border border-[#eef0f3] bg-white px-4 py-1 shadow-[0_10px_24px_-14px_rgba(20,40,70,0.28)]">
        {achados.map((a, i) => (
          <motion.div
            key={a.titulo}
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.18 }}
            className={`flex items-start gap-3 py-3 ${i < achados.length - 1 ? "border-b border-[#f2f3f5]" : ""}`}
          >
            <span className="w-9 h-9 rounded-xl grid place-items-center text-base shrink-0" style={{ background: a.cor }}>{a.emoji}</span>
            <span className="flex-1 leading-tight text-left">
              <b className="block text-[13px]">{a.titulo}</b>
              <small className="text-[11px] text-muted-foreground leading-snug">{a.sub}</small>
            </span>
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.45 + i * 0.18, type: "spring", stiffness: 300, damping: 16 }}
              className={`text-[9px] font-extrabold px-2 py-1 rounded-full shrink-0 mt-0.5 ${NIVEL_CLS[a.nivel]}`}
            >{a.nivel}</motion.span>
          </motion.div>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground text-center mt-4 mb-5">
        agora confere você mesmo — o app aberto <b className="text-foreground">de verdade</b>, com dados de exemplo
      </p>
      <Button size="lg" className="w-full h-12 text-base rounded-full font-bold" onClick={() => { trackEvent("funnel_click", { cta: "result", area }); onDemo(); }}>
        Testar o app de verdade <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3 text-center">seu plano vem em seguida</p>
    </div>
  );
}

/* ---------------------------------------------------------------- screens */

function StartScreen({ onPick }: { onPick: (firstAnswer: string) => void }) {
  // Item 3 (RCD/Schwartz): público problem-aware → a 1ª tela já é o diagnóstico.
  // O 1º toque responde a pergunta em vez de um botão neutro — encurta o
  // caminho até a prova. Sem vídeo (bugado) — headline + pergunta são o hero.
  const q0 = QUIZ[0]; // "O que mais te atrapalha hoje?"
  return (
    <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto">
      <h1 className="text-[clamp(28px,8vw,42px)] font-bold leading-[1.05] tracking-tight mb-2 text-center">
        Organize sua vida financeira
      </h1>
      <p className="text-[15px] text-muted-foreground text-center mb-6">{q0.q}</p>

      <div className="space-y-2.5">
        {q0.opts.map((o) => (
          <button
            key={o.label}
            onClick={() => onPick(o.label)}
            className="group w-full flex items-center gap-3.5 rounded-2xl border-2 border-border bg-card p-3 text-left hover:border-accent hover:bg-accent/[0.04] active:scale-[0.99] transition-all"
          >
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-secondary text-xl shrink-0">{o.emoji}</span>
            <span className="font-semibold text-[15px] flex-1 leading-snug">{o.label}</span>
            <span className="grid place-items-center w-6 h-6 rounded-full border-2 border-border group-hover:border-accent transition-colors shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
            </span>
          </button>
        ))}
      </div>

      <p className="text-[12px] text-muted-foreground mt-4 text-center">
        5 perguntas rápidas · sem cadastro agora
      </p>
      <p className="text-sm text-muted-foreground mt-2 text-center">
        Já tem uma conta? <Link to="/auth" className="font-semibold text-foreground">Entrar</Link>
      </p>
    </div>
  );
}

/* ------------------------------------------------- porta vitrine (?porta=vida) */

/** Porta do criativo "vida inteira": o vídeo vendeu a casa, a porta faz a
 *  pessoa escolher um cômodo — amplitude vira especificidade em 1 toque. */
function VitrineStartScreen({ onPickArea }: { onPickArea: (area: AreaKey, label: string) => void }) {
  const options: Array<{ area: AreaKey; emoji: string; label: string }> = [
    ...DOOR_AREAS.map((key) => ({ area: key, emoji: AREAS[key].emoji, label: AREAS[key].label })),
    // "Tudo" não é uma trilha — é pedido de priorização. Começa pelo que
    // custa mais caro (dinheiro), e a central mostra o resto junto.
    { area: "dinheiro" as AreaKey, emoji: "😵", label: "Tudo, sinceramente" },
  ];
  return (
    <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto">
      {/* Prova visual da amplitude: os 16 módulos como pano de fundo, sem virar menu */}
      <div className="grid grid-cols-8 gap-1.5 mb-5 opacity-90">
        {ALL_MODULE_ICONS.map((m) => (
          <span key={m.label} className="grid place-items-center aspect-square rounded-lg bg-secondary text-[15px]">
            {m.emoji}
          </span>
        ))}
      </div>
      <h1 className="text-[clamp(27px,7.5vw,40px)] font-bold leading-[1.06] tracking-tight mb-2 text-center">
        Um app pra<br />vida inteira
      </h1>
      <p className="text-[15px] text-muted-foreground text-center mb-6">
        Qual área tá mais fora de controle hoje?
      </p>

      <div className="space-y-2.5">
        {options.map((o) => (
          <button
            key={o.label}
            onClick={() => onPickArea(o.area, o.label)}
            className="group w-full flex items-center gap-3.5 rounded-2xl border-2 border-border bg-card p-3 text-left hover:border-accent hover:bg-accent/[0.04] active:scale-[0.99] transition-all"
          >
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-secondary text-xl shrink-0">{o.emoji}</span>
            <span className="font-semibold text-[15px] flex-1 leading-snug">{o.label}</span>
            <span className="grid place-items-center w-6 h-6 rounded-full border-2 border-border group-hover:border-accent transition-colors shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
            </span>
          </button>
        ))}
      </div>

      <p className="text-[12px] text-muted-foreground mt-4 text-center">
        4 perguntas rápidas · sem cadastro agora
      </p>
      <p className="text-sm text-muted-foreground mt-2 text-center">
        Já tem uma conta? <Link to="/auth" className="font-semibold text-foreground">Entrar</Link>
      </p>
    </div>
  );
}

/** Radar da vida (funil vitrine): a área escolhida em baixa, o potencial
 *  mapeado — o momento "isso sou eu" da trilha de vida. */
function LifeRadar({ area }: { area: AreaKey }) {
  // Os 5 eixos mapeiam 1:1 com as 5 áreas da porta.
  const axes = [
    { key: "dinheiro", label: "Dinheiro" },
    { key: "rotina", label: "Rotina" },
    { key: "corpo", label: "Corpo" },
    { key: "saude", label: "Saúde" },
    { key: "metas", label: "Metas" },
  ];
  // Escolhida = baixa (foi o que a pessoa DISSE); demais = meio-termo neutro.
  const value = (k: string) => (k === area ? 0.3 : 0.58);
  const C = 100; // centro
  const R = 72;
  const pt = (i: number, r: number) => {
    const ang = (i * (360 / axes.length) - 90) * (Math.PI / 180);
    return [C + r * Math.cos(ang), C + r * Math.sin(ang)] as const;
  };
  const poly = (rFor: (i: number) => number) =>
    axes.map((_, i) => pt(i, rFor(i)).join(",")).join(" ");
  return (
    <div className="relative mx-auto w-64 h-56">
      <svg viewBox="0 0 200 190" className="w-full h-full">
        {[0.33, 0.66, 1].map((f) => (
          <polygon key={f} points={poly(() => R * f)} fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth="1" />;
        })}
        <motion.polygon
          points={poly((i) => R * value(axes[i].key))}
          fill="hsl(var(--accent) / 0.18)"
          stroke="hsl(var(--accent))"
          strokeWidth="2.5"
          strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
          style={{ transformOrigin: "100px 100px" }}
        />
        {axes.map((a, i) => {
          const [x, y] = pt(i, R * value(a.key));
          const chosen = a.key === area;
          return (
            <motion.circle
              key={a.key} cx={x} cy={y} r={chosen ? 5 : 3.5}
              fill={chosen ? "hsl(var(--destructive))" : "hsl(var(--accent))"}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + i * 0.06 }}
            />
          );
        })}
        {axes.map((a, i) => {
          const [x, y] = pt(i, R + 16);
          const chosen = a.key === area;
          return (
            <text key={a.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fontSize="11" fontWeight={chosen ? 800 : 600}
              fill={chosen ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"}>
              {a.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

const AREA_RESULT_ITEMS: Record<AreaKey, string[]> = {
  dinheiro: RESULT_ITEMS,
  rotina: [
    "Montar sua rotina semanal, hora a hora",
    "Manter hábitos com streaks que dão orgulho",
    "Nunca mais esquecer tarefa ou compromisso",
    "Ver sua consistência crescer no calendário",
  ],
  corpo: [
    "Montar seu plano de treino da semana",
    "Seguir um cardápio simples, refeição por refeição",
    "Registrar cargas e ver a progressão",
    "Treino e dieta finalmente no mesmo lugar",
  ],
  saude: [
    "Bater sua meta de água todo dia",
    "Vitaminas e remédios com lembrete e estoque",
    "Acompanhar sono, peso e evolução",
    "Sua saúde inteira num painel só",
  ],
  metas: [
    "Transformar sua meta num plano com passos",
    "Ver sua linha do tempo: 6 meses, 1, 3, 5 anos",
    "Diário, humor e gratidão pra manter o pique",
    "Ver sua evolução na roda da vida",
  ],
};

function RadarResultScreen({ answers, area, onDone }: { answers: Record<string, string>; area: AreaKey; onDone: () => void }) {
  const a = AREAS[area];
  const items = answers.vitoria
    ? [answers.vitoria, ...AREA_RESULT_ITEMS[area].filter((r) => r !== answers.vitoria)].slice(0, 4)
    : AREA_RESULT_ITEMS[area].slice(0, 4);
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="text-[11px] font-bold uppercase tracking-widest text-accent mb-2">Análise concluída</div>
      <h2 className="text-[28px] font-bold tracking-tight leading-tight mb-1">Seu mapa da vida<br />está pronto</h2>
      <LifeRadar area={area} />
      <Card className="p-3.5 text-left mb-4 border-destructive/30 bg-destructive/[0.04]">
        <p className="text-[13.5px] leading-snug">
          <strong>Seu ponto de partida: {a.nome}.</strong> Foi o que você disse que mais dói — é por onde seu plano começa.
        </p>
      </Card>
      <Card className="p-4 text-left space-y-3 mb-7">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Com o CORE, você vai</div>
        {items.map((r, i) => (
          <motion.div key={r} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.08 }}
            className="flex items-start gap-2.5 text-[14px]">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-accent/15 text-accent grid place-items-center shrink-0">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            {r}
          </motion.div>
        ))}
      </Card>
      <Button size="lg" className="w-full h-12 text-base" onClick={() => { trackEvent("funnel_click", { cta: "result", area }); onDone(); }}>
        Testar o app de verdade <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3">Abre o app real, com dados de exemplo — seu plano vem em seguida</p>
    </div>
  );
}

/** Vislumbre da central: prova a amplitude (16 módulos) por 3 segundos de
 *  tela — trailer, não mapa. A demo continua guiada (5 módulos do vídeo). */
function CentralScreen({ area, onOpen }: { area: AreaKey; onOpen: () => void }) {
  const a = AREAS[area];
  // Só o módulo da área tem anel "começa aqui" (bate com a copy). Os outros
  // 15 são cards sólidos — NADA apagado, senão o lead acha que estão bloqueados.
  const startLabel: Record<string, string> = { financas: "Finanças", rotina: "Rotina", treino: "Treino", saude: "Saúde", desenvolvimento: "Metas" };
  const startHere = startLabel[a.module];
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <h2 className="text-[26px] font-bold tracking-tight leading-tight mb-2">Sua central tá pronta</h2>
      <p className="text-muted-foreground text-sm leading-relaxed mb-5">
        Os 16 módulos já são seus. <strong className="text-foreground">Começamos por {a.nome}</strong> — o resto entra no seu ritmo.
      </p>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {ALL_MODULE_ICONS.map((m, i) => {
          const on = m.label === startHere;
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.08 + i * 0.035, duration: 0.3 }}
              className={`relative rounded-2xl border-2 p-2.5 flex flex-col items-center gap-1 bg-card ${
                on ? "border-accent bg-accent/[0.07]" : "border-border"
              }`}
            >
              {on && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wide bg-accent text-accent-foreground rounded-full px-1.5 py-0.5 whitespace-nowrap">
                  começa aqui
                </span>
              )}
              <span className="text-xl">{m.emoji}</span>
              <span className="text-[10px] font-semibold leading-none text-foreground">{m.label}</span>
            </motion.div>
          );
        })}
      </div>
      <p className="text-[11px] text-accent font-semibold mb-6 inline-flex items-center justify-center gap-1 w-full">
        <Check className="w-3.5 h-3.5" strokeWidth={3} /> Todos os 16 inclusos, sem pagar à parte
      </p>
      <Button size="lg" className="w-full h-12 text-base" onClick={() => { trackEvent("funnel_click", { cta: "central_open", area }); onOpen(); }}>
        Abrir minha central <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3">Explore à vontade — dados de exemplo</p>
    </div>
  );
}

/** Tela de impacto: devolve a estimativa da própria pessoa, anualizada.
 *  É o momento "isso é sério" antes das duas últimas perguntas. */
function ProofSlide({ gasto, atrapalha, pele, onNext }: { gasto: string; atrapalha?: string; pele?: boolean; onNext: () => void }) {
  const anchor = GASTO_ANCHOR[gasto] ?? null;
  if (pele) {
    // RELATÓRIO computado (23/07, refeito do zero): 3 escalas de dor
    // derivadas da resposta (dia = mês÷30), 12 barras acumulando e "onde
    // costuma vazar" — a resposta de atrapalha vira heurística. Nada
    // genérico, nada inventado sem dizer que é estimativa.
    const mesNum = anchor ? Number((anchor.month.match(/\d+/)?.[0] ?? "0")) : 0;
    const diaNum = Math.max(1, Math.round(mesNum / 30));
    const mais = anchor?.month.endsWith("+") ? "+" : "";
    const anoNum = anchor ? Number((anchor.year.match(/[\d.]+/)?.[0] ?? "0").replace(/\./g, "")) : 0;
    const fontes: Array<[string, string, string, number]> =
      atrapalha === "Esqueço contas"
        ? [["💸", "#fdeccb", "Juros e multas", 45], ["📅", "#cdeeee", "Cobranças em atraso", 35], ["🔁", "#e6def8", "Assinaturas duplicadas", 20]]
        : atrapalha === "Não consigo guardar dinheiro"
          ? [["🛒", "#cdeeee", "Compras por impulso", 40], ["🍔", "#fdeccb", "Delivery e lanches", 35], ["📺", "#e6def8", "Assinaturas paradas", 25]]
          : [["🍔", "#fdeccb", "Delivery e lanches", 40], ["🛒", "#cdeeee", "Compras pequenas", 35], ["📺", "#e6def8", "Assinaturas paradas", 25]];
    return (
      <div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-accent mb-2">
          💡 Seu diagnóstico
        </motion.div>
        <h2 className="text-[27px] font-black tracking-tight leading-[1.12] mb-5">
          {anchor
            ? <>Pela sua estimativa,<br /><span className="text-accent">{anchor.month} somem</span><br />todo mês sem você ver.</>
            : <>A maioria <span className="text-accent">não faz ideia</span> —<br />e é assim que o dinheiro some.</>}
        </h2>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border border-[#eef0f3] bg-white p-4 mb-4 shadow-[0_10px_24px_-14px_rgba(20,40,70,0.28)]">
          {anchor && (
            <>
              <div className="flex text-center mb-1">
                <div className="flex-1">
                  <small className="block text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Por dia</small>
                  <b className="text-[16px] tabular-nums text-destructive/80">R$ {diaNum}{mais}</b>
                </div>
                <div className="flex-1">
                  <small className="block text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Por mês</small>
                  <b className="text-[16px] tabular-nums">{anchor.month}</b>
                </div>
                <div className="flex-1">
                  <small className="block text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Em 12 meses</small>
                  <b className="text-[18px] tabular-nums text-accent">{anchor.year}</b>
                </div>
              </div>
              <div className="relative flex items-end gap-[3px] h-[72px] mt-4 mb-1 px-0.5" aria-hidden>
                {Array.from({ length: 12 }, (_, bi) => (
                  <motion.i
                    key={bi}
                    className={`flex-1 rounded-t-[3px] block ${bi === 11 ? "bg-accent" : "bg-[#f2d4e4]"}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${((bi + 1) / 12) * 100}%` }}
                    transition={{ delay: 0.45 + bi * 0.07, duration: 0.35, ease: "easeOut" }}
                  />
                ))}
                <motion.span
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}
                  className="absolute -top-1 right-0 bg-foreground text-background text-[9.5px] font-extrabold px-2 py-0.5 rounded-full"
                >{anchor.year}</motion.span>
              </div>
              <div className="flex justify-between text-[8px] text-muted-foreground/70 px-0.5 mb-3">
                <span>mês 1</span><span>mês 4</span><span>mês 8</span><span>mês 12</span>
              </div>
            </>
          )}
          {!anchor && (
            <p className="text-[13.5px] leading-relaxed mb-3">
              Sem registro, cada gasto pequeno fica invisível. E o que é invisível não dá pra controlar.
            </p>
          )}
          <small className="block text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
            Onde costuma vazar {atrapalha ? "— pelo que você contou" : ""}
          </small>
          {fontes.map(([emo, cor, nome, pct], fi) => (
            <div key={nome} className="flex items-center gap-2 mb-1.5 last:mb-0">
              <span className="w-6 h-6 rounded-[7px] grid place-items-center text-[12px] shrink-0" style={{ background: cor }}>{emo}</span>
              <span className="text-[11.5px] font-semibold flex-1">{nome}</span>
              <span className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.i className="block h-full rounded-full bg-accent/80"
                  initial={{ width: 0 }} animate={{ width: `${pct * 2}%` }} transition={{ delay: 0.9 + fi * 0.12, duration: 0.4 }} />
              </span>
              <b className="text-[10px] text-muted-foreground w-9 text-right">~{pct}%</b>
            </div>
          ))}
        </motion.div>
        <p className="text-[11px] text-muted-foreground text-center mb-4">
          estimativa com base nas suas respostas — o app mostra o <b className="text-foreground">SEU</b> número real
        </p>
        <Button size="lg" className="w-full h-12 rounded-full text-[15px] font-bold gap-2" onClick={onNext}>
          <span className="min-w-0 truncate">Quero estancar isso</span> <ArrowRight className="w-4 h-4 shrink-0" />
        </Button>
      </div>
    );
  }
  return (
    <div className="text-center pt-2">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-14 h-14 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-5 text-2xl"
      >
        💡
      </motion.div>
      {anchor ? (
        <>
          <h2 className="text-[26px] font-bold tracking-tight leading-[1.15] mb-4">
            Pela sua estimativa,<br />
            <span className="text-accent">{anchor.month} somem por mês</span><br />
            sem você ver.
          </h2>
          <div className="rounded-2xl border-2 border-accent/25 bg-accent/[0.05] p-5 mb-5">
            <p className="text-[13px] text-muted-foreground mb-1">Em um ano, isso vira</p>
            <p className="text-4xl font-extrabold text-accent tracking-tight">{anchor.year}</p>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-[26px] font-bold tracking-tight leading-[1.15] mb-4">
            A maioria das pessoas<br />
            <span className="text-accent">não faz ideia</span> —<br />
            e é assim que o dinheiro some.
          </h2>
          <div className="rounded-2xl border-2 border-accent/25 bg-accent/[0.05] p-5 mb-5">
            <p className="text-[14px] leading-relaxed">
              Sem registro, cada gasto pequeno fica invisível. E o que é invisível não dá pra controlar.
            </p>
          </div>
        </>
      )}
      <p className="text-sm text-muted-foreground leading-relaxed mb-7">
        Não é falta de disciplina — é falta de <strong className="text-foreground">visibilidade</strong>.
        Registrar no CORE leva segundos.
      </p>
      <Button size="lg" className="w-full h-12 text-base" onClick={onNext}>
        Quero ver pra onde vai <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

/** Pico das trilhas de vida (funil vitrine): a resposta de consistência vira
 *  a confissão — "não é força de vontade, é falta de sistema". */

function AreaProofSlide({ area, answer, pele, onNext }: { area: AreaKey; answer: string; pele?: boolean; onNext: () => void }) {
  const proof = AREA_PROOF[area as Exclude<AreaKey, "dinheiro">];
  const echo = proof?.echo[answer] ?? "É sempre a mesma história.";
  if (pele) {
    return (
      <div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-accent mb-2">
          💡 Seu diagnóstico
        </motion.div>
        <h2 className="text-[27px] font-black tracking-tight leading-[1.12] mb-5">
          <span className="text-accent">{echo}</span><br />{proof.reframe}
        </h2>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl border border-[#eef0f3] bg-white p-5 mb-6 shadow-[0_10px_24px_-14px_rgba(20,40,70,0.28)]">
          <p className="text-[14px] leading-relaxed">{proof.card}</p>
        </motion.div>
        <Button size="lg" className="w-full h-12 rounded-full text-[15px] font-bold gap-2" onClick={onNext}>
          <span className="min-w-0 truncate">{proof.cta}</span> <ArrowRight className="w-4 h-4 shrink-0" />
        </Button>
      </div>
    );
  }
  return (
    <div className="text-center pt-2">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-14 h-14 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-5 text-2xl"
      >
        💡
      </motion.div>
      <h2 className="text-[26px] font-bold tracking-tight leading-[1.15] mb-4">
        <span className="text-accent">{echo}</span><br />
        {proof.reframe}
      </h2>
      <div className="rounded-2xl border-2 border-accent/25 bg-accent/[0.05] p-5 mb-5">
        <p className="text-[14px] leading-relaxed">{proof.card}</p>
      </div>
      <Button size="lg" className="w-full h-12 text-base" onClick={onNext}>
        {proof.cta} <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

// Fluxo do quiz: perguntas + (na trilha de dinheiro) a tela de impacto logo
// após a pergunta de gasto. As trilhas das outras áreas não têm proof.
type QuizItem = { kind: "q"; qIdx: number } | { kind: "proof" };
const buildQuizItems = (questions: QuizQ[], proofAfterKey?: string): QuizItem[] =>
  questions.flatMap((q, i) => {
    const item: QuizItem[] = [{ kind: "q", qIdx: i }];
    if (proofAfterKey && q.key === proofAfterKey) item.push({ kind: "proof" });
    return item;
  });
const QUIZ_ITEMS: QuizItem[] = buildQuizItems(QUIZ, PROOF_AFTER_KEY);

function QuizScreen({ questions, items, onDone, onBack, initialAnswers, skipFirstAnswered, proofArea, pele }: {
  questions: QuizQ[];
  items: QuizItem[];
  onDone: (a: Record<string, string>) => void;
  onBack: () => void;
  initialAnswers?: Record<string, string>;
  /** Porta de finanças responde a 1ª pergunta na tela inicial: começa da 2ª. */
  skipFirstAnswered?: boolean;
  /** Trilha de vida: renderiza o pico de área (senão, o proof de gasto). */
  proofArea?: AreaKey;
  /** Pele do app (premissa 23/07, vitrine web+shell): tiles pastel, sombra,
   *  h2 900, só barra sem contador. /comecar padrão fica sem. */
  pele?: boolean;
}) {
  const startIdx = skipFirstAnswered && initialAnswers && questions.length > 0 && initialAnswers[questions[0].key]
    ? items.findIndex((it) => it.kind === "q" && it.qIdx === 1)
    : 0;
  const [idx, setIdx] = useState(startIdx < 0 ? 0 : startIdx);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers ?? {});
  // Micro-feedback por resposta (só web vitrine): a opção acende, a tag
  // devolve algo, e só então o slide segue — conversa, não formulário.
  const comFeedback = !!pele && !isNativeShell();
  const [feedback, setFeedback] = useState<{ label: string; texto: string } | null>(null);
  const item = items[idx];
  const q = item.kind === "q" ? questions[item.qIdx] : null;
  useEffect(() => {
    const it = items[idx];
    trackEvent("funnel_view", { step: it.kind === "q" ? `quiz_${it.qIdx + 1}` : "quiz_proof" });
  }, [idx, items]);
  const back = () => { if (idx === 0) onBack(); else setIdx((i) => i - 1); };
  const advance = (next: Record<string, string>) => {
    if (idx < items.length - 1) setIdx((i) => i + 1);
    else onDone(next);
  };
  const pick = (label: string) => {
    if (!q || feedback) return;
    const next = { ...answers, [q.key]: label };
    setAnswers(next);
    trackEvent("funnel_quiz_answer", { q: q.key, answer: label });
    const tag = comFeedback ? feedbackPara(q.key, label) : null;
    if (!tag) { advance(next); return; }
    setFeedback({ label, texto: tag });
    setTimeout(() => { setFeedback(null); advance(next); }, 900);
  };
  return (
    <div className="w-full max-w-md mx-auto">
      {/* topo: voltar + progresso */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={back} aria-label="Voltar" className="-ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full bg-accent rounded-full" initial={false}
            animate={{ width: `${((idx + 1) / items.length) * 100}%` }} transition={{ duration: 0.35, ease: "easeOut" }} />
        </div>
        {/* Pele do app: sem contador — só a barra (decisão do dono 23/07) */}
        {!pele && (
          <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}/{items.length}</span>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={item.kind === "q" ? q!.key : "proof"} {...slide}>
          {item.kind === "proof" ? (
            proofArea && proofArea !== "dinheiro" ? (
              <AreaProofSlide area={proofArea} answer={answers.consistencia ?? ""} pele={pele} onNext={() => advance(answers)} />
            ) : (
              <ProofSlide gasto={answers.gasto ?? ""} atrapalha={answers.atrapalha} pele={pele} onNext={() => advance(answers)} />
            )
          ) : (
            <>
              <h2 className={`text-[27px] ${pele ? "font-black" : "font-bold"} tracking-tight leading-[1.15] mb-7`}>{q!.q}</h2>
              <div className="space-y-3">
                {q!.opts.map((o, oi) => (
                  <div key={o.label}>
                  <button
                    onClick={() => pick(o.label)}
                    className={`group w-full flex items-center gap-3.5 rounded-2xl p-3.5 text-left active:scale-[0.99] transition-all ${
                      pele
                        ? "border border-[#e8eef4] bg-white shadow-[0_10px_24px_-14px_rgba(20,40,70,0.25)]"
                        : "border-2 border-border bg-card hover:border-accent hover:bg-accent/[0.04]"
                    } ${feedback?.label === o.label ? "!border-accent bg-accent/5" : ""}`}
                  >
                    <span
                      className={`grid place-items-center w-11 h-11 rounded-xl text-2xl shrink-0 ${pele ? "" : "bg-secondary"}`}
                      style={pele ? { background: TILE_CORES_APP[oi % TILE_CORES_APP.length] } : undefined}
                    >{o.emoji}</span>
                    <span className="font-semibold text-[15px] flex-1 leading-snug">{o.label}</span>
                    {pele ? (
                      <ChevronRight className="w-4 h-4 text-[#c3cad2] shrink-0" />
                    ) : (
                      <span className="grid place-items-center w-6 h-6 rounded-full border-2 border-border group-hover:border-accent transition-colors shrink-0">
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                      </span>
                    )}
                  </button>
                  {feedback?.label === o.label && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 ml-1 inline-flex items-center gap-1.5 rounded-full bg-accent/10 text-accent px-3 py-1.5 text-[12px] font-bold"
                    >✓ {feedback.texto}</motion.div>
                  )}
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ProgressScreen({ onDone, steps = PREP_STEPS, titulo = "Preparando seu plano…", review = false }: { onDone: () => void; steps?: string[]; titulo?: string; review?: boolean }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (done >= steps.length) {
      const t = setTimeout(onDone, 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone((d) => d + 1), done === 0 ? 500 : 850);
    return () => clearTimeout(t);
  }, [done, onDone, steps.length]);
  const pct = Math.round((done / steps.length) * 100);
  const C = 2 * Math.PI * 44;
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="relative w-28 h-28 mx-auto mb-7">
        <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <motion.circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--accent))" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} initial={false} animate={{ strokeDashoffset: C * (1 - pct / 100) }} transition={{ duration: 0.5, ease: "easeOut" }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-2xl font-bold tabular-nums">{pct}%</div>
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-1">{titulo}</h2>
      <p className="text-muted-foreground text-sm mb-8">Isso leva só alguns segundos.</p>
      <div className="space-y-3 text-left max-w-xs mx-auto">
        {steps.map((s, i) => {
          const state = i < done ? "done" : i === done ? "active" : "pending";
          return (
            <div key={s} className="flex items-center gap-3">
              {state === "done" ? <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                : state === "active" ? <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                : <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />}
              <span className={`text-sm ${state === "pending" ? "text-muted-foreground/60" : "text-foreground"}`}>{s}</span>
            </div>
          );
        })}
      </div>
      {/* Prova no meio da espera (BitePal): a espera vira argumento */}
      {review && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }}
          className="mt-8 max-w-xs mx-auto rounded-2xl border border-[#eef0f3] bg-white p-3.5 text-left shadow-[0_8px_20px_-14px_rgba(20,40,70,0.25)]">
          <p className="text-[12.5px] leading-snug">“Adorei demais o aplicativo!! Estou usando há 1 dia e já está me ajudando bastante.”</p>
          <p className="text-[10.5px] text-muted-foreground mt-1.5"><span className="text-[#f0a500]">★★★★★</span> — @requeijohn · Instagram</p>
        </motion.div>
      )}
    </div>
  );
}

/** Diagnóstico derivado das respostas — barras que dão o momento "isso sou eu". */
function DiagnosisCard({ answers }: { answers: Record<string, string> }) {
  const semControle = answers.controle === "Não controlo" || answers.controle === "Bloco de notas";
  const rows = [
    { label: "Visibilidade dos gastos", pct: semControle ? 18 : 38, level: "Baixa", tone: "bg-destructive/70" },
    { label: "Organização das contas", pct: answers.atrapalha === "Esqueço contas" ? 22 : 42, level: semControle ? "Baixa" : "Média", tone: "bg-amber-500/80" },
    { label: "Potencial de economia", pct: 88, level: "Alto", tone: "bg-accent" },
  ];
  return (
    <Card className="p-4 text-left space-y-3.5 mb-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Seu diagnóstico</div>
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[13px] font-semibold">{r.label}</span>
            <span className={`text-[11px] font-bold ${r.pct >= 60 ? "text-accent" : "text-muted-foreground"}`}>{r.level}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${r.tone}`}
              initial={{ width: 0 }}
              animate={{ width: `${r.pct}%` }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.7, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
    </Card>
  );
}

function ResultScreen({ answers, onDone }: { answers: Record<string, string>; onDone: () => void }) {
  // Coloca a "vitória" escolhida em primeiro, pra parecer feito pra ela.
  const items = answers.vitoria
    ? [answers.vitoria, ...RESULT_ITEMS.filter((r) => r !== answers.vitoria)].slice(0, 4)
    : RESULT_ITEMS.slice(0, 4);
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-16 h-16 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-4">
        <Sparkles className="w-8 h-8" />
      </motion.div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-accent mb-2">Análise concluída</div>
      <h2 className="text-[28px] font-bold tracking-tight leading-tight mb-5">Seu plano personalizado<br />está pronto</h2>
      <DiagnosisCard answers={answers} />
      <Card className="p-4 text-left space-y-3 mb-7">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Com o CORE, você vai</div>
        {items.map((r, i) => (
          <motion.div key={r} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.08 }}
            className="flex items-start gap-2.5 text-[14px]">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-accent/15 text-accent grid place-items-center shrink-0">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            {r}
          </motion.div>
        ))}
      </Card>
      <Button size="lg" className="w-full h-12 text-base" onClick={() => { trackEvent("funnel_click", { cta: "result" }); onDone(); }}>
        Ver meu painel <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3">Abre o app de verdade, com dados de exemplo</p>
    </div>
  );
}

function SignupScreen({ onSession, onConfirm }: { onSession: () => void; onConfirm: (email: string) => void }) {
  const { signUp, signIn } = useAuth();
  const { set: setUserData } = useUserData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // "User already registered": a pessoa voltou pelo anúncio e já tem conta.
  // Em vez de beco sem saída, oferece login com o e-mail que ela já digitou.
  const [existingAccount, setExistingAccount] = useState(false);
  // Telemetria de campo (20/07): 41% de quem VÊ o form não conclui e a gente
  // não sabia ONDE parava. 1º foco de cada campo vira evento — o último campo
  // focado antes do abandono aponta o degrau exato. 1 evento por campo/tela.
  const camposFocados = useRef<Set<string>>(new Set());
  const focoCampo = (campo: string) => () => {
    if (camposFocados.current.has(campo)) return;
    camposFocados.current.add(campo);
    trackEvent("funnel_signup_field", { field: campo, inapp: inApp });
  };
  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6 && (existingAccount || !!name.trim());
  // Webview do Instagram/Facebook: o Google trava o OAuth ali (dados de 11/07:
  // ~metade dos cliques falhavam e era ONDE o cadastro morria). Some com o
  // botão nesse ambiente e vai direto pro e-mail — igual o Auth.tsx já faz.
  const [inApp] = useState(isInAppBrowser);
  useEffect(() => {
    if (inApp) trackEvent("funnel_view", { step: "signup_inapp_browser" });
  }, [inApp]);

  const handleGoogle = async () => {
    if (loading || googleLoading) return;
    setErr(null);
    setGoogleLoading(true);
    trackEvent("funnel_click", { cta: "signup_google", inapp: inApp });
    try { localStorage.setItem(FUNNEL_OAUTH_KEY, "true"); } catch { /* noop */ }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthRedirectUrl("/auth/callback") },
    });
    if (error) {
      try { localStorage.removeItem(FUNNEL_OAUTH_KEY); } catch { /* noop */ }
      trackEvent("funnel_error", { where: "signup_google", inapp: inApp, message: (error.message || "").slice(0, 200) });
      setErr(error.message || "Não consegui abrir o Google. Tente de novo.");
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) { setErr("Digite seu e-mail pra receber o link."); return; }
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: getAuthRedirectUrl("/update-password"),
    });
    trackEvent("funnel_click", { cta: "signup_reset_password" });
    if (error) setErr(error.message);
    else setErr("Enviamos um link de recuperação pro seu e-mail. ✓");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    setErr(null);
    setLoading(true);

    // Modo "entrar" (e-mail já tinha conta): loga direto, sem tentar criar.
    if (existingAccount) {
      trackEvent("funnel_click", { cta: "existing_login_submit" });
      const { error: signInErr } = await signIn(email.trim().toLowerCase(), password);
      if (signInErr) {
        setErr("Senha incorreta. Tente de novo ou recupere abaixo.");
        setLoading(false);
        return;
      }
      trackEvent("funnel_click", { cta: "signup_success", via: "existing_login" });
      setLoading(false);
      onSession();
      return;
    }

    trackEvent("funnel_click", { cta: "signup_submit" });
    const { error, session } = await signUp(email.trim().toLowerCase(), password, name.trim());
    if (error) {
      // O MOTIVO importa: sem ele, "7 submits sem sucesso" (caso real de
      // 09/07) fica indiagnosticável — senha? e-mail já usado? rede do webview?
      trackEvent("funnel_error", { where: "signup_submit", inapp: inApp, message: (error.message || "").slice(0, 200) });
      const already = /already registered|already been registered|user already/i.test(error.message || "");
      if (already) {
        // Já tem conta: tenta logar com a senha que ela ACABOU de digitar
        // (o caminho mais curto — se acertou, entra direto no paywall).
        const { error: signInErr } = await signIn(email.trim().toLowerCase(), password);
        if (!signInErr) {
          // Login de conta existente: NÃO força tutorial (pode já ter feito).
          trackEvent("funnel_click", { cta: "signup_success", via: "existing_login" });
          setLoading(false);
          onSession();
          return;
        }
        // Senha não bateu: mostra o caminho de recuperação, sem beco sem saída.
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
    // Tutorial forçado é o de FINANÇAS (spotlight do Index) e o wizard da Home.
    // Quem veio do funil vitrine com outra área cai no módulo dela — o flag
    // aqui sequestraria a 1ª visita à Home com o wizard multi-módulo.
    try {
      const vidaArea = localStorage.getItem(FUNNEL_AREA_KEY);
      if (!vidaArea || vidaArea === "dinheiro") {
        setUserData("force-new-user-tutorial", "true");
        localStorage.setItem("force-new-user-tutorial", "true");
      }
    } catch { /* noop */ }
    trackEvent("funnel_click", { cta: "signup_success", instant: !!session });
    fireMetaEvent("CompleteRegistration", { content_name: "signup" });
    setLoading(false);
    if (session) onSession();
    else onConfirm(email.trim().toLowerCase());
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" /> Último passo
        </div>
        <h2 className="text-[26px] font-bold tracking-tight leading-tight">
          Só falta 1 passo pra você<br />começar a usar o CORE.
        </h2>
        <p className="text-muted-foreground text-sm mt-2">Crie sua conta pra destravar seu plano personalizado.</p>
      </div>

      {/* Fora do webview: Google é o caminho rápido. Dentro do Instagram/FB
          o OAuth trava, então nem mostra — e-mail vira o único caminho. */}
      {!inApp ? (
        <>
          <Button type="button" variant="outline" onClick={handleGoogle} disabled={loading || googleLoading} className="w-full h-12 gap-2 text-[15px] font-semibold">
            {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><GoogleIcon /> Continuar com Google</>}
          </Button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">ou com e-mail</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </>
      ) : (
        <p className="text-[12px] text-muted-foreground leading-snug text-center mb-4">
          Crie sua conta com e-mail e senha — leva 10 segundos.
        </p>
      )}

      <form onSubmit={submit} className="space-y-3">
        <Input placeholder="Seu nome" value={name} onFocus={focoCampo("nome")} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-12" />
        <Input type="email" placeholder="Seu melhor e-mail" value={email} onFocus={focoCampo("email")} onChange={(e) => { setEmail(e.target.value); if (existingAccount) { setExistingAccount(false); setErr(null); } }} autoComplete="email" className="h-12" />
        <Input type="password" placeholder={existingAccount ? "Sua senha" : "Crie uma senha (mín. 6)"} value={password} onFocus={focoCampo("senha")} onChange={(e) => setPassword(e.target.value)} autoComplete={existingAccount ? "current-password" : "new-password"} className="h-12" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={!valid || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : existingAccount ? <>Entrar e continuar <ArrowRight className="w-4 h-4" /></> : <>Criar conta e continuar <ArrowRight className="w-4 h-4" /></>}
        </Button>
        {existingAccount && (
          <button type="button" onClick={handleForgotPassword} className="w-full text-center text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
            Esqueci minha senha
          </button>
        )}
      </form>
      <div className="mt-5"><TrustRow /></div>
    </div>
  );
}

function ConfirmScreen({ email }: { email: string }) {
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

/* ----------------------------------------------------------------- shell */

export default function Comecar() {
  const [params] = useSearchParams();
  const { user, isSubscribed, subLoaded } = useAuth();
  // Volta da demo (?step=signup) cai no cadastro; volta do OAuth Google
  // (?step=offer, via /auth/callback) cai direto no paywall.
  // ("trial" é aceito por compat com links antigos.)
  const [step, setStep] = useState<Step>(() => {
    const s = params.get("step");
    // "plano" = volta da demo do funil vitrine (ordem 23/07: radar → demo →
    // PLANO → cadastro; o plano promete depois que a demo provou).
    return s === "signup" ? "signup" : s === "plano" ? "plano" : s === "analise" ? "result" : s === "offer" || s === "trial" ? "offer" : "start";
  });
  const [confirmEmail, setConfirmEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Funil vitrine: /inicio (URL limpa dos anúncios) ou ?porta=vida (compat).
  // Criativo "app pra vida inteira". A área escolhida persiste — quem volta
  // da demo (?step=signup) segue na trilha.
  const { pathname } = useLocation();
  const vitrine = pathname.startsWith("/inicio") || params.get("porta") === "vida";
  // Welcome "grade viva" como OVERLAY por cima da porta (a porta já está
  // montada por baixo — Começar só derrete o céu, sem troca de rota, sem
  // flash). Desde 23/07 vale pro /inicio INTEIRO (dono: web segue a premissa
  // do app — mesmas 2 telas iniciais). Deep-link com ?step= pula o welcome.
  const [welcomeVisible, setWelcomeVisible] = useState(
    () => (window.location.pathname.startsWith("/inicio") || new URLSearchParams(window.location.search).get("porta") === "vida") && !new URLSearchParams(window.location.search).get("step"),
  );
  const [area, setArea] = useState<AreaKey | null>(() => {
    try {
      const a = localStorage.getItem(FUNNEL_AREA_KEY);
      return a && a in AREAS ? (a as AreaKey) : null;
    } catch { return null; }
  });
  const track: QuizQ[] = vitrine && area && area !== "dinheiro" ? AREA_TRACKS[area] : QUIZ;
  // Trilhas de vida ganham a tela de PICO depois da pergunta de consistência.
  const trackItems = vitrine && area && area !== "dinheiro"
    ? buildQuizItems(track, "consistencia")
    : QUIZ_ITEMS;
  // Vitrine: o loading monta a ANÁLISE (a palavra "plano" pertence só ao SEU
  // PLANO — eram 2 páginas gerando plano, dono 23/07).
  const vidaPrepSteps = area
    ? ["Lendo suas respostas", `Mapeando seu padrão de ${AREAS[area].nome}`, "Montando sua análise", "Separando o que resolver primeiro"]
    : PREP_STEPS;

  // Captura UTM/referrer da entrada no funil — sem isso o admin não sabe
  // qual campanha/origem trouxe cada sessão.
  useEffect(() => {
    captureLandingMeta();
    // Meta Pixel: visitante entrou no funil (topo). A Compra vem da Cakto.
    fireMetaEvent("ViewContent", { content_name: "funil_comecar" });
  }, []);

  // Telemetria do funil: cada tela vista (a "quiz" emite quiz_1/2/3 por dentro
  // e o paywall emite offer/wheel/downsell por conta própria).
  useEffect(() => {
    // "plano" fica de fora: o SeuPlanoScreen emite o dele (com area) — sem duplo-count no admin.
    if (step !== "quiz" && step !== "offer" && step !== "plano") {
      trackEvent("funnel_view", {
        step,
        // Segmenta o funil vitrine ("vida") do funil padrão (finanças) no admin.
        ...(vitrine ? { porta: "vida" } : {}),
        // Só na 1ª tela: sinal pra distinguir visita real de pré-carregamento
        // do webview (Instagram/TikTok pré-abrem a página antes do tap real —
        // isso chega com visibilityState "hidden"/"prerender").
        ...(step === "start"
          ? { visibility: document.visibilityState, ua: navigator.userAgent.slice(0, 200) }
          : {}),
      });
    }
  }, [step]);

  // Assinante logado não tem nada a fazer no funil — manda pro app, na área
  // que ele escolheu. Caso real de 12/07: pagante voltou pro /inicio pelo
  // link do anúncio, reviu o quiz, tentou recriar a conta ("User already
  // registered") e cancelou achando que era problema técnico.
  if (user && subLoaded && isSubscribed) {
    return <Navigate to={area && area !== "dinheiro" ? `/${AREAS[area].module}` : "/financas"} replace />;
  }

  // Paywall é full-bleed (tem fundo, padding e CTA sticky próprios)
  if (step === "offer") return <PaywallFlow context="funnel" answers={answers} />;

  // Funil vitrine (web e app): céu suave da porta até o loading; branco do
  // radar em diante (céu forte no welcome → suave no corredor → app assume).
  const ceuShell = (vitrine || isNativeShell()) && (step === "start" || step === "crenca" || step === "quiz" || step === "confianca" || step === "progress");

  return (
    <div
      style={{ ...LIGHT_VARS, ...(ceuShell ? { background: CEU_SUAVE_APP } : {}) }}
      className={`min-h-dvh ${ceuShell ? "" : "bg-white"} text-foreground flex flex-col`}
    >
      {/* Shell: porta e quiz TOP-ALIGNED com a mesma geometria (barra e
          pergunta no mesmo y em toda tela) + transição em slide horizontal —
          pra ler como UMA tela trocando conteúdo. Web fica como sempre foi. */}
      <div className={`flex-1 flex flex-col ${step === "start" || ((vitrine || isNativeShell()) && (step === "crenca" || step === "quiz" || step === "confianca")) ? "px-5 pt-3 pb-7" : "items-center justify-center px-5 py-12"}`}>
        <AnimatePresence mode="wait">
          <motion.div key={step} {...(isNativeShell() ? slide : fade)} className={step === "start" ? "w-full flex-1 flex flex-col" : "w-full"}>
            {step === "start" && (vitrine ? (
              // Porta como pergunta pura no molde do quiz (premissa do app,
              // 23/07: web e app iguais — a headline mora no welcome).
              <PortaPerguntaApp
                onBack={() => setWelcomeVisible(true)}
                onPickArea={(picked, label) => {
                  setArea(picked);
                  const first = { area: picked };
                  setAnswers(first);
                  try { localStorage.setItem(FUNNEL_AREA_KEY, picked); } catch { /* noop */ }
                  trackEvent("funnel_click", { cta: "start", porta: "vida", area: picked });
                  trackEvent("funnel_quiz_answer", { q: "area", answer: label });
                  // Web (teste 23/07): beat de CRENÇA antes do quiz; app segue direto.
                  setStep(isNativeShell() ? "quiz" : "crenca");
                }}
              />
            ) : (
              <StartScreen
                onPick={(firstAnswer) => {
                  const first = { [QUIZ[0].key]: firstAnswer };
                  setAnswers(first);
                  trackEvent("funnel_click", { cta: "start" });
                  // A 1ª pergunta virou a tela inicial: emite quiz_1 aqui pra o
                  // passo "Quiz 1" do admin continuar contando (o QuizScreen
                  // agora começa no quiz_2).
                  trackEvent("funnel_view", { step: "quiz_1" });
                  trackEvent("funnel_quiz_answer", { q: QUIZ[0].key, answer: firstAnswer });
                  setStep("quiz");
                }}
              />
            ))}
            {step === "crenca" && <CrencaScreen area={area ?? "dinheiro"} onNext={() => setStep("quiz")} onBack={() => setStep("start")} />}
            {step === "confianca" && <ConfiancaScreen answers={answers} onNext={() => setStep("progress")} onBack={() => setStep("quiz")} />}
            {step === "quiz" && (
              <QuizScreen
                questions={track}
                items={trackItems}
                skipFirstAnswered={!vitrine}
                proofArea={vitrine && area ? area : undefined}
                pele={vitrine || isNativeShell()}
                initialAnswers={answers}
                onBack={() => setStep("start")}
                onDone={(a) => {
                  setAnswers(a);
                  // Persiste pro paywall personalizar mesmo após OAuth/refresh
                  try { localStorage.setItem("funnel-quiz-answers", JSON.stringify(a)); } catch { /* noop */ }
                  setStep(vitrine && !isNativeShell() ? "confianca" : "progress");
                }}
              />
            )}
            {step === "progress" && <ProgressScreen steps={vitrine ? vidaPrepSteps : PREP_STEPS} titulo={vitrine && !isNativeShell() ? "Montando sua análise…" : undefined} review={vitrine && !isNativeShell()} onDone={() => setStep("result")} />}
            {step === "result" && (vitrine && area ? (
              // Web: PONTE (radar saiu — números fabricados); shell mantém o
              // radar até o web validar. A demo devolve em ?step=plano.
              isNativeShell()
                ? <RadarResultScreen answers={answers} area={area} onDone={() => { window.location.href = demoUrlFor(area); }} />
                : <PonteDemoScreen area={area} answers={answers} onDemo={() => { window.location.href = demoUrlFor(area); }} />
            ) : (
              <ResultScreen answers={answers} onDone={() => { window.location.href = DEMO_URL; }} />
            ))}
            {step === "central" && area && (
              <CentralScreen area={area} onOpen={() => { window.location.href = demoUrlFor(area); }} />
            )}
            {step === "plano" && (
              <SeuPlanoScreen
                area={area ?? "dinheiro"}
                answers={answers}
                onCommit={() => setStep("signup")}
              />
            )}
            {step === "signup" && (
              <SignupScreen
                onSession={() => setStep("offer")}
                onConfirm={(e) => { setConfirmEmail(e); setStep("confirm"); }}
              />
            )}
            {step === "confirm" && <ConfirmScreen email={confirmEmail} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* APP DAS LOJAS: welcome por cima da porta — o céu derrete revelando
          o funil já montado por baixo (sem troca de rota, sem flash) */}
      <AnimatePresence>
        {welcomeVisible && (
          <motion.div key="app-welcome" exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
            <AppWelcome onComecar={() => setWelcomeVisible(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
