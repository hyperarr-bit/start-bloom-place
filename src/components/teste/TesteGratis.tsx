/**
 * AS DUAS SUPERFÍCIES GLOBAIS DO TESTE GRÁTIS (v53, 16/08) — montadas UMA
 * vez no App.tsx (padrão TrialBanner/GracePeriodBanner: dentro do
 * BrowserRouter, fora das Routes), vivas em todas as telas do shell.
 *
 * 1. TesteBanner — a faixa fina "Dia X de 3 · Garantir meu CORE". É o
 *    caminho do comprador QUENTE: nosso dado diz que tem gente que paga em
 *    15 minutos e não pode esperar o D3. Só pra convidado com teste ativo.
 *
 * 2. TrilhaDoTeste — a escada de 3 passos DENTRO dos módulos reais (16/08:
 *    "nada de mini-demo com cara de fictício; botar o próprio app com a
 *    instrução do passo"). Uma faixa 🌱 instrui o único passo por cima do
 *    módulo de verdade e escuta o `core:activation` que o useUserData JÁ
 *    dispara na primeira escrita real (mesmo evento do SpotlightOverlay).
 *    Plantou → a faixa comemora, some sozinha e nunca mais volta.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Sprout } from "lucide-react";
import { isNativeShell } from "@/lib/native-shell";
import { useAuth } from "@/hooks/use-auth";
import { estadoTeste, guiaSemente, concluirPassoDaTrilha, chavesCreditadasDoGuia, trialCartaoAtivo } from "@/lib/teste-gratis";
import { type AreaKey } from "@/lib/funnel";
import { trackEvent } from "@/lib/analytics";

/**
 * A TRILHA DE 3 PASSOS POR ÁREA — cada degrau escolhido pela PRÓPRIA BASE
 * (1.498 usuários com ativação, medido 16/08):
 *  - 1 ação distinta → 5% pagam · 2 → 42% · 3-4 → 69%. O jogo é subir degrau.
 *  - A 2ª ação NATURAL de quem começa por corpo é DINHEIRO (57%); de rotina
 *    é a AGENDA (64%); saúde vai pra dinheiro (45%) e treino (41%). A 1ª
 *    assinante real (16/08) veio por metas e foi pro dinheiro.
 *  - O copo d'água é a ação mais executada da base inteira (491 pessoas) —
 *    é o passo 3 padrão: barato, diário, e mostra que o app tem 16 módulos.
 *
 * Filtrar pela CHAVE de storage (não pela ação) é obrigatório: a regra
 * genérica /financ/i dispara first_transaction até pra chave de manutenção
 * finance-last-seen-month no BOOT do módulo — visto no emulador 16/08, o
 * guia se completava sozinho antes de qualquer gesto. E os eventos só nascem
 * de escrita SIGNIFICATIVA (isMeaningful + guards do checkActivation), então
 * boot de módulo com listas vazias não sobe degrau.
 */
type Passo = { texto: string; chaves: RegExp; rota: string; destino: string };
const TRILHA: Record<AreaKey, [Passo, Passo, Passo]> = {
  dinheiro: [
    {
      texto: "Registra a conta que você mais esquece — toca no dia que ela vence, ali no calendário.",
      // SEM expenses/installments de propósito: são as chaves do PASSO 2. Com
      // overlap, editar o gasto que fechou o P1 completava o P2 sem a pessoa
      // ler a instrução (review adversarial 16/08).
      chaves: /finance-(dueDays|incomes|fixed-expenses|investments|wishlist|category-budgets|notes)/i,
      rota: "/financas", destino: "Finanças",
    },
    {
      texto: "Anota teu 1º gasto de hoje — qualquer um, o lanche vale. É o hábito que muda o mês.",
      chaves: /finance-(expenses|transactions|installments)/i,
      rota: "/financas", destino: "Finanças",
    },
    {
      texto: "Última: marca 1 copo d'água na Saúde. Teu radar são 16 módulos, não 1.",
      chaves: /water-log/i,
      rota: "/saude", destino: "Saúde",
    },
  ],
  rotina: [
    {
      texto: "Adiciona o hábito que você quer sustentar — um só já muda a semana.",
      chaves: /rotina-habits|todo-list/i,
      rota: "/rotina", destino: "Rotina",
    },
    {
      texto: "Monta teu dia: joga na agenda o que você tem pra fazer amanhã.",
      chaves: /rotina-schedule/i,
      rota: "/rotina", destino: "Rotina",
    },
    {
      texto: "Última: anota teu 1º gasto de hoje em Finanças — rotina e dinheiro andam juntos.",
      chaves: /finance-(expenses|dueDays|incomes|fixed-expenses)/i,
      rota: "/financas", destino: "Finanças",
    },
  ],
  corpo: [
    {
      texto: "Monta seu primeiro treino — adiciona um exercício pra hoje.",
      // Chaves de DADO, nunca de manutenção: o boot do Treino escreve
      // treino-semana-dos-checks e completava o passo sozinho ao abrir o
      // módulo (crítico do review 16/08).
      chaves: /saude-workouts-v2|saude-workout-log|treino-exercise-history|saude-meals|dieta-(diary|recipes|smart-list)/i,
      rota: "/treino", destino: "Treino",
    },
    {
      texto: "Agora anota teu 1º gasto de hoje em Finanças — é o módulo que mais segura a galera aqui.",
      chaves: /finance-(expenses|dueDays|incomes|fixed-expenses)/i,
      rota: "/financas", destino: "Finanças",
    },
    {
      texto: "Última: marca 1 copo d'água na Saúde — hidratação anda junto do treino.",
      chaves: /water-log/i,
      rota: "/saude", destino: "Saúde",
    },
  ],
  saude: [
    {
      texto: "Marca 1 copo d'água no topo da Saúde — leva 2 segundos.",
      // só o que DISPARA evento de verdade (sono grava em core-saude-sleep,
      // que o checkActivation ignora — prometer sono era beco sem saída)
      chaves: /water-log|hidrat/i,
      rota: "/saude", destino: "Saúde",
    },
    {
      texto: "Anota teu 1º gasto de hoje em Finanças — saúde do corpo e do bolso no mesmo app.",
      chaves: /finance-(expenses|dueDays|incomes|fixed-expenses)/i,
      rota: "/financas", destino: "Finanças",
    },
    {
      texto: "Última: monta um treino simples — um exercício já conta.",
      chaves: /saude-workouts-v2|saude-workout-log|treino-exercise-history/i,
      rota: "/treino", destino: "Treino",
    },
  ],
  metas: [
    {
      texto: "Cria sua primeira meta — tira ela da cabeça e bota no painel.",
      chaves: /goals-board-v2|month-goals/i,
      rota: "/desenvolvimento?tab=metas", destino: "Metas",
    },
    {
      texto: "Anota teu 1º gasto de hoje em Finanças — meta sem dinheiro mapeado não sai do papel.",
      chaves: /finance-(expenses|dueDays|incomes|fixed-expenses)/i,
      rota: "/financas", destino: "Finanças",
    },
    {
      texto: "Última: marca 1 copo d'água na Saúde. 16 módulos, um radar só.",
      chaves: /water-log/i,
      rota: "/saude", destino: "Saúde",
    },
  ],
};

/** Rotas onde as superfícies do teste NÃO aparecem (funil tem as próprias
 *  telas; auth/planos têm outro trabalho). */
const fora = (path: string) =>
  path.startsWith("/app") || path.startsWith("/auth") || path.startsWith("/planos") ||
  path.startsWith("/privacidade") || path.startsWith("/termos") || path.startsWith("/excluir-conta") ||
  path.startsWith("/admin") || path.startsWith("/acesso") || path.startsWith("/entrar");

/**
 * RETOMADA PÓS-COMPRA GLOBAL (16/08, bug achado no ciclo do emulador): quem
 * paga e o app morre ANTES do cadastro reabria no /home do teste — o RootGate
 * (síncrono) manda convidado com teste ativo pro hub antes do boot-check de
 * compra local (async, morava só dentro do funil). A pessoa pagante via a
 * faixa "Garantir meu CORE" e podia pagar DE NOVO. Este vigia roda uma vez
 * por sessão em qualquer tela: compra local sem conta → cadastro de salvar
 * acesso (o ComecarTeste detecta a compra de novo e liga o modo posCompra).
 */
export function RetomadaPosCompra() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Ref, NÃO state: setState aqui re-dispararia o efeito, o cleanup marcaria
  // vivo=false e o resultado da checagem em voo seria descartado — foi
  // exatamente o bug da 1ª versão (visto no emulador: pagante reabria no
  // /home mesmo com o vigia montado).
  const checado = useRef(false);
  useEffect(() => {
    if (!isNativeShell() || loading || user || checado.current) return;
    if (pathname.startsWith("/app") || pathname.startsWith("/auth")) return;
    checado.current = true;
    import("@/lib/revenuecat")
      .then(async (m) => (await m.compraVitaliciaLocal()) || (await m.compraAssinaturaLocal()))
      .then((tem) => {
        if (!tem) return;
        trackEvent("app_pos_compra_retomada", { funil: "teste", origem: "global" });
        navigate("/app?step=signup", { replace: true });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);
  return null;
}

/** A faixa e o guia se empilham no rodapé — esta condição é compartilhada
 *  pra um saber do outro. */
const bannerVisivel = (user: unknown, pathname: string): boolean => {
  if (!isNativeShell() || user || fora(pathname)) return false;
  return estadoTeste().fase === "ativo";
};

export function TesteBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // re-render a cada navegação já basta: o dia só muda a cada 24h.
  const visivel = bannerVisivel(user, pathname);
  // A altura do banner vira variável CSS: a action bar fixa do Treino
  // (Iniciar Sessão/Finalizar) morava exatamente embaixo dele e ficava
  // COBERTA — e é o único lugar que registra o treino da trilha (review
  // 16/08). Com a var, quem é fixed-bottom sobe junto quando o banner existe.
  useEffect(() => {
    const raiz = document.documentElement.style;
    if (visivel) raiz.setProperty("--teste-banner-h", "calc(2.75rem + env(safe-area-inset-bottom))");
    else raiz.removeProperty("--teste-banner-h");
    return () => { raiz.removeProperty("--teste-banner-h"); };
  }, [visivel]);
  if (!visivel) return null;
  const t = estadoTeste();
  if (t.fase !== "ativo") return null;
  return (
    // Wrapper DIV fixo de propósito: a regra de alvo-de-toque do shell
    // (.core-shell button { position: relative }) tem especificidade maior
    // que a classe `fixed` — botão fixo direto cai no fluxo do documento
    // (visto no emulador 16/08: banner no y=4019 de um viewport de 842).
    <div
      className="fixed bottom-0 inset-x-0 z-[60]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <button
        onClick={() => { trackEvent("funnel_click", { cta: "teste_banner_garantir", dia: t.dia, funil: "teste" }); navigate("/app?step=offer"); }}
        className="w-full flex items-center justify-between px-4 h-11 bg-white/95 backdrop-blur border-t border-black/10 text-[12.5px] font-semibold"
      >
        <span className="text-muted-foreground">
          Dia <b className="text-foreground">{t.dia} de 3</b> do seu teste
          {t.dia === 3 && <span className="text-foreground"> · fecha em {t.horasRestantes}h</span>}
        </span>
        <span className="font-extrabold text-accent">Garantir meu CORE →</span>
      </button>
    </div>
  );
}

/** Celebração curta entre degraus; a última fica mais tempo e morre de vez. */
const CELEBRA = {
  1: "Plantado! Isso já é seu — e é só o começo.",
  2: "Boa! Segunda no papo — falta uma.",
  3: "Trilha completa! Seu CORE tá rodando de verdade. Explora à vontade: são 16 módulos.",
} as const;

export function TrilhaDoTeste() {
  const { user, isSubscribed } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [guia, setGuia] = useState(() => guiaSemente());
  // passo recém-concluído (1|2|3) enquanto a celebração está na tela
  const [celebrando, setCelebrando] = useState<0 | 1 | 2 | 3>(0);
  // Um único salvar pode disparar DOIS core:activation (chaves diferentes do
  // mesmo gesto). Sem esta janela, o segundo evento casaria com o regex do
  // passo NOVO e a pessoa pulava um degrau sem nunca ler a instrução.
  const ultimoAvanco = useRef(0);

  useEffect(() => {
    // Escrita REAL do passo atual = degrau vencido — filtrada pela chave de
    // storage (ver comentário da TRILHA: ação genérica mente).
    const onActivation = (e: Event) => {
      if (Date.now() - ultimoAvanco.current < 2600) return;
      const g = guiaSemente();
      if (!g || g.status !== "pendente" || !(g.area in TRILHA)) return;
      const key = String((e as CustomEvent).detail?.key ?? "");
      // v56: ação DISTINTA sobe degrau, em qualquer ordem — qualquer uma das
      // 3 chaves do mapa da área conta, não só a do passo atual. Medido
      // 17/08: em dinheiro a pessoa registrava um GASTO (chave do passo 2)
      // durante o passo 1 e a trilha ficava apagada — agiu e não foi
      // celebrada. A instrução do passo segue guiando; o crédito não pune
      // quem fez outra coisa útil.
      if (!TRILHA[g.area as AreaKey].some((p) => p.chaves.test(key))) return;
      // editar/apagar registro que JÁ pontuou reescreve a mesma chave — não
      // é ação nova, não sobe degrau (review 16/08; v56 guarda TODAS as que
      // pontuaram, não só a última — senão alternar entre 2 chaves subiria
      // a trilha inteira com 2 ações repetidas)
      if (chavesCreditadasDoGuia(g).includes(key)) return;
      const vencido = g.passo;
      ultimoAvanco.current = Date.now();
      concluirPassoDaTrilha(key);
      setGuia(guiaSemente());
      setCelebrando(vencido);
      // o degrau final merece mais tempo de tela; os outros passam o bastão
      window.setTimeout(() => setCelebrando(0), vencido === 3 ? 7000 : 2600);
    };
    window.addEventListener("core:activation", onActivation);
    return () => window.removeEventListener("core:activation", onActivation);
  }, []);

  // Navegou = estado pode ter mudado (funil acabou de armar o guia).
  useEffect(() => { setGuia(guiaSemente()); }, [pathname]);

  if (!isNativeShell() || fora(pathname)) return null;
  // Assinante não tem trilha de teste — cobre chave residual de quem pagou
  // por caminho que não passou pelo limparGuiaSemente (restore antigo etc.).
  // EXCETO o trial do cartão (v60): esses 3 dias são exatamente quando a
  // trilha mais paga o aluguel — 2+ usos = não cancela. O marcador expira
  // sozinho e o cinto volta a valer.
  if (isSubscribed && !trialCartaoAtivo()) return null;
  const area = (guia && guia.area in TRILHA ? guia.area : null) as AreaKey | null;
  if (!area || !guia) return null;
  const pendente = guia.status === "pendente";
  if (!pendente && !celebrando) return null;

  const passoAtual = guia.passo;
  const passo = TRILHA[area][passoAtual - 1];
  const foraDoModulo = pendente && !pathname.startsWith(passo.rota.split("?")[0]);
  const mostrandoCelebracao = celebrando > 0;
  const final = celebrando === 3;

  return (
    <AnimatePresence>
      <motion.div
        key={mostrandoCelebracao ? `celebra-${celebrando}` : `passo-${passoAtual}`}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="fixed inset-x-3 z-[70]"
        style={{
          // acima da faixa "Dia X de 3" quando ela está no rodapé
          bottom: bannerVisivel(user, pathname)
            ? "calc(3.5rem + env(safe-area-inset-bottom))"
            : "calc(0.75rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className={`rounded-2xl shadow-lg border overflow-hidden ${
          mostrandoCelebracao ? "bg-emerald-50 border-emerald-200" : "bg-white border-black/10"
        }`}>
          {/* progresso: 3 segmentos, estilo stories — a pessoa VÊ a escada */}
          <div className="flex gap-1 px-4 pt-2.5">
            {[1, 2, 3].map((n) => {
              const cheio = mostrandoCelebracao ? n <= celebrando : n < passoAtual;
              const atual = !mostrandoCelebracao && n === passoAtual;
              return (
                <div key={n} className="flex-1 h-1 rounded-full overflow-hidden bg-black/10">
                  <div className={`h-full rounded-full transition-all ${
                    cheio ? "w-full bg-emerald-500" : atual ? "w-1/3 bg-accent" : "w-0"
                  }`} />
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3 flex items-start gap-3">
            <span className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${
              mostrandoCelebracao ? "bg-emerald-500 text-white" : "bg-accent/10 text-accent"
            }`}>
              {mostrandoCelebracao ? <Check className="w-5 h-5" strokeWidth={3} /> : <Sprout className="w-5 h-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-0.5">
                {mostrandoCelebracao
                  ? (final ? "3 de 3 — feito" : `Passo ${celebrando} de 3 ✓`)
                  : `Sua trilha · passo ${passoAtual} de 3`}
              </div>
              <div className="text-[13px] leading-snug text-foreground">
                {mostrandoCelebracao ? <b>{CELEBRA[celebrando as 1 | 2 | 3]}</b> : passo.texto}
              </div>
              {/* o degrau mora em OUTRO módulo? A faixa carrega a pessoa até
                  lá — é isso que transforma o hub de beco em corredor. */}
              {foraDoModulo && (
                <button
                  onClick={() => {
                    trackEvent("trilha_leva_la", { passo: passoAtual, area, destino: passo.rota, funil: "teste" });
                    navigate(passo.rota);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent text-accent-foreground text-[12px] font-bold px-3.5 py-1.5 active:scale-95 transition-transform"
                >
                  Abrir {passo.destino} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
