/**
 * Varredura da demo 26/09 — CASA + DIETA, as contas (puras).
 * Fuso do Brasil ANTES de qualquer Date: os bugs de "1 dia antes" só existem
 * a oeste de Greenwich.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import {
  CATEGORIAS_PADRAO_MERCADO, ID_CATEGORIA_DIETA, adicionarDaDespensa, alternarItemMercado, devolverADespensa,
  enviarParaMercado, mesmoNome, precisaReparar, repararCategorias, retirarDaDespensa,
  type CategoriaMercado, type ItemDespensa,
} from "@/lib/mercado";
import { brl, dataBR, diaLocal, diasDeGarantia, linkWhatsApp, mesCurtoBR, numeroWhatsApp, ROTULO_CONSUMO } from "@/components/casa/formatos";
import { alternarLimpeza, chaveDoPeriodo, feitoNoPeriodo, periodoDaSecao, renovarRotina, type SecaoLimpeza } from "@/components/casa/rotina-limpeza";
import { fotografarDias, itensDoCardapio, limparItem, primeiraMaiuscula, restaurarDias, statusAderencia } from "@/components/dieta/cardapio";

const soDieta = (): CategoriaMercado[] => [{ id: ID_CATEGORIA_DIETA, name: "Dieta", emoji: "🥗", color: "bg-green-500", items: [{ id: "a", text: "Aveia", done: false }] }];
const nomes = (l: CategoriaMercado[]) => l.map((c) => c.name);
const itensDe = (l: CategoriaMercado[], cat: string) => l.find((c) => c.name === cat)?.items ?? [];

describe("lib/mercado: categorias padrão e o reparo de quem ficou só com a 'Dieta'", () => {
  it("o padrão tem as 9 categorias, sem itens", () => {
    expect(nomes(CATEGORIAS_PADRAO_MERCADO)).toEqual([
      "HortiFrutti", "Açougue e Peixaria", "Laticínios e Frios", "Mercearia", "Padaria", "Congelados", "Limpeza", "Higiene Pessoal", "Bebidas",
    ]);
    expect(CATEGORIAS_PADRAO_MERCADO.every((c) => c.items.length === 0)).toBe(true);
  });

  it("só a 'Dieta' = precisa reparar; o reparo põe as 9 na frente e mantém os itens da Dieta", () => {
    expect(precisaReparar(soDieta())).toBe(true);
    const r = repararCategorias(soDieta());
    expect(r).toHaveLength(10);
    expect(nomes(r).slice(0, 9)).toEqual(nomes(CATEGORIAS_PADRAO_MERCADO));
    expect(itensDe(r, "Dieta").map((i) => i.text)).toEqual(["Aveia"]);
    expect(precisaReparar(r)).toBe(false);
  });

  it("lista normal, vazia ou torta não é 'reparada'", () => {
    expect(precisaReparar(CATEGORIAS_PADRAO_MERCADO)).toBe(false);
    expect(precisaReparar([])).toBe(false);
    expect(precisaReparar(null)).toBe(false);
    expect(precisaReparar("lixo")).toBe(false);
    expect(repararCategorias(CATEGORIAS_PADRAO_MERCADO)).toEqual(CATEGORIAS_PADRAO_MERCADO);
  });

  it("enviarParaMercado com o Mercado nunca aberto parte das 9 e não repete", () => {
    const { lista, novos } = enviarParaMercado(undefined, ["Aveia", " aveia ", "Banana"]);
    expect(novos).toBe(2);
    expect(lista).toHaveLength(10);
    expect(itensDe(lista, "Dieta").map((i) => i.text)).toEqual(["Aveia", "Banana"]);
    const de2 = enviarParaMercado(lista, ["AVEIA", "Maçã"]);
    expect(de2.novos).toBe(1);
    expect(itensDe(de2.lista, "Dieta").map((i) => i.text)).toEqual(["Aveia", "Banana", "Maçã"]);
  });

  it("mesmoNome ignora caixa, acento e espaço", () => {
    expect(mesmoNome(" Feijão ", "feijao")).toBe(true);
    expect(mesmoNome("Leite", "Leite condensado")).toBe(false);
  });
});

describe("lib/mercado: Despensa → Mercado (o 'Acabou')", () => {
  it("vai pro corredor do canto de origem, com a origem guardada", () => {
    const { lista, entrou, categoria } = adicionarDaDespensa(undefined, "Leite", "geladeira", 1);
    expect(entrou).toBe(true);
    expect(categoria).toBe("Laticínios e Frios");
    expect(itensDe(lista, "Laticínios e Frios")).toEqual([{ id: "desp-1", text: "Leite", done: false, origem: "geladeira" }]);
    expect(adicionarDaDespensa(lista, "Detergente", "limpeza").categoria).toBe("Limpeza");
    expect(adicionarDaDespensa(lista, "Sabonete", "banheiro").categoria).toBe("Higiene Pessoal");
    expect(adicionarDaDespensa(lista, "Arroz", "armario").categoria).toBe("Mercearia");
  });

  it("sem o corredor certo cai na Mercearia; sem a Mercearia, ela volta", () => {
    const semLaticinios = CATEGORIAS_PADRAO_MERCADO.filter((c) => c.name !== "Laticínios e Frios");
    expect(adicionarDaDespensa(semLaticinios, "Leite", "geladeira").categoria).toBe("Mercearia");
    const soBebidas = CATEGORIAS_PADRAO_MERCADO.filter((c) => c.name === "Bebidas");
    const r = adicionarDaDespensa(soBebidas, "Leite", "geladeira", 7);
    expect(r.categoria).toBe("Mercearia");
    expect(nomes(r.lista)).toEqual(["Bebidas", "Mercearia"]);
    expect(itensDe(r.lista, "Mercearia")[0]).toMatchObject({ text: "Leite", origem: "geladeira" });
  });

  it("não duplica: já pendente (em qualquer categoria) só ganha a origem", () => {
    const base = CATEGORIAS_PADRAO_MERCADO.map((c) => (c.name === "Mercearia" ? { ...c, items: [{ id: "m", text: "leite", done: false }] } : c));
    const r = adicionarDaDespensa(base, "Leite", "geladeira");
    expect(r.entrou).toBe(false);
    expect(r.categoria).toBe("Mercearia");
    expect(r.lista.flatMap((c) => c.items)).toEqual([{ id: "m", text: "leite", done: false, origem: "geladeira" }]);
    // já comprado (✓) não conta como pendente: entra de novo
    const comprado = CATEGORIAS_PADRAO_MERCADO.map((c) => (c.name === "Mercearia" ? { ...c, items: [{ id: "m", text: "Leite", done: true }] } : c));
    expect(adicionarDaDespensa(comprado, "Leite", "geladeira").entrou).toBe(true);
  });

  it("comprar devolve pro canto de origem; desmarcar tira; marcar/desmarcar/marcar deixa UM só", () => {
    let cats = adicionarDaDespensa(undefined, "Leite", "geladeira", 1).lista;
    const cat = cats.find((c) => c.name === "Laticínios e Frios")!;
    let despensa: ItemDespensa[] = [];
    for (let n = 0; n < 3; n++) {
      const r = alternarItemMercado(cats, despensa, cat.id, "desp-1", 100 + n);
      cats = r.categorias;
      despensa = r.despensa;
    }
    expect(despensa).toHaveLength(1);
    expect(despensa[0]).toMatchObject({ name: "Leite", category: "geladeira", status: "cheio" });
    expect(itensDe(cats, "Laticínios e Frios")[0]).toMatchObject({ done: true, devolvidoId: despensa[0].id });
    const r = alternarItemMercado(cats, despensa, cat.id, "desp-1");
    expect(r.despensa).toHaveLength(0);
    expect(itensDe(r.categorias, "Laticínios e Frios")[0].devolvidoId).toBeUndefined();
  });

  it("item digitado no Mercado (sem origem) não mexe na despensa; já na despensa não duplica", () => {
    const cats = CATEGORIAS_PADRAO_MERCADO.map((c) => (c.id === "4" ? { ...c, items: [{ id: "x", text: "Arroz", done: false }] } : c));
    const r = alternarItemMercado(cats, [], "4", "x");
    expect(r.despensa).toEqual([]);
    expect(r.voltou).toBeUndefined();
    const ja: ItemDespensa[] = [{ id: "p", name: "leite", category: "geladeira", status: "acabando" }];
    expect(devolverADespensa(ja, "Leite", "geladeira")).toEqual({ despensa: ja });
    expect(retirarDaDespensa(ja, undefined)).toBe(ja);
  });
});

describe("Casa: datas no dia LOCAL", () => {
  it("'2026-09-26' é 26/09 no Brasil (o new Date() dava 25/09)", () => {
    expect(new Date("2026-09-26").toLocaleDateString("pt-BR")).toBe("25/09/2026"); // o bug, pra provar o fuso
    expect(dataBR("2026-09-26")).toBe("26/09/2026");
    expect(dataBR("")).toBe("");
    expect(diaLocal("lixo")).toBeNull();
  });

  it("garantia sem data de compra não tem status (era 'Expirada')", () => {
    expect(diasDeGarantia("", 12)).toBeNull();
    const hoje = new Date(2026, 8, 26, 15, 0);
    expect(diasDeGarantia("2026-09-26", 12, hoje)).toBe(365);
    expect(diasDeGarantia("2026-08-27", 1, hoje)).toBe(1);
    expect(diasDeGarantia("2020-01-01", 12, hoje)).toBe(0);
  });
});

describe("Casa: WhatsApp e consumo", () => {
  it("número com +55 não vira 5555…", () => {
    expect(numeroWhatsApp("+55 (11) 99999-8888")).toBe("5511999998888");
    expect(numeroWhatsApp("55 11 99999-8888")).toBe("5511999998888");
    expect(numeroWhatsApp("(11) 99999-8888")).toBe("5511999998888");
    expect(numeroWhatsApp("11 3333-4444")).toBe("551133334444");
    expect(numeroWhatsApp("011 99999-8888")).toBe("5511999998888");
    // DDD 55 (RS) sem DDI: 11 dígitos começando com 55 ainda leva o DDI
    expect(numeroWhatsApp("(55) 99999-8888")).toBe("5555999998888");
    expect(numeroWhatsApp("+1 415 555 0100")).toBe("14155550100");
    expect(numeroWhatsApp("")).toBeNull();
    expect(numeroWhatsApp("123")).toBeNull();
    expect(linkWhatsApp("+55 (11) 99999-8888")).toBe("https://wa.me/5511999998888");
    expect(linkWhatsApp("")).toBeNull();
  });

  it("mês 'set/2026', dinheiro em real e nomes com acento", () => {
    expect(mesCurtoBR("2026-09")).toBe("set/2026");
    expect(mesCurtoBR("2026-12")).toBe("dez/2026");
    expect(mesCurtoBR("torto")).toBe("torto");
    expect(brl(150.5).replace(/\s/g, " ")).toBe("R$ 150,50");
    expect(brl("1.234,5").replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(ROTULO_CONSUMO).toMatchObject({ agua: "Água", gas: "Gás", luz: "Luz", internet: "Internet" });
  });
});

describe("Casa: rotina de limpeza zera no período", () => {
  const secao = (name: string, items: SecaoLimpeza["items"]): SecaoLimpeza => ({ id: name, name, color: "", items });

  it("o período sai do nome da seção", () => {
    expect(periodoDaSecao("LIMPEZA DIÁRIA")).toBe("dia");
    expect(periodoDaSecao("LIMPEZA SEMANAL")).toBe("semana");
    expect(periodoDaSecao("LIMPEZA QUINZENAL")).toBe("quinzena");
    expect(periodoDaSecao("LIMPEZA MENSAL")).toBe("mes");
    expect(periodoDaSecao("FAXINA PESADA")).toBeNull();
  });

  it("semana começa na segunda; quinzena é 1–15 e 16–fim", () => {
    expect(chaveDoPeriodo("semana", new Date(2026, 8, 27))).toBe("2026-09-21"); // domingo → segunda 21
    expect(chaveDoPeriodo("semana", new Date(2026, 8, 28))).toBe("2026-09-28");
    expect(chaveDoPeriodo("quinzena", new Date(2026, 8, 15))).toBe("2026-09-1");
    expect(chaveDoPeriodo("quinzena", new Date(2026, 8, 16))).toBe("2026-09-2");
  });

  it("marcado 23:57 não vale mais 00:07 do dia seguinte (diária); a semanal segue valendo", () => {
    const marcado = alternarLimpeza({ id: "1", text: "Louça", done: false }, "dia", new Date(2026, 8, 26, 23, 57));
    expect(marcado).toEqual({ id: "1", text: "Louça", done: true, doneOn: "2026-09-26" });
    const madrugada = new Date(2026, 8, 27, 0, 7);
    expect(feitoNoPeriodo(marcado, "dia", new Date(2026, 8, 26, 23, 59))).toBe(true);
    expect(feitoNoPeriodo(marcado, "dia", madrugada)).toBe(false);
    expect(feitoNoPeriodo(marcado, "semana", madrugada)).toBe(true); // sáb 26 e dom 27 = mesma semana
    expect(feitoNoPeriodo(marcado, "semana", new Date(2026, 8, 28))).toBe(false);
    expect(feitoNoPeriodo(marcado, "mes", new Date(2026, 9, 1))).toBe(false);
    expect(feitoNoPeriodo(marcado, null, new Date(2030, 0, 1))).toBe(true);
    // ✓ vencido na tela aparece desmarcado → tocar MARCA de novo (não desmarca)
    expect(alternarLimpeza(marcado, "dia", madrugada)).toMatchObject({ done: true, doneOn: "2026-09-27" });
  });

  it("renovarRotina zera o vencido, carimba o antigo sem data e não mexe no resto", () => {
    const hoje = new Date(2026, 8, 27, 8, 0);
    const secoes = [
      secao("LIMPEZA DIÁRIA", [
        { id: "a", text: "Louça", done: true, doneOn: "2026-09-26" },
        { id: "b", text: "Cama", done: true }, // formato antigo
        { id: "c", text: "Lixo", done: false, doneOn: "2026-09-20" },
      ]),
      secao("FAXINA PESADA", [{ id: "d", text: "Vidros", done: true }]),
    ];
    const r = renovarRotina(secoes, hoje);
    expect(r[0].items).toEqual([
      { id: "a", text: "Louça", done: false },
      { id: "b", text: "Cama", done: true, doneOn: "2026-09-27" },
      { id: "c", text: "Lixo", done: false },
    ]);
    expect(r[1]).toBe(secoes[1]);
    expect(renovarRotina(r, hoje)).toBe(r); // nada a fazer = mesma lista (não grava à toa)
  });
});

describe("Dieta: lista do cardápio", () => {
  const plano = [
    "2 ovos mexidos (100g) • 1 fatia de pão integral • 100g de mamão ou melão",
    "120g de frango grelhado • 100g de arroz • feijão • 200g de vegetais variados",
    "160g de iogurte natural • 100g de morangos • 15g de whey ou aveia",
    "120g de patinho moído ou tilápia • 150g de abóbora ou batata-doce • salada à vontade",
    "Refeição livre 😌 — com consciência",
    "120g de frango grelhado • 100g de arroz integral • salada colorida",
  ];

  it("separa por •, tira gramas/quantidade, ignora 'Refeição livre' e não repete", () => {
    expect(itensDoCardapio(plano)).toEqual([
      "Ovos mexidos", "Pão integral", "Mamão ou melão",
      "Frango grelhado", "Arroz", "Feijão", "Vegetais variados",
      "Iogurte natural", "Morangos", "Whey ou aveia",
      "Patinho moído ou tilápia", "Abóbora ou batata-doce", "Salada",
      "Arroz integral", "Salada colorida",
    ]);
  });

  it("vírgula, quebra de linha e ingredientes de receita; decimal não é separador", () => {
    expect(itensDoCardapio(["1 banana, 2 ovos, aveia, canela", "3 col sopa de aveia\n1 scoop whey", "1,5 kg de batata + 2 gemas"]))
      .toEqual(["Banana", "Ovos", "Aveia", "Canela", "Whey", "Batata", "Gemas"]);
  });

  it("o que já está na lista (mesmo em minúsculas, do jeito antigo) não entra de novo", () => {
    expect(itensDoCardapio(["120g de frango grelhado • feijão"], ["frango grelhado"])).toEqual(["Feijão"]);
  });

  it("limparItem e a 1ª maiúscula", () => {
    expect(limparItem("Refeição livre")).toBeNull();
    expect(limparItem("  —  ")).toBeNull();
    expect(limparItem("1 litro de leite")).toBe("Leite");
    expect(limparItem("frango 150g")).toBe("Frango");
    expect(primeiraMaiuscula("pão de queijo")).toBe("Pão de queijo");
    expect(primeiraMaiuscula("ômega 3")).toBe("Ômega 3");
  });
});

describe("Dieta: aderência e desfazer cópia", () => {
  const plan = ["Café", "Almoço", "Janta"];
  it("1 seguida de 3 é PARCIAL (era ❌); ❌ só com 'não segui'", () => {
    expect(statusAderencia(plan, {})).toEqual({ status: "vazio", seguidas: 0, total: 3 });
    expect(statusAderencia(plan, { Café: { followed: true } })).toEqual({ status: "parcial", seguidas: 1, total: 3 });
    expect(statusAderencia(plan, { Café: { followed: true }, Almoço: { followed: false } }).status).toBe("furou");
    expect(statusAderencia(plan, { Café: { followed: true }, Almoço: { followed: true }, Janta: { followed: true } }).status).toBe("tudo");
    expect(statusAderencia([], { Café: { followed: true } }).status).toBe("vazio");
    // refeição do diário que não está no plano não conta
    expect(statusAderencia(["Café"], { Ceia: { followed: false } }).status).toBe("vazio");
  });

  it("foto + restauração devolve exatamente os dias (quem não existia volta a não existir)", () => {
    const antes = { SEGUNDA: { Almoço: "A" }, TERÇA: { Almoço: "B" } } as Record<string, Record<string, string>>;
    const foto = fotografarDias(antes, ["TERÇA", "QUARTA"]);
    const depois = { ...antes, TERÇA: { Almoço: "A" }, QUARTA: { Almoço: "A" } };
    expect(restaurarDias(depois, foto)).toEqual(antes);
  });
});
