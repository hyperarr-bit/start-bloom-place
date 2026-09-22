/**
 * TABELA DE ALIMENTOS — TACO (22/09). Chamado com print: "coloco no meu
 * registro a refeição, mas não aparece nem as calorias nem os macros no
 * widget" e "como faço para contabilizar meus macros, não tem contador de
 * calorias?". Não tinha: o app só somava o que a pessoa DIGITAVA. Agora tem
 * uma tabela de verdade — a TACO (Tabela Brasileira de Composição de
 * Alimentos, 4ª ed., NEPA/UNICAMP), 597 alimentos com kcal, proteína,
 * carboidrato e gordura por 100 g, servida como JSON estático por
 * brolesi.github.io/taco (MIT) e compactada em src/data/taco.json (30 KB).
 *
 * Carregada SOB DEMANDA (import dinâmico): quem nunca abre a busca não baixa
 * nada, e o pacote principal (que o funil de venda divide) não cresce.
 */

export type Alimento = {
  id: number;
  nome: string;
  categoria: string;
  /** por 100 g */
  kcal: number;
  p: number;
  c: number;
  g: number;
};

type TacoCompacto = { categorias: string[]; alimentos: [number, string, number, number, number, number, number][] };

let cache: Promise<Alimento[]> | null = null;

export const carregarTaco = (): Promise<Alimento[]> => {
  cache ??= import("@/data/taco.json").then((m) => {
    const bruto = m as unknown as { default?: TacoCompacto } & Partial<TacoCompacto>;
    const d = (bruto.default ?? bruto) as TacoCompacto;
    return d.alimentos.map(([id, nome, ci, kcal, p, c, g]) => ({ id, nome, categoria: d.categorias[ci] ?? "", kcal, p, c, g }));
  });
  return cache;
};

/** "Pão, trigo, francês" → "pao trigo frances" */
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Busca por palavras: todas as palavras digitadas precisam aparecer no nome.
 * Ordem: nome que COMEÇA pela primeira palavra primeiro (quem digita "arroz"
 * quer "Arroz, tipo 1, cozido", não "Bolinho de arroz"), depois cozido antes
 * de cru (é o que se come), depois o nome mais curto.
 */
export function buscarAlimentos(lista: Alimento[], consulta: string, limite = 12): Alimento[] {
  const q = normalizar(consulta);
  if (q.length < 2) return [];
  const palavras = q.split(" ").filter(Boolean);
  const pontuar = (a: Alimento): number | null => {
    const n = normalizar(a.nome);
    if (!palavras.every((p) => n.includes(p))) return null;
    let s = 0;
    if (n.startsWith(palavras[0])) s += 100;
    if (palavras.every((p) => new RegExp(`(^| )${p}`).test(n))) s += 30; // casa no começo de palavra
    if (/\bcru\b|\bcrua\b/.test(n)) s -= 20;
    if (/cozid|assad|grelhad|frit/.test(n)) s += 5;
    s -= Math.min(20, n.length / 4);
    return s;
  };
  return lista
    .map((a) => ({ a, s: pontuar(a) }))
    .filter((x): x is { a: Alimento; s: number } => x.s !== null)
    .sort((x, y) => y.s - x.s || x.a.nome.localeCompare(y.a.nome))
    .slice(0, limite)
    .map((x) => x.a);
}

export type Porcao = { kcal: number; p: number; c: number; g: number };

/** Quanto tem em `gramas` do alimento (tabela é por 100 g). Gramas inválidas → tudo 0. */
export const porcao = (a: Alimento, gramas: number): Porcao => {
  const f = Number.isFinite(gramas) && gramas > 0 ? gramas / 100 : 0;
  const r1 = (x: number) => Math.round(x * f * 10) / 10;
  return { kcal: Math.round(a.kcal * f), p: r1(a.p), c: r1(a.c), g: r1(a.g) };
};

/** Nome curto pra lista: "Arroz, tipo 1, cozido" → "Arroz tipo 1 cozido · 150 g" */
export const rotuloDaPorcao = (a: Alimento, gramas: number) => `${a.nome.replace(/,\s*/g, " ")} · ${gramas} g`;
