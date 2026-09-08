/**
 * Avaliações da Play de setembro/2026 viradas em trava.
 *
 * Cada bloco cita a frase real que o motivou. Ciclo completo (regra da casa,
 * 19/07): abrir → usar → SAIR → REABRIR, porque o buraco costuma estar na
 * remontagem — e aqui é literal: "abas ocultas" e "ordem dos módulos" só
 * valem se sobrevivem à segunda abertura.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { useAbasOcultas } from "@/hooks/use-abas-ocultas";
import { AbasOcultaveis } from "@/components/ui/abas-ocultaveis";
import { useModulePreferences } from "@/hooks/use-module-preferences";
import { EtiquetasDasMetas, ReflexoesAnteriores, anoDaMeta, casaComFiltro } from "@/pages/DesenvolvimentoPessoal";
import { useState } from "react";

const criarStore = (inicial: Record<string, unknown> = {}, loaded = true) => {
  const dados: Record<string, unknown> = { ...inicial };
  let escritas = 0;
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { escritas++; dados[key] = value; },
    loaded,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor, escritas: () => escritas };
};

const renderComStore = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider>);

/* ============================================================
 * ABAS OCULTAS — "Opção de ocultar certas abas (ex. jejum intermitente)"
 * ============================================================ */
const ABAS = [
  { id: "semana", label: "SEMANA", icon: "📅" },
  { id: "mes", label: "MÊS", icon: "📆" },
  { id: "foco", label: "FOCO", icon: "🧠" },
];

const PaginaComAbas = () => {
  const [ativa, setAtiva] = useState("semana");
  const abas = useAbasOcultas("teste", ABAS);
  return (
    <div>
      <AbasOcultaveis abas={abas} ativa={ativa} onTrocar={setAtiva} />
      <p data-testid="ativa">{ativa}</p>
    </div>
  );
};

describe("Abas ocultas por módulo", () => {
  it("oculta pelo menu ⋯, persiste na chave do módulo e continua oculta ao REABRIR", () => {
    const store = criarStore();
    const tela = renderComStore(<PaginaComAbas />, store);
    expect(screen.getByRole("button", { name: /MÊS/ })).toBeInTheDocument();

    // vai pra aba MÊS e oculta ela pelo ⋯
    fireEvent.click(screen.getByRole("button", { name: /MÊS/ }));
    expect(screen.getByTestId("ativa")).toHaveTextContent("mes");
    fireEvent.click(screen.getByRole("button", { name: "Opções das abas" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Ocultar aba/ }));

    expect(screen.queryByRole("button", { name: /MÊS/ })).not.toBeInTheDocument();
    expect(store.dados["abas-ocultas:teste"]).toEqual(["mes"]);
    // a aba ativa sumiu → cai na primeira visível, nunca numa tela vazia
    expect(screen.getByTestId("ativa")).toHaveTextContent("semana");

    // SAI e REABRE
    tela.unmount();
    renderComStore(<PaginaComAbas />, store);
    expect(screen.queryByRole("button", { name: /MÊS/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /SEMANA/ })).toBeInTheDocument();

    // "Mostrar abas ocultas" traz de volta
    fireEvent.click(screen.getByRole("button", { name: "Opções das abas" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Mostrar 📆 MÊS/ }));
    expect(screen.getByRole("button", { name: /MÊS/ })).toBeInTheDocument();
    expect(store.dados["abas-ocultas:teste"]).toEqual([]);
  });

  it("NUNCA deixa ocultar a última aba visível", () => {
    const store = criarStore({ "abas-ocultas:teste": ["mes", "foco"] });
    renderComStore(<PaginaComAbas />, store);
    expect(screen.getAllByRole("button").filter(b => /SEMANA|MÊS|FOCO/.test(b.textContent || ""))).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Opções das abas" }));
    const ocultar = screen.getByRole("menuitem", { name: /Ocultar aba/ });
    expect(ocultar).toBeDisabled();
    fireEvent.click(ocultar);
    expect(screen.getByRole("button", { name: /SEMANA/ })).toBeInTheDocument();
    expect(store.dados["abas-ocultas:teste"]).toEqual(["mes", "foco"]);
    expect(screen.getByText(/A última aba não pode ser ocultada/)).toBeInTheDocument();
  });

  it("dado corrompido na chave não derruba a barra", () => {
    const store = criarStore({ "abas-ocultas:teste": "lixo" });
    renderComStore(<PaginaComAbas />, store);
    expect(screen.getByRole("button", { name: /SEMANA/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FOCO/ })).toBeInTheDocument();
  });
});

/* ============================================================
 * ORDEM DOS MÓDULOS — "poder mover a ordem das coisas... deixar a tela
 * inicial do seu jeito, mover, editar, ocultar"
 * ============================================================ */
const MODULOS = [{ id: "a" }, { id: "b" }, { id: "c" }];

const GavetaDeTeste = () => {
  const { ordenar, moveModule, toggleFavorite, prefs } = useModulePreferences();
  const ordem = ordenar(MODULOS).map(m => m.id);
  return (
    <div>
      <p data-testid="ordem">{ordem.join(",")}</p>
      <p data-testid="favoritos">{prefs.favorites.join(",")}</p>
      <button onClick={() => moveModule("c", -1, ordem)}>subir c</button>
      <button onClick={() => moveModule("a", 1, ordem)}>descer a</button>
      <button onClick={() => toggleFavorite("b")}>favoritar b</button>
    </div>
  );
};

describe("Ordem dos módulos na Home", () => {
  it("sem ordem salva, favoritos vêm na frente (comportamento de sempre)", () => {
    const store = criarStore({ "core-module-prefs": { favorites: ["c"], hidden: [] } });
    renderComStore(<GavetaDeTeste />, store);
    expect(screen.getByTestId("ordem")).toHaveTextContent("c,a,b");
  });

  it("mover persiste em `order` e sobrevive ao REABRIR", () => {
    const store = criarStore();
    const tela = renderComStore(<GavetaDeTeste />, store);
    expect(screen.getByTestId("ordem")).toHaveTextContent("a,b,c");

    fireEvent.click(screen.getByText("subir c"));
    expect(screen.getByTestId("ordem")).toHaveTextContent("a,c,b");
    expect((store.dados["core-module-prefs"] as { order: string[] }).order).toEqual(["a", "c", "b"]);

    tela.unmount();
    renderComStore(<GavetaDeTeste />, store);
    expect(screen.getByTestId("ordem")).toHaveTextContent("a,c,b");

    // com ordem salva, a ordem manda — favoritar não embaralha
    fireEvent.click(screen.getByText("favoritar b"));
    expect(screen.getByTestId("ordem")).toHaveTextContent("a,c,b");
  });

  it("módulo novo (fora da ordem salva) entra no fim sem migração", () => {
    const store = criarStore({ "core-module-prefs": { favorites: [], hidden: [], order: ["c", "a"] } });
    renderComStore(<GavetaDeTeste />, store);
    expect(screen.getByTestId("ordem")).toHaveTextContent("c,a,b");
  });

  it("NÃO grava antes da hidratação — o bug que apagou os widgets em 20/08", () => {
    // Servidor tem favoritos; o store ainda não carregou. O hook antigo
    // escrevia { favorites: [], hidden: [] } por cima no mount.
    const store = criarStore({}, false);
    renderComStore(<GavetaDeTeste />, store);
    expect(store.escritas()).toBe(0);
    expect(store.dados["core-module-prefs"]).toBeUndefined();
  });
});

/* ============================================================
 * ETIQUETAS DAS METAS — "inserir tags do ano das metas e tags de segmentos
 * (finanças, educação, profissional e etc)"
 * ============================================================ */
describe("Etiquetas das metas", () => {
  const metas = [
    { id: "g1", title: "Abrir meu negócio" },
    { id: "g2", title: "Viajar pro Nordeste" },
    { id: "g3", title: "Meta sem etiqueta" },
  ];

  it("o ano vem do id (Date.now) ou do valor salvo; id de demo cai no ano corrente", () => {
    const anoAtual = new Date().getFullYear();
    expect(anoDaMeta(String(new Date("2024-03-10T12:00:00Z").getTime()))).toBe(2024);
    expect(anoDaMeta("g1")).toBe(anoAtual);
    expect(anoDaMeta("g1", 2023)).toBe(2023);
    expect(anoDaMeta("g1", "lixo")).toBe(anoAtual);
  });

  it("filtro casa por etiqueta OU por ano", () => {
    const e = { tags: ["Finanças"], ano: 2025, notas: "" };
    expect(casaComFiltro(e, null)).toBe(true);
    expect(casaComFiltro(e, "Finanças")).toBe(true);
    expect(casaComFiltro(e, "2025")).toBe(true);
    expect(casaComFiltro(e, "Pessoal")).toBe(false);
  });

  it("chips filtram a lista; meta antiga sem etiqueta continua aparecendo em 'Todas'", () => {
    const store = criarStore({
      "goals-board-v2": metas,
      "goals-etiquetas": {
        g1: { tags: ["Finanças", "Profissional"], ano: 2026, notas: "validar antes de sair do CLT" },
        g2: { tags: ["Pessoal"], ano: 2025, notas: "" },
      },
    });
    renderComStore(<EtiquetasDasMetas />, store);
    expect(screen.getByText("Abrir meu negócio")).toBeInTheDocument();
    expect(screen.getByText("Meta sem etiqueta")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finanças" }));
    expect(screen.getByText("Abrir meu negócio")).toBeInTheDocument();
    expect(screen.queryByText("Viajar pro Nordeste")).not.toBeInTheDocument();
    expect(screen.queryByText("Meta sem etiqueta")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "📅 2025" }));
    expect(screen.getByText("Viajar pro Nordeste")).toBeInTheDocument();
    expect(screen.queryByText("Abrir meu negócio")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    expect(screen.getAllByText(/negócio|Nordeste|sem etiqueta/)).toHaveLength(3);
  });

  it("marcar uma etiqueta grava na chave irmã e NÃO encosta em goals-board-v2", () => {
    const store = criarStore({ "goals-board-v2": metas });
    const antes = JSON.stringify(store.dados["goals-board-v2"]);
    renderComStore(<EtiquetasDasMetas />, store);
    fireEvent.click(screen.getByRole("button", { name: "Editar etiquetas de Viajar pro Nordeste" }));
    fireEvent.click(screen.getByRole("button", { name: "Pessoal" }));
    const salvo = store.dados["goals-etiquetas"] as Record<string, { tags: string[]; ano: number }>;
    expect(salvo.g2.tags).toEqual(["Pessoal"]);
    expect(salvo.g2.ano).toBe(new Date().getFullYear());
    expect(JSON.stringify(store.dados["goals-board-v2"])).toBe(antes);
  });
});

/* ============================================================
 * DIÁRIO COM FOTO — "deveria ter um diário como o de pet, onde você pode
 * adicionar fotos e imagens do dia"
 * ============================================================ */
describe("Diário com foto", () => {
  it("entrada com photoUrl renderiza <img>; entrada antiga sem foto continua válida", () => {
    const foto = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD";
    render(
      <ReflexoesAnteriores
        hoje="2026-09-07"
        entradas={{
          "2026-09-07": { text: "hoje (não entra na lista)", prompt: "p" },
          "2026-09-06": { text: "Dia de praia", prompt: "O que me fez sorrir hoje?", photoUrl: foto },
          "2026-09-05": { text: "Sem foto, entrada antiga", prompt: "O que aprendi hoje?" },
        }}
      />,
    );
    const img = screen.getByRole("img", { name: /Foto do dia 2026-09-06/ });
    expect(img).toHaveAttribute("src", foto);
    expect(screen.getByText("Sem foto, entrada antiga")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByText(/não entra na lista/)).not.toBeInTheDocument();
  });
});
