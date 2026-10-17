import { Suspense, lazy, useCallback, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { CHAVE_FORCA_INTRO, INTROS, _apagarIntroVista } from "@/lib/intro-modulo";
import { abrirConhecerMais } from "@/lib/conhecer-mais";
import { EscolherTreino } from "@/components/intro-modulo/EscolherTreino";
import { CATEGORIAS_PADRAO_MERCADO } from "@/lib/mercado";
import { CHAVE_FORCA_MISSAO_DOSES, apagarMissao, gravarMissao, iniciarMissao } from "@/lib/missao-doses";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { localDayKey } from "@/lib/utils";

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
 *   &missao=dia1 · a missão em doses NASCEU HOJE (braço A, 1 dose por dia: Finanças → Rotina → Saúde), dose 1 por fazer
 *   &montar=1  · simula o fim do montar do módulo (Finanças: renda e contas fixas gravadas; Rotina: 3 hábitos criados):
 *                `<html data-montar-…>` até a página receber `dev:montar-fim` (ou 6 s) e então o evento `montar-…:fim` {resultado:"pronto"}
 *   &escolher=1 · Treino: o EscolherTreino (as 2 perguntas da 1ª dose da missão) em cima do módulo
 *   &tour=1    · abre o passeio "Conhecer mais" do módulo 0,9 s depois de carregar (Finanças/Rotina/Saúde)
 *   &aberturas=N · finge N aberturas anteriores do módulo neste navegador (N=2 ⇒ esta é a 3ª: o lembrete aparece)
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
  // lidos UMA vez: o módulo troca a query ao mudar de aba (?tab=) e os parâmetros sumiriam no meio da foto
  const [flags] = useState(() => ({
    tela: params.get("tela") ?? "financas", cheio: params.get("cheio") === "1", sem: params.get("sem") === "1", escuro: params.get("tema") === "escuro",
    vista: params.get("vista") === "1", missao: params.get("missao") === "dia1", montar: params.get("montar") === "1", escolher: params.get("escolher") === "1",
    tour: params.get("tour") === "1", aberturas: Number(params.get("aberturas") ?? "") || 0,
  }));
  const { tela, cheio, sem, escuro, vista, missao, montar, escolher, tour, aberturas } = flags;
  useMemo(() => {
    try {
      localStorage.setItem(CHAVE_FORCA_INTRO, sem ? "off" : "on");
      localStorage.setItem("core-theme-mode", escuro ? "dark" : "light");
      document.documentElement.classList.toggle("dark", escuro);
      _apagarIntroVista(tela);
      if (vista) localStorage.setItem(`core-intro-vista-${tela}`, `feita@${new Date().toISOString()}`);
      // o passeio "Conhecer mais": zera as marcas dele (dev) e, com &aberturas=N, finge N aberturas anteriores
      for (const k of [`core-conhecer-feito-${tela}`, `core-conhecer-lembrete-${tela}`, `core-conhecer-aberturas-${tela}`]) localStorage.removeItem(k);
      if (aberturas) localStorage.setItem(`core-conhecer-aberturas-${tela}`, String(aberturas));
      if (tour) window.setTimeout(() => abrirConhecerMais(tela, "menu"), 900);
      if (missao) {
        (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ = true; // a missão na web só liga por QA
        localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "on");
        gravarMissao(iniciarMissao(["financas", "rotina", "saude"]));
      } else { localStorage.removeItem(CHAVE_FORCA_MISSAO_DOSES); apagarMissao(); }
      const m = INTROS[tela]?.montar;
      if (montar && m) {
        // o montar "na tela" até o roteiro de prints mandar `dev:montar-fim` (ou 6 s, de reserva)
        document.documentElement.setAttribute(m.atributo, "1");
        let feito = false;
        const fim = () => {
          if (feito) return; feito = true;
          document.documentElement.removeAttribute(m.atributo);
          window.dispatchEvent(new CustomEvent(m.evento, { detail: { resultado: "pronto" } }));
        };
        window.addEventListener("dev:montar-fim", fim, { once: true });
        window.setTimeout(fim, 6000);
      } else if (m) document.documentElement.removeAttribute(m.atributo);
    } catch (e) { console.error("[dev/intro-modulo] preparo falhou:", e); }
  }, [tela, sem, escuro, vista, missao, montar, tour, aberturas]);
  const inicial = useMemo<Record<string, unknown>>(() => {
    if (cheio) {
      const seeds = { ...getSeedsForModule(tela), ...(tela === "casa" ? { "casa-grocery-categories": listaCheia() } : {}) };
      // a captura da Biblioteca com capa de verdade (a mesma fonte de capas da function fetch-book-metadata)
      if (tela === "biblioteca" && Array.isArray(seeds["lib-books"])) {
        const capas: Record<string, string> = { "Hábitos Atômicos": "https://covers.openlibrary.org/b/isbn/9788550807560-L.jpg" };
        seeds["lib-books"] = (seeds["lib-books"] as Array<Record<string, unknown>>).map((l) => (capas[String(l.title)] ? { ...l, cover: capas[String(l.title)] } : l));
      }
      return seeds;
    }
    // a conta nova não tem nada (dicas fechadas contam como "módulo já apresentado" — então nada é marcado aqui)
    const base: Record<string, unknown> = { "core-user-name": "Ana" };
    if (montar && tela === "financas") {
      // o que o Montar grava: renda e contas fixas (nenhum gasto variável) — o Dashboard mostra o "quanto posso gastar hoje"
      const dia = localDayKey();
      base["finance-incomes"] = [{ id: "montar-renda", date: dia, value: 2400, description: "Salário" }];
      base["finance-fixed-expenses"] = [
        { id: "montar-f1", value: 1100, category: "moradia", description: "Aluguel", paymentMethod: "pix", day: 5 },
        { id: "montar-f2", value: 99, category: "internet_telefone", description: "Internet", paymentMethod: "boleto", day: 10 },
      ];
    }
    // o que o Montar Rotina cria: os hábitos (nada marcado ainda)
    if (montar && tela === "rotina") base["rotina-habits"] = ["Beber água ao acordar", "Alongar 5 min", "Arrumar a cama"];
    return base;
  }, [cheio, tela, montar]);
  const Pagina = paginaDe(tela);
  const [escolhaFeita, setEscolhaFeita] = useState(false);
  return (
    <Provedor inicial={inicial}>
      {escolher && tela === "treino" && !escolhaFeita && (
        <div className="max-w-5xl mx-auto px-4 pt-4"><EscolherTreino onPronto={() => setEscolhaFeita(true)} /></div>
      )}
      <Suspense fallback={null}><Pagina /></Suspense>
    </Provedor>
  );
};

export default DevIntroModulo;
