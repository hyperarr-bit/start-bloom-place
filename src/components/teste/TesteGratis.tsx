/**
 * AS DUAS SUPERFÍCIES GLOBAIS DO TESTE GRÁTIS (v53, 16/08) — montadas UMA
 * vez no App.tsx (padrão TrialBanner/GracePeriodBanner: dentro do
 * BrowserRouter, fora das Routes), vivas em todas as telas do shell.
 *
 * 1. TesteBanner — a faixa fina "Dia X de 3 · Garantir meu CORE". É o
 *    caminho do comprador QUENTE: nosso dado diz que tem gente que paga em
 *    15 minutos e não pode esperar o D3. Só pra convidado com teste ativo.
 *
 * 2. GuiaSemente — a semente DENTRO do módulo real (toque do dono 16/08:
 *    "nada de mini-demo com cara de fictício; botar o próprio app com a
 *    instrução do passo"). Uma faixa 🌱 instrui o único passo por cima do
 *    módulo de verdade e escuta o `core:activation` que o useUserData JÁ
 *    dispara na primeira escrita real (mesmo evento do SpotlightOverlay).
 *    Plantou → a faixa comemora, some sozinha e nunca mais volta.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Sprout } from "lucide-react";
import { isNativeShell } from "@/lib/native-shell";
import { useAuth } from "@/hooks/use-auth";
import { estadoTeste, guiaSemente, concluirGuiaSemente } from "@/lib/teste-gratis";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { trackEvent } from "@/lib/analytics";

/** Instrução do único passo, por área + as CHAVES de storage que contam como
 *  semente. Filtrar pela chave (não pela ação) é obrigatório: a regra
 *  genérica /financ/i dispara first_transaction até pra chave de manutenção
 *  finance-last-seen-month no BOOT do módulo — visto no emulador 16/08, o
 *  guia se completava sozinho antes de qualquer gesto. */
const PASSO: Record<AreaKey, { texto: string; chaves: RegExp }> = {
  dinheiro: {
    texto: "Registra a conta que você mais esquece — toca no dia que ela vence, ali no calendário.",
    chaves: /finance-(dueDays|expenses|incomes|fixed-expenses|installments|investments|wishlist|category-budgets|notes)/i,
  },
  rotina: { texto: "Adiciona o hábito que você quer sustentar — um só já muda a semana.", chaves: /rotina-habits|rotina-schedule|todo-list|month-goals/i },
  corpo: { texto: "Monta seu primeiro treino — adiciona um exercício pra hoje.", chaves: /workout|treino|saude-meals|dieta-(diary|recipes|smart-list)/i },
  saude: { texto: "Marca seu primeiro registro de hoje — água, sono, o que já fez.", chaves: /water-log|hidrat|sleep-log|saude-meals/i },
  metas: { texto: "Cria sua primeira meta — tira ela da cabeça e bota no painel.", chaves: /goals-board-v2|month-goals/i },
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
  if (!bannerVisivel(user, pathname)) return null;
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

export function GuiaSemente() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [guia, setGuia] = useState(() => guiaSemente());
  const [feita, setFeita] = useState(false);

  useEffect(() => {
    // Primeira escrita REAL da área conta como semente plantada — filtrada
    // pela chave de storage (ver comentário do PASSO: ação genérica mente).
    const onActivation = (e: Event) => {
      const g = guiaSemente();
      if (!g || g.status !== "pendente" || !(g.area in PASSO)) return;
      const key = String((e as CustomEvent).detail?.key ?? "");
      if (!PASSO[g.area as AreaKey].chaves.test(key)) return;
      concluirGuiaSemente();
      setFeita(true);
      setGuia(guiaSemente());
      window.setTimeout(() => setFeita(false), 5000);
    };
    window.addEventListener("core:activation", onActivation);
    return () => window.removeEventListener("core:activation", onActivation);
  }, []);

  // Navegou = estado pode ter mudado (funil acabou de armar o guia).
  useEffect(() => { setGuia(guiaSemente()); }, [pathname]);

  if (!isNativeShell() || fora(pathname)) return null;
  const area = (guia && guia.area in AREAS ? guia.area : null) as AreaKey | null;
  if (!area) return null;
  const pendente = guia?.status === "pendente";
  if (!pendente && !feita) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={feita ? "feita" : "pendente"}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        className="fixed inset-x-3 z-[70]"
        style={{
          // acima da faixa "Dia X de 3" quando ela está no rodapé
          bottom: bannerVisivel(user, pathname)
            ? "calc(3.5rem + env(safe-area-inset-bottom))"
            : "calc(0.75rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className={`rounded-2xl shadow-lg border px-4 py-3 flex items-start gap-3 ${
          feita ? "bg-emerald-50 border-emerald-200" : "bg-white border-black/10"
        }`}>
          <span className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${feita ? "bg-emerald-500 text-white" : "bg-accent/10 text-accent"}`}>
            {feita ? <Check className="w-5 h-5" strokeWidth={3} /> : <Sprout className="w-5 h-5" />}
          </span>
          <div className="text-[13px] leading-snug">
            {feita ? (
              <>
                <b>Plantado!</b> Isso aqui já é seu — fica salvo nos seus 3 dias de teste.
              </>
            ) : (
              <>
                <b>Único passo:</b> {PASSO[area].texto}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
