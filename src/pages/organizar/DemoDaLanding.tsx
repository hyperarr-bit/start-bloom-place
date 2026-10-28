import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { DemoDoFunilProvider, type DemoDoFunil } from "@/lib/demo-do-funil";
import { VoltaDaDemoProvider, type VoltaDaDemo } from "@/lib/volta-da-demo";
import { NavegacaoDaDemo } from "@/pages/experimente/navegacao";
import { CarregandoModulo } from "@/pages/experimente/modulos";
import { desvioNaLanding, ehModuloLanding, moduloDaLanding, type MensagemDaDemo, type ModuloLanding } from "@/landing/regras";

/**
 * A DEMO DENTRO DA LANDING NOVA — /organizar/demo?m=<módulo> (28/10). Só existe DENTRO do iframe da /organizar
 * (aberto direto = volta pra /organizar). É o app de verdade com dados de exemplo (a infra do /preview e do
 * /experimente: PreviewUserDataProvider em memória + DemoDoFunilProvider, que esconde os cartões de chamada), sem
 * nenhuma moldura de funil: nada de topo, faixa, folha ou "Criar conta" — quem vende é a página por fora.
 *
 * Conversa com a página (postMessage, MESMA origem):
 *   ← landing:modulo {m}           a página trocou de módulo (pílula, grade, resposta do topo)
 *   → landing:pronta {modulo, ms}  o módulo pintou (a página troca a imagem pela demo, sem salto)
 *   → landing:modulo-trocado       o módulo navegou pra outro dos 16 (troca aqui mesmo)
 *   → landing:oferta {destino}     algo que só existe com conta (login, /home, conquistas…): a página rola até o preço
 *   → landing:mexeu {modulo}       1º toque da pessoa em cada módulo
 * Os 16 módulos sob demanda (o mesmo lazy do /preview). Sempre no tema claro (a página é clara).
 */
const lazyModulo = (carregar: () => Promise<{ default?: unknown }>) =>
  lazy(async () => {
    const mod = await carregar();
    if (mod && typeof mod.default !== "undefined") return mod as { default: React.ComponentType };
    throw new Error("Failed to fetch dynamically imported module (módulo resolveu vazio)");
  });
const MODULOS: Record<ModuloLanding, React.ComponentType> = {
  financas: lazyModulo(() => import("@/pages/Index")),
  rotina: lazyModulo(() => import("@/pages/Rotina")),
  treino: lazyModulo(() => import("@/pages/Treino")),
  dieta: lazyModulo(() => import("@/pages/Dieta")),
  saude: lazyModulo(() => import("@/pages/Saude")),
  desenvolvimento: lazyModulo(() => import("@/pages/DesenvolvimentoPessoal")),
  casa: lazyModulo(() => import("@/pages/Casa")),
  estudos: lazyModulo(() => import("@/pages/Estudos")),
  carreira: lazyModulo(() => import("@/pages/Carreira")),
  biblioteca: lazyModulo(() => import("@/pages/Biblioteca")),
  beleza: lazyModulo(() => import("@/pages/Beleza")),
  viagens: lazyModulo(() => import("@/pages/Viagens")),
  hiperfoco: lazyModulo(() => import("@/pages/Hiperfoco")),
  relacionamentos: lazyModulo(() => import("@/pages/Relacionamentos")),
  pet: lazyModulo(() => import("@/pages/Pet")),
  detox: lazyModulo(() => import("@/pages/Detox")),
};

const dentroDaLanding = (): boolean => {
  try { return window.parent !== window && window.parent.location.origin === window.location.origin; } catch { return false; }
};
const avisar = (m: MensagemDaDemo) => {
  try { window.parent.postMessage(m, window.location.origin); } catch { /* sem a página, nada a avisar */ }
};

/** Monta junto com o módulo (dentro do Suspense): o módulo pintou. */
function Pronto({ modulo, onPronto }: { modulo: ModuloLanding; onPronto: (m: ModuloLanding) => void }) {
  useEffect(() => {
    // 2 frames: o módulo já está desenhado quando a página trocar a imagem pela demo
    const id = requestAnimationFrame(() => requestAnimationFrame(() => onPronto(modulo)));
    return () => cancelAnimationFrame(id);
  }, [modulo, onPronto]);
  return null;
}

export default function DemoDaLanding() {
  const [params] = useSearchParams();
  const [modulo, setModulo] = useState<ModuloLanding>(() => moduloDaLanding(params.get("m")));
  const naLanding = useMemo(dentroDaLanding, []);
  const mexeu = useRef(new Set<string>());

  useLayoutEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.remove("dark");
    raiz.style.colorScheme = "light";
    raiz.setAttribute("data-landing-demo", "");
  }, []);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { tipo?: string; m?: unknown } | null;
      if (d?.tipo === "landing:modulo" && ehModuloLanding(d.m)) {
        setModulo(d.m);
        try { window.scrollTo(0, 0); } catch { /* noop */ }
      }
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, []);

  const onPronto = useCallback((m: ModuloLanding) => avisar({ tipo: "landing:pronta", modulo: m, ms: Math.round(performance.now()) }), []);

  const desviar = useCallback((destino: string): boolean => {
    const d = desvioNaLanding(destino);
    if (!d) return false;
    if (d.tipo === "modulo") {
      setModulo(d.modulo);
      try { window.scrollTo(0, 0); } catch { /* noop */ }
      avisar({ tipo: "landing:modulo-trocado", modulo: d.modulo, via: "dentro" });
    } else {
      avisar({ tipo: "landing:oferta", destino: d.destino });
    }
    return true;
  }, []);

  const demoDoFunil: DemoDoFunil = useMemo(() => ({ abrirConta: (_o, destino) => avisar({ tipo: "landing:oferta", destino: destino ?? "modulo" }) }), []);
  const volta: VoltaDaDemo = { destino: "/organizar/oferta", aoTocar: () => avisar({ tipo: "landing:oferta", destino: "seta" }), modulo };

  const aoGravar = useCallback((_chave: string, _v: unknown, _a: unknown, gesto: boolean) => {
    if (!gesto || mexeu.current.has(modulo)) return;
    mexeu.current.add(modulo);
    avisar({ tipo: "landing:mexeu", modulo });
  }, [modulo]);

  if (!naLanding) return <Navigate to="/organizar" replace />;

  const Modulo = MODULOS[modulo];
  return (
    <VoltaDaDemoProvider value={volta}>
      <div className="min-h-[100dvh] bg-background [overflow-x:clip]" data-testid="landing-demo" data-modulo={modulo}>
        <DemoDoFunilProvider value={demoDoFunil}>
          <PreviewUserDataProvider key={modulo} moduleKey={modulo} aoGravar={aoGravar}>
            <NavegacaoDaDemo desviar={desviar}>
              <RouteErrorBoundary routeName={`landing-demo-${modulo}`}>
                <Suspense fallback={<CarregandoModulo />}>
                  <Pronto modulo={modulo} onPronto={onPronto} />
                  <Modulo />
                </Suspense>
              </RouteErrorBoundary>
            </NavegacaoDaDemo>
          </PreviewUserDataProvider>
        </DemoDoFunilProvider>
      </div>
    </VoltaDaDemoProvider>
  );
}
