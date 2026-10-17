import { Suspense, lazy, useCallback, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { CHAVE_FORCA_INTRO, _apagarIntroVista } from "@/lib/intro-modulo";
import { CATEGORIAS_PADRAO_MERCADO } from "@/lib/mercado";
import { getSeedsForModule } from "@/lib/preview-seeds";

/**
 * /dev/intro-modulo — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de
 * `import.meta.env.DEV`; some do build). O módulo DE VERDADE numa conta em memória (nada vai pro
 * servidor, não precisa de conta), com a intro ligada por força de QA — pra fotografar e gravar as
 * capturas reais da intro do módulo (16/10).
 *   ?tela=financas | rotina | saude | treino | dieta | estudos | biblioteca | casa | desenvolvimento |
 *         carreira | hiperfoco | detox | viagens | relacionamentos | pet | beleza     (padrão: financas)
 *   &cheio=1   · a conta de um mês (preview-seeds) — pra GRAVAR a captura real do módulo em uso
 *   &sem=1     · sem a intro (a chave fica como está) — a tela de hoje, pra comparar
 *   &tema=escuro · tema escuro (a classe .dark no <html>, como o ThemeProvider faz)
 *   &vista=1   · simula "já vi" neste navegador (a intro não aparece)
 * Cada carga apaga o "já vi" deste módulo neste navegador (dev: a intro sempre aparece).
 */
const PAGINAS: Record<string, () => Promise<{ default: ComponentType }>> = {
  financas: () => import("@/pages/Index"),
  rotina: () => import("@/pages/Rotina"),
  saude: () => import("@/pages/Saude"),
  treino: () => import("@/pages/Treino"),
  dieta: () => import("@/pages/Dieta"),
  estudos: () => import("@/pages/Estudos"),
  biblioteca: () => import("@/pages/Biblioteca"),
  casa: () => import("@/pages/Casa"),
  desenvolvimento: () => import("@/pages/DesenvolvimentoPessoal"),
  carreira: () => import("@/pages/Carreira"),
  hiperfoco: () => import("@/pages/Hiperfoco"),
  detox: () => import("@/pages/Detox"),
  viagens: () => import("@/pages/Viagens"),
  relacionamentos: () => import("@/pages/Relacionamentos"),
  pet: () => import("@/pages/Pet"),
  beleza: () => import("@/pages/Beleza"),
};
const componentes: Record<string, ReturnType<typeof lazy>> = {};
const paginaDe = (tela: string) => (componentes[tela] ??= lazy(PAGINAS[tela] ?? PAGINAS.financas));

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children: ReactNode }) => {
  const [dados, setDados] = useState(inicial);
  const atual = useRef(dados);
  atual.current = dados;
  const get = useCallback(<T,>(k: string, f: T): T => (k in atual.current ? (atual.current[k] as T) : f), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => setDados((d) => ({ ...d, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: true, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

/** A lista do mercado de uma casa em uso (a chave real do Mercado não está nos seeds da demo). */
const listaCheia = () => CATEGORIAS_PADRAO_MERCADO.map((c) => {
  const itens: Record<string, Array<[string, boolean]>> = {
    "1": [["Banana", true], ["Tomate", false], ["Alface", false]],
    "3": [["Leite", true], ["Queijo mussarela", false], ["Iogurte", false]],
    "4": [["Café", false], ["Arroz 5 kg", true], ["Azeite", false]],
    "5": [["Pão francês", false]],
    "7": [["Detergente", false], ["Papel higiênico", true]],
  };
  return { ...c, items: (itens[c.id] ?? []).map(([text, done], i) => ({ id: `${c.id}-${i}`, text, done })) };
});

const DevIntroModulo = () => {
  const [params] = useSearchParams();
  const tela = params.get("tela") ?? "financas";
  const cheio = params.get("cheio") === "1";
  const sem = params.get("sem") === "1";
  const escuro = params.get("tema") === "escuro";
  const vista = params.get("vista") === "1";
  useMemo(() => {
    try {
      localStorage.setItem(CHAVE_FORCA_INTRO, sem ? "off" : "on");
      localStorage.setItem("core-theme-mode", escuro ? "dark" : "light");
      document.documentElement.classList.toggle("dark", escuro);
      _apagarIntroVista(tela);
      if (vista) localStorage.setItem(`core-intro-vista-${tela}`, new Date().toISOString());
    } catch { /* noop */ }
  }, [tela, sem, escuro, vista]);
  const inicial = useMemo<Record<string, unknown>>(() => {
    if (cheio) return { ...getSeedsForModule(tela), ...(tela === "casa" ? { "casa-grocery-categories": listaCheia() } : {}) };
    // a conta nova não tem nada (dicas fechadas contam como "módulo já apresentado" — então nada é marcado aqui)
    return { "core-user-name": "Ana" };
  }, [cheio, tela]);
  const Pagina = paginaDe(tela);
  return (
    <Provedor inicial={inicial}>
      <Suspense fallback={null}><Pagina /></Suspense>
    </Provedor>
  );
};

export default DevIntroModulo;
