/**
 * ONDE A MISSÃO APONTA, POR ÁREA (demo guiada, 28/09).
 *
 * As âncoras são as MESMAS da tabela ALVO da Missão do teste grátis
 * (src/components/missao/MissaoDoTrial.tsx): add-expense, add-habit,
 * add-exercise, add-water, add-goal — com a aba de cada uma como reserva. A
 * tabela é espelhada aqui (e não importada) porque a Missão é do app nativo e
 * as frases dela falam do "Dia 1"; errar aqui é inofensivo: fail-open.
 *
 * Pra cada área:
 *   · passo 2 (ANOTAR): onde fica o botão de adicionar, a frase da faixa e do
 *     balão, a chave que o módulo grava e como achar o item NOVO nela;
 *   · passo 3 (OLHAR): o resumo que recalculou e o número que sobe.
 */
import { normalizarItem, type ItemDaDemo, type TipoDoItem } from "@/lib/demo-guiada";
import { localDayKey } from "@/lib/utils";

/**
 * Os tempos da missão. As duas comemorações duram o mesmo que as da Missão do
 * teste grátis no app (MissaoDoTrial: 2,8 s o 1º registro, 3,6 s a missão
 * cumprida). Objeto (e não constantes soltas) só pra os testes encurtarem.
 */
export const TEMPOS_DA_MISSAO = {
  /** a faixa fica em 1/3 ("área escolhida ✓") antes de a demo andar sozinha até o botão */
  antesDoHolofote: 1200,
  /** "Primeiro registro feito!" */
  primeiroRegistro: 2800,
  /** holofote no resumo que recalculou, com o número subindo */
  olhar: 4500,
  /** "Missão cumprida 🏆" */
  cumprida: 3600,
};

export interface Numero {
  titulo: string;
  antes: number;
  depois: number;
  formatar: (n: number) => string;
}

export interface AlvoDaMissao {
  /** Em ordem: o 1º que existir. `aba` = aba do módulo (a missão toca nela sozinha). */
  passos: Array<{ seletor: string; aba?: boolean }>;
  /** O anel abraça a linha inteira quando a linha tem o campo de digitar. */
  anel?: (el: Element) => Element;
  /** Faixa: "Agora: …". */
  pedido: string;
  /** Faixa depois do registro: pra onde olhar. */
  olhe: string;
  /** Balão do holofote. */
  dica: string;
  chave: string;
  /** O item novo = o que está em `valor` e não estava em `anterior`. */
  achar: (valor: unknown, anterior: unknown) => ItemDaDemo | null;
  /** Os números do passo 3 (antes → depois). Lido na hora do registro, antes de a tela redesenhar. */
  numero: (valor: unknown, anterior: unknown, item: ItemDaDemo) => Numero | null;
  /** Passo 3: o resumo que recalculou (sem âncora → pula direto pra folha). */
  olhar?: { seletor: string; recorte?: (el: Element) => Retangulo | null; perto?: (el: Element) => Element | null };
  /** Folha "Missão cumprida": a frase do meio. */
  cumprida: (item: ItemDaDemo) => { titulo: string; sub: string };
}

const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const mapa = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const reaisInteiros = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** Linha do formulário (campo + botão): o anel abraça ela toda, não só o "+". */
const linhaComCampo = (el: Element): Element => (el.parentElement?.querySelector("input") ? el.parentElement : el);

/** Retângulo simples (sem `new DOMRect`: WebView antigo não tem o construtor). */
export interface Retangulo { top: number; left: number; width: number; height: number; bottom: number }

/** Retângulo que junta os primeiros filhos (ex.: cabeçalho + resumo de um card alto). */
const juntarFilhos = (quantos: number) => (el: Element): Retangulo | null => {
  const filhos = Array.from(el.children).slice(0, quantos);
  if (!filhos.length) return null;
  const rs = filhos.map((f) => f.getBoundingClientRect());
  const top = Math.min(...rs.map((r) => r.top));
  const bottom = Math.max(...rs.map((r) => r.bottom));
  const left = Math.min(...rs.map((r) => r.left));
  const right = Math.max(...rs.map((r) => r.right));
  return { top, left, width: right - left, height: bottom - top, bottom };
};

/** O card em volta de um elemento (a moldura arredondada mais próxima ACIMA dele —
 *  o próprio botão também é arredondado, e o anel tem que abraçar o card). */
const cardEmVolta = (el: Element): Element | null =>
  el.parentElement?.closest(".rounded-2xl, .rounded-xl") ?? el.parentElement;

/** "↓ Saiu R$ 3.718" do MEU MÊS → 3718. */
export const lerReais = (texto: string | null | undefined): number | null => {
  const m = (texto ?? "").match(/R\$\s*([\d.]+(?:,\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const saiuDoMes = (): number | null => {
  const card = document.querySelector('[data-spotlight="add-bill"]');
  const chip = card && Array.from(card.querySelectorAll("span")).find((s) => /^\s*↓?\s*Saiu\b/.test(s.textContent ?? ""));
  return chip ? lerReais(chip.textContent) : null;
};

const ALVOS: Record<TipoDoItem, AlvoDaMissao> = {
  gasto: {
    passos: [{ seletor: '[data-spotlight="add-expense"]' }, { seletor: '[data-spotlight="financeiro"]', aba: true }],
    anel: linhaComCampo,
    pedido: "anota 1 gasto seu",
    olhe: "olha o seu mês",
    dica: "Escreve um gasto SEU de hoje — ex.: Café, 12 — e toca no +.",
    chave: "finance-expenses",
    achar: (valor, anterior) => {
      const ids = new Set(lista(anterior).map((e) => String(mapa(e).id)));
      const novo = lista(valor).map(mapa).filter((e) => !ids.has(String(e.id))).pop();
      return novo ? normalizarItem({ tipo: "gasto", nome: novo.description, valor: Number(novo.value) }) : null;
    },
    numero: (valor, anterior, item) => {
      // o "Saiu" do MEU MÊS (o resumo que a pessoa vai olhar); sem ele, os custos variáveis
      const antes = saiuDoMes();
      if (antes !== null) return { titulo: "Saiu no mês", antes, depois: antes + (item.valor ?? 0), formatar: reaisInteiros };
      const soma = (v: unknown) => lista(v).reduce<number>((s, e) => s + (Number(mapa(e).value) || 0), 0);
      return { titulo: "Custos variáveis do mês", antes: soma(anterior), depois: soma(valor), formatar: reaisInteiros };
    },
    olhar: { seletor: '[data-spotlight="add-bill"]', recorte: juntarFilhos(2) },
    cumprida: () => ({
      titulo: "já está anotado.",
      sub: "É o seu 1º registro. Com os seus números de verdade, o CORE mostra quanto dá pra gastar hoje.",
    }),
  },
  habito: {
    passos: [{ seletor: '[data-spotlight="add-habit"]' }, { seletor: '[data-spotlight="tab-semana"]', aba: true }],
    pedido: "cria 1 hábito seu",
    olhe: "olha a sua semana",
    dica: "Toca em + Hábito e escreve um hábito SEU — ex.: beber água.",
    chave: "rotina-habits",
    achar: (valor, anterior) => {
      const nomeDe = (x: unknown) => (typeof x === "string" ? x : String(mapa(x).name ?? ""));
      const antes = new Set(lista(anterior).map((x) => nomeDe(x).trim().toLowerCase()));
      const novo = lista(valor).map(nomeDe).filter((n) => n.trim() && !antes.has(n.trim().toLowerCase())).pop();
      return novo ? normalizarItem({ tipo: "habito", nome: novo }) : null;
    },
    numero: (valor, anterior) => ({ titulo: "Hábitos na sua semana", antes: lista(anterior).length, depois: lista(valor).length, formatar: (n) => `${Math.round(n)}` }),
    olhar: { seletor: '[data-spotlight="add-habit"]', perto: cardEmVolta, recorte: juntarFilhos(2) },
    cumprida: () => ({ titulo: "já está na sua semana.", sub: "É o seu 1º hábito. Marca o quadradinho todo dia e vê a sequência crescer." }),
  },
  exercicio: {
    passos: [{ seletor: '[data-spotlight="add-exercise"]' }, { seletor: '[data-spotlight="tab-hoje"]', aba: true }],
    pedido: "anota 1 exercício seu",
    olhe: "olha o seu treino",
    dica: "Escreve um exercício SEU — ex.: agachamento — e toca no +.",
    chave: "saude-workouts-v2",
    achar: (valor, anterior) => {
      const a = mapa(anterior);
      for (const [dia, d] of Object.entries(mapa(valor))) {
        const antes = new Set(lista(mapa(a[dia]).exercises).map((e) => String(mapa(e).name ?? "").trim().toLowerCase()));
        const novo = lista(mapa(d).exercises).map((e) => String(mapa(e).name ?? "")).filter((n) => n.trim() && !antes.has(n.trim().toLowerCase())).pop();
        if (novo) return normalizarItem({ tipo: "exercicio", nome: novo });
      }
      return null;
    },
    numero: (valor, anterior) => {
      const conta = (v: unknown) => Object.values(mapa(v)).reduce<number>((s, d) => s + lista(mapa(d).exercises).length, 0);
      return { titulo: "Exercícios na sua semana", antes: conta(anterior), depois: conta(valor), formatar: (n) => `${Math.round(n)}` };
    },
    olhar: { seletor: '[data-spotlight="add-exercise"]', perto: cardEmVolta, recorte: juntarFilhos(1) },
    cumprida: () => ({ titulo: "já está no seu treino.", sub: "É o seu 1º exercício. Anota a carga de cada série e vê a evolução." }),
  },
  agua: {
    passos: [{ seletor: '[data-spotlight="add-water"]' }, { seletor: '[data-spotlight="tab-hoje"]', aba: true }],
    pedido: "marca 1 copo d'água",
    olhe: "olha o seu dia",
    dica: "Bebeu água hoje? Toca em +250ml pra marcar 1 copo.",
    chave: "core-saude-water",
    achar: (valor, anterior) => {
      const hoje = localDayKey();
      if ((Number(mapa(valor)[hoje]) || 0) <= (Number(mapa(anterior)[hoje]) || 0)) return null;
      const copo = Number((window as unknown as { __PREVIEW_SEEDS__?: Record<string, unknown> }).__PREVIEW_SEEDS__?.["core-saude-copo-ml"]) || 250;
      return normalizarItem({ tipo: "agua", nome: "1 copo d'água", valor: copo });
    },
    numero: (valor, anterior, item) => {
      const hoje = localDayKey();
      const ml = item.valor ?? 250;
      return { titulo: "Água hoje", antes: (Number(mapa(anterior)[hoje]) || 0) * ml, depois: (Number(mapa(valor)[hoje]) || 0) * ml, formatar: (n) => `${Math.round(n)} ml` };
    },
    olhar: { seletor: '[data-spotlight="add-water"]', perto: cardEmVolta, recorte: juntarFilhos(3) },
    cumprida: () => ({ titulo: "já está marcado.", sub: "É o seu 1º registro de água. O CORE te lembra de bater a meta do dia." }),
  },
  meta: {
    passos: [{ seletor: '[data-spotlight="add-goal"]' }, { seletor: '[data-spotlight="tab-metas"]', aba: true }],
    pedido: "escreve 1 meta sua",
    olhe: "olha a sua meta",
    dica: "Toca em Nova meta e escreve uma meta SUA — ex.: Correr 5 km.",
    chave: "goals-board-v2",
    achar: (valor, anterior) => {
      const ids = new Set(lista(anterior).map((g) => String(mapa(g).id)));
      const nova = lista(valor).map(mapa).filter((g) => !ids.has(String(g.id))).pop();
      return nova ? normalizarItem({ tipo: "meta", nome: nova.title }) : null;
    },
    numero: (valor, anterior) => ({ titulo: "Metas com plano", antes: lista(anterior).length, depois: lista(valor).length, formatar: (n) => `${Math.round(n)}` }),
    // a meta nova abre na página dela (o quadro sai de cena): sem resumo pra olhar, vai direto pra folha
    cumprida: () => ({ titulo: "já tem um plano.", sub: "É a sua 1ª meta. Quebra em passos e acompanha até sair do papel." }),
  },
};

export const alvoDaMissao = (tipo: TipoDoItem): AlvoDaMissao => ALVOS[tipo];
