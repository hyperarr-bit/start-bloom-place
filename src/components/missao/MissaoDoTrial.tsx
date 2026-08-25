/**
 * A MISSÃO DOS 3 DIAS — tutorial pós-pago do trial (v61, 19/08).
 *
 * Por que existe (dado de 87 compradores reais): o pagante ativa SOZINHO em
 * 2 minutos (97% agem no D0) — mas 0 dos 8 cancelados voltaram no dia
 * seguinte, contra 55% dos que ficam. O trabalho desta peça não é ensinar o
 * app: é fabricar a VOLTA do dia 2. Três atos:
 *   B1  boas-vindas do pagante (celebra a escolha + missão com barra que
 *       nasce em 25% — started progress) → CTA único pro módulo;
 *   B2  holofote na primeira ação (10s), reaproveitando os âncoras
 *       data-spotlight que os módulos já têm;
 *   B3  celebração de pico a cada dia da missão vencido (peak-end).
 *
 * ⚠️ HOLOFOTE QUE NÃO TEM COMO TRAVAR (cicatriz do dono: "sempre que fizemos
 * overlay, bugou"). Regras de aço, todas juntas:
 *   1. NENHUMA camada intercepta toque — tudo pointer-events:none. O escuro é
 *      box-shadow gigante do anel, não um véu clicável. A classe de bug
 *      "overlay engole o toque" é fisicamente impossível.
 *   2. Fail-open: âncora não encontrada → NADA monta (a Trilha continua
 *      guiando por texto). Sem tela preta órfã.
 *   3. Morte por qualquer saída: rolagem, toque fora, troca de rota, app em
 *      segundo plano, 12 segundos, ou a própria ação acontecendo. Seis
 *      gatilhos independentes — nenhum caminho deixa ele pendurado.
 *   4. z-index abaixo de sheet/dialog (300): qualquer UI do sistema vence.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { useAuth } from "@/hooks/use-auth";
import { AREAS, FUNNEL_AREA_KEY, type AreaKey } from "@/lib/funnel";
import {
  trialCartaoAtivo, missaoAtual, iniciarMissao, salvarMissao, diaDaMissao,
  guiaSemente, type Missao,
} from "@/lib/teste-gratis";
import { agendarReguaDaMissao, pedirPermissao } from "@/lib/notificacoes";

const GRAFITE = "#16121c";

/** Âncora + rota + instrução por área — TODOS os seletores já existem nos
 *  módulos (inventário 19/08: add-expense/add-todo/add-exercise/add-water/
 *  add-goal). Errar aqui é inofensivo: fail-open. */
const ALVO: Record<string, { rota: string; passos: Array<{ seletor: string; dica: string }> }> = {
  dinheiro: {
    rota: "/financas",
    passos: [
      { seletor: '[data-spotlight="add-expense"]', dica: "Anota qualquer gasto de hoje — leva 10 segundos." },
      // Conta antiga aterrissa no dashboard (a aba padrão depende de
      // spotlight-done-financas): guia o toque pra aba e morre em paz.
      { seletor: '[data-spotlight="financeiro"]', dica: "Toca em 💰 MEU FINANCEIRO pra abrir seu painel." },
    ],
  },
  rotina: {
    rota: "/rotina",
    // 20/08: 3/3 sem_ancora da rotina — add-todo mora na aba FOCO e a rotina
    // ABRE na SEMANA. O 1º registro certo é o hábito, que vive na aba de
    // entrada; a aba é o fallback (mesmo desenho do financeiro).
    passos: [
      { seletor: '[data-spotlight="add-habit"]', dica: "Cria teu 1º hábito — ex.: beber água. Leva 10 segundos." },
      { seletor: '[data-spotlight="tab-semana"]', dica: "Toca em 📅 MINHA SEMANA pra montar tua rotina." },
    ],
  },
  corpo: {
    rota: "/treino",
    // add-exercise só existe com músculos configurados — conta nova cai no
    // CONFIG primeiro.
    passos: [
      { seletor: '[data-spotlight="add-exercise"]', dica: "Monta teu primeiro exercício — leva 10 segundos." },
      { seletor: '[data-spotlight="tab-config"]', dica: "Toca em ⚙️ CONFIG e escolhe teus grupos musculares." },
    ],
  },
  saude: {
    rota: "/saude",
    passos: [
      { seletor: '[data-spotlight="add-water"]', dica: "Marca 1 copo d'água — leva 2 segundos." },
      { seletor: '[data-spotlight="tab-hoje"]', dica: "Toca em 💊 HOJE pra registrar teu dia." },
    ],
  },
  metas: {
    rota: "/desenvolvimento",
    // add-goal mora na aba METAS; a default é SOBRE MIM — sem o fallback a
    // conta nova ficava sem tutorial (mesma classe da rotina).
    passos: [
      { seletor: '[data-spotlight="add-goal"]', dica: "Escreve 1 meta pequena — leva 10 segundos." },
      { seletor: '[data-spotlight="tab-metas"]', dica: "Toca em METAS pra criar tua primeira." },
    ],
  },
};

const FORA = ["/app", "/entrar", "/auth", "/planos", "/comecar", "/inicio", "/lp", "/admin", "/preview", "/retrospectiva", "/update-password"];
const fora = (p: string) => FORA.some((f) => p === f || p.startsWith(`${f}/`) || p.startsWith(`${f}?`));

/* --------------------------------------------------------------- B2 anel */

function Holofote({ area, aoSair }: { area: string; aoSair: (motivo: string) => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [dica, setDica] = useState("");
  const alvoRef = useRef<Element | null>(null);
  const saiuRef = useRef(false);
  const sair = (motivo: string) => {
    if (saiuRef.current) return;
    saiuRef.current = true;
    aoSair(motivo);
  };

  useEffect(() => {
    const cfg = ALVO[area];
    if (!cfg) { sair("sem_config"); return; }
    let vivo = true;
    const timers: number[] = [];
    // RETRY (20/08): 600ms e UMA tentativa não bastavam — módulo pesado
    // (Rotina, 1.300 linhas) monta depois disso e o holofote falhava aberto
    // por CORRIDA, não por falta de âncora. Procura a cadeia a cada 300ms
    // por até ~4,5s; só então desiste. As 7 saídas continuam valendo o
    // tempo todo (o timeout de 12s inclusive).
    let tentativas = 0;
    const procurar = () => {
      if (!vivo) return;
      const passo = cfg.passos.map((p) => ({ ...p, el: document.querySelector(p.seletor) })).find((p) => p.el);
      if (!passo?.el) {
        if (++tentativas >= 13) { sair("sem_ancora"); return; }
        timers.push(window.setTimeout(procurar, 300));
        return;
      }
      const el = passo.el;
      setDica(passo.dica);
      alvoRef.current = el;
      try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* noop */ }
      timers.push(window.setTimeout(() => {
        if (!vivo) return;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) { sair("ancora_invisivel"); return; }
        setRect(r);
        trackEvent("holofote_montou", { area });
        // Rolagem arma quando o scroll ASSENTAR (2 leituras estáveis), não em
        // tempo fixo: o smooth-scroll de distância longa passa de 800ms e o
        // próprio scrollIntoView matava o anel como "rolagem" (provado no
        // emulador 20/08, rotina).
        let ultimoY = -1, estaveis = 0;
        const armarQuandoParar = () => {
          if (!vivo) return;
          const y = window.scrollY;
          if (y === ultimoY && ++estaveis >= 2) {
            window.addEventListener("scroll", aoRolar, { passive: true, capture: true });
            return;
          }
          if (y !== ultimoY) { estaveis = 0; ultimoY = y; }
          timers.push(window.setTimeout(armarQuandoParar, 250));
        };
        timers.push(window.setTimeout(armarQuandoParar, 400));
      }, 520));
    };
    timers.push(window.setTimeout(procurar, 600));
    // Morte por tempo: 12s e ele se despede sozinho.
    timers.push(window.setTimeout(() => sair("timeout"), 12_000));

    // Saídas passivas — NUNCA preventDefault: o app continua 100% tocável.
    const aoRolar = () => sair("rolagem");
    const aoTocar = (e: Event) => {
      const el = alvoRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) {
        // Tocou o ALVO: a ação segue (nada intercepta) e o anel se despede
        // sozinho — se o toque abriu outra vista (ex.: trocar de aba), o
        // anel não fica apontando pro passado.
        window.setTimeout(() => sair("alvo_tocado"), 450);
        return;
      }
      sair("toque_fora");
    };
    const aoEsconder = () => { if (document.visibilityState === "hidden") sair("segundo_plano"); };
    document.addEventListener("pointerdown", aoTocar, { passive: true, capture: true });
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("resize", aoRolar);
    return () => {
      vivo = false;
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("scroll", aoRolar, { capture: true } as EventListenerOptions);
      document.removeEventListener("pointerdown", aoTocar, { capture: true } as EventListenerOptions);
      document.removeEventListener("visibilitychange", aoEsconder);
      window.removeEventListener("resize", aoRolar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area]);

  if (!rect) return null;
  const acima = rect.top > 180;
  return (
    <motion.div
      className="fixed inset-0 z-[200] pointer-events-none"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      aria-hidden
    >
      {/* o anel: o escuro em volta é a SOMBRA dele — um elemento só, zero
          camadas clicáveis, zero geometria de 4 retângulos pra desalinhar */}
      <motion.div
        className="absolute rounded-2xl border-2 border-white/90 pointer-events-none"
        style={{
          top: rect.top - 8, left: Math.max(6, rect.left - 8),
          width: Math.min(window.innerWidth - 12, rect.width + 16), height: rect.height + 16,
          boxShadow: "0 0 0 9999px rgba(15,12,20,.6)",
        }}
        animate={{ scale: [1, 1.015, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[86%] max-w-[340px] rounded-2xl px-4 py-3 text-center text-[13.5px] font-semibold text-white shadow-2xl pointer-events-none"
        style={{ background: GRAFITE, ...(acima ? { top: rect.top - 86 } : { top: rect.top + rect.height + 26 }) }}
      >
        <span className="block text-[10px] uppercase tracking-widest opacity-60 mb-0.5">Dia 1 da missão</span>
        {dica}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------ B3 pico */

function Celebracao({ dia, aoFim }: { dia: 1 | 2 | 3; aoFim: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(aoFim, dia === 3 ? 3600 : 2800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pct = dia === 1 ? 50 : dia === 2 ? 75 : 100;
  const titulo = dia === 1 ? "Primeiro registro feito!" : dia === 2 ? "Você voltou — é disso que é feito" : "Missão cumprida 🏆";
  const chip = dia === 1 ? "🔥 Dia 1 da missão ✓" : dia === 2 ? "🔥🔥 Dia 2 ✓" : "🔥🔥🔥 3 de 3 dias";
  return (
    <motion.div
      className="fixed inset-0 z-[210] pointer-events-none grid place-items-center px-8"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
      aria-hidden
    >
      <div className="absolute inset-0" style={{ background: "rgba(15,12,20,.55)" }} />
      <motion.div
        initial={{ y: 26, scale: 0.92, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.08 }}
        className="relative w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-2xl"
      >
        {/* o gráfico que sobe (Stripe: "o gráfico criou um cliente") */}
        <svg viewBox="0 0 200 84" className="w-full h-[84px] mb-3">
          <motion.path
            d="M8 72 L58 58 L104 62 L150 30 L192 12"
            fill="none" stroke="hsl(330 65% 50%)" strokeWidth="4" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: "easeOut", delay: 0.25 }}
          />
          <motion.circle
            cx="192" cy="12" r="6" fill="hsl(330 65% 50%)"
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 16, delay: 1.3 }}
          />
        </svg>
        <p className="text-[19px] font-black tracking-[-0.02em] leading-tight mb-1.5">{titulo}</p>
        <span className="inline-block rounded-full bg-[#16121c] text-white text-[12px] font-extrabold px-3.5 py-1.5 mb-4">{chip}</span>
        <div className="h-2 rounded-full bg-black/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            initial={{ width: `${pct - 25}%` }} animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
          />
        </div>
        <p className="text-[11px] text-black/50 mt-1.5 font-semibold">Missão dos 3 dias · {pct}%</p>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------ orquestra */

export function MissaoDoTrial() {
  const { user, isSubscribed } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [missao, setMissao] = useState<Missao | null>(() => missaoAtual());
  const [celebrando, setCelebrando] = useState<0 | 1 | 2 | 3>(0);
  const ctaEm = useRef(0);

  // O marcador do trial pode nascer DEPOIS do primeiro render: a compra na
  // sessão marca na hora, mas quem vem da sincronização com o RevenueCat
  // (conferirTrialCartao, boot) só marca quando a resposta chega. O evento
  // força o recálculo de `elegivel` — senão o B1 só apareceria na próxima
  // troca de rota.
  const [, recalcular] = useState(0);
  useEffect(() => {
    const f = () => recalcular((x) => x + 1);
    window.addEventListener("core:trial-cartao", f);
    return () => window.removeEventListener("core:trial-cartao", f);
  }, []);

  const elegivel = isNativeShell() && trialCartaoAtivo() && !!user && isSubscribed && !fora(pathname);

  // Nasce a missão na primeira entrada elegível (a área vem do guia/funil).
  useEffect(() => {
    if (!elegivel || missao) return;
    let areaSalva: string | null = null;
    try { areaSalva = localStorage.getItem(FUNNEL_AREA_KEY); } catch { /* noop */ }
    const area = guiaSemente()?.area ?? areaSalva ?? "dinheiro";
    setMissao(iniciarMissao(area in ALVO ? area : "dinheiro"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegivel]);

  // B3 — cada dia vencido: escuta a MESMA fonte de verdade da trilha.
  // Escrita de NAVEGAÇÃO (*-last-seen-*) não é ação da pessoa — filtrada por
  // nome. A guarda de tempo (2,5s) que existia aqui foi REMOVIDA na revisão
  // de 22/08: ela engolia a ação de 1 toque ("marca 1 copo — leva 2
  // segundos") e não protegia de verdade (os culpados do dia-1-em-0s já
  // morreram na fonte: quickstart suprimido pra missão, virada de mês é
  // escrita {system} sem ativação, last-seen filtrado).
  useEffect(() => {
    if (!missao) return;
    const aoAgir = (ev: Event) => {
      const chave = (ev as CustomEvent).detail?.key as string | undefined;
      if (chave && /last-seen/.test(chave)) return;
      const m = missaoAtual();
      if (!m || !trialCartaoAtivo()) return;
      const dia = diaDaMissao(m);
      if (dia === 1 && !m.d1) {
        salvarMissao({ ...m, d1: true, chip: false, holofote: m.holofote === "pendente" ? "feito" : m.holofote });
        setMissao(missaoAtual());
        trackEvent("missao_dia_feito", { dia: 1, segundos: ctaEm.current ? Math.round((Date.now() - ctaEm.current) / 1000) : null });
        setCelebrando(1);
      } else if (dia === 2 && !m.d2) {
        salvarMissao({ ...m, d2: true });
        setMissao(missaoAtual());
        trackEvent("missao_dia_feito", { dia: 2 });
        setCelebrando(2);
      } else if (dia === 3 && !m.d3) {
        salvarMissao({ ...m, d3: true });
        setMissao(missaoAtual());
        trackEvent("missao_dia_feito", { dia: 3 });
        setCelebrando(3);
      }
    };
    window.addEventListener("core:activation", aoAgir);
    return () => window.removeEventListener("core:activation", aoAgir);
  }, [missao]);

  if (!elegivel || !missao) return null;

  const cfg = ALVO[missao.area] ?? ALVO.dinheiro;
  const noModulo = pathname.startsWith(cfg.rota);

  /* B1 — boas-vindas do pagante (uma vez) */
  if (!missao.vista) {
    return (
      <div className="fixed inset-0 z-[240] overflow-y-auto" style={{ background: "linear-gradient(180deg,#eaf5fd 0%,#ffffff 55%)" }}>
        <div className="min-h-full max-w-[400px] mx-auto flex flex-col px-6 py-10">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 17, delay: 0.15 }}
            className="w-16 h-16 rounded-full bg-emerald-500 grid place-items-center mx-auto mb-4 shadow-[0_16px_32px_-10px_rgba(16,185,129,.55)]"
          >
            <Check className="w-8 h-8 text-white" strokeWidth={3.5} />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-[27px] font-black tracking-[-0.03em] leading-[1.1] text-center text-[#16121c]"
          >
            Seu CORE tá pronto.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            className="text-[13.5px] text-[#4f5a64] text-center mt-2 mb-6"
          >
            <span className="text-[#f0a500]">★★★★★</span> Você entrou pro grupo de <b className="text-[#16121c]">+1000 pessoas</b> organizando a vida.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, type: "spring", stiffness: 300, damping: 24 }}
            className="rounded-3xl bg-white border border-black/[0.06] shadow-[0_24px_48px_-18px_rgba(20,60,110,.35)] p-5"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#4f5a64] mb-2">Sua missão dos 3 dias</p>
            <div className="h-2 rounded-full bg-black/10 overflow-hidden mb-1.5">
              {/* nasce em 25% — cartão com o 1º selo carimbado vence cartão vazio */}
              <motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: "25%" }} transition={{ duration: 0.8, delay: 0.9 }} />
            </div>
            <p className="text-[10.5px] text-[#4f5a64] font-semibold mb-3.5">Conta criada ✓ · 25%</p>
            {[
              ["1", `Seu primeiro registro em ${AREAS[missao.area as AreaKey]?.nome ?? "Dinheiro"} (10s)`, true],
              ["2", "Volta amanhã e fecha o dia", false],
              ["3", "Terceiro dia — hábito nascendo", false],
            ].map(([n, t, hoje], i) => (
              <motion.div
                key={String(n)}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.75 + i * 0.14 }}
                className="flex items-center gap-3 py-1.5"
              >
                <span className={`w-7 h-7 rounded-full grid place-items-center text-[12px] font-extrabold shrink-0 ${hoje ? "bg-[#16121c] text-white" : "bg-black/[0.06] text-[#4f5a64]"}`}>{n}</span>
                <span className={`text-[13.5px] leading-snug ${hoje ? "font-bold text-[#16121c]" : "font-medium text-[#4f5a64]"}`}>{t}</span>
                {hoje ? <span className="ml-auto text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">hoje</span> : null}
              </motion.div>
            ))}
          </motion.div>
          <div className="mt-auto pt-6">
            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }}
              onClick={async () => {
                ctaEm.current = Date.now();
                trackEvent("missao_cta", { area: missao.area });
                salvarMissao({ ...missao, vista: true });
                setMissao(missaoAtual());
                // Permissão ANTES do navigate (revisão 22/08): o diálogo do
                // sistema pausa a Activity → visibilitychange:hidden → o
                // holofote recém-montado morria como "segundo_plano" antes
                // do anel aparecer. Pedindo AQUI, o diálogo abre sobre o B1;
                // a régua (abaixo) encontra a permissão já decidida.
                try { await pedirPermissao(); } catch { /* nunca trava o CTA */ }
                void agendarReguaDaMissao(missao.area, AREAS[missao.area as AreaKey]?.nome ?? "seu módulo", localStorage.getItem("core-lembrete-hora"));
                navigate(cfg.rota);
              }}
              className="w-full min-h-[54px] rounded-full text-[16.5px] font-extrabold text-white bg-[#16121c] shadow-[0_18px_38px_-10px_rgba(22,18,28,.5)] active:scale-[0.985] transition-transform grid place-items-center"
            >
              <span className="flex items-center gap-1.5">Fazer meu primeiro registro <ArrowRight className="w-4 h-4" /></span>
            </motion.button>
            <button
              onClick={() => { trackEvent("missao_explorar", {}); salvarMissao({ ...missao, vista: true, holofote: "dispensado" }); setMissao(missaoAtual()); }}
              className="w-full text-center text-[12.5px] text-[#4f5a64] mt-3 py-1"
            >
              Explorar por conta própria
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {missao.holofote === "pendente" && noModulo && celebrando === 0 && (
          <Holofote
            key="holofote"
            area={missao.area}
            aoSair={(motivo) => {
              trackEvent("holofote_saida", { motivo, area: missao.area });
              // "feito" só quando a ação aconteceu (o listener de activation
              // marca antes); qualquer outra saída dispensa sem insistir.
              // Rolagem/timeout = a pessoa estava EXPLORANDO e a instrução
              // morreria junto — deixa o chip no lugar (2/2 que rolaram não
              // fizeram o registro; quem toca fora fez 3/3).
              const m = missaoAtual();
              if (m && m.holofote === "pendente") {
                const deixaChip = motivo === "rolagem" || motivo === "timeout";
                salvarMissao({ ...m, holofote: "dispensado", ...(deixaChip ? { chip: true } : {}) });
                setMissao(missaoAtual());
              }
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {celebrando !== 0 && <Celebracao key={`cel-${celebrando}`} dia={celebrando} aoFim={() => setCelebrando(0)} />}
      </AnimatePresence>
      <AnimatePresence>
        {missao.chip && !missao.d1 && noModulo && celebrando === 0 && missao.holofote !== "pendente" && (
          <motion.div
            key="chip-missao"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="fixed bottom-20 inset-x-0 z-[60] flex justify-center px-6"
          >
            <div className="flex items-center gap-2.5 rounded-full bg-[#16121c] text-white shadow-[0_14px_30px_-8px_rgba(22,18,28,.55)] pl-4 pr-2 py-2 max-w-[360px]">
              <span className="text-[12.5px] font-semibold leading-snug">✨ {(ALVO[missao.area] ?? ALVO.dinheiro).passos[0].dica}</span>
              <button
                aria-label="Fechar dica"
                onClick={() => {
                  trackEvent("missao_chip", { acao: "fechou", area: missao.area });
                  const m = missaoAtual();
                  if (m) { salvarMissao({ ...m, chip: false }); setMissao(missaoAtual()); }
                }}
                className="w-7 h-7 rounded-full grid place-items-center bg-white/10 text-white/70 shrink-0"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
