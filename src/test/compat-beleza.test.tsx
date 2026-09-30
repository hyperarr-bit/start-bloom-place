/**
 * BELEZA — COMPATIBILIDADE com o app antigo das lojas (30/09).
 *
 * A Beleza virou SKINCARE · CABELO · MEUS PRODUTOS · CUIDADOS (o DIÁRIO virou "Fotos da pele"
 * dentro de SKINCARE) e a web nova lê e grava a MESMA nuvem que o app antigo (78883beb: iPhone
 * 1.0.7/1.0.8, Android 125). Regra de 28/09: chave que já existe nunca muda de tipo nem de forma.
 *
 * Os componentes ANTIGOS (SkincareRoutine, DailyMirror, ProductShelf, SkinDiary + estado e utils
 * deles) estão congelados em ./app-antigo/beleza; a regra dos compromissos do app antigo está em
 * ./app-antigo/home/compromissos-antigo.ts. Eles leem, no mesmo store, o que o módulo novo gravou.
 *
 *  1. abrir com dado antigo → tudo aparece (inclusive as FOTOS do diário), nada é gravado;
 *  2. a rotina pronta nunca troca a rotina de quem já tem uma sem o toque dela;
 *  3. gravar pelo novo → o antigo lê: rotina pronta, check, produto "Maquiagem" com validade
 *     impressa, gasto em Finanças (formato da ação rápida da Home antiga), compromisso na Rotina;
 *  4. tipo preservado em toda chave que já existia;
 *  5. ida e volta: o antigo edita o produto e marca/acrescenta passo; o novo reabre certinho.
 * Os interruptores de lembrete NÃO entram aqui (vão sair da web).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { act, fireEvent, screen, within, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock, Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
// o cliente do Supabase aponta pra PRODUÇÃO: o SkinDiary (novo e antigo) importa ele pra subir foto
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }) },
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) },
  },
}));

import Beleza from "@/pages/Beleza";
import { VARIABLE_CATEGORIES } from "@/lib/finance-categories";
import { SkincareRoutine } from "./app-antigo/beleza/SkincareRoutine";
import { DailyMirror } from "./app-antigo/beleza/DailyMirror";
import { ProductShelf } from "./app-antigo/beleza/ProductShelf";
import { SkinDiary } from "./app-antigo/beleza/SkinDiary";
import { compromissosValidos as compromissosValidosAntigo, planejarCompromissos as planejarCompromissosAntigo } from "./app-antigo/home/compromissos-antigo";
import { criarNuvem, formaDe, prepararJsdom, vigiarConsole, type Dados, type Nuvem } from "./compat-comum";

// quarta, 30/09/2026 10:00 (quarta = 2 na semana da Beleza, que começa na segunda)
const HOJE = "2026-09-30";
const ONTEM = "2026-09-29";
const AGORA = new Date(2026, 8, 30, 10, 0);
beforeAll(prepararJsdom);
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(AGORA); toastMock.mockClear(); });
// restoreAllMocks: solta o console.error do vigiarConsole mesmo se a tela quebrar no meio (os vi.fn dos mocks ficam como estão)
afterEach(() => { vi.useRealTimers(); cleanup(); vi.restoreAllMocks(); });

/* ───────────────────────── o dado ANTIGO (formatos de 78883beb) ───────────────────────── */

const FOTO_1 = "https://itoylenzvahbscgjgtqf.supabase.co/storage/v1/object/sign/skin-photos/u/a.jpg?token=x";
const FOTO_2 = "https://itoylenzvahbscgjgtqf.supabase.co/storage/v1/object/sign/skin-photos/u/b.jpg?token=y";

/** Produto no formato de SEMPRE (Product de components/beleza/utils antigo; id = crypto.randomUUID()). */
const produto = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, category: "Skincare", brand: "", opened: false, openedDate: "", paoMonths: 12, expiry: "", notes: "", rating: 0,
  repurchase: false, price: 0, sizeMl: 0, photoUrl: "", frequency: "Diário", finished: false, ...extra,
});

const ANTIGO: Dados = {
  // o SkincareRoutine antigo grava os DOIS flags em todo passo (addStep)
  "skincare-am-steps": [
    { name: "Gel de limpeza", isSunscreen: false, isAcid: false },
    { name: "Vitamina C", isSunscreen: false, isAcid: false },
    { name: "Protetor solar FPS 50", isSunscreen: true, isAcid: false },
  ],
  "skincare-pm-steps": [
    { name: "Demaquilante", isSunscreen: false, isAcid: false },
    { name: "Retinol", isSunscreen: false, isAcid: true },
    { name: "Hidratante", isSunscreen: false, isAcid: false },
  ],
  // checks = ÍNDICE do passo, por dia
  "skincare-morning-checked": { [HOJE]: [0], [ONTEM]: [0, 1, 2], "2026-09-28": [0, 2] },
  "skincare-night-checked": { [ONTEM]: [0, 2] },
  "skincare-cycle-start": "2026-09-10",
  "skincare-daily-checkin": { [ONTEM]: "oleosa", [HOJE]: "boa" },
  "skincare-triggers": ["Ácido Salicílico"],
  "skincare-diary": [
    { id: "0b6c8c1e-5b1a-4a53-9d07-1f3c2a9e0a11", date: ONTEM, photoUrl: FOTO_1, notes: "Pele calma depois do retinol", skinStatus: "boa", mood: "😊" },
    { id: "0b6c8c1e-5b1a-4a53-9d07-1f3c2a9e0a12", date: "2026-09-15", photoUrl: FOTO_2, notes: "Espinha no queixo", skinStatus: "acne", mood: "😐" },
    { id: "0b6c8c1e-5b1a-4a53-9d07-1f3c2a9e0a13", date: "2026-09-01", photoUrl: "", notes: "Só anotação, sem foto", skinStatus: "seca", mood: "😔" },
  ],
  "beauty-products": [
    produto("5f1d7a52-0c1e-4c1b-8a3e-2d9b7c4e6f01", "Gel de Limpeza Espumante", { brand: "CeraVe", opened: true, openedDate: "2026-08-01", repurchase: true, price: 89.9, sizeMl: 473 }),
    produto("5f1d7a52-0c1e-4c1b-8a3e-2d9b7c4e6f02", "Máscara de Hidratação", { category: "Cabelo", brand: "Lola" }),
    produto("5f1d7a52-0c1e-4c1b-8a3e-2d9b7c4e6f03", "Óleo corporal", { category: "Corpo", brand: "Natura", finished: true }),
  ],
  "beauty-shopping-list": [produto("5f1d7a52-0c1e-4c1b-8a3e-2d9b7c4e6f04", "Óleo corporal", { category: "Corpo", brand: "Natura", price: 59.9 })],
  // Casa/Home — a Beleza nova grava nelas ("Lançar em Finanças", "Marquei horário", "Pôr na Home")
  "finance-expenses": [{ id: "9a1e4f0c-7d2b-4c8e-b1a3-5e6f7a8b9c01", description: "Alimentação", value: 200, category: "alimentacao", date: "2026-09-02", paymentMethod: "pix" }],
  "rotina-compromissos": [
    { id: "c-dentista", titulo: "Dentista", data: "2026-10-05", hora: "09:00", aviso: 60 },
    { id: "c-torto", titulo: "Reunião sem hora", data: "2026-10-01" }, // torto: sem hora (a Rotina não agenda, mas é da pessoa)
  ],
  "core-home-widgets-v2": [{ id: "finances", size: "small" }, { id: "habits", size: "small" }],
};

/** Os 16 campos de `beauty-products` que o app antigo lê, no tipo de sempre. */
const TIPO_DO_PRODUTO: Record<string, string> = {
  id: "string", name: "string", category: "string", brand: "string", opened: "boolean", openedDate: "string", paoMonths: "number",
  expiry: "string", notes: "string", rating: "number", repurchase: "boolean", price: "number", sizeMl: "number", photoUrl: "string",
  frequency: "string", finished: "boolean",
};
/**
 * O gasto que a ação rápida "Registrar Gasto" da Home ANTIGA grava (78883beb:src/components/home/QuickActions.tsx,
 * submitExpense): etiquetar({ id: crypto.randomUUID(), description, value, category, date: todayStr(), paymentMethod: "pix" }, perfil).
 * A Home antiga não é renderizada aqui (puxa o app inteiro pelo useLifeHubData): o formato está escrito como ela grava.
 */
const CAMPOS_DO_GASTO_DA_HOME_ANTIGA = ["category", "date", "description", "id", "paymentMethod", "value"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Passo = { name: string; isSunscreen?: boolean; isAcid?: boolean; dias?: number[]; tipo?: string };
const lista = <T,>(n: Nuvem, k: string) => (n.ler<T[]>(k) ?? []) as T[];
const aba = (nome: RegExp) => fireEvent.click(screen.getByRole("button", { name: nome }));

/* ───────────────────────── as ações do módulo NOVO ───────────────────────── */

/**
 * O que a Beleza nova grava de novo partindo da conta antiga: rotina pronta (3 perguntas, pelo
 * "Refazer" — troca a de agora, com Desfazer), check de hoje, "Pôr na Home", produto de
 * Maquiagem com validade impressa, cuidado FEITO + "Lançar em Finanças" + "Marquei horário".
 */
function gravarPeloNovo(nuvem: Nuvem) {
  const tela = nuvem.montar(<Beleza />, "/beleza");

  // 1) SKINCARE: rotina pronta em 3 toques (mista · manchas · intermediário)
  fireEvent.click(screen.getByTestId("refazer-perguntas"));
  fireEvent.click(screen.getByTestId("opcao-mista"));
  fireEvent.click(screen.getByTestId("opcao-manchas"));
  fireEvent.click(screen.getByTestId("opcao-intermediario"));
  // 2) marca o sérum de hoje e põe o "Skincare de hoje" na Home
  fireEvent.click(screen.getByRole("checkbox", { name: "Marcar Sérum de vitamina C" }));
  fireEvent.click(within(screen.getByTestId("postit-home")).getByRole("button", { name: "Pôr" }));

  // 3) MEUS PRODUTOS: batom (categoria nova "Maquiagem", tipo batom) com a validade impressa
  aba(/MEUS PRODUTOS/);
  fireEvent.click(screen.getByRole("button", { name: "+ Detalhes" }));
  const form = within(screen.getByTestId("form-produto"));
  fireEvent.change(form.getByPlaceholderText("Nome do produto"), { target: { value: "Batom Matte" } });
  fireEvent.change(form.getByPlaceholderText("Marca"), { target: { value: "Vult" } });
  fireEvent.click(form.getByRole("button", { name: "Maquiagem" }));
  fireEvent.click(form.getByRole("button", { name: /Batom · 18m/ }));
  fireEvent.change(form.getByLabelText("Vence em (mês e ano impressos)"), { target: { value: "2027-03" } });
  fireEvent.click(form.getByRole("button", { name: "Salvar" }));

  // 4) CUIDADOS: unha FEITO hoje (R$ 45) → "Lançar em Finanças"; "Pôr na Home"; depois "Marquei horário"
  aba(/CUIDADOS/);
  fireEvent.click(screen.getByTestId("modelo-unha"));
  let ficha = within(screen.getByTestId("ficha-cuidado"));
  fireEvent.change(ficha.getByLabelText("Preço"), { target: { value: "45,00" } });
  fireEvent.click(ficha.getByTestId("cuidado-feito"));
  fireEvent.click(ficha.getByTestId("lancar-financas"));
  fireEvent.click(ficha.getByRole("button", { name: "Fechar" }));
  fireEvent.click(within(screen.getByTestId("oferta-cuidados-home")).getByRole("button", { name: "Pôr" }));
  fireEvent.click(screen.getByTestId("linha-cuidado"));
  ficha = within(screen.getByTestId("ficha-cuidado"));
  fireEvent.click(ficha.getByTestId("marquei-horario"));
  fireEvent.change(ficha.getByTestId("horario-dia"), { target: { value: "2026-10-07" } });
  fireEvent.change(ficha.getByTestId("horario-hora"), { target: { value: "15:00" } });
  fireEvent.click(ficha.getByTestId("salvar-horario"));
  fireEvent.click(ficha.getByRole("button", { name: "Fechar" }));
  return tela;
}

/** Os 4 componentes do app antigo (Espelho do dia + as abas Rotina, Bancada e Diário), no mesmo store. */
const AppAntigo = () => (
  <>
    <section data-testid="antigo-espelho"><DailyMirror /></section>
    <section data-testid="antigo-rotina"><SkincareRoutine /></section>
    <section data-testid="antigo-bancada"><ProductShelf /></section>
    <section data-testid="antigo-diario"><SkinDiary /></section>
  </>
);
/** A linha de um item num componente antigo (as linhas deles têm a classe `group`). */
const linhasAntigas = (secao: string, texto: string) =>
  within(screen.getByTestId(secao)).getAllByText(texto).map((el) => el.closest(".group") as HTMLElement);
const marcadoNoAntigo = (linha: HTMLElement) => within(linha).getByRole("checkbox").getAttribute("aria-checked");

/* ═════════════════════════ 1. abrir com dado antigo ═════════════════════════ */

describe("1. abrir a Beleza nova com o dado do app antigo", () => {
  it("rotina, checks, fotos do diário, produtos e compras aparecem nas 4 abas — e nada é gravado", () => {
    const nuvem = criarNuvem(ANTIGO);
    nuvem.montar(<Beleza />, "/beleza");

    // SKINCARE: os 6 passos (sem dias = todo dia, como o antigo sempre mostrou), o check de hoje no índice 0
    const passos = screen.getAllByTestId("passo-skincare");
    expect(passos.map((p) => within(p).getByRole("checkbox").getAttribute("aria-label"))).toEqual([
      "Marcar Gel de limpeza", "Marcar Vitamina C", "Marcar Protetor solar FPS 50", "Marcar Demaquilante", "Marcar Retinol", "Marcar Hidratante",
    ]);
    expect(passos.map((p) => within(p).getByRole("checkbox").getAttribute("aria-checked"))).toEqual(["true", "false", "false", "false", "false", "false"]);
    expect(within(screen.getByTestId("semana-skincare")).getAllByTestId("linha-semana")).toHaveLength(6);
    expect(screen.getByText("Ácido Salicílico")).toBeInTheDocument(); // ingredientes a evitar
    expect(screen.queryByTestId("montar-rotina")).not.toBeInTheDocument();

    // FOTOS DA PELE: as 3 entradas do DIÁRIO antigo, com as fotos (URL assinada do bucket skin-photos)
    const fotos = screen.getByTestId("fotos-da-pele");
    expect(within(fotos).getByText("3 registros • 2 fotos")).toBeInTheDocument();
    for (const nota of ["Pele calma depois do retinol", "Espinha no queixo", "Só anotação, sem foto"]) expect(within(fotos).getByText(nota)).toBeInTheDocument();
    expect(fotos.querySelector(`img[src="${FOTO_1}"]`)).not.toBeNull();
    expect(fotos.querySelector(`img[src="${FOTO_2}"]`)).not.toBeNull();

    // CABELO: sem cronograma, as perguntas (nada inventado)
    aba(/CABELO/);
    expect(screen.getByTestId("curva-ondulado")).toBeInTheDocument();

    // MEUS PRODUTOS: os 2 ativos ("Skincare" = Pele), o acabado fica fora, a lista de compras conta 1
    aba(/MEUS PRODUTOS/);
    const produtos = screen.getAllByTestId("produto-meu");
    expect(produtos.map((p) => within(p).getByText(/Gel de Limpeza Espumante|Máscara de Hidratação/).textContent)).toEqual(["Gel de Limpeza Espumante", "Máscara de Hidratação"]);
    expect(screen.getByText("2 produtos ativos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pele 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cabelo 1" })).toBeInTheDocument();
    expect(screen.getByText("vence 08/2027 (depois de aberto)")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Lista de compras" })).getByText("1")).toBeInTheDocument();

    // CUIDADOS: vazio (chave nova), sem gravar
    aba(/CUIDADOS/);
    expect(screen.getByTestId("proximos-cuidados")).toBeInTheDocument();

    expect(nuvem.escritasDeDado()).toEqual([]);
    for (const k of Object.keys(ANTIGO)) expect(nuvem.estado.dados[k], k).toEqual(ANTIGO[k]);
  });

  it("o link antigo /beleza?aba=diario chega em SKINCARE › FOTOS DA PELE, com as fotos, sem gravar", () => {
    const nuvem = criarNuvem(ANTIGO);
    nuvem.montar(<Beleza />, "/beleza?aba=diario");
    expect(screen.getByRole("button", { name: /SKINCARE/ }).className).toMatch(/notion-tab-active/);
    const fotos = screen.getByTestId("fotos-da-pele");
    expect(fotos.querySelector(`img[src="${FOTO_1}"]`)).not.toBeNull();
    expect(fotos.querySelector(`img[src="${FOTO_2}"]`)).not.toBeNull();
    expect(within(fotos).getByText("Espinha no queixo")).toBeInTheDocument();
    expect(nuvem.escritasDeDado()).toEqual([]);
  });
});

/* ═════════════════════════ 2. a rotina pronta não entra sozinha ═════════════════════════ */

describe("2. a rotina pronta nunca troca a rotina de ninguém sem o toque", () => {
  it("com rotina: abrir não troca nada (as 3 perguntas só pelo 'Refazer')", () => {
    const nuvem = criarNuvem(ANTIGO);
    nuvem.montar(<Beleza />, "/beleza");
    expect(screen.queryByTestId("montar-rotina")).not.toBeInTheDocument();
    expect(screen.getByTestId("refazer-perguntas")).toBeInTheDocument();
    expect(nuvem.estado.dados["skincare-am-steps"]).toEqual(ANTIGO["skincare-am-steps"]);
    expect(nuvem.estado.dados["skincare-pm-steps"]).toEqual(ANTIGO["skincare-pm-steps"]);
    expect(nuvem.escritasDeDado()).toEqual([]);
  });

  it("conta antiga SEM rotina (só produtos e fotos): as perguntas aparecem, nada é gravado; as fotos continuam", () => {
    const { ["skincare-am-steps"]: _am, ["skincare-pm-steps"]: _pm, ...semRotina } = ANTIGO;
    const nuvem = criarNuvem(semRotina);
    nuvem.montar(<Beleza />, "/beleza");
    expect(screen.getByTestId("montar-rotina")).toBeInTheDocument();
    expect(screen.getByTestId("fotos-da-pele").querySelector(`img[src="${FOTO_1}"]`)).not.toBeNull();
    expect(nuvem.escritasDeDado()).toEqual([]);
  });

  it("conta vazia: as perguntas aparecem, nada é gravado ao abrir nem trocando de aba; os 3 toques gravam", () => {
    const nuvem = criarNuvem({});
    nuvem.montar(<Beleza />, "/beleza");
    expect(screen.getByTestId("montar-rotina")).toBeInTheDocument();
    aba(/CABELO/); aba(/MEUS PRODUTOS/); aba(/CUIDADOS/); aba(/SKINCARE/);
    fireEvent.click(screen.getByTestId("opcao-oleosa"));
    fireEvent.click(screen.getByTestId("opcao-acne"));
    expect(nuvem.escritasDeDado()).toEqual([]);
    fireEvent.click(screen.getByTestId("opcao-iniciante"));
    expect(nuvem.escritasDeDado()).toEqual(["skincare-am-steps", "skincare-pm-steps", "skincare-perfil"]);
  });

  it("'Refazer as 3 perguntas' troca a rotina (e só os checks de HOJE); o Desfazer devolve a antiga exatamente", () => {
    const nuvem = criarNuvem(ANTIGO);
    nuvem.montar(<Beleza />, "/beleza");
    fireEvent.click(screen.getByTestId("refazer-perguntas"));
    fireEvent.click(screen.getByTestId("opcao-mista"));
    fireEvent.click(screen.getByTestId("opcao-manchas"));
    fireEvent.click(screen.getByTestId("opcao-intermediario"));
    expect(lista<Passo>(nuvem, "skincare-am-steps").map((p) => p.name)).toEqual(["Gel de limpeza", "Sérum de vitamina C", "Hidratante leve (gel)", "Protetor solar (toque seco)"]);
    // os dias passados ficam como estavam (só contam pra sequência); hoje zera
    expect(nuvem.ler("skincare-morning-checked")).toEqual({ ...(ANTIGO["skincare-morning-checked"] as object), [HOJE]: [] });
    const desfazer = toastMock.mock.calls.find((c) => c[0] === "Rotina trocada pela nova");
    expect(desfazer).toBeTruthy();
    act(() => { desfazer![1].action.onClick(); });
    for (const k of ["skincare-am-steps", "skincare-pm-steps", "skincare-morning-checked"]) expect(nuvem.ler(k), k).toEqual(ANTIGO[k]);
  });
});

/* ═════════════════════════ 3. gravar pelo novo → o antigo lê ═════════════════════════ */

describe("3. o que a Beleza nova grava, o app antigo lê", () => {
  it("as ações do módulo novo gravam nos formatos de sempre (+ campos opcionais e chaves novas)", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem);

    // rotina pronta: passos { name, isSunscreen?, isAcid? } + dias/tipo opcionais; checks por índice
    expect(lista<Passo>(nuvem, "skincare-am-steps")).toEqual([
      { name: "Gel de limpeza", tipo: "limpeza" },
      { name: "Sérum de vitamina C", tipo: "vitamina-c" },
      { name: "Hidratante leve (gel)", tipo: "hidratante" },
      { name: "Protetor solar (toque seco)", tipo: "protetor", isSunscreen: true },
    ]);
    expect(lista<Passo>(nuvem, "skincare-pm-steps")).toEqual([
      { name: "Gel de limpeza", tipo: "limpeza" },
      { name: "Ácido glicólico (AHA)", tipo: "acido-glicolico", isAcid: true, dias: [1, 5] },
      { name: "Hidratante leve (gel)", tipo: "hidratante" },
    ]);
    expect((nuvem.ler("skincare-morning-checked") as Record<string, number[]>)[HOJE]).toEqual([1]);
    expect(nuvem.ler("skincare-perfil")).toEqual({ pele: "mista", objetivo: "manchas", nivel: "intermediario" });

    // o produto: formato de sempre + tipo/paoPadrao; validade impressa no `expiry` que já existia
    const batom = lista<Record<string, unknown>>(nuvem, "beauty-products").at(-1)!;
    expect(batom).toMatchObject({ name: "Batom Matte", brand: "Vult", category: "Maquiagem", tipo: "batom", paoMonths: 18, paoPadrao: true, expiry: "2027-03", opened: false, openedDate: "" });
    for (const [campo, tipo] of Object.entries(TIPO_DO_PRODUTO)) expect(typeof batom[campo], campo).toBe(tipo);

    // o gasto em Finanças: EXATAMENTE o formato da ação rápida da Home antiga
    const gasto = lista<Record<string, unknown>>(nuvem, "finance-expenses").at(-1)!;
    expect(Object.keys(gasto).sort()).toEqual(CAMPOS_DO_GASTO_DA_HOME_ANTIGA);
    expect(gasto).toMatchObject({ description: "Unha", value: 45, category: "beleza", date: HOJE, paymentMethod: "pix" });
    expect(String(gasto.id)).toMatch(UUID);
    // "beleza" é categoria que o app antigo conhece (lib/finance-categories não mudou desde 78883beb)
    expect(VARIABLE_CATEGORIES.map((c) => c.value)).toContain(gasto.category);

    // o compromisso na Rotina: gravado sobre a lista CRUA (o torto continua) e válido pela regra ANTIGA
    const crus = nuvem.ler<Record<string, unknown>[]>("rotina-compromissos");
    expect(crus).toHaveLength(3);
    expect(crus.slice(0, 2)).toEqual(ANTIGO["rotina-compromissos"]);
    const cuidado = lista<{ id: string }>(nuvem, "beleza-cuidados")[0];
    expect(crus[2]).toEqual({ id: expect.stringMatching(UUID), titulo: "Unha", data: "2026-10-07", hora: "15:00", aviso: 60, origem: "beleza", ref: cuidado.id });
    expect(nuvem.ler("core-home-widgets-v2")).toEqual([...(ANTIGO["core-home-widgets-v2"] as unknown[]), { id: "skincare", size: "large" }, { id: "cuidados", size: "large" }]);
  });

  it("o compromisso 'beleza' passa no compromissosValidos ANTIGO (o torto continua fora, mas na lista) e o agendador antigo avisa 1 h antes", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem);
    const crus = nuvem.ler<unknown[]>("rotina-compromissos");
    const validos = compromissosValidosAntigo(crus);
    expect(validos.map((c) => c.titulo)).toEqual(["Dentista", "Unha"]);
    expect(crus).toContainEqual(ANTIGO["rotina-compromissos"][1]);
    const avisos = planejarCompromissosAntigo(validos, 0, AGORA);
    expect(avisos.find((a) => a.title === "📅 Unha")).toMatchObject({ quando: new Date(2026, 9, 7, 14, 0), body: "Em 1 hora, às 15:00" });
  });

  it("os componentes do app antigo abrem sem erro e mostram a rotina pronta com o check, o batom 'Maquiagem' e as fotos", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem).unmount();

    const vigia = vigiarConsole();
    nuvem.montar(<AppAntigo />);
    vigia.parar();
    expect(vigia.erros()).toEqual([]);

    // SkincareRoutine antigo: os passos novos (todos, todo dia — o antigo não sabe de dias) e o check de hoje
    const rotina = within(screen.getByTestId("antigo-rotina"));
    for (const nome of ["Sérum de vitamina C", "Protetor solar (toque seco)", "Ácido glicólico (AHA)"]) expect(rotina.getByText(nome)).toBeInTheDocument();
    expect(rotina.getAllByText("Gel de limpeza")).toHaveLength(2);
    expect(marcadoNoAntigo(linhasAntigas("antigo-rotina", "Sérum de vitamina C")[0])).toBe("true");
    expect(marcadoNoAntigo(linhasAntigas("antigo-rotina", "Gel de limpeza")[0])).toBe("false");
    expect(rotina.getByText("OBRIGATÓRIO")).toBeInTheDocument(); // o protetor (isSunscreen) segue obrigatório
    expect(rotina.getByText("ativo")).toBeInTheDocument(); // o ácido (isAcid) segue marcado como ativo
    expect(rotina.getByText("Nenhum conflito de ativos ✅")).toBeInTheDocument();
    // o antigo não regravou o início do ciclo (já existia)
    expect(nuvem.ler("skincare-cycle-start")).toBe(ANTIGO["skincare-cycle-start"]);

    // ProductShelf antigo: o batom com a categoria nova (texto), junto dos de sempre
    const bancada = within(screen.getByTestId("antigo-bancada"));
    expect(bancada.getByText("3 produtos ativos")).toBeInTheDocument();
    const batom = within(linhasAntigas("antigo-bancada", "Batom Matte")[0]);
    expect(batom.getByText("Maquiagem")).toBeInTheDocument();
    expect(batom.getByText("Vult")).toBeInTheDocument();
    expect(bancada.getByText("Gel de Limpeza Espumante")).toBeInTheDocument();

    // SkinDiary antigo: as fotos de sempre
    const diario = screen.getByTestId("antigo-diario");
    expect(within(diario).getByText("3 registros • 2 fotos")).toBeInTheDocument();
    expect(diario.querySelector(`img[src="${FOTO_1}"]`)).not.toBeNull();
    // DailyMirror antigo: a sequência conta os checks de hoje e dos dias antes
    expect(within(screen.getByTestId("antigo-espelho")).getByText("🔥 3 dias consecutivos de rotina")).toBeInTheDocument();
  });
});

/* ═════════════════════════ 4. tipo preservado ═════════════════════════ */

describe("4. toda chave que já existia continua com o mesmo tipo e os itens antigos continuam lá", () => {
  it("formas, ids e os campos que o app antigo lê", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem);
    const depois = nuvem.estado.dados;

    for (const k of Object.keys(ANTIGO)) expect(formaDe(depois[k]), k).toBe(formaDe(ANTIGO[k]));
    // o que o novo não tinha por que tocar ficou idêntico
    for (const k of ["skincare-cycle-start", "skincare-daily-checkin", "skincare-triggers", "skincare-diary", "beauty-shopping-list", "skincare-night-checked"]) {
      expect(depois[k], k).toEqual(ANTIGO[k]);
    }
    // itens antigos (com id) continuam, idênticos
    for (const k of ["beauty-products", "finance-expenses", "rotina-compromissos"]) {
      const atuais = depois[k] as { id: string }[];
      for (const item of ANTIGO[k] as { id: string }[]) expect(atuais.find((x) => x.id === item.id), `${k} ${item.id}`).toEqual(item);
    }
    expect((depois["core-home-widgets-v2"] as unknown[]).slice(0, 2)).toEqual(ANTIGO["core-home-widgets-v2"]);
    // os passos (sem id) foram trocados pela rotina pronta — gesto da pessoa, com Desfazer (teste 2) —
    // e seguem no formato que o antigo lê
    for (const k of ["skincare-am-steps", "skincare-pm-steps"]) {
      for (const p of depois[k] as Record<string, unknown>[]) {
        expect(typeof p.name, k).toBe("string");
        expect(["boolean", "undefined"]).toContain(typeof p.isSunscreen);
        expect(["boolean", "undefined"]).toContain(typeof p.isAcid);
      }
    }
    // checks: dia → lista de índices (inteiros); os dias passados intactos
    for (const k of ["skincare-morning-checked", "skincare-night-checked"]) {
      for (const v of Object.values(depois[k] as Record<string, unknown>)) expect(Array.isArray(v) && (v as unknown[]).every(Number.isInteger), k).toBe(true);
    }
    const manha = depois["skincare-morning-checked"] as Record<string, number[]>;
    expect([manha[ONTEM], manha["2026-09-28"]]).toEqual([[0, 1, 2], [0, 2]]);
    // produtos: os 16 campos de sempre, no tipo de sempre, em TODOS
    for (const p of depois["beauty-products"] as Record<string, unknown>[]) {
      for (const [campo, tipo] of Object.entries(TIPO_DO_PRODUTO)) expect(typeof p[campo], `${p.name}.${campo}`).toBe(tipo);
    }
    // gastos: número no valor, dia na data
    for (const g of depois["finance-expenses"] as Record<string, unknown>[]) {
      expect(typeof g.value).toBe("number");
      expect(String(g.date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

/* ═════════════════════════ 5. ida e volta ═════════════════════════ */

describe("5. ida e volta: o antigo edita o que o novo gravou, e o novo reabre certinho", () => {
  it("ProductShelf antigo edita o batom (tipo/expiry/paoPadrao ficam); SkincareRoutine antigo marca e acrescenta passo (dias/tipo ficam)", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem).unmount();

    const vigia = vigiarConsole();
    const antigo = nuvem.montar(<AppAntigo />);
    // ProductShelf: abre o batom → Editar → troca o nome → Salvar
    fireEvent.click(linhasAntigas("antigo-bancada", "Batom Matte")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    const bancada = within(screen.getByTestId("antigo-bancada"));
    fireEvent.change(bancada.getAllByPlaceholderText("Nome do produto").at(-1)!, { target: { value: "Batom Matte Vermelho" } });
    fireEvent.click(bancada.getByRole("button", { name: "Salvar" }));
    // SkincareRoutine: marca o hidratante da manhã e acrescenta um tônico
    fireEvent.click(within(linhasAntigas("antigo-rotina", "Hidratante leve (gel)")[0]).getByRole("checkbox"));
    const novoPasso = within(screen.getByTestId("antigo-rotina")).getByPlaceholderText("Ex: Gel de limpeza, Tônico, Vitamina C...");
    fireEvent.change(novoPasso, { target: { value: "Tônico" } });
    fireEvent.keyDown(novoPasso, { key: "Enter" });
    antigo.unmount();
    vigia.parar();
    expect(vigia.erros()).toEqual([]);

    const batom = lista<Record<string, unknown>>(nuvem, "beauty-products").at(-1)!;
    expect(batom).toMatchObject({ name: "Batom Matte Vermelho", category: "Maquiagem", tipo: "batom", expiry: "2027-03", paoPadrao: true, paoMonths: 18 });
    expect((nuvem.ler("skincare-morning-checked") as Record<string, number[]>)[HOJE]).toEqual([1, 2]);
    const manha = lista<Passo>(nuvem, "skincare-am-steps");
    expect(manha.at(-1)).toEqual({ name: "Tônico", isSunscreen: false, isAcid: false });
    expect(manha[1]).toEqual({ name: "Sérum de vitamina C", tipo: "vitamina-c" });
    expect(lista<Passo>(nuvem, "skincare-pm-steps")[1]).toEqual({ name: "Ácido glicólico (AHA)", tipo: "acido-glicolico", isAcid: true, dias: [1, 5] });

    // a Beleza nova reabre com tudo no lugar
    nuvem.montar(<Beleza />, "/beleza");
    const hoje = within(screen.getByTestId("periodo-manha"));
    expect(hoje.getByRole("checkbox", { name: "Marcar Sérum de vitamina C" })).toHaveAttribute("aria-checked", "true");
    expect(hoje.getByRole("checkbox", { name: "Marcar Hidratante leve (gel)" })).toHaveAttribute("aria-checked", "true");
    expect(hoje.getByRole("checkbox", { name: "Marcar Tônico" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("fora-noite")).toHaveTextContent("Hoje não: Ácido glicólico (ter · sáb)");
    aba(/MEUS PRODUTOS/);
    const linha = screen.getAllByTestId("produto-meu").find((p) => within(p).queryByText("Batom Matte Vermelho"))!;
    expect(within(linha).getByText("vence 03/2027 (data impressa)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maquiagem 1" })).toBeInTheDocument();
  });
});
