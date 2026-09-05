/**
 * FUNIL W (29/08, desenho do dono): o funil da WEB que dava ROI, dentro do
 * app, com as adições que o APP provou. Passo a passo e a origem de cada tela:
 *
 *   welcome     → grade viva azul do app (AppWelcome)
 *   promessas   → 3 telas rápidas BitePal (app)
 *   porta       → "Um app pra vida inteira. Qual área tá fora de controle?"
 *                 (web dia14 vitrine) — define a ROTA de tudo que segue
 *   quiz        → perguntas da web (QUIZ finanças / AREA_TRACKS por área)
 *   progress    → loading teatral (web)
 *   result      → diagnóstico da área (web, RadarResultScreen)
 *   central     → 16 módulos → abre a DEMO REAL (/preview do módulo da rota)
 *   compromissos→ volta da demo: Claro!×3 POR ROTA (app/Me+, perguntas novas)
 *   contrato    → assinatura no dedo (app/Me+)
 *   notif       → UMA tela só, copy premissa-dia14, pós-contrato
 *   offer       → PaywallW (layout web @ 97,90 vitalício, motor RC do app)
 *   signup      → cadastro DEPOIS de pagar (v48) → liberando
 *
 * O que a web tinha e MORREU aqui de propósito: criar-conta pré-paywall (no
 * app a conta nasce depois do pagamento) e a prova social no meio do quiz
 * (a web que dava ROI rodava com ela desligada; a prova mora no mural).
 */
import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppWelcome } from "@/components/app/AppWelcome";
import { trackEvent, getAttributionParams } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { CHAVES_FUNIL_W as CHAVES, guardarChave, lerChave, idadeDaChave, REINICIO_ATE_MS, limparProgresso, passoDeRetomada, comecaNaPorta, veioDeAnuncio, passoAnteriorDe, ficaNoVoltar, alvoDoDeepLink, RECUO_DO_PAYWALL } from "@/pages/funis/w/retomada";
import { useAuth } from "@/hooks/use-auth";
import { anonimoLigado, precisaBatizar } from "@/lib/sessao-anonima";
import { QUIZ, AREA_TRACKS, AREAS, type AreaKey } from "@/lib/funnel";
import { ArrowRight, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { ICONE_PORTA, ICONES_COMPROMISSO, MODULO_VISUAL } from "@/lib/funnel-icones";
import {
  QuizScreen, ProgressScreen, RadarResultScreen, CentralScreen, ProvaSocialScreen,
  buildQuizItems,
} from "@/pages/funis/dia14/ComecarDia14";
import { PromessasScreen, ContratoScreen } from "@/pages/funis/teste/ComecarTeste";
import { SignupScreen, ConfirmScreen, LiberandoScreen, POS_COMPRA_OAUTH_KEY } from "@/pages/funis/radar/ComecarRadar";
import { PaywallW } from "./PaywallW";
import { PagoScreen } from "@/components/funil/PagoScreen";
/* Lazy de propósito: esta folha só existe dentro do app da loja, e o
   ComecarW é carregado ansiosamente na /inicio da WEB (velocidade da 1ª tela,
   02/09) — o vaul do Drawer não pode entrar no bundle de quem nunca vai vê-la. */
const ConviteAvaliacao = lazy(() =>
  import("@/components/avaliacao/ConviteAvaliacao").then((m) => ({ default: m.ConviteAvaliacao })));
import type { PlanoDoConvite } from "@/components/avaliacao/ConviteAvaliacao";
import { PaywallIOS } from "@/pages/funis/ios/PaywallIOS";
import { SignupIOS, ConfirmIOS, LiberandoIOS } from "@/pages/funis/ios/CadastroIOS";
import { ehApple } from "@/lib/loja";

const FUNIL = "w";

type Step =
  | "welcome" | "promessas" | "porta" | "quiz" | "prova" | "progress" | "result"
  | "central" | "compromissos" | "contrato" | "notif" | "offer" | "pago"
  | "signup" | "confirm" | "liberando";

// Tema claro fixo (o funil da web roda claro, doa o que doer o tema do sistema).
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

/** Claro!×3 POR ROTA (pedido do dono: "elas têm que mudar de acordo com a
 *  escolha da rota"). A pergunta 1 é a dor da área; 2 e 3 sobem o degrau. */
const COMPROMISSOS_POR_AREA: Record<AreaKey, Array<{ emoji: string; p: string }>> = {
  dinheiro: [
    { emoji: "💸", p: "Você quer saber pra onde seu dinheiro vai?" },
    { emoji: "📅", p: "Quer parar de esquecer conta e pagar juros?" },
    { emoji: "🚀", p: "Topa fechar o mês no azul?" },
  ],
  rotina: [
    { emoji: "🗓️", p: "Você quer um dia que se organiza sozinho?" },
    { emoji: "🔁", p: "Quer construir hábitos que ficam?" },
    { emoji: "🚀", p: "Topa manter a constância por 30 dias?" },
  ],
  corpo: [
    { emoji: "💪", p: "Você quer treinar com progresso de verdade?" },
    { emoji: "🥗", p: "Quer dieta e treino no mesmo lugar?" },
    { emoji: "🚀", p: "Topa cuidar do corpo sem depender de motivação?" },
  ],
  saude: [
    { emoji: "❤️", p: "Você quer cuidar da sua saúde todo dia?" },
    { emoji: "😴", p: "Quer dormir e beber água como gente grande?" },
    { emoji: "🚀", p: "Topa virar sua versão mais saudável?" },
  ],
  metas: [
    { emoji: "🎯", p: "Você quer tirar suas metas do papel?" },
    { emoji: "🧭", p: "Quer ver seu progresso toda semana?" },
    { emoji: "🚀", p: "Topa virar sua melhor versão?" },
  ],
};

/** Porta como PERGUNTA de quiz (30/08, dono): na web esta tela era a ENTRADA
 *  do funil (headline hero, grade de 16 ícones, "5 perguntas rápidas · sem
 *  cadastro"). Aqui ela vem DEPOIS da welcome+promessas — então veste o
 *  uniforme das outras perguntas: título de quiz + opções, e só. */
const PORTAS_W: Array<{ area: AreaKey; emoji: string; label: string }> = [
  { area: "dinheiro", emoji: "💰", label: "Meu dinheiro" },
  { area: "rotina", emoji: "📅", label: "Minha rotina e hábitos" },
  { area: "corpo", emoji: "💪", label: "Treino e alimentação" },
  { area: "metas", emoji: "🎯", label: "Minhas metas paradas" },
  { area: "dinheiro", emoji: "😵", label: "Tudo, sinceramente" },
];

/* A PORTA É A PERGUNTA 1 (31/08, bronca do dono: "deixa ela no mesmo design
 * das outras com a barra em cima"). Antes ela era uma tela avulsa, sem topo:
 * a pessoa respondia a primeira pergunta sem nenhum sinal de que o quiz tinha
 * começado, e a barra só aparecia depois — parecia outro app. Agora nasce com
 * o mesmo cabeçalho do QuizScreen, com a barra no primeiro degrau de 8.
 * O botão de voltar existe mas leva pras promessas (não há pergunta antes). */
function PortaW({ onPickArea, onBack, totalPassos }: { onPickArea: (a: AreaKey, label: string) => void; onBack: () => void; totalPassos: number }) {
  /* v105: a escolha acende (borda grafite) por 220 ms antes de avançar — o
   * mesmo feedback das outras perguntas. A trava evita o toque duplo. */
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const escolher = (o: (typeof PORTAS_W)[number]) => {
    if (escolhida) return;
    setEscolhida(o.label);
    window.setTimeout(() => onPickArea(o.area, o.label), 220);
  };
  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} aria-label="Voltar" className="-ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full bg-accent rounded-full" initial={false}
            animate={{ width: `${(1 / totalPassos) * 100}%` }} transition={{ duration: 0.35, ease: "easeOut" }} />
        </div>
      </div>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent mb-2.5">Pra começar</div>
      <h2 className="text-[26px] font-extrabold tracking-[-0.02em] leading-[1.15] mb-2">
        Qual área da sua vida tá mais fora de controle hoje?
      </h2>
      <p className="text-[14px] text-muted-foreground leading-snug mb-5">Seu plano começa por ela. O resto entra no seu ritmo.</p>
      <div className="space-y-2.5">
        {PORTAS_W.map((o, i) => {
          /* v105: o tile é o MÓDULO que a área abre, com o ícone e o pastel do
             painel do app (o emoji saiu do funil inteiro). */
          const v = MODULO_VISUAL[ICONE_PORTA[o.label] ?? "tudo"];
          const Icon = v.Icon;
          const sel = escolhida === o.label;
          return (
            <motion.button
              key={o.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.045, duration: 0.36, ease: [0.23, 1, 0.32, 1] }}
              onClick={() => escolher(o)}
              className={`w-full flex items-center gap-3 rounded-2xl border-2 p-3 text-left active:scale-[0.985] transition-[transform,border-color,background-color] duration-150 ${
                sel ? "border-[#16121c] bg-[#F6F5F3]" : "border-border bg-card"
              }`}
            >
              <span className="grid place-items-center w-[42px] h-[42px] rounded-xl shrink-0" style={{ background: v.cor, color: v.tinta }}>
                <Icon className="w-5 h-5" strokeWidth={2} />
              </span>
              <span className="font-semibold text-[15px] flex-1 leading-snug">{o.label}</span>
              <ChevronRight className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/** Notificação NO ONBOARDING (30/08, dono: "não faz sentido depois do
 *  compromisso; tem que seguir a identidade da web e falar do que ELE
 *  escolheu"). Tela CLARA, uniforme de quiz, logo depois do diagnóstico:
 *  o resultado acabou de dizer o que o CORE vai fazer — aqui ele diz COMO
 *  te lembra disso. Copy por área, concreta. */
const LEMBRETES_W: Record<AreaKey, { titulo: string; itens: Array<{ emoji: string; t: string }> }> = {
  dinheiro: {
    titulo: "O CORE te avisa antes da conta vencer",
    itens: [
      { emoji: "💸", t: "Conta chegando no vencimento — aviso na véspera" },
      { emoji: "📊", t: "Quanto ainda dá pra gastar no mês" },
      { emoji: "🗓️", t: "Fechamento do teu mês, todo dia 1º" },
    ],
  },
  rotina: {
    titulo: "O CORE te lembra do hábito na hora certa",
    itens: [
      { emoji: "🔁", t: "Hábito do dia ainda aberto — um toque às 21h" },
      { emoji: "📅", t: "Sua agenda de amanhã, na noite anterior" },
      { emoji: "🔥", t: "Sua sequência em risco — antes de quebrar" },
    ],
  },
  corpo: {
    titulo: "O CORE te lembra do treino de hoje",
    itens: [
      { emoji: "💪", t: "Treino do dia, no seu horário" },
      { emoji: "💧", t: "Água ficando pra trás — lembrete leve" },
      { emoji: "🔥", t: "Constância em risco — antes de quebrar" },
    ],
  },
  saude: {
    titulo: "O CORE cuida dos teus lembretes de saúde",
    itens: [
      { emoji: "💧", t: "Água e sono — no ritmo que você definir" },
      { emoji: "❤️", t: "Check-in do teu dia, uma vez só" },
      { emoji: "🔥", t: "Sequência em risco — antes de quebrar" },
    ],
  },
  metas: {
    titulo: "O CORE te cobra a meta (do jeito bom)",
    itens: [
      { emoji: "🎯", t: "Check-in semanal do progresso da meta" },
      { emoji: "📈", t: "Marco batido — comemorar também importa" },
      { emoji: "🔥", t: "Semana sem avanço — cutucada gentil" },
    ],
  },
};

/** v105: a notificação de EXEMPLO que a pessoa veria — um cartão igual ao do
 *  Android, com a copy da área. Mostrar a coisa vale mais que descrevê-la. */
const NOTIF_EXEMPLO: Record<AreaKey, [string, string]> = {
  dinheiro: ["Conta de luz vence amanhã", "R$ 182,40 · toca pra marcar como paga"],
  rotina: ["Hora do hábito: ler 10 páginas", "Sequência de 6 dias · não quebra hoje"],
  corpo: ["Treino de hoje: pernas · 35 min", "3 de 5 na semana · falta pouco"],
  saude: ["Vitamina D · agora", "e 2 copos de água pra bater a meta"],
  metas: ["Meta: viagem em dezembro · 62%", "Próximo passo: guardar R$ 200 esta semana"],
};

function NotifW({ area, onDone }: { area: AreaKey; onDone: () => void }) {
  const [indo, setIndo] = useState(false);
  const conf = LEMBRETES_W[area] ?? LEMBRETES_W.dinheiro;
  const exemplo = NOTIF_EXEMPLO[area] ?? NOTIF_EXEMPLO.dinheiro;
  const seguir = async (pedir: boolean) => {
    if (indo) return;
    setIndo(true);
    trackEvent("funnel_click", { cta: pedir ? "notif_ativar" : "notif_pular", funil: FUNIL, area });
    if (pedir) {
      /* TETO DE 4s (31/08). O `catch` sozinho não bastava: ele cobre promise
       * REJEITADA, não promise que nunca resolve. E o plugin de permissão
       * pendura em alguns aparelhos — reproduzido no emulador, onde o diálogo
       * do Android não volta nunca. Como `indo` já desabilitou os DOIS botões
       * antes do await, o resultado era uma tela sem saída: a pessoa que pediu
       * o lembrete ficava presa no funil pra sempre, sem nem poder voltar.
       * Corre atrás do dado quando dá, mas o funil nunca espera mais que 4s. */
      const comTeto = <T,>(p: Promise<T>, ms = 4000) =>
        Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
      try {
        const { pedirPermissao, estadoPermissao } = await import("@/lib/notificacoes");
        const antes = await comTeto(estadoPermissao());
        const concedida = await comTeto(pedirPermissao());
        // "denied" prévio (reinstalação/recusa antiga) = o Android NÃO mostra
        // o diálogo nunca mais — o funil segue, e a telemetria conta quantos.
        // `concedida: null` agora significa "o aparelho não respondeu a tempo",
        // que é exatamente o caso que travava e a gente não conseguia contar.
        trackEvent("notif_permissao_funil", { funil: FUNIL, area, antes, concedida, expirou: concedida === null });
      } catch { /* nunca trava o funil */ }
    }
    onDone();
  };
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent mb-2.5">Um detalhe importante</div>
      <h2 className="text-[24px] font-extrabold tracking-[-0.02em] leading-[1.15] mb-3">{conf.titulo}</h2>
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.36, ease: [0.23, 1, 0.32, 1] }}
        className="flex items-start gap-3 rounded-[18px] border border-border bg-[#F6F5F3] px-3.5 py-3 mb-4"
      >
        <span className="grid place-items-center w-[38px] h-[38px] rounded-[10px] bg-[#16121c] text-white text-[11px] font-black shrink-0">CORE</span>
        <span className="min-w-0">
          <span className="block text-[11px] font-medium text-muted-foreground mb-0.5">CORE · agora</span>
          <span className="block text-[14px] font-bold leading-tight">{exemplo[0]}</span>
          <span className="block text-[13px] text-muted-foreground leading-snug">{exemplo[1]}</span>
        </span>
      </motion.div>
      <p className="text-[13.5px] text-muted-foreground mb-4 leading-snug">
        Organizar sozinho falha no dia 3 — por esquecimento, não por preguiça. O lembrete certo é metade do resultado.
      </p>
      <div className="space-y-2.5 mb-5">
        {conf.itens.map((i, k) => (
          <motion.div
            key={i.t}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + k * 0.05, duration: 0.36, ease: [0.23, 1, 0.32, 1] }}
            className="flex items-start gap-2.5"
          >
            <Bell className="w-[18px] h-[18px] text-accent shrink-0 mt-0.5" strokeWidth={2} />
            <span className="font-medium text-[14px] leading-snug">{i.t}</span>
          </motion.div>
        ))}
      </div>
      <div className="space-y-2.5 pb-2">
        <button
          onClick={() => void seguir(true)}
          disabled={indo}
          className="w-full rounded-full py-3.5 text-[15px] font-extrabold text-white active:scale-[0.99] transition-transform disabled:opacity-60"
          style={{ background: "#16121c" }}
        >
          Quero ser lembrado
        </button>
        <button onClick={() => void seguir(false)} disabled={indo} className="w-full text-center text-[13px] text-muted-foreground py-2">
          Agora não
        </button>
      </div>
    </div>
  );
}

function CompromissosPorRota({ area, onDone }: { area: AreaKey; onDone: () => void }) {
  const PERGUNTAS = COMPROMISSOS_POR_AREA[area] ?? COMPROMISSOS_POR_AREA.dinheiro;
  const ICONES = ICONES_COMPROMISSO[area] ?? ICONES_COMPROMISSO.dinheiro;
  const visual = MODULO_VISUAL[AREAS[area].module] ?? MODULO_VISUAL.financas;
  const [i, setI] = useState(0);
  const responder = (sim: boolean) => {
    trackEvent("funnel_quiz_answer", { step: `compromisso_${i + 1}`, answer: sim ? "claro" : "nao", area, funil: FUNIL });
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
              <div className="flex justify-center gap-1.5 mb-5">
                {PERGUNTAS.map((_, k) => (
                  <span key={k} className={`w-2 h-2 rounded-full transition-colors ${k <= i ? "bg-accent" : "bg-black/10"}`} />
                ))}
              </div>
              {/* v105: o ícone do módulo da área no tile pastel do app, no lugar do emoji */}
              {(() => { const Icon = ICONES[i] ?? visual.Icon; return (
                <motion.span
                  key={q.p}
                  initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, ease: [0.22, 1.25, 0.36, 1] }}
                  className="mx-auto mb-5 grid place-items-center w-[76px] h-[76px] rounded-[24px]" style={{ background: visual.cor, color: visual.tinta }}
                >
                  <Icon className="w-[34px] h-[34px]" strokeWidth={2} />
                </motion.span>
              ); })()}
              <h1 className="text-[26px] font-extrabold tracking-[-0.02em] leading-tight">{q.p}</h1>
            </div>
          </div>
          <div className="pb-1 space-y-2.5">
            <button
              onClick={() => responder(true)}
              className="w-full rounded-full py-4 text-[16px] font-extrabold text-white active:scale-[0.99] transition-transform"
              style={{ background: "#16121c" }}
            >
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

/** ECO (v105) — tela nova depois da 1ª pergunta, só pra quem respondeu
 *  "Quero organizar tudo" / "Um pouco de tudo": 46% de todas as respostas da
 *  1ª pergunta (184 de 396 em 03–04/09). Diz que a pessoa não está sozinha e
 *  POR QUE o plano começa por uma área só — o argumento contra o "tudo de uma
 *  vez" que larga no dia 3. Medir: passagem do eco e toque no paywall de quem
 *  o viu contra quem não viu. */
const RESPOSTA_TUDO = /organizar tudo|um pouco de tudo/i;
export const respondeuTudo = (answers: Record<string, string> | null | undefined): boolean => RESPOSTA_TUDO.test(answers?.atrapalha ?? "");

function EcoW({ area, onNext }: { area: AreaKey; onNext: () => void }) {
  const a = AREAS[area];
  const visual = MODULO_VISUAL[a.module] ?? MODULO_VISUAL.financas;
  const Icon = visual.Icon;
  const item = (i: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.06, duration: 0.36, ease: [0.23, 1, 0.32, 1] as const } });
  return (
    <div className="w-full max-w-md mx-auto">
      <motion.div {...item(0)} className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent mb-2">Você não está sozinho</motion.div>
      <motion.div {...item(1)} className="flex items-baseline gap-2 mb-2">
        <span className="text-[44px] font-extrabold tracking-[-0.03em] leading-none text-accent tabular-nums">46</span>
        <span className="text-[15px] font-semibold text-muted-foreground">de cada 100 pessoas respondem isso</span>
      </motion.div>
      <motion.h2 {...item(2)} className="text-[24px] font-extrabold tracking-[-0.02em] leading-[1.15] mb-3">Quem tenta arrumar tudo de uma vez larga no dia 3.</motion.h2>
      <motion.p {...item(3)} className="text-[14.5px] text-muted-foreground leading-snug mb-4">
        Por isso o seu plano começa por <b className="text-foreground font-semibold">{a.nome.toLowerCase()}</b>: 5 minutos por dia numa área só. Os outros 15 módulos ficam abertos e entram no seu ritmo.
      </motion.p>
      <motion.div {...item(4)} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 mb-5">
        <span className="grid place-items-center w-[42px] h-[42px] rounded-xl shrink-0" style={{ background: visual.cor, color: visual.tinta }}><Icon className="w-5 h-5" strokeWidth={2} /></span>
        <span><span className="block text-[14px] font-bold">Começa por {a.nome}</span><span className="block text-[12.5px] text-muted-foreground">o resto entra quando você quiser</span></span>
      </motion.div>
      <motion.button
        {...item(5)}
        onClick={onNext}
        className="w-full h-14 rounded-full text-[16px] font-semibold text-white flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
        style={{ background: "#16121c" }}
      >
        Faz sentido <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2.2} />
      </motion.button>
    </div>
  );
}

// As chaves e a retomada moram em ./retomada.ts (02/09): progresso em
// localStorage com validade, pra sobreviver ao Android matar o app na folha.

export default function ComecarW() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Init preguiçoso DIRETO da URL (bug do dono 30/08: a volta da demo pintava
  // 1 frame da welcome azul antes do efeito trocar o passo — o estado já
  // nasce no passo certo e o azul nunca pinta).
  const [step, setStepCru] = useState<Step>(() => {
    try {
      const s = new URLSearchParams(window.location.search).get("step");
      if (s === "compromissos" || s === "offer" || s === "signup") return s as Step;
    } catch { /* noop */ }
    // ANÚNCIO NA WEB → PORTA (02/09): o clique pago cai na primeira pergunta,
    // sem welcome nem promessas (ver retomada.ts — 69% morriam no splash).
    if (comecaNaPorta(isNativeShell(), veioDeAnuncio(window.location.search, getAttributionParams()))) return "porta";
    // RETOMADA (02/09): o app morreu com a folha do Google aberta e voltou?
    // Cai onde parou (paywall, cadastro…), não na welcome. Só no shell.
    const retomar = passoDeRetomada(lerChave<string>(CHAVES.passo), isNativeShell());
    if (retomar) return retomar as Step;
    return "welcome";
  });
  const [area, setArea] = useState<AreaKey | null>(() => {
    const a = lerChave<AreaKey>(CHAVES.area); return a && a in AREAS ? a : null;
  });
  const [answers, setAnswers] = useState<Record<string, string>>(() => lerChave<Record<string, string>>(CHAVES.respostas) ?? {});
  /* v105: o QuizScreen guarda as respostas dele e só entrega no fim; o ECO
   * precisa da 1ª resposta NA HORA pra entrar (ou não) na sequência. */
  const [parciais, setParciais] = useState<Record<string, string>>({});
  const [confirmEmail, setConfirmEmail] = useState("");
  // Pagou sem conta antes de o app morrer? Então a retomada é no CADASTRO.
  const [posCompra, setPosCompra] = useState<boolean>(() => lerChave<boolean>(CHAVES.posCompra) === true);
  /* A chave de sign-in anônimo está ligada? Decide se a web vende antes de
   * cadastrar (caminho novo) ou cadastra antes de vender (caminho de 31/08).
   * Nasce `false` — o caminho antigo — e só vira `true` se o Supabase
   * confirmar. A pergunta sai no mount, muito antes do contrato, então já
   * chegou quando a resposta importa; e se não tiver chegado, o pior caso é
   * pedir cadastro a mais, nunca levar alguém a um beco sem sessão. */
  const [anonimoOk, setAnonimoOk] = useState(false);
  /* MESMO FUNIL, DOIS CANOS DE PAGAMENTO (31/08). Fora do shell da loja este
   * arquivo roda em /w e cobra por Pix; dentro do app, pela folha do Google.
   * A meta que motivou isso é ROI 2, e a conta não fecha na folha: ela paga
   * 13-27% (medido 27-31/08), cobra 15% e prende o caixa 60 dias. */
  const naWeb = !isNativeShell();
  const montou = useRef(false);

  const setStep = (s: Step) => {
    setStepCru(s);
    // "liberando" = a conta nasceu; a partir daqui o RootGate manda pro app,
    // e progresso guardado só serviria pra prender alguém no funil.
    if (s === "liberando") limparProgresso(); else guardarChave(CHAVES.passo, s);
    // WEB (02/09): uma entrada de history por passo — sem isso o Voltar do
    // navegador do Instagram SAÍA do site (o funil é estado, não rota). A URL
    // não muda (nada de ?step=, que dispararia o efeito de deep link).
    if (naWeb && !voltandoRef.current) { try { window.history.pushState({ w: s }, ""); } catch { /* noop */ } }
    // "offer" é emitido pelo PaywallW no mount (com braço e área) — emitir
    // aqui também contava 2 paywalls por sessão (varredura 02/09).
    if (s !== "offer") trackEvent("funnel_view", { step: s === "porta" ? "start" : s, funil: FUNIL, ...(area ? { area } : {}) });
    window.scrollTo(0, 0);
  };

  // Retomada: volta da DEMO cai em ?step=compromissos (mesma mecânica do /app);
  // pós-OAuth e estados persistidos seguem a whitelist curta.
  useEffect(() => {
    if (montou.current) return;
    montou.current = true;
    // Volta do OAuth de quem JÁ PAGOU (SignupScreen grava a flag antes de
    // abrir o Google): pousa direto no liberando, nunca de volta no paywall.
    try {
      if (localStorage.getItem(POS_COMPRA_OAUTH_KEY) === "1") {
        localStorage.removeItem(POS_COMPRA_OAUTH_KEY);
        setPosCompra(true);
        setStepCru("liberando");
        return;
      }
    } catch { /* noop */ }
    // Pergunta cedo, usa tarde: a resposta só é lida no fim do contrato.
    if (naWeb) void anonimoLigado().then(setAnonimoOk);
    const s = params.get("step");
    if (s === "compromissos" || s === "offer" || s === "signup") {
      // "offer" já sai do PaywallW no mount — aqui só o registro da retomada
      trackEvent(s === "offer" ? "funnel_retomada" : "funnel_view", { step: s, funil: FUNIL, retomada: true });
    } else if (step === "porta") {
      // clique pago na web caiu direto na porta — o "start" do funil
      trackEvent("funnel_view", { step: "start", funil: FUNIL, entrada: "anuncio" });
    } else if (step !== "welcome") {
      // retomada depois de reinício (<6h) ou VOLTA (dias depois, 04/09) —
      // medível separado da welcome ("offer" só como funnel_retomada: o
      // funnel_view dele sai do PaywallW)
      const idade = idadeDaChave(CHAVES.passo);
      const motivo = idade !== null && idade > REINICIO_ATE_MS ? "volta" : "reinicio";
      trackEvent(step === "offer" ? "funnel_retomada" : "funnel_view", { step, funil: FUNIL, retomada: true, motivo, idade_h: idade === null ? null : Math.round(idade / 3600e3) });
    } else {
      trackEvent("funnel_view", { step: "welcome", funil: FUNIL });
    }
    /* COMPRA FEITA COM O APP MORTO (02/09): a Play concluiu, o app não viu.
     * Pergunta pra loja no boot; se ela diz "tem compra", pula pro cadastro
     * com "seu pagamento passou". Corre em paralelo — a welcome não espera. */
    if (!naWeb && step !== "signup" && step !== "liberando") {
      void import("@/lib/revenuecat").then(async (rc) => {
        if (typeof rc.compraNaLojaSemConta !== "function") return;
        if (!(await rc.compraNaLojaSemConta())) return;
        trackEvent("app_compra_recuperada", { origem: "boot", funil: FUNIL, passo: step });
        pagoSemConta();
      }).catch(() => { /* loja fora do ar: segue o funil normal */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const areaOuPadrao: AreaKey = area ?? "dinheiro";

  /* ── BOTÃO VOLTAR DO ANDROID (02/09) — ver retomada.ts. Só no shell. ── */
  const stepRef = useRef(step); stepRef.current = step;
  const ultimoVoltarRef = useRef(0);
  /** O recuo do paywall vale UMA vez por sessão: na segunda o app minimiza. */
  const recuouRef = useRef(false);
  const [avisoVoltar, setAvisoVoltar] = useState(false);
  useEffect(() => {
    if (naWeb) return;
    let vivo = true;
    let handle: { remove: () => Promise<void> } | null = null;
    void import("@capacitor/app").then(async ({ App }) => {
      const h = await App.addListener("backButton", () => {
        const s = stepRef.current;
        if (ficaNoVoltar(s)) {
          // paywall e pós-compra: o 1º Voltar fica na tela; o 2º em 3s RECUA
          // um passo (só no paywall, só uma vez) ou minimiza — ver
          // RECUO_DO_PAYWALL em retomada.ts pro número que motivou.
          window.dispatchEvent(new CustomEvent("core:voltar")); // PaywallW desarma o resgate
          const agora = Date.now();
          if (agora - ultimoVoltarRef.current < 3000) {
            if (s === "offer" && !recuouRef.current) {
              recuouRef.current = true;
              trackEvent("funnel_click", { cta: "w_back_recuou", funil: FUNIL, step: s, para: RECUO_DO_PAYWALL });
              setStepCru(RECUO_DO_PAYWALL as Step);
              guardarChave(CHAVES.passo, RECUO_DO_PAYWALL);
              window.scrollTo(0, 0);
              return;
            }
            trackEvent("funnel_click", { cta: "w_back_minimizou", funil: FUNIL, step: s });
            void App.minimizeApp();
            return;
          }
          ultimoVoltarRef.current = agora;
          trackEvent("funnel_click", { cta: "w_back_ficou", funil: FUNIL, step: s });
          setAvisoVoltar(true);
          window.setTimeout(() => setAvisoVoltar(false), 2600);
          return;
        }
        // A tela corrente tem o próprio Voltar (o quiz volta UMA pergunta,
        // QuizScreen:548)? Ele manda — senão o Voltar físico na pergunta 5
        // jogava pra porta e zerava as respostas (revisão 02/09).
        const daTela = document.querySelector<HTMLButtonElement>('button[aria-label="Voltar"]');
        if (daTela) {
          trackEvent("funnel_click", { cta: "w_back", funil: FUNIL, step: s, para: "tela" });
          daTela.click();
          return;
        }
        const anterior = passoAnteriorDe(s);
        trackEvent("funnel_click", { cta: "w_back", funil: FUNIL, step: s, para: anterior ?? "minimizar" });
        if (!anterior) { void App.minimizeApp(); return; }
        // volta de PASSO, sem contar como view nova do passo anterior
        setStepCru(anterior as Step);
        guardarChave(CHAVES.passo, anterior);
        window.scrollTo(0, 0);
      });
      if (!vivo) { void h.remove(); return; }
      handle = h;
    }).catch(() => { /* plugin ausente: fica o comportamento padrão */ });
    return () => { vivo = false; if (handle) void handle.remove(); };
  }, [naWeb]);

  /* ── VOLTAR DO NAVEGADOR (web, 02/09). Medido: "sumiu sem nenhum evento"
     no start 21% (app 7%) e no offer 51% (app 19%) — o Voltar do navegador do
     Instagram saía do site, ou caía na demo (única rota no history antes do
     paywall). Agora volta de PASSO, como o Voltar físico no app; no paywall e
     pós-compra o 1º Voltar fica (a entrada é devolvida à pilha) e o 2º em 3s
     volta um passo. O quiz volta uma pergunta pela própria seta. ── */
  const avisouVoltarRef = useRef(0);
  const voltandoRef = useRef(false);
  useEffect(() => {
    if (!naWeb) return;
    try {
      window.history.replaceState({ ...(window.history.state || {}), w: stepRef.current }, "");
      // Pousou DIRETO no paywall/pós-compra (deep link, retomada)? Sem entrada
      // nossa atrás, o 1º Voltar sairia do site sem popstate. Uma cópia da
      // entrada faz o 1º Voltar cair aqui (fica + aviso); o 2º sai de verdade.
      if (ficaNoVoltar(stepRef.current)) window.history.pushState({ w: stepRef.current }, "");
    } catch { /* noop */ }
    const aoPopstate = (e: PopStateEvent) => {
      const alvo = (e.state as { w?: string } | null)?.w;
      const atual = stepRef.current;
      if (!alvo) return;
      if (ficaNoVoltar(atual)) {
        const agora = Date.now();
        if (agora - avisouVoltarRef.current > 3000) {
          avisouVoltarRef.current = agora;
          try { window.history.pushState({ w: atual }, ""); } catch { /* noop */ }
          window.dispatchEvent(new CustomEvent("core:voltar"));
          setAvisoVoltar(true);
          window.setTimeout(() => setAvisoVoltar(false), 2600);
          trackEvent("funnel_click", { cta: "w_back_ficou", funil: FUNIL, step: atual, via: "navegador" });
          return;
        }
        // 2º Voltar em 3s: se pousou direto aqui, deixa sair; senão volta um passo
        if (alvo === atual) { trackEvent("funnel_click", { cta: "w_back_saiu", funil: FUNIL, step: atual, via: "navegador" }); try { window.history.back(); } catch { /* noop */ } return; }
      }
      if (alvo === atual) return;
      const daTela = document.querySelector<HTMLButtonElement>('button[aria-label="Voltar"]');
      if (atual === "quiz" && daTela) {
        // a seta da tela manda: pergunta anterior (continua no quiz → devolve
        // a entrada à pilha) ou porta (setStep sem empilhar, via voltandoRef)
        trackEvent("funnel_click", { cta: "w_back", funil: FUNIL, step: atual, para: "tela", via: "navegador" });
        voltandoRef.current = true;
        daTela.click();
        window.setTimeout(() => {
          if (stepRef.current === "quiz") { try { window.history.pushState({ w: "quiz" }, ""); } catch { /* noop */ } }
          voltandoRef.current = false;
        }, 0);
        return;
      }
      trackEvent("funnel_click", { cta: "w_back", funil: FUNIL, step: atual, para: alvo, via: "navegador" });
      setStepCru(alvo as Step);
      guardarChave(CHAVES.passo, alvo);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", aoPopstate);
    return () => window.removeEventListener("popstate", aoPopstate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naWeb]);

  /* ── DEEP LINK DEPOIS DE MONTADO (02/09): o toque na notificação chega como
     navigate("/app?step=offer") DEPOIS de o RootGate já ter posto a pessoa em
     /app — mesmo pathname, o ComecarW não remonta e o ?step era ignorado. ── */
  useEffect(() => {
    if (!montou.current) return;
    // Volta do Google DEPOIS de pagar, caminho quente (o app não morreu):
    // deep-link.ts navega pra /app?step=offer com a flag pós-compra ligada.
    // Quem acabou de pagar vai pro "liberando", nunca pro paywall (revisão 02/09).
    let oauthPosCompra = false;
    try {
      if (localStorage.getItem(POS_COMPRA_OAUTH_KEY) === "1") { localStorage.removeItem(POS_COMPRA_OAUTH_KEY); oauthPosCompra = true; }
    } catch { /* noop */ }
    const alvo = alvoDoDeepLink(params.get("step"), stepRef.current, oauthPosCompra);
    if (!alvo) return;
    if (alvo === "liberando") { setPosCompra(true); setStepCru("liberando"); limparProgresso(); return; }
    trackEvent(alvo === "offer" ? "funnel_retomada" : "funnel_view", { step: alvo, funil: FUNIL, retomada: true, motivo: "deeplink" });
    setStepCru(alvo as Step);
    guardarChave(CHAVES.passo, alvo);
    window.scrollTo(0, 0);
  }, [params]);

  /* ── CONVITE DE AVALIAÇÃO NO FIM DO FUNIL (03/09) ──────────────────────
   * Volta o gatilho que colheu 63 avaliações em 27–29/08 (média 4,9) e morreu
   * em 28/08 por uma leitura do Console atrasado. Sem ele o app ficou em 1–2
   * avaliações/dia; o `primeiro_gasto`, que entrou pra substituir, alcançou 5
   * aparelhos em 2 dias — ele exige conta criada e o 1º gasto no mesmo dia.
   *
   * O que mudou em relação à versão que morreu: a caixa do Google não abre
   * sozinha. Abre a NOSSA folha, e só quem toca em "Deixar minha nota" gasta
   * a janela de 90 dias do aparelho. Era essa a objeção legítima de quem
   * desligou o gatilho: pedir nota antes de a pessoa virar pagante queimava a
   * cota dela. Quem recusa continua elegível pra conta paga, sequência e
   * retrospectiva.
   *
   * Onde: no `central` — o plano montado com os 16 módulos, DEPOIS do
   * diagnóstico e ANTES de qualquer preço. É o pico da jornada (o mesmo ponto
   * que o funil antigo usava, um passo à frente) e o único lugar do app com
   * volume: ~300 pessoas/dia passam por aqui.
   *
   * Os 4s são pra folha não cobrir a tela que a pessoa acabou de abrir. ── */
  /* v105 (05/09): a FOLHA de convite na central morreu — medida em 03–04/09:
   * 107 viram, 4 aceitaram (3,7%), 99 recusaram. O pedido DIRETO do Google no
   * "plano pronto" rendeu 63 avaliações em 3 dias (27–29/08). Volta o direto,
   * uma vez por aparelho; a folha fica só pra quem pagou (conta_paga). */
  const [planoDoConvite, setPlanoDoConvite] = useState<PlanoDoConvite | null>(null);
  useEffect(() => {
    if (naWeb || step !== "central") return;
    const t = window.setTimeout(() => {
      void import("@/lib/avaliacao").then((m) => {
        const pedir = (m as { pedirAvaliacaoPlanoPronto?: () => Promise<boolean> }).pedirAvaliacaoPlanoPronto;
        if (typeof pedir === "function") void pedir();
      }).catch(() => { /* avaliação nunca pode quebrar o funil */ });
    }, 2500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naWeb, step]);

  /* ── RESGATE POR NOTIFICAÇÃO (02/09): quem chega ao paywall sem comprar
     recebe dois avisos (2h e 24h) apontando pra cá. Existia desde 14/08 e o
     paywall do W nunca armou. Só no shell; cancela ao pagar (pagoSemConta). ── */
  /* 04/09: não armar pra quem JÁ PAGOU. A tela de Planos monta este passo
   * pra cliente logado e a régua disparava "pague R$ 97,90" pra quem tinha
   * pago 2h antes (21% dos armados-que-compraram em 03/09). Também não arma
   * com pagamento pendente de cadastro (posCompra). */
  const { user: usuarioLogado, isSubscribed: jaAssina } = useAuth();
  useEffect(() => {
    if (naWeb || step !== "offer" || posCompra || (usuarioLogado && jaAssina)) return;
    void import("@/lib/notificacoes").then((m) => m.agendarResgateDoPlano(AREAS[areaOuPadrao].nome, { area: areaOuPadrao })).catch(() => { /* noop */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naWeb, step, posCompra, usuarioLogado, jaAssina]);

  const guardar = (a: AreaKey | null, r: Record<string, string>) => {
    if (a) guardarChave(CHAVES.area, a);
    guardarChave(CHAVES.respostas, r);
  };

  /** Pagou sem conta: o cadastro vem depois — e o FATO de ter pago fica
   *  guardado no aparelho, pra um reinício cair no cadastro, não no paywall. */
  const pagoSemConta = () => {
    /* v105: no app, PRIMEIRO a comemoração (PagoScreen: os recortes entram na
     * lente), DEPOIS o cadastro. Na web o PixCheckout já confirmou na tela —
     * vai direto batizar a conta. */
    setPosCompra(true); guardarChave(CHAVES.posCompra, true); setStep(naWeb ? "signup" : "pago");
    if (!naWeb) void import("@/lib/notificacoes").then((m) => m.cancelarResgateDoPlano()).catch(() => { /* noop */ });
  };

  // Mesma derivação do dia14 em modo vitrine: dinheiro = QUIZ completo com a
  // prova de gasto embutida; outras áreas = trilha própria com o pico após a
  // pergunta de consistência.
  const perguntas = areaOuPadrao === "dinheiro" ? QUIZ : AREA_TRACKS[areaOuPadrao as Exclude<AreaKey, "dinheiro">];
  const itensQuiz = (() => {
    const base = areaOuPadrao === "dinheiro" ? buildQuizItems(QUIZ, "gasto") : buildQuizItems(perguntas, "consistencia");
    // Notificação ENTRE as perguntas (30/08, dono: "igual o Cal AI, que mete
    // um gráfico no meio do quiz") — entra logo depois da 2ª pergunta.
    const pos = base.findIndex((it) => it.kind === "q" && it.qIdx === 1);
    const arr = [...base];
    arr.splice((pos < 0 ? 0 : pos) + 1, 0, { kind: "extra" });
    // v105: o ECO cola na 1ª pergunta, só pra quem respondeu "tudo" (46%).
    if (respondeuTudo({ ...answers, ...parciais })) {
      const p1 = arr.findIndex((it) => it.kind === "q" && it.qIdx === 0);
      if (p1 >= 0) arr.splice(p1 + 1, 0, { kind: "eco", qIdx: 0 });
    }
    return arr;
  })();
  const prepSteps = ["Analisando suas respostas", "Montando sua central", `Preparando o módulo de ${AREAS[areaOuPadrao].nome}`, "Finalizando seu plano personalizado"];
  const telaCheia = step === "offer" || step === "pago" || step === "signup" || step === "confirm" || step === "liberando";

  // Faixa da status bar veste o funil (regra v83.4).
  useEffect(() => {
    const cor = step === "welcome" ? "#2F7BD0" : "#ffffff";
    try { document.documentElement.style.setProperty("--safe-top-cor", cor); } catch { /* noop */ }
    return () => { try { document.documentElement.style.removeProperty("--safe-top-cor"); } catch { /* noop */ } };
  }, [step]);

  const abrirDemo = () => {
    // v105: o passo fica gravado ANTES de sair do funil — quem morre dentro da
    // demo (14% saem lá) e reabre tem que cair na central, não na welcome.
    guardarChave(CHAVES.passo, "central");
    // Cerca da demo (v83.4): a volta converge em /funil-w?step=compromissos.
    try {
      sessionStorage.setItem("core-demo-guarda", "1");
      sessionStorage.setItem("core-demo-volta", `${window.location.pathname}?step=compromissos`);
    } catch { /* noop */ }
    const modulo = AREAS[areaOuPadrao].module;
    trackEvent("funnel_view", { step: "demo", funil: FUNIL, area: areaOuPadrao, module: modulo });
    // v105: metas abre direto na aba METAS (antes caía em "Sobre mim", sem o
    // quadro de metas que a demo guiada aponta) — mesmo parâmetro dos outros funis.
    navigate(`/preview/${modulo}?funnel=1&tour=vida&from=w${areaOuPadrao === "metas" ? "&tab=metas" : ""}`);
  };

  return (
    <div style={{ ...LIGHT_VARS, background: "#ffffff" }} className="min-h-[calc(100dvh-var(--app-safe-top,0px))] text-foreground flex flex-col">
      <AnimatePresence>
        {step === "welcome" && (
          <motion.div key="welcome" exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            <AppWelcome
              /* v105: as "promessas" saíram — custavam 3,5 s por 1,5% de perda;
                 a welcome já carrega a promessa. */
              onComecar={() => setStep("porta")}
              onEntrar={() => navigate("/auth")}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {planoDoConvite && (
        <Suspense fallback={null}>
          <ConviteAvaliacao
            plano={planoDoConvite}
            pagante={false}
            onFechar={() => setPlanoDoConvite(null)}
          />
        </Suspense>
      )}
      {avisoVoltar && (
        <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[60] rounded-full bg-[#1c1917] text-white text-[12.5px] font-medium px-4 py-2 shadow-lg whitespace-nowrap">
          {naWeb || (stepRef.current === "offer" && !recuouRef.current)
            ? "Sem pressa. Aperta Voltar de novo pra voltar um passo."
            : "Sem pressa. Aperta Voltar de novo pra sair."}
        </div>
      )}
      {step === "promessas" && <PromessasScreen onDone={() => setStep("porta")} />}

      {step !== "welcome" && step !== "promessas" && (
        /* UNIFORME (30/08, dono: "as telas não conversavam — uma em cima,
           outra embaixo, e dava pra rolar tela que não precisa"): todo passo
           curto vive num viewport travado (h-dvh, sem scroll) com o MESMO
           topo; só resultado/central/paywall — compridos de verdade — rolam. */
        <div
          style={{ ["--util" as string]: "calc(100dvh - var(--app-safe-top, 0px))" }}
          className={`flex flex-col px-5 ${telaCheia ? "min-h-[var(--util)] pt-4 pb-7" : step === "result" || step === "central" ? "min-h-[var(--util)] pt-6 pb-8" : "h-[var(--util)] overflow-hidden pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]"}`}
        >
          <AnimatePresence mode="wait">
            <motion.div key={step} {...fade} className="w-full flex-1 flex flex-col">
              {step === "porta" && (
                <PortaW
                  onBack={() => setStep("welcome")}
                  totalPassos={itensQuiz.length + 1}
                  onPickArea={(a, label) => {
                    setArea(a);
                    const r = { ...answers, area: a, area_label: label };
                    setAnswers(r);
                    guardar(a, r);
                    trackEvent("funnel_quiz_answer", { step: "porta", answer: label, funil: FUNIL });
                    setStep("quiz");
                  }}
                />
              )}
              {step === "quiz" && (
                <QuizScreen
                  questions={perguntas}
                  items={itensQuiz}
                  initialAnswers={answers}
                  counterBase={1}
                  semContador
                  extraSlide={(next) => <NotifW area={areaOuPadrao} onDone={next} />}
                  ecoSlide={(_qIdx, _r, next) => <EcoW area={areaOuPadrao} onNext={() => { trackEvent("funnel_click", { cta: "eco_faz_sentido", funil: FUNIL, area: areaOuPadrao }); next(); }} />}
                  onAnswer={(k, v) => setParciais((p) => ({ ...p, [k]: v }))}
                  proofArea={areaOuPadrao === "dinheiro" ? undefined : areaOuPadrao}
                  onBack={() => setStep("porta")}
                  onDone={(r: Record<string, string>) => {
                    const todas = { ...answers, ...r };
                    setAnswers(todas);
                    guardar(area, todas);
                    /* 03/09: tela de prova entre o quiz e o plano (BitePal/Cal
                     * AI). Já rodou em 30–31/07 no /inicio — os 2 melhores dias
                     * de sessão→venda do mês (3,3%), e a passagem do quiz ficou
                     * em ~96%. Saiu em 01/08 por queda que era custo de tráfego.
                     * Volta com avaliações REAIS da Play dentro. */
                    setStep("prova");
                  }}
                />
              )}
              {step === "prova" && <ProvaSocialScreen onNext={() => setStep("progress")} />}
              {step === "progress" && <div className="flex-1 grid place-items-center"><ProgressScreen steps={prepSteps} onDone={() => setStep("result")} /></div>}
              {step === "result" && (
                <RadarResultScreen answers={answers} area={areaOuPadrao} onDone={() => setStep("central")} />
              )}
              {step === "central" && <CentralScreen area={areaOuPadrao} onOpen={abrirDemo} />}
              {step === "compromissos" && <CompromissosPorRota area={areaOuPadrao} onDone={() => setStep("contrato")} />}
              {/* MESMA ORDEM NAS DUAS PONTAS (01/09): vende primeiro, cadastra
                  depois. Até ontem a web era obrigada a cadastrar ANTES do
                  paywall porque a função do Pix exige usuário autenticado pra
                  emitir o QR. Medido no dia: 54 assinaram o contrato e 11
                  criaram conta — o cadastro comia 80% de um tráfego 100% pago.
                  Agora o PixCheckout abre uma SESSÃO ANÔNIMA antes do QR
                  (src/lib/sessao-anonima.ts), então existe um user_id de
                  verdade e nenhuma função de dinheiro mudou. Se a chave de
                  sign-in anônimo estiver desligada no painel, o PixCheckout
                  cai no caminho antigo e pede pra entrar — por isso dá pra
                  subir isto antes de ligar a chave.

                  A PERGUNTA TEM QUE SER FEITA AQUI, não no checkout: se a
                  chave estiver desligada e a gente mandar a pessoa direto pro
                  paywall, ela só descobre que precisa de conta ao TOCAR EM
                  COMPRAR — numa tela de erro que a joga pra fora do funil.
                  Perguntando antes, a ordem antiga (cadastro → paywall) volta
                  inteira. `anonimoLigado()` falha pro lado antigo de propósito. */}
              {step === "contrato" && (
                <ContratoScreen onDone={() => setStep(naWeb && !anonimoOk ? "signup" : "offer")} />
              )}
              {/* A BIFURCAÇÃO DAS DUAS LOJAS (31/08, decisão do dono).
                  Não é um `if` de comportamento — é a escolha de QUAL ARQUIVO
                  renderizar. A partir daqui o paywall do Android e o do iPhone
                  são produtos separados: mexer num não alcança o outro, e não
                  depende de ninguém lembrar de uma condicional. */}
              {step === "offer" && (
                ehApple() ? (
                  <PaywallIOS
                    area={areaOuPadrao}
                    answers={answers}
                    onPagoSemConta={pagoSemConta}
                  />
                ) : (
                  <PaywallW
                    area={areaOuPadrao}
                    answers={answers}
                    naWeb={naWeb}
                    /* Pagou. No app sempre vai pro cadastro. Na web depende de
                     * QUEM é a sessão: anônima (comprou sem conta) vai pro
                     * cadastro pra ser batizada — o SignupScreen põe e-mail e
                     * senha NESSA conta, que é a dona da compra, em vez de
                     * criar outra e órfã a assinatura. Se já for conta de
                     * verdade (cadastrou antes, ou voltou logada), pedir
                     * cadastro de novo seria absurdo: vai direto liberar. */
                    onPagoSemConta={() => {
                      if (!naWeb) { pagoSemConta(); return; }
                      void precisaBatizar().then((anon) => {
                        if (anon) pagoSemConta();
                        else setStep("liberando");
                      });
                    }}
                  />
                )
              )}
              {/* PÓS-COMPRA: telas próprias no iPhone (01/09). Foi AQUI que
                  apareceram os 5 vazamentos do teste real — botão da Apple
                  faltando, "como você pagou", garantia de 7 dias, "o Google
                  confirma" e o botão do Google que não volta. Nenhum na tela
                  de venda; todos no que vem depois dela. Agora são arquivos
                  distintos: mexer num não alcança o outro. */}
              {step === "pago" && (
                <PagoScreen area={areaOuPadrao} onContinuar={() => setStep("signup")} />
              )}
              {step === "signup" && (
                ehApple() ? (
                  <SignupIOS
                    posCompra={posCompra}
                    onSession={() => setStep(posCompra ? "liberando" : "offer")}
                    onConfirm={(e: string) => { setConfirmEmail(e); setStep("confirm"); }}
                  />
                ) : (
                  <SignupScreen
                    posCompra={posCompra}
                    onSession={() => setStep(posCompra ? "liberando" : "offer")}
                    onConfirm={(e: string) => { setConfirmEmail(e); setStep("confirm"); }}
                  />
                )
              )}
              {step === "confirm" && (ehApple() ? <ConfirmIOS email={confirmEmail} /> : <ConfirmScreen email={confirmEmail} />)}
              {/* v105: no app a comemoração já aconteceu no "pago" — aqui só "acesso guardado" */}
              {step === "liberando" && (ehApple() ? <LiberandoIOS /> : <LiberandoScreen celebrar={naWeb} />)}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
