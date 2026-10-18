/**
 * MEDIÇÃO TOTAL (1.0.16) — o agregador por sessão e a montagem da chave.
 *  - conta em memória e manda UM `uso_resumo` (segundo plano, saída, timer de 10 min, teto cheio);
 *  - dedupe do clique duplo do rótulo, teto de chaves com `fora`, sessão vazia não manda nada;
 *  - chave remota `medicao_total` (e a força de QA do navegador) desliga tudo;
 *  - a chave: data-track > data-tour/spotlight > aria-label/texto pela peneira > ícone > papel+posição,
 *    com folha (diálogo) e bloco (marcador, card com título do código, cabeçalho);
 *  - a peneira: texto que não está no código, ou que está nos dados da pessoa, nunca vira chave.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

const enviados = vi.hoisted(() => ({ normal: [] as Array<[string, Record<string, unknown>]>, beacon: [] as Array<[string, Record<string, unknown>]> }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { enviados.normal.push([n, d]); },
  trackEventBeacon: (n: string, d: Record<string, unknown> = {}) => { enviados.beacon.push([n, d]); },
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false, plataformaApp: () => "web", isIOS: () => false, isAndroid: () => false }));

import {
  _definirDicionario, _resumoAtual, _zerarMedicaoTotal, anotarAba, anotarTela, carregarDicionario, chaveDoToque, contarUso,
  descarregarResumo, guardarForcaMedicaoTotal, instalarMedicaoTotal, lerChaveRemotaMedicaoTotal, medicaoTotalLigada,
  registrarLeitorDosDados, registrarMedicaoTotalRemota, telaDaRota, textoSeguro, varrer,
} from "@/lib/medicao-total";

const DICIONARIO = [
  "PRONTO", "SALVAR", "ADICIONAR", "EDITAR NOME", "NOVO GASTO", "URGENCIAS", "BOA TARDE", "LEMBRETE DE CONTAS",
  "VALOR", "ABRIR", "MINHA CONTA", "ABA OCULTA", "CONFIGURACOES",
];

const montar = (html: string) => { document.body.innerHTML = html; };
const clicar = (sel: string | Element) => {
  const el = typeof sel === "string" ? document.querySelector(sel)! : sel;
  fireEvent.click(el);
};
const chave = (sel: string, tela = "home", aba: string | null = null) => chaveDoToque(document.querySelector(sel)!, tela, aba);

beforeEach(() => {
  _zerarMedicaoTotal();
  _definirDicionario(DICIONARIO);
  enviados.normal.length = 0;
  enviados.beacon.length = 0;
  localStorage.clear();
  document.body.innerHTML = "";
});
afterEach(() => { cleanup(); _zerarMedicaoTotal(); vi.useRealTimers(); });

describe("telas", () => {
  it("só as rotas do app contam; funil, site, login, admin e demo ficam de fora", () => {
    expect(telaDaRota("/home")).toBe("home");
    expect(telaDaRota("/financas?aba=x")).toBe("financas");
    expect(telaDaRota("/relacionamentos")).toBe("relacionamentos");
    expect(telaDaRota("/planos")).toBe("planos");
    for (const fora of ["/", "/inicio", "/app", "/auth", "/entrar", "/admin/uso", "/preview/financas", "/afiliado/token-secreto", "/comecar"]) {
      expect(telaDaRota(fora)).toBeNull();
    }
  });
});

describe("agregador da sessão", () => {
  it("conta toques em memória e manda UM uso_resumo no segundo plano (keepalive); a 2ª saída não repete", () => {
    instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0 });
    anotarTela("/home");
    montar(`<main><button id="a">Pronto</button><button id="b" data-track="acao:gasto">Gasto</button></main>`);
    clicar("#a"); clicar("#a"); clicar("#b");
    expect(enviados.beacon).toHaveLength(0); // nada sai por toque
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    expect(enviados.beacon).toHaveLength(1);
    const [nome, p] = enviados.beacon[0];
    expect(nome).toBe("uso_resumo");
    expect(p).toMatchObject({ v: 1, seq: 1, motivo: "fundo" });
    expect(p.n).toEqual({ "home||||PRONTO": 2, "home||||acao:gasto": 1 });
    expect(p.t).toEqual({ "home|": 1 });
    expect(enviados.normal).toHaveLength(0);
  });

  it("sessão vazia não manda nada; fora das telas do app nada conta", () => {
    instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0 });
    expect(descarregarResumo("teste")).toBeNull();
    anotarTela("/inicio");
    montar(`<button id="a">Pronto</button>`);
    clicar("#a");
    expect(descarregarResumo("teste")).toBeNull();
    expect(enviados.beacon).toHaveLength(0);
  });

  it("só tempo (voltou e saiu sem tocar) espera juntar 30 s; a aba de um módulo que não é a rota (demo) não conta", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
    instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0 });
    anotarTela("/home");
    expect(descarregarResumo("teste")).not.toBeNull(); // a entrada na Home (t) sai
    vi.advanceTimersByTime(10_000);
    expect(descarregarResumo("teste")).toBeNull(); // 10 s de tempo, nada mais: segura
    vi.advanceTimersByTime(25_000);
    expect(descarregarResumo("teste")!.s).toEqual({ "home|": 35 }); // juntou 35 s: sai tudo
    anotarTela("/inicio");
    anotarAba("financas", "dashboard"); // TrackedModule fora da rota do módulo (ex.: demo do funil)
    expect(_resumoAtual().t).toEqual({});
  });

  it("clique sintético (el.click() do código) não conta em produção", () => {
    instalarMedicaoTotal({ dedupeMs: 0 });
    anotarTela("/home");
    montar(`<button id="a">Pronto</button>`);
    clicar("#a");
    expect(_resumoAtual().n).toEqual({});
  });

  it("dedupe: dois cliques no mesmo instante (rótulo → input) contam 1; depois de 40 ms, conta de novo", () => {
    vi.useFakeTimers({ toFake: ["Date", "performance"] });
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
    instalarMedicaoTotal({ aceitarSinteticos: true });
    anotarTela("/home");
    montar(`<button id="a">Pronto</button>`);
    const ev = () => new MouseEvent("click", { bubbles: true });
    const a = document.querySelector("#a")!;
    a.dispatchEvent(ev()); a.dispatchEvent(ev());
    expect(_resumoAtual().n["home||||PRONTO"]).toBe(1);
    vi.advanceTimersByTime(100);
    a.dispatchEvent(ev());
    expect(_resumoAtual().n["home||||PRONTO"]).toBe(2);
  });

  it("teto: 300 chaves por envio; bateu, manda na hora (motivo cheio); de novo em < 2 min, o excesso vira `fora`", () => {
    instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0 });
    anotarTela("/home");
    for (let i = 0; i < 300; i++) contarUso(`x${i}`);
    expect(enviados.normal).toHaveLength(1);
    expect(enviados.normal[0][1]).toMatchObject({ motivo: "cheio" });
    expect(Object.keys(enviados.normal[0][1].n as object)).toHaveLength(300);
    for (let i = 0; i < 305; i++) contarUso(`y${i}`);
    expect(enviados.normal).toHaveLength(1);
    const p = descarregarResumo("teste")!;
    expect(Object.keys(p.n as object)).toHaveLength(300);
    expect(p.fora).toEqual({ n: 5 });
  });

  it("tempo por tela e aba (segundo plano para o relógio) e entradas por aba", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
    instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0 });
    anotarTela("/home");
    vi.advanceTimersByTime(5000);
    anotarTela("/rotina");
    anotarAba("rotina", "semana");
    vi.advanceTimersByTime(3000);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(60_000); // no fundo: não conta
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    const p = enviados.beacon[0][1];
    expect(p.t).toEqual({ "home|": 1, "rotina|": 1, "rotina|semana": 1 });
    expect(p.s).toEqual({ "home|": 5, "rotina|semana": 3 });
    expect(p.ms).toBe(8000);
  });

  it("sessão longa: com o app aberto, o resumo de 10 min sai sozinho pelo caminho normal", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
    instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0, tiqueMs: 1000, idadeMaxMs: 10 * 60_000 });
    anotarTela("/home");
    contarUso("algo");
    vi.advanceTimersByTime(9 * 60_000);
    expect(enviados.normal).toHaveLength(0);
    vi.advanceTimersByTime(61_000);
    expect(enviados.normal).toHaveLength(1);
    expect(enviados.normal[0][1]).toMatchObject({ motivo: "timer", seq: 1 });
    expect(enviados.beacon).toHaveLength(0);
  });

  it("toque antes do dicionário chegar fica guardado e conta quando ele chega (o do build de verdade)", async () => {
    _definirDicionario(null);
    instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0 });
    anotarTela("/home");
    montar(`<button id="a">Pronto</button>`);
    clicar("#a");
    expect(_resumoAtual().n).toEqual({});
    await carregarDicionario();
    expect(_resumoAtual().n).toEqual({ "home||||PRONTO": 1 });
  });
});

describe("chave remota medicao_total", () => {
  it("lê a metadata (a offering atual vence) e desliga tudo: nada conta, nada sai", () => {
    expect(lerChaveRemotaMedicaoTotal({ current: { metadata: { medicao_total: "off" } } })).toBe("off");
    expect(lerChaveRemotaMedicaoTotal({ current: { metadata: {} }, all: { b: { metadata: { medicao_total: "on" } } } })).toBe("on");
    expect(lerChaveRemotaMedicaoTotal({ current: { metadata: { medicao_total: "OFF" } }, all: { b: { metadata: { medicao_total: "on" } } } })).toBe("off");
    expect(lerChaveRemotaMedicaoTotal({ current: { metadata: { medicao_total: "talvez" } } })).toBeNull();
    expect(lerChaveRemotaMedicaoTotal(null)).toBeNull();

    instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0 });
    anotarTela("/home");
    expect(medicaoTotalLigada()).toBe(true); // padrão: ligada (app e web)
    montar(`<button id="a">Pronto</button>`);
    clicar("#a");
    registrarMedicaoTotalRemota({ current: { metadata: { medicao_total: "off" } } });
    expect(medicaoTotalLigada()).toBe(false);
    expect(_resumoAtual().n).toEqual({}); // desligou: o que estava contado não sai
    clicar("#a");
    expect(descarregarResumo("teste")).toBeNull();
    registrarMedicaoTotalRemota({ current: { metadata: { medicao_total: "on" } } });
    clicar("#a");
    expect(descarregarResumo("teste")!.n).toEqual({ "home||||PRONTO": 1 });
  });

  it("força de QA no navegador vence a remota (`?medicao-total=off`, `auto` apaga)", () => {
    registrarMedicaoTotalRemota({ current: { metadata: { medicao_total: "on" } } });
    guardarForcaMedicaoTotal("?medicao-total=off");
    expect(medicaoTotalLigada()).toBe(false);
    guardarForcaMedicaoTotal("?medicao-total=auto");
    expect(medicaoTotalLigada()).toBe(true);
  });
});

describe("a chave do controle", () => {
  it("data-track manda; depois data-tour/spotlight; depois aria-label e texto do código", () => {
    montar(`<main>
      <button id="t" data-track="acao:gasto">Pronto</button>
      <button id="s" data-spotlight="tab-financeiro">Financeiro</button>
      <button id="l" aria-label="Editar nome"><svg class="lucide lucide-pencil"></svg></button>
      <button id="x">Adicionar <span>3</span></button>
    </main>`);
    expect(chave("#t")).toBe("home||||acao:gasto");
    expect(chave("#s")).toBe("home||||tab-financeiro");
    expect(chave("#l")).toBe("home||||EDITAR NOME");
    expect(chave("#x")).toBe("home||||ADICIONAR");
  });

  it("texto que não é do código (ou mistura código + dado) nunca entra: cai pro ícone ou papel+posição", () => {
    montar(`<main>
      <button id="a" class="p-1">Excluir Zumbalaia</button>
      <button id="b" class="p-2"><span>Boa tarde</span><span>, Zumbalaia</span></button>
      <button id="c" aria-label="Excluir Zumbalaia"><svg class="lucide lucide-trash-2"></svg></button>
    </main>`);
    expect(chave("#a")).toBe("home||||botao#1");
    expect(chave("#b")).toBe("home||||botao#2");
    expect(chave("#c")).toBe("home||||icone:trash-2");
  });

  it("pedaço com menos de 3 letras some (número, R$, iniciais) — o resto precisa ser do código", () => {
    montar(`<main><button id="a"><span>JO</span></button><button id="b" class="x">Salvar <b>R$ 12,50</b></button></main>`);
    expect(chave("#a")).toBe("home||||botao#1");
    expect(chave("#b")).toBe("home||||SALVAR");
  });

  it("lista (irmãos iguais) vira @lista; posição só fora de lista", () => {
    montar(`<main><ul><li class="row"><button class="q"></button></li><li class="row"><button class="q"></button></li></ul>
      <button id="u" class="a"></button><button id="v" class="b"></button></main>`);
    expect(chave("li:nth-child(2) button")).toBe("home||||botao@lista");
    expect(chave("#u")).toBe("home||||botao#1");
    expect(chave("#v")).toBe("home||||botao#2");
  });

  it("campo: nunca o valor digitado — placeholder ou rótulo do código, senão papel", () => {
    montar(`<main><input id="a" class="v" value="Zumbalaia" placeholder="Valor"><input id="b" class="w" value="Zumbalaia"><label>Salvar<input id="c" type="checkbox"></label></main>`);
    expect(chave("#a")).toBe("home||||VALOR");
    expect(chave("#b")).toBe("home||||campo#2");
    expect(chave("#c")).toBe("home||||SALVAR"); // o rótulo associado (texto do código)
    expect(JSON.stringify([chave("#a"), chave("#b"), chave("#c")])).not.toMatch(/ZUMBALAIA/i);
  });

  it("chave (switch) sem texto: o texto da linha, se a linha não tiver outro controle", () => {
    montar(`<main><div class="linha"><span>Lembrete de contas</span><button id="s" role="switch"></button></div></main>`);
    expect(chave("#s")).toBe("home||||LEMBRETE DE CONTAS");
  });

  it("<div onClick> do React é controle; contêiner com 3+ controles (fundo da Home) não é", () => {
    render(<main>
      <div id="d" onClick={() => {}}>Abrir</div>
      <div id="fundo" onClick={() => {}}><p id="morto">texto</p><button>a</button><button>b</button><button>c</button></div>
    </main>);
    expect(chave("#d")).toBe("home||||ABRIR");
    expect(chave("#morto")).toBeNull();
  });

  it("folha: data-folha > título do diálogo (aria-labelledby) pela peneira; bloco: marcador > card com título do código > cabeçalho", () => {
    montar(`
      <header class="border-b"><button id="h" aria-label="Minha conta"></button></header>
      <div data-tour="score"><button id="sc" class="z"></button></div>
      <div class="rounded-xl border border-border"><h3>Urgências</h3><button id="u">Adicionar</button></div>
      <div class="rounded-xl border border-border"><h3>Zumbalaia</h3><button id="z">Adicionar</button></div>
      <div role="dialog" aria-labelledby="t1"><h2 id="t1">Novo gasto</h2><button id="d1">Salvar</button></div>
      <div data-folha="widgets"><div role="dialog" aria-labelledby="t2"><h2 id="t2">Novo gasto</h2><button id="d2">Salvar</button></div></div>`);
    expect(chave("#h")).toBe("home|||cabecalho|MINHA CONTA");
    expect(chave("#sc")).toBe("home|||score|botao#1");
    expect(chave("#u", "rotina", "semana")).toBe("rotina|semana||URGENCIAS|ADICIONAR");
    expect(chave("#z", "rotina", "semana")).toBe("rotina|semana|||ADICIONAR"); // card com título de dado: sem bloco
    expect(chave("#d1")).toBe("home||NOVO GASTO||SALVAR");
    expect(chave("#d2")).toBe("home||widgets||SALVAR");
  });

  it("peneira: texto do código que também é DADO da pessoa (sugestão que virou hábito) fica de fora", () => {
    const store = { "rotina-habits": [{ id: "h1", name: "Salvar" }], "finance-category-budgets": { "Urgências": 300 } };
    registrarLeitorDosDados(() => store);
    montar(`<main>
      <div class="rounded-xl border border-border"><h3>Urgências</h3><button id="a" class="k">Salvar</button><button id="b" class="j">Pronto</button></div>
    </main>`);
    expect(textoSeguro("Salvar")).toBeNull();
    expect(textoSeguro("Pronto")).toBe("PRONTO");
    expect(chave("#a")).toBe("home||||botao#1"); // nem "SALVAR" (dado) nem "URGENCIAS" (chave de objeto nos dados)
    expect(chave("#b")).toBe("home||||PRONTO");
    // o store mudou (a pessoa apagou o hábito): a peneira recalcula só a chave que mudou
    store["rotina-habits"] = [];
    registrarLeitorDosDados(() => ({ ...store }));
    expect(chave("#a")).toBe("home||||SALVAR");
  });
});

describe("folhas e blocos vistos", () => {
  it("folha aberta conta 1× enquanto está aberta (a de fora, com o nome do data-folha); reabrir conta de novo", () => {
    instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0 });
    anotarTela("/home");
    const abrir = () => {
      const d = document.createElement("div");
      d.setAttribute("data-folha", "widgets");
      d.innerHTML = `<div role="dialog" aria-labelledby="tt"><h2 id="tt">Novo gasto</h2></div>`;
      document.body.appendChild(d);
      return d;
    };
    const d = abrir();
    varrer(); varrer();
    expect(_resumoAtual().f).toEqual({ "home||widgets": 1 });
    d.remove(); varrer();
    abrir(); varrer();
    expect(_resumoAtual().f).toEqual({ "home||widgets": 2 });
  });

  it("etapa nova na MESMA folha (montar finanças/rotina troca o data-folha no elemento) conta como vista nova", () => {
    instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0 });
    anotarTela("/financas");
    const d = document.createElement("div");
    d.setAttribute("role", "dialog");
    d.setAttribute("data-folha", "montar-financas:renda");
    document.body.appendChild(d);
    varrer();
    d.setAttribute("data-folha", "montar-financas:contas");
    varrer(); varrer();
    expect(_resumoAtual().f).toEqual({ "financas||montar-financas:renda": 1, "financas||montar-financas:contas": 1 });
  });

  it("bloco explícito (data-tour/data-track-bloco) visto 1× por sessão; botão com data-tour não é bloco", () => {
    instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0 });
    anotarTela("/home");
    montar(`<div data-tour="score">x</div><div data-track-bloco="widget:habits">y</div><button data-tour="modulos-engrenagem"></button>`);
    varrer(); varrer();
    expect(_resumoAtual().b).toEqual({ "home||score": 1, "home||widget:habits": 1 });
  });
});
