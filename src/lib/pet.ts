/**
 * PET — os dados do módulo e as contas que não dependem de tela (29/09).
 *
 * Por que o módulo foi refeito: 24% das pessoas abrem o Pet e 62% delas saem
 * em menos de 10 segundos; de quem viu a tela vazia desde 13/09, 9 em 10 nunca
 * cadastraram um bicho, e só 4 pessoas abriram a Rotina com um pet dentro. O
 * módulo abria VAZIO, pedia um formulário de texto livre e depois não dava
 * motivo nenhum pra voltar (sem lembrete, sem nada na Home).
 *
 * REGRA DE DADOS (a do Finanças, 28/09): chave sincronizada NUNCA muda de tipo.
 * O app antigo (Android ≤124, iPhone ≤1.0.8) lê a MESMA nuvem. Então:
 *  - `pet-list`, `pet-health`, `pet-expenses`, `pet-diary`, `pet-routine-<dia>`
 *    e `pet-routine-tasks-<pet>` continuam no formato de sempre; o que é novo
 *    entra como CAMPO OPCIONAL (o app antigo ignora);
 *  - o que não cabe no formato antigo mora em chave NOVA: `pet-cuidados` (o
 *    plano da carteirinha), `pet-pesos` (histórico de peso) e
 *    `pet-lembrete-prefs` / `pet-dicas-prefs` (ajustes);
 *  - ABRIR NÃO GRAVA: nada aqui escreve só porque a tela abriu.
 */
import { localDayKey, parseLocalDay } from "@/lib/utils";

/* ─────────────────────────────── chaves ─────────────────────────────── */

export const CHAVE_PETS = "pet-list";
export const CHAVE_REGISTROS = "pet-health";
export const CHAVE_GASTOS = "pet-expenses";
export const CHAVE_CATEGORIAS_GASTO = "pet-expense-categories";
export const CHAVE_DIARIO = "pet-diary";
export const CHAVE_CUIDADOS = "pet-cuidados";
export const CHAVE_PESOS = "pet-pesos";
export const CHAVE_LEMBRETE = "pet-lembrete-prefs";
export const CHAVE_DICAS = "pet-dicas-prefs";
export const chaveRotinaDoDia = (dia: string) => `pet-routine-${dia}`;
export const chaveTarefasDoPet = (petId: string) => `pet-routine-tasks-${petId}`;

/* ─────────────────────────────── tipos ─────────────────────────────── */

export type Especie = "cao" | "gato" | "ave" | "peixe" | "roedor" | "coelho" | "reptil" | "outro";
export type Sexo = "macho" | "femea";
export type Porte = "pequeno" | "medio" | "grande";
export type FaixaEtaria = "filhote" | "adulto" | "idoso";

/** Item de `pet-list`. Os 6 primeiros campos são os de sempre (o app antigo
 *  lê e grava só eles); o resto é opcional e só o app novo usa. */
export interface Pet {
  id: string;
  name: string;
  /** texto livre desde a 1ª versão ("Cachorro", "gata", "Calopsita") */
  species: string;
  breed: string;
  /** texto: o app antigo mostra `${weight} kg` — por isso gravamos só o número ("18,4") */
  weight: string;
  /** "AAAA-MM-DD" ou "" */
  birthday: string;
  photoUrl?: string;
  sexo?: Sexo;
  castrado?: boolean;
  porte?: Porte;
  /** a data de nascimento é estimada (bicho adotado adulto) */
  nascimentoAprox?: boolean;
  /** sem data nenhuma: só a fase da vida, escolhida no começo */
  faixa?: FaixaEtaria;
  chip?: string;
  alergias?: string;
  vetNome?: string;
  vetTelefone?: string;
  obs?: string;
  criadoEm?: string;
}

/** Tarefa da rotina diária (formato de sempre + `hora` opcional, só exibição). */
export interface TarefaDaRotina {
  id: string;
  label: string;
  emoji: string;
  hora?: string;
}

/** `pet-routine-<dia>`: { [petId]: { [tarefaId]: true/false } } — formato de sempre. */
export type RotinaDoDia = Record<string, Record<string, boolean>>;

export type PesosPorPet = Record<string, { dia: string; kg: number }[]>;

/* ─────────────────────────────── datas ─────────────────────────────── */

export const ehDia = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const somarDias = (dia: string, n: number): string => {
  const d = parseLocalDay(dia);
  d.setDate(d.getDate() + n);
  return localDayKey(d);
};

/** Dias de CALENDÁRIO de `de` até `ate` (negativo = já passou). */
export const diasEntre = (de: string, ate: string): number =>
  Math.round((parseLocalDay(ate).getTime() - parseLocalDay(de).getTime()) / 86_400_000);

/* ─────────────────────────────── leitura segura ─────────────────────────────── */

const texto = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** `pet-list` como vier (lixo, null, item sem id) → lista limpa. Nunca derruba a tela. */
export function petsValidos(bruto: unknown): Pet[] {
  if (!Array.isArray(bruto)) return [];
  const out: Pet[] = [];
  for (const p of bruto) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const id = texto(o.id);
    const name = texto(o.name).trim();
    if (!id || !name) continue;
    out.push({
      ...(o as Partial<Pet>),
      id,
      name,
      species: texto(o.species),
      breed: texto(o.breed),
      weight: texto(o.weight),
      birthday: ehDia(o.birthday) ? o.birthday : "",
      photoUrl: typeof o.photoUrl === "string" && o.photoUrl ? o.photoUrl : undefined,
    });
  }
  return out;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Da espécie em texto livre ("gata", "Cachorro", "calopsita") pro tipo que as contas usam. */
export function especieDe(species: string | undefined | null): Especie {
  const s = ` ${semAcento(species ?? "")} `;
  if (/\b(cachorr|cao\b|caes\b|cadel|canin|dog|filhote de cachorro|vira.?lata)/.test(s)) return "cao";
  if (/\b(gat|felin|cat\b|cats\b|kitten)/.test(s)) return "gato";
  if (/\b(passar|ave\b|aves\b|calopsit|periquit|papagai|canari|agapornis|bird|galinh)/.test(s)) return "ave";
  if (/\b(peix|fish|betta|aquario)/.test(s)) return "peixe";
  if (/\b(hamster|porquinho|chinchila|roedor|gerbil|rato|topolino|twister)/.test(s)) return "roedor";
  if (/\b(coelh|rabbit)/.test(s)) return "coelho";
  if (/\b(tartaruga|jabuti|iguana|cobra|lagart|reptil|gecko)/.test(s)) return "reptil";
  return "outro";
}

export const EMOJI_DA_ESPECIE: Record<Especie, string> = {
  cao: "🐶", gato: "🐱", ave: "🐦", peixe: "🐟", roedor: "🐹", coelho: "🐰", reptil: "🐢", outro: "🐾",
};

export const NOME_DA_ESPECIE: Record<Especie, string> = {
  cao: "Cachorro", gato: "Gato", ave: "Ave", peixe: "Peixe", roedor: "Roedor", coelho: "Coelho", reptil: "Réptil", outro: "Pet",
};

/* ─────────────────────────────── idade ─────────────────────────────── */

/** Meses completos entre o nascimento e hoje (null sem data). */
export function mesesDeVida(birthday: string | undefined, hoje: string = localDayKey()): number | null {
  if (!ehDia(birthday)) return null;
  const n = parseLocalDay(birthday), h = parseLocalDay(hoje);
  let meses = (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth());
  if (h.getDate() < n.getDate()) meses--;
  return Math.max(0, meses);
}

/** "3 anos e 2 meses", "5 meses", "3 semanas", "1 ano" — ou a fase da vida sem data. */
export function idadeExtenso(pet: Pick<Pet, "birthday" | "nascimentoAprox" | "faixa">, hoje: string = localDayKey()): string {
  const meses = mesesDeVida(pet.birthday, hoje);
  if (meses === null) return pet.faixa ? FAIXA_ROTULO[pet.faixa] : "";
  const aprox = pet.nascimentoAprox ? "cerca de " : "";
  if (meses < 1) {
    const semanas = Math.max(0, Math.floor(diasEntre(pet.birthday, hoje) / 7));
    return semanas <= 1 ? `${aprox}recém-nascido` : `${aprox}${semanas} semanas`;
  }
  const anos = Math.floor(meses / 12), resto = meses % 12;
  const a = anos === 1 ? "1 ano" : `${anos} anos`;
  const m = resto === 1 ? "1 mês" : `${resto} meses`;
  if (anos === 0) return `${aprox}${m}`;
  if (resto === 0 || pet.nascimentoAprox) return `${aprox}${a}`;
  return `${a} e ${m}`;
}

/** "3a 2m", "5m", "3sem" — pro campo curto do RG. */
export function idadeCurta(pet: Pick<Pet, "birthday" | "nascimentoAprox" | "faixa">, hoje: string = localDayKey()): string {
  const meses = mesesDeVida(pet.birthday, hoje);
  if (meses === null) return pet.faixa ? FAIXA_ROTULO[pet.faixa] : "—";
  const aprox = pet.nascimentoAprox ? "~" : "";
  if (meses < 1) return `${aprox}${Math.max(0, Math.floor(diasEntre(pet.birthday, hoje) / 7))}sem`;
  const anos = Math.floor(meses / 12), resto = meses % 12;
  if (anos === 0) return `${aprox}${resto}m`;
  return resto && !pet.nascimentoAprox ? `${anos}a ${resto}m` : `${aprox}${anos}a`;
}

export const FAIXA_ROTULO: Record<FaixaEtaria, string> = { filhote: "Filhote", adulto: "Adulto", idoso: "Idoso" };

/**
 * Fase da vida pras sugestões da carteirinha. Idoso = último quarto da vida
 * (AAHA 2019) sobre a expectativa por porte de Montoya et al. 2023: cão grande
 * ~8,5 anos, médio e SRD ~9,5, pequeno ~10; gato acima de 10 (AAHA/AAFP 2021).
 * Filhote = menos de 12 meses. Fontes no relatório do módulo.
 */
export function faixaEtaria(pet: Pick<Pet, "birthday" | "faixa" | "porte" | "species">, hoje: string = localDayKey()): FaixaEtaria {
  const meses = mesesDeVida(pet.birthday, hoje);
  if (meses === null) return pet.faixa ?? "adulto";
  if (meses < 12) return "filhote";
  const anos = meses / 12;
  const esp = especieDe(pet.species);
  const idoso = esp === "cao" ? (pet.porte === "grande" ? 8.5 : pet.porte === "pequeno" ? 10 : 9.5) : 10;
  return anos >= idoso ? "idoso" : "adulto";
}

/* ─────────────────────────────── peso ─────────────────────────────── */

/** "28 kg" → 28 · "4,2" → 4.2 · "4.2kg" → 4.2 · "65 g" → 0.065 (calopsita, hamster) · lixo → null. */
export function lerPeso(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  const t = texto(v).toLowerCase();
  const m = /(\d+(?:[.,]\d+)?)/.exec(t);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  // "65 g" / "65g" / "65 gramas" = gramas (mas "65 kg" não)
  return /\d\s*(g|gr|grama|gramas)\b/.test(t) && !/kg/.test(t) ? n / 1000 : n;
}

/** 18.4 → "18,4" · 4 → "4" · 0.065 → "0,065" (o app antigo acrescenta " kg" na tela). */
export const pesoTexto = (kg: number): string => (Math.round(kg * 1000) / 1000).toString().replace(".", ",");

/** Pra mostrar: "18,4 kg" · "65 g" (abaixo de 1 kg, em gramas — ninguém fala "0,065 kg" de calopsita). */
export const pesoComUnidade = (kg: number): string => (kg < 1 ? `${Math.round(kg * 1000)} g` : `${pesoTexto(Math.round(kg * 100) / 100)} kg`);

/** Histórico de peso do pet, do mais antigo pro mais novo. Sem histórico, o
 *  `weight` antigo vira um ponto só (sem data) — nada é gravado por isso. */
export function pesosDoPet(pet: Pet, todos: unknown): { dia: string; kg: number }[] {
  const mapa = todos && typeof todos === "object" && !Array.isArray(todos) ? (todos as Record<string, unknown>) : {};
  const lista = Array.isArray(mapa[pet.id]) ? (mapa[pet.id] as unknown[]) : [];
  const limpos = lista
    .map((x) => x as { dia?: unknown; kg?: unknown })
    .filter((x) => ehDia(x?.dia) && lerPeso(x?.kg) !== null)
    .map((x) => ({ dia: x.dia as string, kg: lerPeso(x.kg) as number }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
  if (limpos.length) return limpos;
  const antigo = lerPeso(pet.weight);
  return antigo !== null ? [{ dia: "", kg: antigo }] : [];
}

/** Registra um peso no dia (substitui o do mesmo dia). Devolve o mapa novo. */
export function comPeso(todos: unknown, petId: string, dia: string, kg: number): PesosPorPet {
  const mapa: PesosPorPet = todos && typeof todos === "object" && !Array.isArray(todos) ? { ...(todos as PesosPorPet) } : {};
  const lista = Array.isArray(mapa[petId]) ? mapa[petId].filter((x) => x?.dia !== dia) : [];
  mapa[petId] = [...lista, { dia, kg: Math.round(kg * 1000) / 1000 }].sort((a, b) => a.dia.localeCompare(b.dia)).slice(-120);
  return mapa;
}

/* ─────────────────────────────── rotina do dia ─────────────────────────────── */

/**
 * A rotina de sempre (6 tarefas iguais pra todo bicho) punha BANHO e ESCOVAR
 * como tarefa DIÁRIA — o dia nunca fechava. A de agora depende da espécie.
 * Ids de sempre: "walk" é o que as insígnias contam como passeio.
 */
export const ROTINA_PADRAO: Record<"cao" | "gato" | "outro", TarefaDaRotina[]> = {
  cao: [
    { id: "food", label: "Comida · manhã", emoji: "🥣", hora: "08:00" },
    { id: "walk", label: "Passeio", emoji: "🦮" },
    { id: "water", label: "Água fresca", emoji: "💧" },
    { id: "food-noite", label: "Comida · noite", emoji: "🥣", hora: "19:00" },
    { id: "play", label: "Brincar", emoji: "🎾" },
  ],
  gato: [
    { id: "food", label: "Comida · manhã", emoji: "🥣", hora: "08:00" },
    { id: "water", label: "Água fresca", emoji: "💧" },
    { id: "areia", label: "Limpar a areia", emoji: "🧹" },
    { id: "food-noite", label: "Comida · noite", emoji: "🥣", hora: "19:00" },
    { id: "play", label: "Brincar", emoji: "🧶" },
  ],
  outro: [
    { id: "food", label: "Comida", emoji: "🥣" },
    { id: "water", label: "Água fresca", emoji: "💧" },
  ],
};

export const rotinaPadraoDe = (especie: Especie): TarefaDaRotina[] =>
  especie === "cao" ? ROTINA_PADRAO.cao
    : especie === "gato" ? ROTINA_PADRAO.gato
    // peixe não tem "água fresca" pra trocar todo dia: só a comida (o aquário é cuidado com data)
    : especie === "peixe" ? ROTINA_PADRAO.outro.filter((t) => t.id === "food")
    : ROTINA_PADRAO.outro;

/** Tarefas do pet: a lista que a pessoa montou (`pet-routine-tasks-<id>`), ou a padrão da espécie. */
export function tarefasDoPet(pet: Pet, gravada: unknown): TarefaDaRotina[] {
  if (Array.isArray(gravada)) {
    return gravada
      .filter((t) => t && typeof t === "object" && texto((t as TarefaDaRotina).id) && texto((t as TarefaDaRotina).label).trim())
      .map((t) => {
        const o = t as TarefaDaRotina;
        return { ...o, id: texto(o.id), label: texto(o.label).trim(), emoji: texto(o.emoji) || "🐾" };
      });
  }
  return rotinaPadraoDe(especieDe(pet.species));
}

/** `pet-routine-<dia>` como vier → objeto limpo (lixo vira {}). */
export function rotinaValida(bruto: unknown): RotinaDoDia {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const out: RotinaDoDia = {};
  for (const [petId, marcas] of Object.entries(bruto as Record<string, unknown>)) {
    if (!marcas || typeof marcas !== "object" || Array.isArray(marcas)) continue;
    out[petId] = {};
    for (const [t, v] of Object.entries(marcas as Record<string, unknown>)) if (typeof v === "boolean") out[petId][t] = v;
  }
  return out;
}

/** Marca/desmarca uma tarefa no dia, sem tocar nas outras (nem nas de outros pets). */
export function comMarca(rotina: unknown, petId: string, tarefaId: string, valor: boolean): RotinaDoDia {
  const r = rotinaValida(rotina);
  return { ...r, [petId]: { ...(r[petId] ?? {}), [tarefaId]: valor } };
}

/* ─────────────────────────────── ids ─────────────────────────────── */

export const novoId = (prefixo = "") => `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
