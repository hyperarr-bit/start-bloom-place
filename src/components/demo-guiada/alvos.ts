/**
 * ONDE A MISSÃO APONTA, POR ÁREA (demo guiada, 28/09 · redesenho 30/09).
 *
 * As âncoras são as MESMAS da tabela ALVO da Missão do teste grátis
 * (src/components/missao/MissaoDoTrial.tsx): add-expense, add-habit,
 * add-exercise, add-water, add-goal — com a aba de cada uma como reserva. A
 * tabela é espelhada aqui (e não importada) porque a Missão é do app nativo e
 * as frases dela falam do "Dia 1"; errar aqui é inofensivo: fail-open.
 *
 * Pra cada área:
 *   · passo 2 (1 TOQUE): onde fica o botão de adicionar, os CHIPS prontos do
 *     post-it (30/09: 9% completavam digitando; 1 toque no lugar de 41 s de
 *     teclado), a pergunta do post-it, as chaves que o módulo grava e como
 *     achar o item NOVO nelas;
 *   · passo 3 (OLHAR): o resumo que recalculou e o número que sobe.
 * Rotina (30/09): a missão vira MARCAR 1 hábito no quadradinho de hoje — o
 * toque mais comum da demo inteira (rotina-habits-checked) — em vez de digitar
 * um hábito novo (que continua valendo, se ela preferir).
 */
import { normalizarItem, reais, type ItemDaDemo, type TipoDoItem } from "@/lib/demo-guiada";
import { gravacoesDoItem, idDoItem, type Gravacao } from "@/lib/demo-guiada-registro";
import { localDayKey } from "@/lib/utils";

/**
 * Os tempos da missão. A 1ª comemoração dura o que dura no app (MissaoDoTrial:
 * 2,8 s) mais o tempo de ler o botão; o passo 3 e a "Missão cumprida" só
 * andam sozinhos como rede de segurança — o caminho é o botão. Objeto (e não
 * constantes soltas) só pra os testes encurtarem.
 */
export const TEMPOS_DA_MISSAO = {
  /** PASSO 1 (30/09): o cartão "Passo 1 de 3 ✓ · você começou por X" fica na
   *  tela antes de a demo andar sozinha até o post-it ("Começar →" adianta) */
  inicio: 3000,
  /** depois do cartão do passo 1, o módulo já montou: só o respiro da troca de aba */
  antesDoHolofote: 300,
  /** o chip tocado vira ✓ e o registro aparece na lista ANTES da comemoração (causa → efeito) */
  registrou: 550,
  /** "Primeiro registro feito!" anda sozinha depois disso; "Ver meu mês →" adianta */
  primeiroRegistro: 4500,
  /** holofote no resumo que recalculou, com o número subindo; "Continuar →" adianta */
  olhar: 8000,
  /** trava suave do CTA fixo: "1 toque e é seu →" até o 1º registro OU este tempo OU 1 toque nele */
  trava: 20_000,
};

export interface Numero {
  titulo: string;
  antes: number;
  depois: number;
  formatar: (n: number) => string;
}

/** Um gasto/exercício/meta pronto do post-it: 1 toque = registro dela. */
export interface ChipDaMissao {
  emoji: string;
  nome: string;
  /** gasto: reais · água: ml */
  valor?: number;
  /** gasto: categoria do módulo (pra linha nascer com a etiqueta certa na demo) */
  categoria?: string;
}

/** Como o item nasceu — vai no evento `demo_guia_registro`. */
export type ViaDoRegistro = "chip" | "toque" | "digitado";

/** Quem lê o snapshot da demo (a ponte do Preview) — pra achar o nome do hábito marcado. */
export type LeitorDaDemo = (chave: string) => unknown;

export interface AlvoDaMissao {
  /** Em ordem: o 1º que existir. `aba` = aba do módulo (a missão toca nela sozinha). */
  passos: Array<{ seletor: string; aba?: boolean }>;
  /** O que o anel abraça a partir da âncora (a linha inteira do formulário, a linha de HOJE da tabela). */
  anel?: (el: Element) => Element;
  /** O post-it fica EMBAIXO do anel (Rotina: em cima ele taparia os nomes dos hábitos). */
  postItAbaixo?: boolean;
  /** Faixa: "Agora: …". */
  pedido: string;
  /** Post-it: a pergunta em cima dos chips (ou a instrução, quando não há chips). */
  pergunta: string;
  /** Chips prontos (1 toque). Vazio = a ação é no próprio módulo (quadradinho, + Copo). */
  chips: ChipDaMissao[];
  /** Post-it: "✎ escrever o meu" leva o foco pro campo do módulo (tipos com campo de texto). */
  escrever: boolean;
  /** Botão da 1ª comemoração ("Ver meu mês →"). */
  botaoOlhar: string;
  /** Faixa depois do registro: pra onde olhar. */
  olhe: string;
  /** Chaves do snapshot que a missão escuta. */
  chaves: string[];
  /** O item novo = o que está em `valor` e não estava em `anterior` (naquela chave). */
  achar: (chave: string, valor: unknown, anterior: unknown, ler: LeitorDaDemo) => { item: ItemDaDemo; via: ViaDoRegistro } | null;
  /** Os números do passo 3 (antes → depois). Lido na hora do registro, antes de a tela redesenhar. */
  numero: (chave: string, valor: unknown, anterior: unknown, item: ItemDaDemo) => Numero | null;
  /** Passo 3: o resumo que recalculou (sem âncora → direto pra "Missão cumprida"). */
  olhar?: { achar: () => Element | null; recorte?: (el: Element) => Retangulo | null };
  /** "Missão cumprida": a linha do item e a frase do meio. */
  cumprida: (item: ItemDaDemo) => { feito: string; titulo: string; sub: string };
}

const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const mapa = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const reaisInteiros = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 })}`;
const inteiro = (n: number) => `${Math.round(n)}`;

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
  el.parentElement?.closest(".rounded-2xl, .rounded-xl, .rounded-lg") ?? el.parentElement;

const porSeletor = (seletor: string, perto?: (el: Element) => Element | null) => (): Element | null => {
  const el = document.querySelector(seletor);
  return el ? (perto ? perto(el) : el) : null;
};

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

/* ------------------------------------------------------------ Rotina: a linha de HOJE */

export const DIAS_DA_ROTINA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
export const diaDeHoje = (d: Date = new Date()): string => DIAS_DA_ROTINA[(d.getDay() + 6) % 7];

/** A linha de HOJE da tabela HÁBITOS DIÁRIOS (a partir do botão "+ Hábito" do card). */
export const linhaDeHoje = (el: Element): Element => {
  const card = cardEmVolta(el);
  const hoje = diaDeHoje();
  const linha = card && Array.from(card.querySelectorAll("tbody tr")).find((tr) => (tr.querySelector("td")?.textContent ?? "").trim().toUpperCase() === hoje);
  return linha ?? el;
};

const nomesDosHabitos = (v: unknown): string[] =>
  lista(v).map((h) => (typeof h === "string" ? h : String(mapa(h).name ?? ""))).map((n) => n.trim());
const feitosNoDia = (grade: unknown, dia: string) => lista(mapa(grade)[dia]).filter((x) => x === true).length;
const feitosNaSemana = (grade: unknown) => Object.values(mapa(grade)).reduce<number>((s, d) => s + lista(d).filter((x) => x === true).length, 0);

/** O quadradinho que virou ✓: [dia, índice do hábito] — hoje primeiro. */
const quadradinhoMarcado = (valor: unknown, anterior: unknown): [string, number] | null => {
  const v = mapa(valor), a = mapa(anterior);
  const dias = [diaDeHoje(), ...DIAS_DA_ROTINA.filter((d) => d !== diaDeHoje())];
  for (const dia of dias) {
    const depois = lista(v[dia]), antes = lista(a[dia]);
    const i = depois.findIndex((x, k) => x === true && antes[k] !== true);
    if (i >= 0) return [dia, i];
  }
  return null;
};

/* ------------------------------------------------------------ a tabela */

const CHIPS_DE_GASTO: ChipDaMissao[] = [
  { emoji: "☕", nome: "Café", valor: 12, categoria: "alimentacao" },
  { emoji: "🚗", nome: "Uber", valor: 23, categoria: "transporte" },
  { emoji: "🍔", nome: "Almoço", valor: 35, categoria: "restaurante" },
];

const ALVOS: Record<TipoDoItem, AlvoDaMissao> = {
  gasto: {
    passos: [{ seletor: '[data-spotlight="add-expense"]' }, { seletor: '[data-spotlight="financeiro"]', aba: true }],
    anel: linhaComCampo,
    pedido: "toca em 1 gasto seu",
    pergunta: "Qual foi o seu último gasto?",
    chips: CHIPS_DE_GASTO,
    escrever: true,
    botaoOlhar: "Ver meu mês",
    olhe: "olha o seu mês",
    chaves: ["finance-expenses"],
    achar: (_chave, valor, anterior) => {
      const ids = new Set(lista(anterior).map((e) => String(mapa(e).id)));
      const novo = lista(valor).map(mapa).filter((e) => !ids.has(String(e.id))).pop();
      const item = novo ? normalizarItem({ tipo: "gasto", nome: novo.description, valor: Number(novo.value) }) : null;
      return item ? { item, via: String(novo?.id ?? "").startsWith("demo-") ? "chip" : "digitado" } : null;
    },
    numero: (_chave, valor, anterior, item) => {
      // o "Saiu" do MEU MÊS (o resumo que a pessoa vai olhar); sem ele, os custos variáveis
      const antes = saiuDoMes();
      if (antes !== null) return { titulo: "Saiu no mês", antes, depois: antes + (item.valor ?? 0), formatar: reaisInteiros };
      const soma = (v: unknown) => lista(v).reduce<number>((s, e) => s + (Number(mapa(e).value) || 0), 0);
      return { titulo: "Custos variáveis do mês", antes: soma(anterior), depois: soma(valor), formatar: reaisInteiros };
    },
    olhar: { achar: porSeletor('[data-spotlight="add-bill"]'), recorte: juntarFilhos(2) },
    cumprida: (item) => ({
      feito: `${item.nome} · R$ ${reais(item.valor ?? 0)} anotado`,
      titulo: "já está anotado.",
      sub: "É o seu 1º registro. Com os seus números de verdade, o CORE mostra quanto dá pra gastar hoje.",
    }),
  },
  habito: {
    passos: [{ seletor: '[data-spotlight="add-habit"]' }, { seletor: '[data-spotlight="tab-semana"]', aba: true }],
    anel: linhaDeHoje,
    postItAbaixo: true,
    pedido: "marca 1 hábito de hoje",
    pergunta: "O que você já fez hoje? Toca no quadradinho.",
    chips: [],
    escrever: false,
    botaoOlhar: "Ver minha sequência",
    olhe: "olha a sua sequência",
    chaves: ["rotina-habits-checked", "rotina-habits"],
    achar: (chave, valor, anterior, ler) => {
      if (chave === "rotina-habits") {
        const antes = new Set(nomesDosHabitos(anterior).map((n) => n.toLowerCase()));
        const novo = nomesDosHabitos(valor).filter((n) => n && !antes.has(n.toLowerCase())).pop();
        const item = novo ? normalizarItem({ tipo: "habito", nome: novo }) : null;
        return item ? { item, via: "digitado" } : null;
      }
      const marcado = quadradinhoMarcado(valor, anterior);
      if (!marcado) return null;
      const nome = nomesDosHabitos(ler("rotina-habits"))[marcado[1]];
      const item = nome ? normalizarItem({ tipo: "habito", nome }) : null;
      return item ? { item, via: "toque" } : null;
    },
    numero: (chave, valor, anterior) => {
      if (chave === "rotina-habits") return { titulo: "Hábitos na sua semana", antes: lista(anterior).length, depois: lista(valor).length, formatar: inteiro };
      const marcado = quadradinhoMarcado(valor, anterior);
      const hoje = marcado?.[0] === diaDeHoje();
      return hoje
        ? { titulo: "Feitos hoje", antes: feitosNoDia(anterior, diaDeHoje()), depois: feitosNoDia(valor, diaDeHoje()), formatar: inteiro }
        : { titulo: "Feitos na semana", antes: feitosNaSemana(anterior), depois: feitosNaSemana(valor), formatar: inteiro };
    },
    // a sequência (CONSISTÊNCIA · N dias seguidos) é o que o quadradinho alimenta
    olhar: {
      achar: () => {
        const titulo = Array.from(document.querySelectorAll("span")).find((s) => (s.textContent ?? "").trim() === "CONSISTÊNCIA");
        return titulo ? cardEmVolta(titulo) : null;
      },
      recorte: juntarFilhos(1),
    },
    cumprida: (item) => ({
      feito: `${item.nome} marcado hoje`,
      titulo: "já está na sua semana.",
      sub: "Marca o quadradinho todo dia e vê a sequência crescer — o CORE te lembra.",
    }),
  },
  exercicio: {
    passos: [{ seletor: '[data-spotlight="add-exercise"]' }, { seletor: '[data-spotlight="tab-hoje"]', aba: true }],
    anel: linhaComCampo,
    pedido: "anota 1 exercício seu",
    pergunta: "Qual exercício você faz?",
    chips: [
      { emoji: "🦵", nome: "Agachamento" },
      { emoji: "🏃", nome: "Corrida" },
      { emoji: "🚶", nome: "Caminhada" },
    ],
    escrever: true,
    botaoOlhar: "Ver meu treino",
    olhe: "olha o seu treino",
    chaves: ["saude-workouts-v2"],
    achar: (_chave, valor, anterior) => {
      const a = mapa(anterior);
      for (const [dia, d] of Object.entries(mapa(valor))) {
        const antes = new Set(lista(mapa(a[dia]).exercises).map((e) => String(mapa(e).name ?? "").trim().toLowerCase()));
        const novo = lista(mapa(d).exercises).map((e) => String(mapa(e).name ?? "")).filter((n) => n.trim() && !antes.has(n.trim().toLowerCase())).pop();
        if (novo) {
          const item = normalizarItem({ tipo: "exercicio", nome: novo });
          return item ? { item, via: "digitado" } : null;
        }
      }
      return null;
    },
    numero: (_chave, valor, anterior) => {
      const conta = (v: unknown) => Object.values(mapa(v)).reduce<number>((s, d) => s + lista(mapa(d).exercises).length, 0);
      return { titulo: "Exercícios na sua semana", antes: conta(anterior), depois: conta(valor), formatar: inteiro };
    },
    olhar: { achar: porSeletor('[data-spotlight="add-exercise"]', cardEmVolta), recorte: juntarFilhos(1) },
    cumprida: (item) => ({ feito: `${item.nome} no treino`, titulo: "já está no seu treino.", sub: "É o seu 1º exercício. Anota a carga de cada série e vê a evolução." }),
  },
  agua: {
    passos: [{ seletor: '[data-spotlight="add-water"]' }, { seletor: '[data-spotlight="tab-hoje"]', aba: true }],
    pedido: "marca 1 copo d'água",
    pergunta: "Bebeu água hoje?",
    chips: [{ emoji: "💧", nome: "1 copo d'água" }],
    escrever: false,
    botaoOlhar: "Ver meu dia",
    olhe: "olha o seu dia",
    chaves: ["core-saude-water"],
    achar: (_chave, valor, anterior) => {
      const hoje = localDayKey();
      if ((Number(mapa(valor)[hoje]) || 0) <= (Number(mapa(anterior)[hoje]) || 0)) return null;
      const copo = Number((window as unknown as { __PREVIEW_SEEDS__?: Record<string, unknown> }).__PREVIEW_SEEDS__?.["core-saude-copo-ml"]) || 250;
      const item = normalizarItem({ tipo: "agua", nome: "1 copo d'água", valor: copo });
      return item ? { item, via: "toque" } : null;
    },
    numero: (_chave, valor, anterior, item) => {
      const hoje = localDayKey();
      const ml = item.valor ?? 250;
      return { titulo: "Água hoje", antes: (Number(mapa(anterior)[hoje]) || 0) * ml, depois: (Number(mapa(valor)[hoje]) || 0) * ml, formatar: (n) => `${Math.round(n)} ml` };
    },
    olhar: { achar: porSeletor('[data-spotlight="add-water"]', cardEmVolta), recorte: juntarFilhos(3) },
    cumprida: () => ({ feito: "1 copo d'água marcado", titulo: "já está marcado.", sub: "É o seu 1º registro de água. O CORE te lembra de bater a meta do dia." }),
  },
  meta: {
    passos: [{ seletor: '[data-spotlight="add-goal"]' }, { seletor: '[data-spotlight="tab-metas"]', aba: true }],
    pedido: "escolhe 1 meta sua",
    pergunta: "Qual meta você quer tirar do papel?",
    chips: [
      { emoji: "🏃", nome: "Correr 5 km" },
      { emoji: "💰", nome: "Guardar R$ 1.000" },
      { emoji: "📚", nome: "Ler 12 livros" },
    ],
    escrever: false,
    botaoOlhar: "Continuar",
    olhe: "olha a sua meta",
    chaves: ["goals-board-v2"],
    achar: (_chave, valor, anterior) => {
      const ids = new Set(lista(anterior).map((g) => String(mapa(g).id)));
      const nova = lista(valor).map(mapa).filter((g) => !ids.has(String(g.id))).pop();
      const item = nova ? normalizarItem({ tipo: "meta", nome: nova.title }) : null;
      return item ? { item, via: String(nova?.id ?? "").startsWith("demo-") ? "chip" : "digitado" } : null;
    },
    numero: (_chave, valor, anterior) => ({ titulo: "Metas com plano", antes: lista(anterior).length, depois: lista(valor).length, formatar: inteiro }),
    // a meta nova aberta pela mão dela troca de página (o quadro sai de cena): sem resumo pra olhar, vai direto pra "Missão cumprida"
    cumprida: (item) => ({ feito: `${item.nome} com plano`, titulo: "já tem um plano.", sub: "É a sua 1ª meta. Quebra em passos e acompanha até sair do papel." }),
  },
};

export const alvoDaMissao = (tipo: TipoDoItem): AlvoDaMissao => ALVOS[tipo];

/* ------------------------------------------------------------ chips → item → snapshot */

/** O item que um chip vira (validado como qualquer item). */
export const itemDoChip = (tipo: TipoDoItem, chip: ChipDaMissao): ItemDaDemo | null =>
  normalizarItem({ tipo, nome: chip.nome, valor: chip.valor });

/**
 * O que o chip grava NO SNAPSHOT DA DEMO — pelo mesmo `set` que o módulo usa
 * (a ponte do Preview), no formato que o módulo já lê:
 *   · gasto: o mesmo objeto do addExpense (ExpenseTable), com a categoria do
 *     chip (a linha nasce com a etiqueta "Alimentação"), pago no Pix, hoje;
 *   · os outros: exatamente o que `gravacoesDoItem(..., "demo")` já sabe
 *     gravar (exercício no dia de hoje, água +1 copo nas duas chaves, meta no
 *     quadro) — uma fonte só pro formato de cada chave.
 * O id é o `idDoItem` (estável): é assim que `achar` sabe que veio do chip.
 */
export function gravacoesDoChip(item: ItemDaDemo, chip: ChipDaMissao, hoje: Date = new Date()): Gravacao[] {
  if (item.tipo !== "gasto") return gravacoesDoItem(item, hoje, "demo");
  const id = idDoItem(item);
  const gasto = { id, description: item.nome, category: chip.categoria || "outros", value: item.valor ?? 0, date: localDayKey(hoje), paymentMethod: "pix" };
  return [{
    chave: "finance-expenses",
    proximo: (atual) => {
      if (atual === undefined || atual === null) return [gasto];
      if (!Array.isArray(atual)) return undefined;
      if (atual.some((e) => e && typeof e === "object" && (e as { id?: unknown }).id === id)) return undefined;
      return [...atual, gasto];
    },
  }];
}
