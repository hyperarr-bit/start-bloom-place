/**
 * PET — COMPATIBILIDADE com o app antigo das lojas (30/09).
 *
 * O Pet foi refeito (RG, o dia do pet, carteirinha, começo pronto) e a web nova lê e grava a
 * MESMA nuvem que o app antigo (78883beb: iPhone 1.0.7/1.0.8, Android 125). A lição de 28/09
 * (Finanças caiu no app antigo com uma chave que virou objeto): chave que já existe nunca muda
 * de tipo nem de forma; o código novo lê o formato antigo.
 *
 * Os componentes ANTIGOS estão congelados em ./app-antigo/pet (cópia byte a byte de 78883beb).
 * Aqui eles leem o que o módulo novo gravou, no mesmo store.
 *
 *  1. abrir com dado antigo → tudo aparece, nada é gravado;
 *  2. começo pronto nunca entra na conta de quem já tem pet;
 *  3. gravar pelo novo → o antigo lê (sem quebrar);
 *  4. tipo preservado em toda chave que já existia;
 *  5. ida e volta: o antigo edita o que o novo gravou sem apagar campo novo, e o novo reabre.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, within, cleanup } from "@testing-library/react";
import Pet from "@/pages/Pet";
import { PetList } from "./app-antigo/pet/PetList";
import { PetHealth } from "./app-antigo/pet/PetHealth";
import { PetRoutine } from "./app-antigo/pet/PetRoutine";
import { PetExpenses } from "./app-antigo/pet/PetExpenses";
import { PetDiary } from "./app-antigo/pet/PetDiary";
import { criarNuvem, formaDe, prepararJsdom, vigiarConsole, type Dados, type Nuvem } from "./compat-comum";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));

// quarta, 30/09/2026 10:00 — o "hoje" de todos os testes
const HOJE = "2026-09-30";
const ONTEM = "2026-09-29";
beforeAll(prepararJsdom);
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 8, 30, 10, 0)); });
// restoreAllMocks: solta o console.error do vigiarConsole mesmo se a tela quebrar no meio (os vi.fn dos mocks ficam como estão)
afterEach(() => { vi.useRealTimers(); cleanup(); vi.restoreAllMocks(); });

/* ───────────────────────── o dado ANTIGO (formatos de 78883beb) ───────────────────────── */

const THOR = "1726000000001";
const MIA = "1726000000002";
const PIPOCA = "1726000000003";
const FOTO_THOR = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ==";
const FOTO_PASSEIO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAZA==";

/** Como o app antigo grava: PetList (texto livre, peso texto, id = Date.now()), PetHealth, PetRoutine, PetExpenses, PetDiary. */
const ANTIGO: Dados = {
  "pet-list": [
    { id: THOR, name: "Thor", species: "cachorro", breed: "Golden", weight: "28 kg", birthday: "2021-04-15", photoUrl: FOTO_THOR },
    { id: MIA, name: "Mia", species: "gata", breed: "", weight: "4,2", birthday: "" },
    { id: PIPOCA, name: "Pipoca", species: "Calopsita", breed: "", weight: "65 g", birthday: "2024-02-10" },
  ],
  "pet-health": [
    { id: "1726100000001", petId: THOR, type: "vaccine", name: "V10", date: "2025-10-24", nextDate: "2026-10-24" },
    { id: "1726100000002", petId: THOR, type: "deworming", name: "Drontal", date: "2026-06-26", nextDate: "2026-09-24" },
    { id: "1726100000003", petId: MIA, type: "visit", name: "Consulta de rotina", date: "2026-03-10", nextDate: "" },
  ],
  // o dia de hoje com as marcas que o PetRoutine antigo grava (ids das 6 tarefas de sempre)
  [`pet-routine-${HOJE}`]: { [THOR]: { food: true, walk: true, bath: false } },
  [`pet-routine-${ONTEM}`]: { [MIA]: { food: true, "custom-1726200000000": true } },
  // a Mia tem lista própria (o PetRoutine antigo grava a lista inteira ao criar/editar um hábito)
  [`pet-routine-tasks-${MIA}`]: [
    { id: "food", label: "Ração", emoji: "🍖" },
    { id: "water", label: "Água", emoji: "💧" },
    { id: "custom-1726200000000", label: "Limpar a caixinha", emoji: "🧹" },
  ],
  "pet-expenses": [
    { id: "1726300000001", petId: THOR, category: "Ração", description: "Ração 15 kg", value: 189.9, date: "2026-09-27" },
    { id: "1726300000002", petId: MIA, category: "Areia", description: "Areia sílica", value: 45, date: "2026-09-12" },
    { id: "1726300000003", petId: THOR, category: "Veterinário", description: "Consulta de agosto", value: 150, date: "2026-08-20" },
  ],
  "pet-expense-categories": ["Areia"],
  "pet-diary": [
    { id: "1726400000001", petName: "Thor", date: "2026-09-28T18:30:00.000Z", text: "Passeio longo no parque.", mood: "😊", photoUrl: FOTO_PASSEIO },
    { id: "1726400000002", petName: "Mia", date: "2026-09-20T12:00:00.000Z", text: "Dormiu o dia todo no sofá.", mood: "😴" },
  ],
  // a Home de quem já montou widgets (o Pet oferece "Pôr na Home")
  "core-home-widgets-v2": [{ id: "finances", size: "small" }, { id: "tasks", size: "large" }],
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const lista = <T,>(n: Nuvem, k: string) => (n.ler<T[]>(k) ?? []) as T[];
type Registro = { id: string; petId: string; type: string; name: string; date: string; nextDate: string; obs?: string; cuidadoId?: string };

/* ───────────────────────── as ações do módulo NOVO ───────────────────────── */

/**
 * Tudo o que o módulo novo grava de novo, partindo da conta antiga: pet novo pelo começo pronto,
 * rotina + remédio com horário (dose `rem:<id>:<HH:MM>`), "Feito hoje" com lote, vacina com a
 * última data (registro com `cuidadoId`), pesar, RG com sexo/porte/microchip, gasto, momento e
 * "Pôr na Home".
 */
function gravarPeloNovo(nuvem: Nuvem) {
  const tela = nuvem.montar(<Pet />, "/pet");

  // 1) pet NOVO pelo "Novo" do seletor (3 perguntas)
  fireEvent.click(screen.getByTestId("pet-novo"));
  const folhaNovo = screen.getByTestId("folha-novo-pet");
  fireEvent.click(within(folhaNovo).getByTestId("especie-gato"));
  fireEvent.change(within(folhaNovo).getByTestId("pet-nome"), { target: { value: "Frida" } });
  fireEvent.click(within(folhaNovo).getByRole("button", { name: "Fêmea" }));
  fireEvent.click(within(folhaNovo).getByTestId("pet-seguir-2"));
  fireEvent.click(within(folhaNovo).getByTestId("faixa-filhote"));
  fireEvent.click(within(folhaNovo).getByTestId("pet-seguir-3"));
  fireEvent.click(within(folhaNovo).getByTestId("pet-criar"));

  // 2) de volta ao Thor: marca a água; remédio com horário; marca a dose das 08:00
  fireEvent.click(screen.getByTestId(`pet-seletor-${THOR}`));
  fireEvent.click(screen.getByRole("checkbox", { name: "Marcar Água fresca" }));
  fireEvent.click(screen.getByRole("button", { name: /Remédio com horário/ }));
  const remedio = screen.getByTestId("novo-cuidado");
  fireEvent.change(within(remedio).getByLabelText("Nome"), { target: { value: "Apoquel" } });
  fireEvent.click(within(remedio).getByTestId("salvar-cuidado"));
  fireEvent.click(screen.getByRole("checkbox", { name: "Marcar Apoquel" }));

  // 3) "Feito hoje" no Drontal (venceu 24/09), pela ficha, com o lote
  const proximos = document.querySelector('[data-card="CARTEIRINHA PROXIMOS"]') as HTMLElement;
  fireEvent.click(within(proximos).getByRole("button", { name: /Drontal/ }));
  const ficha = screen.getByTestId("ficha-cuidado");
  fireEvent.change(within(ficha).getByLabelText("Observação"), { target: { value: "Lote 4471" } });
  fireEvent.click(within(ficha).getByTestId("ficha-feito-hoje"));
  fireEvent.click(within(ficha).getByRole("button", { name: "Fechar" }));

  // 4) SAÚDE: vacina nova com a última vez (vira registro com `cuidadoId`), pesar, RG completo
  fireEvent.click(screen.getByTestId("aba-saude"));
  fireEvent.click(screen.getByTestId("novo-cuidado-abrir"));
  const vacina = screen.getByTestId("novo-cuidado");
  fireEvent.change(within(vacina).getByLabelText("Nome"), { target: { value: "Antirrábica" } });
  fireEvent.change(within(vacina).getByLabelText("Última vez"), { target: { value: "2026-09-01" } });
  fireEvent.click(within(vacina).getByTestId("salvar-cuidado"));
  fireEvent.change(screen.getByTestId("peso-input"), { target: { value: "29,5" } });
  fireEvent.click(screen.getByTestId("peso-salvar"));
  fireEvent.click(screen.getByRole("button", { name: "Ver RG" }));
  const rg = screen.getByTestId("ficha-do-pet");
  fireEvent.click(within(rg).getByRole("button", { name: "Macho" }));
  fireEvent.click(within(rg).getByRole("button", { name: "Grande" }));
  fireEvent.change(within(rg).getByLabelText("Microchip"), { target: { value: "985112004321987" } });
  fireEvent.click(within(rg).getByTestId("rg-salvar"));

  // 5) GASTOS: um gasto da Mia
  fireEvent.click(screen.getByTestId("aba-gastos"));
  fireEvent.click(screen.getByTestId("gasto-novo"));
  const gasto = screen.getByTestId("folha-gasto");
  fireEvent.click(within(gasto).getByRole("button", { name: "Mia" }));
  fireEvent.change(within(gasto).getByTestId("gasto-valor"), { target: { value: "59,90" } });
  fireEvent.click(within(gasto).getByTestId("gasto-salvar"));

  // 6) DIÁRIO: um momento do Thor
  fireEvent.click(screen.getByTestId("aba-diario"));
  fireEvent.click(screen.getByTestId("momento-novo"));
  const momento = screen.getByTestId("folha-momento");
  fireEvent.click(within(momento).getByRole("button", { name: "Thor" }));
  fireEvent.change(within(momento).getByTestId("momento-texto"), { target: { value: "Tomou banho e ficou cheiroso." } });
  fireEvent.click(within(momento).getByTestId("momento-salvar"));

  // 7) HOJE: "Pôr na Home"
  fireEvent.click(screen.getByTestId("aba-hoje"));
  fireEvent.click(screen.getByTestId("dica-home"));
  return tela;
}

/** Os 5 componentes do app antigo, lado a lado, no mesmo store. */
const AppAntigo = () => (
  <>
    <section data-testid="antigo-pets"><PetList /></section>
    <section data-testid="antigo-saude"><PetHealth /></section>
    <section data-testid="antigo-rotina"><PetRoutine /></section>
    <section data-testid="antigo-gastos"><PetExpenses /></section>
    <section data-testid="antigo-diario"><PetDiary /></section>
  </>
);

/** O bloco de edição aberto num componente antigo (PetHealth e PetExpenses escrevem "Editando · <pet>" no topo dele). */
const emEdicao = (secao: string) => within(within(screen.getByTestId(secao)).getByText(/^Editando ·/).closest("div") as HTMLElement);

/** O cartão de um pet no PetRoutine antigo. */
const cartaoDaRotina = (nome: string) =>
  within(screen.getByTestId("antigo-rotina")).getByText(nome, { selector: "p" }).closest(".bg-card") as HTMLElement;

/* ═════════════════════════ 1. abrir com dado antigo ═════════════════════════ */

describe("1. abrir o Pet novo com o dado do app antigo", () => {
  it("todo pet, registro de saúde, rotina, gasto e momento aparece em todas as abas — e nada é gravado", () => {
    const nuvem = criarNuvem(ANTIGO);
    nuvem.montar(<Pet />, "/pet");

    // HOJE: os 3 pets no seletor; o RG do Thor com foto, raça e o peso de texto livre
    for (const [id, nome] of [[THOR, "Thor"], [MIA, "Mia"], [PIPOCA, "Pipoca"]]) {
      expect(within(screen.getByTestId(`pet-seletor-${id}`)).getByText(nome)).toBeInTheDocument();
    }
    let rg = screen.getByTestId("rg-do-pet");
    expect(within(rg).getByText("Thor")).toBeInTheDocument();
    expect(within(rg).getByText("Golden")).toBeInTheDocument();
    expect(within(rg).getByText("28 kg")).toBeInTheDocument();
    expect(within(rg).getByAltText("Foto de Thor")).toHaveAttribute("src", FOTO_THOR);
    // a rotina de hoje com as marcas do app antigo (ids "food" e "walk" de sempre)
    expect(screen.getByRole("checkbox", { name: "Desmarcar Comida · manhã" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Desmarcar Passeio" })).toHaveAttribute("aria-checked", "true");
    // o vermífugo antigo venceu em 24/09 e aparece como próximo cuidado
    const proximos = document.querySelector('[data-card="CARTEIRINHA PROXIMOS"]') as HTMLElement;
    expect(within(proximos).getByText("Drontal")).toBeInTheDocument();
    expect(within(proximos).getByText("venceu há 6 dias")).toBeInTheDocument();

    // a Mia: peso "4,2" (sem unidade) e a lista de hábitos que ela montou no app antigo
    fireEvent.click(screen.getByTestId(`pet-seletor-${MIA}`));
    rg = screen.getByTestId("rg-do-pet");
    expect(within(rg).getByText("Mia")).toBeInTheDocument();
    expect(within(rg).getByText("4,2 kg")).toBeInTheDocument();
    for (const tarefa of ["Ração", "Água", "Limpar a caixinha"]) expect(screen.getByRole("checkbox", { name: `Marcar ${tarefa}` })).toBeInTheDocument();
    // a Pipoca: "65 g" (calopsita) continua em gramas
    fireEvent.click(screen.getByTestId(`pet-seletor-${PIPOCA}`));
    rg = screen.getByTestId("rg-do-pet");
    expect(within(rg).getByText("Calopsita")).toBeInTheDocument();
    expect(within(rg).getByText("65 g")).toBeInTheDocument();

    // SAÚDE: a carteirinha de cada pet com o histórico antigo
    fireEvent.click(screen.getByTestId("aba-saude"));
    fireEvent.click(screen.getByTestId(`pet-seletor-${THOR}`));
    expect(screen.getByText("V10")).toBeInTheDocument();
    expect(screen.getByText("Drontal")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`pet-seletor-${MIA}`));
    expect(screen.getByText("Consulta de rotina")).toBeInTheDocument();

    // GASTOS: os do mês (o de agosto fica fora, como no app antigo), com a categoria da pessoa
    fireEvent.click(screen.getByTestId("aba-gastos"));
    expect(screen.getByTestId("gastos-total")).toHaveTextContent("R$ 234,90");
    expect(screen.getByText("Ração 15 kg")).toBeInTheDocument();
    expect(screen.getByText("Areia sílica")).toBeInTheDocument();
    expect(screen.getByText(/Mia · Areia · 12\/09/)).toBeInTheDocument();
    expect(screen.queryByText("Consulta de agosto")).not.toBeInTheDocument();

    // DIÁRIO: os momentos com a foto
    fireEvent.click(screen.getByTestId("aba-diario"));
    expect(screen.getByText("Passeio longo no parque.")).toBeInTheDocument();
    expect(screen.getByText("Dormiu o dia todo no sofá.")).toBeInTheDocument();
    expect(screen.getByAltText("Foto de Thor")).toHaveAttribute("src", FOTO_PASSEIO);

    expect(nuvem.escritasDeDado()).toEqual([]);
    for (const k of Object.keys(ANTIGO)) expect(nuvem.estado.dados[k], k).toEqual(ANTIGO[k]);
  });

  it("links antigos (?aba=pets, ?aba=rotina) caem no HOJE sem gravar nada", () => {
    for (const aba of ["pets", "rotina"]) {
      window.history.replaceState(null, "", `/pet?aba=${aba}`);
      const nuvem = criarNuvem(ANTIGO);
      const t = nuvem.montar(<Pet />, `/pet?aba=${aba}`);
      expect(screen.getByTestId("aba-hoje")).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("rg-do-pet")).toBeInTheDocument();
      expect(nuvem.escritasDeDado()).toEqual([]);
      t.unmount();
    }
    window.history.replaceState(null, "", "/");
  });
});

/* ═════════════════════════ 2. começo pronto ═════════════════════════ */

describe("2. começo pronto nunca entra na conta de quem já tem pet", () => {
  it("com pet: o começo pronto não aparece (HOJE nem SAÚDE) e nada é gravado", () => {
    const nuvem = criarNuvem(ANTIGO);
    nuvem.montar(<Pet />, "/pet");
    expect(screen.queryByTestId("comeco-pronto")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("aba-saude"));
    expect(screen.queryByTestId("comeco-pronto")).not.toBeInTheDocument();
    expect(nuvem.escritasDeDado()).toEqual([]);
    expect(nuvem.estado.dados["pet-list"]).toEqual(ANTIGO["pet-list"]);
  });

  it("conta vazia: aparece em HOJE e SAÚDE, não grava nada ao abrir; só grava depois das 3 perguntas", () => {
    const nuvem = criarNuvem({});
    nuvem.montar(<Pet />, "/pet");
    expect(screen.getByTestId("comeco-pronto")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("aba-saude"));
    expect(screen.getByTestId("comeco-pronto")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("aba-gastos"));
    fireEvent.click(screen.getByTestId("aba-diario"));
    fireEvent.click(screen.getByTestId("aba-hoje"));
    expect(nuvem.escritasDeDado()).toEqual([]);

    fireEvent.click(screen.getByTestId("especie-cao"));
    fireEvent.change(screen.getByTestId("pet-nome"), { target: { value: "Paçoca" } });
    fireEvent.click(screen.getByTestId("pet-seguir-2"));
    expect(nuvem.escritasDeDado()).toEqual([]); // no meio das perguntas, nada
    fireEvent.click(screen.getByTestId("faixa-adulto"));
    fireEvent.click(screen.getByTestId("pet-seguir-3"));
    fireEvent.click(screen.getByTestId("pet-criar"));
    const pets = lista<Record<string, unknown>>(nuvem, "pet-list");
    expect(pets).toHaveLength(1);
    expect(nuvem.escritasDeDado()).toEqual(["pet-list", `pet-routine-tasks-${pets[0].id}`, "pet-cuidados"]);
  });
});

/* ═════════════════════════ 3. gravar pelo novo → o antigo lê ═════════════════════════ */

describe("3. o que o Pet novo grava, o app antigo lê", () => {
  it("as ações do módulo novo gravam nos formatos de sempre (+ campos e chaves novas)", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem);

    const pets = lista<Record<string, unknown>>(nuvem, "pet-list");
    const frida = pets.find((p) => p.name === "Frida")!;
    expect(frida).toMatchObject({ species: "Gato", breed: "", weight: "", birthday: "", sexo: "femea", faixa: "filhote" });
    expect(pets.find((p) => p.id === THOR)).toMatchObject({ weight: "29,5", sexo: "macho", porte: "grande", chip: "985112004321987", photoUrl: FOTO_THOR });
    // a rotina da gata vai GRAVADA (o app antigo mostra a mesma lista)
    expect(lista<{ id: string }>(nuvem, `pet-routine-tasks-${frida.id}`).map((t) => t.id)).toEqual(["food", "water", "areia", "food-noite", "play"]);
    // o Thor (sem lista, do app antigo): o 1º gesto na rotina gravou a lista que o app novo mostra (30/09)
    expect(lista<{ id: string }>(nuvem, `pet-routine-tasks-${THOR}`).map((t) => t.id)).toEqual(["food", "walk", "water", "food-noite", "play"]);
    // o dia: as marcas do app antigo ficam; a água e a dose do remédio entram como booleano
    const apoquel = lista<{ id: string; nome: string; horarios: string[] }>(nuvem, "pet-cuidados").find((c) => c.nome === "Apoquel")!;
    expect(apoquel.horarios).toEqual(["08:00"]);
    expect(nuvem.ler(`pet-routine-${HOJE}`)).toEqual({ [THOR]: { food: true, walk: true, bath: false, water: true, [`rem:${apoquel.id}:08:00`]: true } });
    // pet-health: o "Feito hoje" com lote e a vacina com a última data (cuidadoId), nos tipos que o antigo conhece
    const regs = lista<Registro>(nuvem, "pet-health");
    expect(regs.find((r) => r.obs === "Lote 4471")).toMatchObject({ petId: THOR, type: "deworming", name: "Drontal", date: HOJE, nextDate: "2026-12-29" });
    expect(regs.find((r) => r.name === "Antirrábica")).toMatchObject({ petId: THOR, type: "vaccine", date: "2026-09-01", nextDate: "2027-09-01", cuidadoId: expect.any(String) });
    // peso: histórico na chave NOVA; o campo de sempre acompanha
    expect(nuvem.ler("pet-pesos")).toEqual({ [THOR]: [{ dia: HOJE, kg: 29.5 }] });
    // gasto e momento como o app antigo grava
    expect(lista(nuvem, "pet-expenses").at(-1)).toMatchObject({ petId: MIA, category: "Ração", description: "", value: 59.9, date: HOJE });
    expect(lista(nuvem, "pet-diary")[0]).toMatchObject({ petName: "Thor", text: "Tomou banho e ficou cheiroso.", mood: "😊" });
    expect(nuvem.ler("core-home-widgets-v2")).toEqual([{ id: "finances", size: "small" }, { id: "tasks", size: "large" }, { id: "pet", size: "large" }]);
  });

  it("os componentes do app antigo abrem sem erro e mostram o pet novo, os registros, a rotina, o gasto e o momento", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem).unmount();

    const vigia = vigiarConsole();
    nuvem.montar(<AppAntigo />);
    vigia.parar();
    expect(vigia.erros()).toEqual([]);

    // PetList: o pet do começo pronto (espécie em texto, sem idade inventada) e o peso novo do Thor
    const pets = within(screen.getByTestId("antigo-pets"));
    expect(pets.getByText("Frida")).toBeInTheDocument();
    expect(pets.getByText("Gato")).toBeInTheDocument();
    expect(pets.getByText("29,5 kg")).toBeInTheDocument();
    expect(pets.getByText("Thor").closest("button")!.querySelector("img")).toHaveAttribute("src", FOTO_THOR);

    // PetHealth: o "Feito hoje" (com a próxima calculada) e a vacina nova, com o nome do pet
    const saude = within(screen.getByTestId("antigo-saude"));
    expect(saude.getAllByText("Drontal")).toHaveLength(2);
    expect(saude.getByText("Antirrábica")).toBeInTheDocument();
    expect(saude.getByText("Thor · Vermífugo · 30/09")).toBeInTheDocument();
    expect(saude.getByText("29/12")).toBeInTheDocument();

    // PetRoutine: a água marcada no app novo aparece marcada; a rotina gravada da Frida aparece.
    // O Thor não tinha lista: o 1º gesto no app novo gravou a que ele mostra (a do cachorro), então o
    // antigo mostra a MESMA rotina — com as marcas de antes (food, walk) e a de agora (água)
    const thor = within(cartaoDaRotina("Thor"));
    for (const t of ["Comida · manhã", "Água fresca", "Passeio"]) expect(thor.getByRole("button", { name: `Desmarcar ${t}` })).toBeInTheDocument();
    expect(thor.queryByRole("button", { name: /Banho/ })).not.toBeInTheDocument();
    const frida = within(cartaoDaRotina("Frida"));
    expect(frida.getByRole("button", { name: "Marcar Limpar a areia" })).toBeInTheDocument();
    expect(frida.getByRole("button", { name: "Marcar Comida · noite" })).toBeInTheDocument();

    // PetExpenses: o gasto novo soma no mês (189,90 + 45 + 59,90)
    const gastos = within(screen.getByTestId("antigo-gastos"));
    expect(gastos.getByText("R$ 294.80")).toBeInTheDocument();
    expect(gastos.getByText("Mia · Ração · 30/09")).toBeInTheDocument();

    // PetDiary: o momento novo, antes dos antigos
    const diario = within(screen.getByTestId("antigo-diario"));
    expect(diario.getByText("Tomou banho e ficou cheiroso.")).toBeInTheDocument();
    expect(diario.getByText("Passeio longo no parque.")).toBeInTheDocument();
  });
});

/* ═════════════════════════ 4. tipo preservado ═════════════════════════ */

describe("4. toda chave que já existia continua com o mesmo tipo e os itens antigos continuam lá", () => {
  it("formas, ids e os campos que o app antigo lê", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem);
    const depois = nuvem.estado.dados;

    for (const k of Object.keys(ANTIGO)) expect(formaDe(depois[k]), k).toBe(formaDe(ANTIGO[k]));
    for (const k of ["pet-list", "pet-health", "pet-expenses", "pet-diary"]) {
      const ids = (depois[k] as { id: string }[]).map((x) => x.id);
      for (const item of ANTIGO[k] as { id: string }[]) expect(ids, k).toContain(item.id);
    }
    // o que não foi tocado ficou idêntico
    expect((depois["pet-list"] as { id: string }[]).filter((p) => p.id === MIA || p.id === PIPOCA)).toEqual((ANTIGO["pet-list"] as { id: string }[]).slice(1));
    expect(depois[`pet-routine-${ONTEM}`]).toEqual(ANTIGO[`pet-routine-${ONTEM}`]);
    expect(depois[`pet-routine-tasks-${MIA}`]).toEqual(ANTIGO[`pet-routine-tasks-${MIA}`]);
    expect(depois["pet-expense-categories"]).toEqual(["Areia"]);
    for (const item of ANTIGO["pet-health"] as Registro[]) expect((depois["pet-health"] as Registro[]).find((r) => r.id === item.id)).toEqual(item);

    // pet-list: os 6 campos de sempre, no tipo de sempre
    for (const p of depois["pet-list"] as Record<string, unknown>[]) {
      for (const c of ["id", "name", "species", "breed", "weight"]) expect(typeof p[c], `${p.name}.${c}`).toBe("string");
      expect(String(p.birthday), `${p.name}.birthday`).toMatch(/^(\d{4}-\d{2}-\d{2})?$/);
      expect(["string", "undefined"]).toContain(typeof p.photoUrl);
    }
    // pet-health: data sempre preenchida; próxima "" ou dia
    for (const r of depois["pet-health"] as Registro[]) {
      for (const c of ["id", "petId", "type", "name"] as const) expect(typeof r[c], `${r.name}.${c}`).toBe("string");
      expect(r.date).toMatch(DIA);
      expect(r.nextDate).toMatch(/^(\d{4}-\d{2}-\d{2})?$/);
    }
    // pet-expenses: valor NÚMERO (o antigo faz value.toFixed)
    for (const e of depois["pet-expenses"] as Record<string, unknown>[]) {
      expect(typeof e.value).toBe("number");
      expect(Number.isFinite(e.value)).toBe(true);
      for (const c of ["id", "petId", "category", "description"]) expect(typeof e[c]).toBe("string");
      expect(String(e.date)).toMatch(DIA);
    }
    // pet-diary: data ISO que o antigo formata
    for (const d of depois["pet-diary"] as Record<string, unknown>[]) {
      for (const c of ["id", "petName", "date", "text", "mood"]) expect(typeof d[c]).toBe("string");
      expect(Number.isNaN(new Date(String(d.date)).getTime())).toBe(false);
    }
    // pet-routine-<dia>: objeto de objetos de booleanos
    for (const k of Object.keys(depois).filter((x) => /^pet-routine-\d/.test(x))) {
      const dia = depois[k] as Record<string, Record<string, unknown>>;
      expect(formaDe(dia)).toBe("object");
      for (const marcas of Object.values(dia)) {
        expect(formaDe(marcas)).toBe("object");
        for (const v of Object.values(marcas)) expect(typeof v).toBe("boolean");
      }
    }
    // pet-routine-tasks-<pet>: lista de { id, label, emoji } texto
    for (const k of Object.keys(depois).filter((x) => x.startsWith("pet-routine-tasks-"))) {
      for (const t of depois[k] as Record<string, unknown>[]) for (const c of ["id", "label", "emoji"]) expect(typeof t[c], `${k}.${c}`).toBe("string");
    }
    // core-home-widgets-v2: lista de { id, size } com os antigos na frente
    expect((depois["core-home-widgets-v2"] as unknown[]).slice(0, 2)).toEqual(ANTIGO["core-home-widgets-v2"]);
  });
});

/* ═════════════════════════ 5. ida e volta ═════════════════════════ */

describe("5. ida e volta: o antigo edita o que o novo gravou, e o novo reabre certinho", () => {
  it("PetList antigo edita os pets com sexo/porte/chip/faixa; PetRoutine antigo marca; PetHealth antigo edita o registro com lote e cuidadoId", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem).unmount();

    const vigia = vigiarConsole();
    const antigo = nuvem.montar(<AppAntigo />);
    // PetList: renomeia a Frida e troca a raça do Thor
    const pets = within(screen.getByTestId("antigo-pets"));
    fireEvent.click(pets.getAllByRole("button", { name: "Editar Frida" })[0]);
    fireEvent.change(pets.getByPlaceholderText("Nome do pet"), { target: { value: "Frida Kahlo" } });
    fireEvent.click(pets.getByRole("button", { name: /Salvar/ }));
    fireEvent.click(pets.getAllByRole("button", { name: "Editar Thor" })[0]);
    fireEvent.change(pets.getByPlaceholderText("Raça"), { target: { value: "Golden Retriever" } });
    fireEvent.click(pets.getByRole("button", { name: /Salvar/ }));
    // PetRoutine: marca "Brincar" do Thor
    fireEvent.click(within(cartaoDaRotina("Thor")).getByRole("button", { name: "Marcar Brincar" }));
    // PetHealth: edita o Drontal de hoje (o de cima) e a Antirrábica
    const saude = within(screen.getByTestId("antigo-saude"));
    fireEvent.click(saude.getAllByRole("button", { name: "Editar Drontal" })[0]);
    let edicao = emEdicao("antigo-saude");
    fireEvent.change(edicao.getByPlaceholderText("Nome (ex: V8, Antirrábica)"), { target: { value: "Drontal Plus" } });
    fireEvent.click(edicao.getByRole("button", { name: /Salvar/ }));
    fireEvent.click(saude.getAllByRole("button", { name: "Editar Antirrábica" })[0]);
    edicao = emEdicao("antigo-saude");
    fireEvent.change(edicao.getByPlaceholderText("Nome (ex: V8, Antirrábica)"), { target: { value: "Antirrábica (Nobivac)" } });
    fireEvent.click(edicao.getByRole("button", { name: /Salvar/ }));
    antigo.unmount();
    vigia.parar();
    expect(vigia.erros()).toEqual([]);

    // os campos novos continuaram lá
    const lidos = lista<Record<string, unknown>>(nuvem, "pet-list");
    expect(lidos.find((p) => p.name === "Frida Kahlo")).toMatchObject({ sexo: "femea", faixa: "filhote", criadoEm: expect.any(String) });
    expect(lidos.find((p) => p.id === THOR)).toMatchObject({ breed: "Golden Retriever", sexo: "macho", porte: "grande", chip: "985112004321987", weight: "29,5" });
    const apoquel = lista<{ id: string; nome: string }>(nuvem, "pet-cuidados").find((c) => c.nome === "Apoquel")!;
    expect(nuvem.ler<Record<string, Record<string, boolean>>>(`pet-routine-${HOJE}`)[THOR]).toEqual({ food: true, walk: true, bath: false, water: true, [`rem:${apoquel.id}:08:00`]: true, play: true });
    const regs = lista<Registro>(nuvem, "pet-health");
    expect(regs.find((r) => r.name === "Drontal Plus")).toMatchObject({ obs: "Lote 4471", date: HOJE, nextDate: "2026-12-29" });
    expect(regs.find((r) => r.name === "Antirrábica (Nobivac)")?.cuidadoId).toEqual(expect.any(String));

    // o módulo novo reabre com tudo no lugar
    nuvem.montar(<Pet />, "/pet");
    expect(within(screen.getByTestId(`pet-seletor-${lidos.find((p) => p.name === "Frida Kahlo")!.id}`)).getByText("Frida Kahlo")).toBeInTheDocument();
    const rg = screen.getByTestId("rg-do-pet");
    expect(within(rg).getByText("Golden Retriever")).toBeInTheDocument();
    expect(within(rg).getByText("Macho")).toBeInTheDocument();
    expect(within(rg).getByText("Chip 985112004321987")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Desmarcar Brincar" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Desmarcar Apoquel" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByTestId("aba-saude"));
    // linha só do histórico: o nome é o do registro mais novo (o que o antigo editou)
    expect(screen.getByText("Drontal Plus")).toBeInTheDocument();
    // linha do plano: o nome é o do cuidado; o registro renomeado no antigo aparece no histórico da ficha
    // (a Frida também tem uma "Antirrábica": a sugerida do começo pronto)
    const antirrabica = lista<{ id: string; nome: string; petId: string }>(nuvem, "pet-cuidados").find((c) => c.nome === "Antirrábica" && c.petId === THOR)!;
    fireEvent.click(screen.getByTestId(`linha-${antirrabica.id}`));
    expect(within(screen.getByTestId("ficha-cuidado")).getByText("Antirrábica (Nobivac)")).toBeInTheDocument();
  });

  it("PetExpenses e PetDiary antigos editam o gasto e o momento gravados pelo novo; o novo mostra a edição", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem).unmount();

    const vigia = vigiarConsole();
    const antigo = nuvem.montar(<AppAntigo />);
    const gastos = within(screen.getByTestId("antigo-gastos"));
    fireEvent.click(gastos.getAllByRole("button", { name: "Editar gasto Ração" })[0]);
    const edicao = emEdicao("antigo-gastos");
    fireEvent.change(edicao.getByPlaceholderText("Descrição"), { target: { value: "Sachê" } });
    fireEvent.click(edicao.getByRole("button", { name: /Salvar/ }));
    const diario = within(screen.getByTestId("antigo-diario"));
    fireEvent.click(diario.getAllByRole("button", { name: "Editar momento de Thor" })[0]);
    fireEvent.change(diario.getByDisplayValue("Tomou banho e ficou cheiroso."), { target: { value: "Tomou banho e dormiu." } });
    fireEvent.click(diario.getByRole("button", { name: /Salvar/ }));
    antigo.unmount();
    vigia.parar();
    expect(vigia.erros()).toEqual([]);

    expect(lista(nuvem, "pet-expenses").at(-1)).toMatchObject({ petId: MIA, description: "Sachê", value: 59.9, date: HOJE });
    expect(lista(nuvem, "pet-diary")[0]).toMatchObject({ petName: "Thor", text: "Tomou banho e dormiu." });

    nuvem.montar(<Pet />, "/pet");
    fireEvent.click(screen.getByTestId("aba-gastos"));
    expect(screen.getByText("Sachê")).toBeInTheDocument();
    expect(screen.getByTestId("gastos-total")).toHaveTextContent("R$ 294,80");
    fireEvent.click(screen.getByTestId("aba-diario"));
    expect(screen.getByText("Tomou banho e dormiu.")).toBeInTheDocument();
  });
});

/* ═════════════════════════ achados (eram it.fails; consertados em 30/09 — ver o relatório da integração) ═════════════════════════ */

describe("achados de compatibilidade — consertados na integração de 30/09 (eram it.fails)", () => {
  /*
   * BUG — peso: `pesosDoPet` (src/lib/pet.ts:229) prefere o histórico `pet-pesos` e só usa o
   * `weight` de sempre quando não há histórico. Depois que alguém pesa no app novo, o peso que
   * o app ANTIGO edita (PetList grava só `weight`) nunca mais aparece no RG nem em PESO do novo.
   */
  it("peso editado no app antigo depois de pesar no novo: o RG novo mostra o peso que o antigo gravou", () => {
    const nuvem = criarNuvem(ANTIGO);
    const novo = nuvem.montar(<Pet />, "/pet");
    fireEvent.click(screen.getByTestId("aba-saude"));
    fireEvent.change(screen.getByTestId("peso-input"), { target: { value: "29,5" } });
    fireEvent.click(screen.getByTestId("peso-salvar"));
    novo.unmount();

    const antigo = nuvem.montar(<PetList />);
    fireEvent.click(screen.getAllByRole("button", { name: "Editar Thor" })[0]);
    fireEvent.change(screen.getByPlaceholderText("Peso (kg)"), { target: { value: "31" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    antigo.unmount();
    expect(lista<{ id: string; weight: string }>(nuvem, "pet-list").find((p) => p.id === THOR)?.weight).toBe("31");

    nuvem.montar(<Pet />, "/pet");
    expect(within(screen.getByTestId("rg-do-pet")).getByText("31 kg")).toBeInTheDocument();
  });

  /*
   * ERA DIVERGÊNCIA — rotina de pet SEM `pet-routine-tasks-<id>` (todo pet cadastrado no app antigo
   * que nunca teve hábito editado): o app antigo mostra as 6 de sempre (Comida, Água, Passeio,
   * Banho, Brincar, Escovar — PetRoutine.defaultTasks); o novo mostra a rotina da espécie.
   * Consertado em 30/09 (`marcarNaRotina`, src/lib/pet.ts): o 1º gesto na rotina grava a lista que
   * o app novo mostra — dali em diante os dois mostram e marcam a mesma. Abrir continua sem gravar.
   */
  it("pet antigo sem lista gravada: o que o HOJE novo mostra e marca aparece no PetRoutine antigo", () => {
    const nuvem = criarNuvem(ANTIGO);
    const novo = nuvem.montar(<Pet />, "/pet");
    fireEvent.click(screen.getByRole("checkbox", { name: "Marcar Comida · noite" }));
    novo.unmount();
    nuvem.montar(<section data-testid="antigo-rotina"><PetRoutine /></section>);
    expect(within(cartaoDaRotina("Thor")).getByRole("button", { name: "Desmarcar Comida · noite" })).toBeInTheDocument();
  });

  /*
   * BUG — registro sem data: o PetHealth antigo deixa lançar com o campo "Data" apagado
   * (addRecord não valida `date`) e grava `date: ""`. `registrosValidos` (src/lib/pet-cuidados.ts:170)
   * descarta registro sem dia válido: a vacina some da carteirinha nova (continua na nuvem e
   * no app antigo).
   */
  it("registro de saúde que o app antigo gravou sem data (campo Data apagado) aparece na carteirinha nova", () => {
    const nuvem = criarNuvem(ANTIGO);
    const antigo = nuvem.montar(<PetHealth />);
    const [seletorDoPet] = Array.from(document.querySelectorAll("select"));
    fireEvent.change(seletorDoPet, { target: { value: THOR } });
    fireEvent.change(screen.getByPlaceholderText("Nome (ex: V8, Antirrábica)"), { target: { value: "Giárdia" } });
    const [data, proxima] = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    fireEvent.change(data, { target: { value: "" } });
    fireEvent.change(proxima, { target: { value: "2026-10-15" } });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar registro/ }));
    antigo.unmount();
    expect(lista<Registro>(nuvem, "pet-health").find((r) => r.name === "Giárdia")).toMatchObject({ date: "", nextDate: "2026-10-15" });

    nuvem.montar(<Pet />, "/pet");
    fireEvent.click(screen.getByTestId("aba-saude"));
    expect(screen.getByText("Giárdia")).toBeInTheDocument();
  });
});
