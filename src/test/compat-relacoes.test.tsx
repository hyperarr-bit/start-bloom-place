/**
 * RELAÇÕES — COMPATIBILIDADE com o app antigo das lojas (30/09).
 *
 * Relações foi refeito (visual Correio, começo pronto, manter contato, avisos) e a web nova lê
 * e grava a MESMA nuvem que o app antigo (78883beb: iPhone 1.0.7/1.0.8, Android 125). Regra de
 * 28/09: chave que já existe nunca muda de tipo nem de forma; o novo lê o formato antigo.
 *
 * Os componentes ANTIGOS (PeoplePanel, DateCalendar, MomentsTimeline, GiftIdeas, EventLog) estão
 * congelados em ./app-antigo/relacionamentos e leem, no mesmo store, o que o módulo novo gravou.
 *
 *  1. abrir com dado antigo → tudo aparece, nada é gravado;
 *  2. começo pronto nunca entra na conta de quem já tem gente (1–2 pessoas: convite, sem gravar);
 *  3. gravar pelo novo → o antigo lê (sem quebrar);
 *  4. tipo preservado em toda chave que já existia;
 *  5. ida e volta: o antigo edita o que o novo gravou sem apagar campo novo, e o novo reabre.
 * Os interruptores de aviso NÃO entram aqui (vão sair da web: aviso só existe no app nativo).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, within, cleanup } from "@testing-library/react";
import Relacionamentos from "@/pages/Relacionamentos";
import { ehDiaValido } from "@/lib/relacoes";
import { PeoplePanel } from "./app-antigo/relacionamentos/PeoplePanel";
import { DateCalendar } from "./app-antigo/relacionamentos/DateCalendar";
import { MomentsTimeline } from "./app-antigo/relacionamentos/MomentsTimeline";
import { GiftIdeas } from "./app-antigo/relacionamentos/GiftIdeas";
import { EventLog } from "./app-antigo/relacionamentos/EventLog";
import { criarNuvem, formaDe, prepararJsdom, vigiarConsole, type Dados, type Nuvem } from "./compat-comum";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));

// quarta, 30/09/2026 10:00
const HOJE = "2026-09-30";
beforeAll(prepararJsdom);
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 8, 30, 10, 0)); });
// restoreAllMocks: solta o console.error do vigiarConsole mesmo se a tela quebrar no meio (os vi.fn dos mocks ficam como estão)
afterEach(() => { vi.useRealTimers(); cleanup(); vi.restoreAllMocks(); });

/* ───────────────────────── o dado ANTIGO (formatos de 78883beb) ───────────────────────── */

const MAE = "1725000000001";
const ANA = "1725000000002";
const LUCIA = "1725000000003";
const PEDRO = "1725000000004";

/** Como o app antigo grava: ids = Date.now() em texto, datas "AAAA-MM-DD", o vínculo com a pessoa pelo NOME. */
const ANTIGO: Dados = {
  "rel-people": [
    { id: MAE, name: "Mãe", relation: "Mãe", birthday: "1965-10-12", notes: "Gosta de orquídea" },
    { id: ANA, name: "Ana", relation: "Namorada", birthday: "1998-03-04", notes: "Ama café coado" },
    { id: LUCIA, name: "Dona Lúcia", relation: "Cliente", birthday: "", notes: "" },
    // cadastro de antes de 07/09: sem o campo `notes`
    { id: PEDRO, name: "Pedro", relation: "Amigo", birthday: "1990-10-05" },
  ],
  "rel-dates": [
    // o app antigo deixava repetir o aniversário que já está na pessoa
    { id: "1725100000001", title: "Aniversário da mãe", person: "Mãe", date: "2025-10-12", type: "birthday" },
    { id: "1725100000002", title: "1 ano de namoro", person: "Ana", date: "2025-10-20", type: "anniversary" },
    { id: "1725100000003", title: "Formatura", person: "", date: "2026-12-15", type: "custom" },
  ],
  "rel-moments": [
    { id: "1725200000001", date: "2026-09-27", person: "Ana", description: "Jantar surpresa em casa" },
    { id: "1725200000002", date: "2026-08-15", person: "Pedro", description: "Trilha no fim de semana" },
  ],
  "rel-gifts": [
    { id: "1725300000001", person: "Ana", idea: "Moka italiana", link: "amazon.com.br/moka", status: "idea" },
    { id: "1725300000002", person: "Mãe", idea: "Orquídea branca", link: "", status: "bought" },
  ],
  "rel-events": [
    { id: "1725400000001", name: "Churrasco do Pedro", date: "2026-10-04", location: "Casa do Pedro", rsvp: "confirmed", tasks: [{ id: "1725400000002", text: "Levar carvão", done: false }] },
    { id: "1725400000003", name: "Casamento da Ju", date: "2026-11-21", location: "", rsvp: "maybe", tasks: [] },
  ],
  // a central de notificações do app antigo: "Aniversário chegando" ligado (véspera, 10h)
  "notif-prefs": { aniversario: true, horaAniversario: 10, contas: true, horaContas: 9 },
};

type Pessoa = { id: string; name: string; relation: string; birthday: string; notes?: string; semAno?: boolean; circulo?: string; cadencia?: number; cadenciaDesde?: string };
type Evento = { id: string; name: string; date: string; location: string; rsvp: string; tasks: { id: string; text: string; done: boolean }[] };
const lista = <T,>(n: Nuvem, k: string) => (n.ler<T[]>(k) ?? []) as T[];
const pessoa = (n: Nuvem, nome: string) => lista<Pessoa>(n, "rel-people").find((p) => p.name === nome)!;
const abas = {
  pessoas: () => fireEvent.click(screen.getByRole("tab", { name: /PESSOAS/ })),
  datas: () => fireEvent.click(screen.getByRole("tab", { name: /DATAS/ })),
  presentes: () => fireEvent.click(screen.getByRole("tab", { name: /PRESENTES/ })),
  momentos: () => fireEvent.click(screen.getByRole("tab", { name: /MOMENTOS/ })),
};
const cartaoDoEvento = (nome: string) => screen.getAllByTestId("evento").find((e) => within(e).queryByText(nome)) as HTMLElement;

/* ───────────────────────── as ações do módulo NOVO ───────────────────────── */

/**
 * Tudo o que o módulo novo grava de novo: pessoa com aniversário SEM ano (ano 2000 + `semAno`),
 * frequência de contato + "Falei hoje" (momento `tipo: "conversa"`), presente com `preco`, data
 * de casal ligada à pessoa, evento com tarefa feita e um encontro.
 */
function gravarPeloNovo(nuvem: Nuvem) {
  const tela = nuvem.montar(<Relacionamentos />, "/relacionamentos");

  // 1) pessoa nova, aniversário sem ano
  fireEvent.click(screen.getByRole("button", { name: /Adicionar pessoa/ }));
  const folha = screen.getByTestId("folha-pessoa");
  fireEvent.change(within(folha).getByLabelText("Nome"), { target: { value: "Ju" } });
  fireEvent.change(within(folha).getByLabelText("Dia do aniversário"), { target: { value: "2" } });
  fireEvent.change(within(folha).getByLabelText("Mês do aniversário"), { target: { value: "10" } });
  fireEvent.change(within(folha).getByLabelText("Relação"), { target: { value: "Amiga da faculdade" } });
  fireEvent.click(within(folha).getByRole("button", { name: "Adicionar pessoa" }));
  const ju = pessoa(nuvem, "Ju");

  // 2) ficha do Pedro: lembrar de falar todo mês + "Falei hoje"
  fireEvent.click(screen.getByRole("button", { name: "Abrir Pedro" }));
  const ficha = screen.getByTestId("ficha-pessoa");
  fireEvent.click(within(ficha).getByRole("button", { name: "Todo mês" }));
  fireEvent.click(within(ficha).getByRole("button", { name: /Falei com Pedro hoje/ }));
  fireEvent.click(within(ficha).getByRole("button", { name: "Fechar" }));

  // 3) PRESENTES: ideia com preço pra Ju
  abas.presentes();
  const presente = screen.getByTestId("form-presente");
  fireEvent.change(within(presente).getByLabelText("Pra quem"), { target: { value: ju.id } });
  fireEvent.change(within(presente).getByLabelText("Preço"), { target: { value: "89,90" } });
  fireEvent.change(within(presente).getByLabelText("Ideia de presente"), { target: { value: "Vale de massagem" } });
  fireEvent.click(within(presente).getByRole("button", { name: /Guardar ideia/ }));

  // 4) DATAS: data de casal com a Ana; evento com uma tarefa (feita)
  abas.datas();
  fireEvent.click(screen.getByRole("button", { name: /Adicionar data especial/ }));
  const data = screen.getByTestId("form-data");
  fireEvent.change(within(data).getByLabelText("Nome da data"), { target: { value: "Casamento" } });
  fireEvent.change(within(data).getByLabelText("Data"), { target: { value: "2019-11-30" } });
  fireEvent.change(within(data).getByLabelText("Com quem"), { target: { value: ANA } });
  fireEvent.click(within(data).getByRole("button", { name: "Guardar data" }));
  fireEvent.click(screen.getByRole("button", { name: /Adicionar evento/ }));
  const evento = screen.getByTestId("form-evento");
  fireEvent.change(within(evento).getByLabelText("Evento"), { target: { value: "Chá de bebê da Lu" } });
  fireEvent.change(within(evento).getByLabelText("Data do evento"), { target: { value: "2026-10-18" } });
  fireEvent.change(within(evento).getByLabelText("Onde"), { target: { value: "Casa da Lu" } });
  fireEvent.click(within(evento).getByRole("button", { name: "Guardar evento" }));
  const cha = cartaoDoEvento("Chá de bebê da Lu");
  fireEvent.change(within(cha).getByLabelText("Nova tarefa de Chá de bebê da Lu"), { target: { value: "Comprar fralda" } });
  fireEvent.click(within(cha).getByRole("button", { name: "Adicionar tarefa" }));
  fireEvent.click(within(cartaoDoEvento("Chá de bebê da Lu")).getByRole("button", { name: /Comprar fralda/ }));

  // 5) MOMENTOS: um encontro com a Ana
  abas.momentos();
  const momento = screen.getByTestId("form-momento");
  fireEvent.click(within(momento).getByRole("button", { name: /Encontro/ }));
  fireEvent.change(within(momento).getByLabelText("Com quem"), { target: { value: ANA } });
  fireEvent.change(within(momento).getByLabelText("O que aconteceu"), { target: { value: "Cinema no sábado" } });
  fireEvent.click(within(momento).getByRole("button", { name: /Guardar/ }));
  return tela;
}

/** Os 5 componentes do app antigo (as 5 abas de antes), no mesmo store. */
const AppAntigo = () => (
  <>
    <section data-testid="antigo-pessoas"><PeoplePanel /></section>
    <section data-testid="antigo-agenda"><DateCalendar /></section>
    <section data-testid="antigo-momentos"><MomentsTimeline /></section>
    <section data-testid="antigo-presentes"><GiftIdeas /></section>
    <section data-testid="antigo-eventos"><EventLog /></section>
  </>
);
/** A linha de um item num componente antigo (todas as linhas deles têm a classe `group`). */
const linhaAntiga = (secao: string, texto: string) => within(within(screen.getByTestId(secao)).getByText(texto).closest(".group") as HTMLElement);

/* ═════════════════════════ 1. abrir com dado antigo ═════════════════════════ */

describe("1. abrir Relações novo com o dado do app antigo", () => {
  it("toda pessoa, data, evento, presente e momento aparece nas 4 abas — e nada é gravado", () => {
    const nuvem = criarNuvem(ANTIGO);
    nuvem.montar(<Relacionamentos />, "/relacionamentos");

    // PESSOAS: as 4, com o aniversário no dia certo (sem o -1 dia do UTC)
    const tabela = screen.getByTestId("lista-pessoas");
    for (const nome of ["Mãe", "Ana", "Dona Lúcia", "Pedro"]) expect(within(tabela).getByRole("button", { name: `Abrir ${nome}` })).toBeInTheDocument();
    for (const dia of ["12/10", "05/10", "04/03"]) expect(within(tabela).getByText(dia)).toBeInTheDocument();
    // o "Aniversário chegando" que a pessoa ligou na central do app antigo (notif-prefs) segue ligado lá;
    // na WEB não aparece linha de aviso nenhuma (30/09: lembrete só no app — ver relacoes-tela › avisos)
    expect(screen.queryByText(/Avisos ligados/)).not.toBeInTheDocument();
    // as notas antigas moram na ficha ("o que lembrar"); abrir e fechar não grava
    fireEvent.click(within(tabela).getByRole("button", { name: "Abrir Mãe" }));
    let ficha = screen.getByTestId("ficha-pessoa");
    expect(within(ficha).getByLabelText("O que lembrar sobre Mãe")).toHaveValue("Gosta de orquídea");
    expect(within(ficha).getByText("Orquídea branca")).toBeInTheDocument(); // presente ligado pelo NOME (dado antigo)
    fireEvent.click(within(ficha).getByRole("button", { name: "Fechar" }));
    // pessoa sem o campo `notes` (cadastro antigo) abre igual
    fireEvent.click(within(tabela).getByRole("button", { name: "Abrir Pedro" }));
    ficha = screen.getByTestId("ficha-pessoa");
    expect(within(ficha).getByLabelText("O que lembrar sobre Pedro")).toHaveValue("");
    expect(within(ficha).getByText(/Trilha no fim de semana/)).toBeInTheDocument();
    fireEvent.click(within(ficha).getByRole("button", { name: "Fechar" }));

    // DATAS: aniversários + datas especiais + eventos (a repetida da mãe aparece UMA vez; o dado fica)
    abas.datas();
    const datas = screen.getByTestId("lista-datas");
    for (const t of ["Mãe", "Ana", "Pedro", "1 ano de namoro", "Formatura"]) expect(within(datas).getByText(t)).toBeInTheDocument();
    expect(within(datas).queryByText("Aniversário da mãe")).not.toBeInTheDocument();
    expect(within(datas).getByText(/1 ano juntos/)).toBeInTheDocument();
    expect(within(cartaoDoEvento("Churrasco do Pedro")).getByText("Levar carvão")).toBeInTheDocument();
    expect(within(cartaoDoEvento("Churrasco do Pedro")).getByText("Vou")).toBeInTheDocument();
    expect(cartaoDoEvento("Casamento da Ju")).toBeInTheDocument();

    // PRESENTES e MOMENTOS
    abas.presentes();
    expect(screen.getByRole("button", { name: /Moka italiana: Ideia/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Orquídea branca: Comprado/ })).toBeInTheDocument();
    abas.momentos();
    expect(screen.getByText("Jantar surpresa em casa")).toBeInTheDocument();
    expect(screen.getByText("Trilha no fim de semana")).toBeInTheDocument();

    expect(nuvem.escritasDeDado()).toEqual([]);
    for (const k of Object.keys(ANTIGO)) expect(nuvem.estado.dados[k], k).toEqual(ANTIGO[k]);
  });

  it("links antigos (?aba=agenda, ?aba=eventos) abrem DATAS sem gravar nada", () => {
    for (const aba of ["agenda", "eventos"]) {
      const nuvem = criarNuvem(ANTIGO);
      const t = nuvem.montar(<Relacionamentos />, `/relacionamentos?aba=${aba}`);
      expect(screen.getByRole("tab", { name: /DATAS/ })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText("Churrasco do Pedro")).toBeInTheDocument();
      expect(nuvem.escritasDeDado()).toEqual([]);
      t.unmount();
    }
  });
});

/* ═════════════════════════ 2. começo pronto ═════════════════════════ */

describe("2. começo pronto nunca entra na conta de quem já tem gente", () => {
  it("com 3 pessoas ou mais: não aparece e nada é gravado", () => {
    const nuvem = criarNuvem(ANTIGO);
    nuvem.montar(<Relacionamentos />, "/relacionamentos");
    expect(screen.queryByTestId("comeco-pronto")).not.toBeInTheDocument();
    expect(nuvem.escritasDeDado()).toEqual([]);
  });

  it("com 1–2 pessoas: aparece como convite (com as que já existem contadas), nada é gravado sem toque", () => {
    const duas = { ...ANTIGO, "rel-people": (ANTIGO["rel-people"] as Pessoa[]).slice(0, 2) };
    const nuvem = criarNuvem(duas);
    nuvem.montar(<Relacionamentos />, "/relacionamentos");
    const comeco = screen.getByTestId("comeco-pronto");
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
    expect(within(comeco).getByRole("button", { name: "Mãe: já guardada" })).toBeDisabled();
    // a lista antiga continua na tela, embaixo
    expect(within(screen.getByTestId("lista-pessoas")).getByRole("button", { name: "Abrir Ana" })).toBeInTheDocument();
    expect(nuvem.escritasDeDado()).toEqual([]);
    // "Agora não" é um toque: grava só o "visto" (chave nova), nada nas pessoas
    fireEvent.click(within(comeco).getByRole("button", { name: "Agora não" }));
    expect(nuvem.escritasDeDado()).toEqual(["rel-comeco-visto"]);
    expect(nuvem.estado.dados["rel-people"]).toEqual(duas["rel-people"]);
  });

  it("conta vazia: aparece, não grava ao abrir (nem trocando de aba); só grava depois do toque", () => {
    const nuvem = criarNuvem({});
    nuvem.montar(<Relacionamentos />, "/relacionamentos");
    const comeco = () => screen.getByTestId("comeco-pronto");
    expect(within(comeco()).getByText("Quem você não pode esquecer?")).toBeInTheDocument();
    abas.datas(); abas.presentes(); abas.momentos(); abas.pessoas();
    expect(nuvem.escritasDeDado()).toEqual([]);
    fireEvent.click(within(comeco()).getByRole("button", { name: "Mãe" }));
    fireEvent.change(within(comeco()).getByLabelText("Dia do aniversário"), { target: { value: "12" } });
    fireEvent.change(within(comeco()).getByLabelText("Mês do aniversário"), { target: { value: "10" } });
    expect(nuvem.escritasDeDado()).toEqual([]);
    fireEvent.click(within(comeco()).getByRole("button", { name: "Guardar" }));
    expect(nuvem.escritasDeDado()).toEqual(["rel-people"]);
    expect(lista(nuvem, "rel-people")[0]).toMatchObject({ name: "Mãe", birthday: "2000-10-12", semAno: true });
  });
});

/* ═════════════════════════ 3. gravar pelo novo → o antigo lê ═════════════════════════ */

describe("3. o que Relações novo grava, o app antigo lê", () => {
  it("as ações do módulo novo gravam nos formatos de sempre (+ campos opcionais)", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem);
    const ju = pessoa(nuvem, "Ju");
    // sem ano: "AAAA-MM-DD" com o ano 2000 (o antigo lê normal) + a bandeira nova
    expect(ju).toMatchObject({ relation: "Amiga da faculdade", birthday: "2000-10-02", semAno: true, circulo: "amigos", notes: "" });
    expect(pessoa(nuvem, "Pedro")).toMatchObject({ birthday: "1990-10-05", cadencia: 30, cadenciaDesde: HOJE });
    const momentos = lista<Record<string, unknown>>(nuvem, "rel-moments");
    expect(momentos[0]).toMatchObject({ date: HOJE, person: "Ana", pessoaId: ANA, description: "Cinema no sábado", tipo: "encontro" });
    expect(momentos[1]).toMatchObject({ date: HOJE, person: "Pedro", pessoaId: PEDRO, description: "Conversamos", tipo: "conversa" });
    expect(lista(nuvem, "rel-gifts").at(-1)).toMatchObject({ person: "Ju", pessoaId: ju.id, idea: "Vale de massagem", link: "", status: "idea", preco: 89.9 });
    expect(lista(nuvem, "rel-dates").at(-1)).toMatchObject({ title: "Casamento", person: "Ana", pessoaId: ANA, date: "2019-11-30", type: "anniversary" });
    expect(lista<Evento>(nuvem, "rel-events").at(-1)).toMatchObject({
      name: "Chá de bebê da Lu", date: "2026-10-18", location: "Casa da Lu", rsvp: "maybe", tasks: [expect.objectContaining({ text: "Comprar fralda", done: true })],
    });
    // os avisos não foram tocados: notif-prefs igual ao do app antigo
    expect(nuvem.ler("notif-prefs")).toEqual(ANTIGO["notif-prefs"]);
  });

  it("os componentes do app antigo abrem sem erro e mostram a pessoa sem ano (dd/MM certo), a conversa, o presente, a data e o evento", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem).unmount();

    const vigia = vigiarConsole();
    nuvem.montar(<AppAntigo />);
    vigia.parar();
    expect(vigia.erros()).toEqual([]);

    // PeoplePanel: a Ju (ano 2000 + semAno) com 02/10, faltando 2 dias
    const ju = linhaAntiga("antigo-pessoas", "Ju");
    expect(ju.getByText("02/10")).toBeInTheDocument();
    expect(ju.getByText("2d")).toBeInTheDocument();
    expect(ju.getByText("Amiga da faculdade")).toBeInTheDocument();
    // DateCalendar: o aniversário da Ju e a data de casal nova, com a pessoa
    expect(linhaAntiga("antigo-agenda", "Aniversário de Ju").getByText("02/10")).toBeInTheDocument();
    const casamento = linhaAntiga("antigo-agenda", "Casamento");
    expect(casamento.getByText("30/11")).toBeInTheDocument();
    expect(casamento.getByText("Ana")).toBeInTheDocument();
    // MomentsTimeline: o "Falei hoje" e o encontro, com quem e quando
    const conversa = linhaAntiga("antigo-momentos", "Conversamos");
    expect(conversa.getByText("com Pedro")).toBeInTheDocument();
    expect(conversa.getByText("30/09/2026")).toBeInTheDocument();
    expect(linhaAntiga("antigo-momentos", "Cinema no sábado").getByText("com Ana")).toBeInTheDocument();
    // GiftIdeas: a ideia com preço aparece como "Ideia", pra Ju
    const presente = linhaAntiga("antigo-presentes", "Vale de massagem");
    expect(presente.getByText("Ju")).toBeInTheDocument();
    expect(presente.getByRole("button", { name: "Ideia" })).toBeInTheDocument();
    // EventLog: o evento novo com a tarefa feita
    const cha = linhaAntiga("antigo-eventos", "Chá de bebê da Lu");
    expect(cha.getByText("18/10/2026")).toBeInTheDocument();
    expect(cha.getByText("Casa da Lu")).toBeInTheDocument();
    expect(cha.getByText("1/1 tarefas")).toBeInTheDocument();
    expect(cha.getByRole("button", { name: /Talvez/ })).toBeInTheDocument();
  });
});

/* ═════════════════════════ 4. tipo preservado ═════════════════════════ */

describe("4. toda chave que já existia continua com o mesmo tipo e os itens antigos continuam lá", () => {
  it("formas, ids e os campos que o app antigo lê (o DateCalendar e o PeoplePanel formatam a data sem checar)", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem);
    const depois = nuvem.estado.dados;

    for (const k of Object.keys(ANTIGO)) expect(formaDe(depois[k]), k).toBe(formaDe(ANTIGO[k]));
    for (const k of ["rel-people", "rel-dates", "rel-moments", "rel-gifts", "rel-events"]) {
      const atuais = depois[k] as { id: string }[];
      for (const item of ANTIGO[k] as { id: string }[]) {
        expect(atuais.map((x) => x.id), k).toContain(item.id);
        // o que o novo não mexeu ficou idêntico (o Pedro ganhou só a frequência de contato)
        if (item.id !== PEDRO) expect(atuais.find((x) => x.id === item.id), `${k} ${item.id}`).toEqual(item);
      }
    }
    const { cadencia, cadenciaDesde, ...pedroDeSempre } = pessoa(nuvem, "Pedro");
    expect(pedroDeSempre).toEqual((ANTIGO["rel-people"] as Pessoa[])[3]);
    expect([cadencia, cadenciaDesde]).toEqual([30, HOJE]);
    expect(depois["notif-prefs"]).toEqual(ANTIGO["notif-prefs"]);

    for (const p of depois["rel-people"] as Record<string, unknown>[]) {
      for (const c of ["id", "name", "relation", "birthday"]) expect(typeof p[c], `${p.name}.${c}`).toBe("string");
      expect(p.birthday === "" || ehDiaValido(String(p.birthday)), `${p.name}.birthday`).toBe(true);
      expect(["string", "undefined"]).toContain(typeof p.notes);
    }
    for (const d of depois["rel-dates"] as Record<string, unknown>[]) {
      expect(ehDiaValido(String(d.date)), `${d.title}.date`).toBe(true); // sempre preenchida: o antigo faz format(parseLocalDay(date))
      expect(["birthday", "anniversary", "custom"]).toContain(d.type);
      for (const c of ["id", "title", "person"]) expect(typeof d[c]).toBe("string");
    }
    for (const m of depois["rel-moments"] as Record<string, unknown>[]) {
      for (const c of ["id", "date", "person", "description"]) expect(typeof m[c], `${m.description}.${c}`).toBe("string");
      expect(ehDiaValido(String(m.date))).toBe(true);
    }
    for (const g of depois["rel-gifts"] as Record<string, unknown>[]) {
      expect(["idea", "bought", "delivered"]).toContain(g.status); // o antigo faz statusLabels[status].color
      for (const c of ["id", "person", "idea", "link"]) expect(typeof g[c]).toBe("string");
      expect(["number", "undefined"]).toContain(typeof g.preco);
    }
    for (const e of depois["rel-events"] as Evento[]) {
      expect(["confirmed", "maybe", "declined"]).toContain(e.rsvp); // o antigo faz rsvpConfig[rsvp].icon
      expect(Array.isArray(e.tasks)).toBe(true); // o antigo faz tasks.filter
      for (const t of e.tasks) expect([typeof t.id, typeof t.text, typeof t.done]).toEqual(["string", "string", "boolean"]);
      expect(ehDiaValido(e.date)).toBe(true);
    }
  });
});

/* ═════════════════════════ 5. ida e volta ═════════════════════════ */

describe("5. ida e volta: o antigo edita o que o novo gravou, e o novo reabre certinho", () => {
  it("PeoplePanel/GiftIdeas/EventLog/MomentsTimeline antigos editam sem apagar semAno, círculo, frequência, preço e pessoaId", { timeout: 40_000 }, () => {
    const nuvem = criarNuvem(ANTIGO);
    gravarPeloNovo(nuvem).unmount();
    const juId = pessoa(nuvem, "Ju").id;

    const vigia = vigiarConsole();
    const antigo = nuvem.montar(<AppAntigo />);
    const pessoas = within(screen.getByTestId("antigo-pessoas"));
    fireEvent.click(pessoas.getByRole("button", { name: "Editar Ju" }));
    fireEvent.change(pessoas.getByLabelText("Notas"), { target: { value: "Adora spa" } });
    fireEvent.click(pessoas.getByRole("button", { name: "Salvar pessoa" }));
    fireEvent.click(pessoas.getByRole("button", { name: "Editar Pedro" }));
    fireEvent.change(pessoas.getByLabelText("Relação"), { target: { value: "Amigo de infância" } });
    fireEvent.click(pessoas.getByRole("button", { name: "Salvar pessoa" }));
    // GiftIdeas: a ideia com preço vira "Comprado"
    fireEvent.click(linhaAntiga("antigo-presentes", "Vale de massagem").getByRole("button", { name: "Ideia" }));
    // EventLog: desmarca a tarefa e troca a presença (maybe → declined)
    const cha = linhaAntiga("antigo-eventos", "Chá de bebê da Lu");
    fireEvent.click(within(cha.getByText("Comprar fralda").parentElement as HTMLElement).getByRole("button"));
    fireEvent.click(cha.getByRole("button", { name: /Talvez/ }));
    // MomentsTimeline: um momento com a Mãe (pelo nome, como sempre)
    const momentos = within(screen.getByTestId("antigo-momentos"));
    fireEvent.change(momentos.getByPlaceholderText("Com quem?"), { target: { value: "Mãe" } });
    fireEvent.change(momentos.getByPlaceholderText("O que aconteceu?"), { target: { value: "Almoço de domingo" } });
    fireEvent.click(momentos.getByRole("button", { name: /Registrar momento/ }));
    antigo.unmount();
    vigia.parar();
    expect(vigia.erros()).toEqual([]);

    expect(pessoa(nuvem, "Ju")).toMatchObject({ notes: "Adora spa", birthday: "2000-10-02", semAno: true, circulo: "amigos" });
    expect(pessoa(nuvem, "Pedro")).toMatchObject({ relation: "Amigo de infância", cadencia: 30, cadenciaDesde: HOJE });
    expect(lista(nuvem, "rel-gifts").find((g) => (g as { idea: string }).idea === "Vale de massagem")).toMatchObject({ status: "bought", preco: 89.9, pessoaId: juId });
    expect(lista<Evento>(nuvem, "rel-events").find((e) => e.name === "Chá de bebê da Lu")).toMatchObject({
      rsvp: "declined", location: "Casa da Lu", tasks: [expect.objectContaining({ text: "Comprar fralda", done: false })],
    });
    expect(lista(nuvem, "rel-moments")[0]).toMatchObject({ person: "Mãe", description: "Almoço de domingo", date: HOJE });

    // o módulo novo reabre com tudo no lugar
    nuvem.montar(<Relacionamentos />, "/relacionamentos");
    const tabela = screen.getByTestId("lista-pessoas");
    expect(within(within(tabela).getByRole("button", { name: "Abrir Ju" })).getByText("02/10")).toBeInTheDocument();
    expect(within(tabela).getByText("Amigo de infância")).toBeInTheDocument();
    fireEvent.click(within(tabela).getByRole("button", { name: "Abrir Ju" }));
    let ficha = screen.getByTestId("ficha-pessoa");
    expect(within(ficha).getByLabelText("O que lembrar sobre Ju")).toHaveValue("Adora spa");
    expect(within(ficha).getByText("R$ 89,90")).toBeInTheDocument();
    expect(within(ficha).queryByText(/faz \d+/)).not.toBeInTheDocument(); // sem ano: sem idade
    fireEvent.click(within(ficha).getByRole("button", { name: "Fechar" }));
    fireEvent.click(within(tabela).getByRole("button", { name: "Abrir Pedro" }));
    ficha = screen.getByTestId("ficha-pessoa");
    expect(within(ficha).getByRole("button", { name: "Todo mês" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(ficha).getByRole("button", { name: "Fechar" }));
    // o momento que o app antigo gravou conta como a última conversa com a Mãe
    fireEvent.click(within(tabela).getByRole("button", { name: "Abrir Mãe" }));
    expect(within(screen.getByTestId("ficha-pessoa")).getByText("última conversa hoje")).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("ficha-pessoa")).getByRole("button", { name: "Fechar" }));

    abas.presentes();
    expect(screen.getByRole("button", { name: /Vale de massagem: Comprado/ })).toBeInTheDocument();
    abas.datas();
    const cartao = within(cartaoDoEvento("Chá de bebê da Lu"));
    expect(cartao.getByText("Não vou")).toBeInTheDocument();
    expect(cartao.getByRole("button", { name: /Comprar fralda/ })).toHaveAttribute("aria-pressed", "false");
    abas.momentos();
    expect(screen.getByText("Almoço de domingo")).toBeInTheDocument();
    expect(nuvem.ler("notif-prefs")).toEqual(ANTIGO["notif-prefs"]);
  });
});

/* ═════════════════════════ achados (eram it.fails; consertados em 30/09 — ver o relatório da integração) ═════════════════════════ */

describe("achados de compatibilidade — consertados na integração de 30/09 (eram it.fails)", () => {
  /*
   * BUG — `semAno` fica velho: a pessoa guardada SEM ano (birthday "2000-MM-DD" + semAno) ganha
   * o ano de verdade no PeoplePanel antigo (que só conhece `birthday` e preserva o resto com
   * `...p`). O novo continua lendo `semAno: true` (src/lib/relacoes.ts:126, `semAno: p.semAno === true`)
   * e esconde a idade para sempre ("faz 30" nunca aparece).
   */
  it("pessoa 'sem ano' que ganha o ano no app antigo: o app novo passa a mostrar a idade", () => {
    const comJu = { ...ANTIGO, "rel-people": [...(ANTIGO["rel-people"] as Pessoa[]), { id: "1727000000009", name: "Ju", relation: "Amiga", birthday: "2000-10-02", notes: "", semAno: true, circulo: "amigos" }] };
    const nuvem = criarNuvem(comJu);
    const antigo = nuvem.montar(<PeoplePanel />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Ju" }));
    fireEvent.change(screen.getByLabelText("Aniversário"), { target: { value: "1996-10-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar pessoa" }));
    antigo.unmount();
    expect(pessoa(nuvem, "Ju")).toMatchObject({ birthday: "1996-10-02" });

    nuvem.montar(<Relacionamentos />, "/relacionamentos?aba=agenda");
    expect(within(screen.getByTestId("lista-datas")).getByText(/faz 30/)).toBeInTheDocument();
  });
});
