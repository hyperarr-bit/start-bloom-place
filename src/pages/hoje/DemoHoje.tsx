import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { DemoDoFunilProvider, type DemoDoFunil } from "@/lib/demo-do-funil";
import { COMPONENTES, CarregandoModulo } from "@/pages/experimente/modulos";
import { FolhaDemo } from "@/pages/experimente/FolhaDemo";
import { NavegacaoDaDemo, type Desvio } from "@/pages/experimente/navegacao";
import { demoDoHoje } from "./demo-financas";
import type { Conta } from "./conteudo";

/**
 * /hoje/demo — a VARIANTE "demo" do funil /hoje (19/10, link da campanha `/hoje?v=demo`): depois do número, o
 * "Ver meu CORE" abre o módulo Finanças DE VERDADE com os números dela (demo-financas.ts), em vez da oferta.
 * O módulo só entra em modo demo pelo endereço (lib/caminho-demo: /hoje/demo) — sem intro, tutorial, Montar,
 * lembretes nem pedido de avaliação. Nada é gravado (PreviewUserDataProvider em memória).
 *
 * Moldura mínima (dono não gosta de poluição): 1 faixa fina no topo + 1 botão fixo embaixo "Quero o meu CORE" →
 * a oferta. Tentar sair do módulo (seta ←, outro módulo, login…) também leva pra oferta. Aos 40 s, 1 folha
 * (1x por sessão) com o mesmo convite.
 *
 * Eventos (com os ids do /hoje, inclusive `variante`):
 *   hoje_demo_view {renda, n, por_dia, gasto_exemplo}       ao abrir
 *   hoje_demo_cta {via: botao|desvio|folha, segundos}       toque que leva pra oferta
 *   hoje_demo_folha {acao: vista|fechou, via?}              a folha dos 40 s
 *   hoje_demo_tempo {segundos, fim: botao|desvio|folha|saiu} 1x por visita (saída da tela ou da página, beacon)
 */
export const SEGUNDOS_ATE_A_FOLHA_HOJE = 40;
const CHAVE_FOLHA_VISTA = "hoje-demo-folha";
export type ViaDemo = "botao" | "desvio" | "folha";

const folhaJaVista = (): boolean => { try { return sessionStorage.getItem(CHAVE_FOLHA_VISTA) === "1"; } catch { return false; } };
const marcarFolhaVista = (): void => { try { sessionStorage.setItem(CHAVE_FOLHA_VISTA, "1"); } catch { /* noop */ } };

export function DemoHoje({ renda, contas, ids, onQuero }: {
  renda: number;
  contas: Conta[];
  ids: () => Record<string, unknown>;
  onQuero: (via: ViaDemo) => void;
}) {
  const t0 = useRef(Date.now());
  const fim = useRef<ViaDemo | "saiu" | null>(null);
  const tempoEnviado = useRef(false);
  const segundos = () => Math.round((Date.now() - t0.current) / 1000);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  // a semente é calculada 1x por visita (o provider lê na montagem)
  const demo = useMemo(() => demoDoHoje({}, renda, contas), [renda, contas]);
  const semente = useCallback((s: Record<string, unknown>) => demoDoHoje(s, renda, contas).sementes, [renda, contas]);

  /* 19/10 (dono: "faz o que achar melhor"): o número DELA fica no meio do Dashboard (~2.200 px) — a demo abre no topo e,
   * quando o card "QUANTO POSSO GASTAR HOJE" aparece, rola até ele (suave, 1x; se ela já rolou sozinha, não mexe). */
  useEffect(() => {
    let feito = false;
    const inicio = Date.now();
    const id = window.setInterval(() => {
      if (feito || Date.now() - inicio > 6000) { window.clearInterval(id); return; }
      if (window.scrollY > 40) { feito = true; window.clearInterval(id); return; }
      const card = document.querySelector<HTMLElement>('[data-testid="hoje-demo"] [data-missao="posso-gastar"]');
      if (!card) return;
      feito = true;
      window.clearInterval(id);
      window.setTimeout(() => {
        try {
          // o cabeçalho do módulo (título + abas) gruda no topo: desconta a altura dele pra o título do card aparecer
          let fixo = 0;
          for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-testid="hoje-demo"] *'))) {
            const cs = getComputedStyle(el);
            if ((cs.position === "sticky" || cs.position === "fixed") && el.getBoundingClientRect().top <= 1 && el.offsetHeight < 300) fixo = Math.max(fixo, el.getBoundingClientRect().bottom);
          }
          const y = card.getBoundingClientRect().top + window.scrollY - (fixo || 120) - 12;
          window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
          trackEvent("hoje_demo_rolou", { ...idsRef.current() });
        } catch { /* jsdom */ }
      }, 700);
    }, 150);
    return () => window.clearInterval(id);
  }, []);

  /* hoje_demo_view + topo da página + o tempo na demo (1x: saída da tela ou da página) */
  useEffect(() => {
    try { window.scrollTo({ top: 0 }); } catch { /* jsdom */ }
    trackEvent("hoje_demo_view", { renda, n: contas.length, por_dia: demo.porDiaDoFunil, gasto_exemplo: demo.gastoDeHoje, ...idsRef.current() });
    const enviarTempo = () => {
      if (tempoEnviado.current) return;
      tempoEnviado.current = true;
      trackEventBeacon("hoje_demo_tempo", { segundos: segundos(), fim: fim.current ?? "saiu", ...idsRef.current() });
    };
    const aoEsconder = () => { if (document.visibilityState === "hidden") enviarTempo(); };
    window.addEventListener("pagehide", enviarTempo);
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      window.removeEventListener("pagehide", enviarTempo);
      document.removeEventListener("visibilitychange", aoEsconder);
      enviarTempo();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quero = useCallback((via: ViaDemo) => {
    if (fim.current && fim.current !== "saiu") return; // 1 saída por visita
    fim.current = via;
    marcarFolhaVista();
    trackEvent("hoje_demo_cta", { via, segundos: segundos(), ...idsRef.current() });
    onQuero(via);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onQuero]);

  /* a folha: 1x por sessão, aos 40 s */
  const [folha, setFolha] = useState(false);
  useEffect(() => {
    if (folhaJaVista()) return;
    const t = window.setTimeout(() => {
      if (folhaJaVista() || fim.current) return;
      marcarFolhaVista();
      setFolha(true);
      trackEvent("hoje_demo_folha", { acao: "vista", segundos: segundos(), ...idsRef.current() });
    }, SEGUNDOS_ATE_A_FOLHA_HOJE * 1000);
    return () => window.clearTimeout(t);
  }, []);

  /* o módulo tentou sair: outro lugar do app → a oferta; o próprio Finanças (troca de aba por URL) → fica */
  const aoDesviar = useCallback((d: NonNullable<Desvio>) => {
    if (d.tipo === "modulo" && d.modulo === "financas") return;
    quero("desvio");
  }, [quero]);
  const demoDoFunil = useMemo<DemoDoFunil>(() => ({ abrirConta: () => quero("desvio") }), [quero]);

  const Modulo = COMPONENTES.financas;
  return (
    <div className="min-h-[100dvh] bg-background text-foreground [overflow-x:clip]" data-testid="hoje-demo">
      {/* as Comparações da demo mostrariam "−97%" (setembro cheio × outubro só com hoje) e "Nenhum lançamento em 2025": fora só aqui */}
      <style>{'[data-testid="hoje-demo"] [data-card="comparacao-mensal"],[data-testid="hoje-demo"] [data-card="comparacao-anual"]{display:none}'}</style>
      <div className="bg-secondary text-[12.5px] font-medium text-muted-foreground border-b border-border px-4 py-1.5 text-center" data-testid="hoje-demo-topo"
        style={{ paddingTop: "calc(6px + env(safe-area-inset-top))" }}>
        Esse é o seu CORE, com os seus números
      </div>
      <DemoDoFunilProvider value={demoDoFunil}>
        <PreviewUserDataProvider moduleKey="financas" semente={semente}>
          <NavegacaoDaDemo aoDesviar={aoDesviar}>
            <RouteErrorBoundary routeName="hoje-demo">
              <Suspense fallback={<CarregandoModulo />}>
                <div data-testid="demo-modulo-financas"><Modulo /></div>
              </Suspense>
            </RouteErrorBoundary>
          </NavegacaoDaDemo>
        </PreviewUserDataProvider>
      </DemoDoFunilProvider>
      {/* espaço do botão fixo: nada do módulo fica escondido atrás dele */}
      <div aria-hidden style={{ height: "calc(92px + env(safe-area-inset-bottom))" }} />
      {!folha && (
        <div className="fixed inset-x-0 bottom-0 z-[70] px-4 pt-3 bg-gradient-to-t from-background via-background/95 to-background/0"
          style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
          <button type="button" onClick={() => quero("botao")} data-testid="hoje-demo-cta"
            className="mx-auto w-full max-w-md h-[54px] rounded-[16px] bg-foreground text-background text-[16.5px] font-bold flex items-center justify-center gap-1.5 shadow-[0_6px_18px_rgba(0,0,0,.16)] active:scale-[.985] transition-transform">
            Quero o meu CORE <ChevronRight className="w-[18px] h-[18px]" strokeWidth={2.6} />
          </button>
        </div>
      )}
      {folha && (
        <FolhaDemo
          titulo="Gostou do seu CORE?"
          texto="Ele fica salvo com os seus números, no celular e no computador."
          botao="Quero o meu CORE"
          onCriar={() => { setFolha(false); quero("folha"); }}
          onFechar={(via) => { setFolha(false); trackEvent("hoje_demo_folha", { acao: "fechou", via, ...idsRef.current() }); }}
        />
      )}
    </div>
  );
}
