/**
 * "PASTA DO MÉDICO" nos exames (13/10, chamado de cliente começando muitos
 * exames: "queria separar os exames por médico — o neuro pediu uns, a médica
 * da família pediu outros").
 *
 * O exame ganha "Pedido por" (nome + especialidade), ambos opcionais. A pasta
 * é um FILTRO, não uma estrutura nova: o dado continua sendo a mesma lista em
 * `core-saude-exams-v2` (chave sincronizada nunca muda de tipo), e exame
 * antigo sem médico segue aparecendo em "Todos".
 *
 * O mesmo médico digitado de jeitos diferentes ("Dr. Hélio", "dr hélio ")
 * cai na mesma pasta: a chave ignora maiúscula, acento, ponto e espaço extra.
 *
 * 16/10 (chamado de cliente nos DOCUMENTOS: "faltam as categorias de médicos e
 * especialistas… tem que ser didático sempre que eu abrir qualquer pasta"):
 * documento também tem médico; pastas por especialidade; e a estante junta
 * consultas + exames + documentos de cada pasta (pastasDeSaude/conteudoDaPasta).
 */

export const ESPECIALIDADES_COMUNS = [
  "Clínico geral",
  "Médico da família",
  "Neurologia",
  "Cardiologia",
  "Endocrinologia",
  "Ginecologia",
  "Ortopedia",
  "Dermatologia",
  "Oftalmologia",
  "Urologia",
  "Gastroenterologia",
  "Psiquiatria",
  "Pediatria",
  "Otorrino",
] as const;

/** Chave da pasta: "Dr. Hélio" e "dr helio" são o mesmo médico. Vazio = sem médico. */
export const chaveMedico = (nome?: string | null): string =>
  (typeof nome === "string" ? nome : "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "Dr. Hélio · Neurologia" (ou só o nome, sem especialidade). */
export const rotuloMedico = (nome: string, especialidade?: string | null): string => {
  const n = nome.trim();
  const e = (especialidade ?? "").trim();
  return n && e ? `${n} · ${e}` : n || e;
};

export interface MedicoConhecido { nome: string; especialidade: string }

type ComMedicoConsulta = { doctor?: string; specialty?: string; date?: string };
type ComMedicoExame = { medico?: string; especialidade?: string; date?: string };

/**
 * Os médicos que a pessoa já usou — das consultas, dos exames e dos documentos
 * (16/10) — pra sugerir no campo do médico. Um por chave; a especialidade é a
 * do registro mais recente que tem especialidade (médico que mudou de clínica
 * não muda de área, mas a grafia mais nova é a que a pessoa usa hoje).
 */
export function medicosConhecidos(
  consultas: ComMedicoConsulta[],
  exames: ComMedicoExame[],
  documentos: ComMedicoExame[] = [],
): MedicoConhecido[] {
  const comoExame = (lista: ComMedicoExame[]) =>
    (Array.isArray(lista) ? lista : []).map((e) => ({ nome: e?.medico ?? "", esp: e?.especialidade ?? "", date: e?.date ?? "" }));
  const todos = [
    ...(Array.isArray(consultas) ? consultas : []).map((c) => ({ nome: c?.doctor ?? "", esp: c?.specialty ?? "", date: c?.date ?? "" })),
    ...comoExame(exames),
    ...comoExame(documentos),
  ]
    .filter((x) => typeof x.nome === "string" && typeof x.esp === "string" && chaveMedico(x.nome))
    // mais antigo primeiro: o mais recente sobrescreve
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const porChave = new Map<string, MedicoConhecido>();
  for (const x of todos) {
    const k = chaveMedico(x.nome);
    const antes = porChave.get(k);
    porChave.set(k, { nome: x.nome.trim(), especialidade: x.esp.trim() || antes?.especialidade || "" });
  }
  return [...porChave.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** O médico conhecido com este nome (ignorando grafia), se houver. */
export const acharMedico = (conhecidos: MedicoConhecido[], nome: string): MedicoConhecido | undefined => {
  const k = chaveMedico(nome);
  return k ? conhecidos.find((m) => chaveMedico(m.nome) === k) : undefined;
};

/**
 * Digitou/escolheu o médico: preenche a especialidade se ela estava vazia ou
 * ainda era a que veio do médico anterior (trocar de "Dr. Hélio" pra "Dra.
 * Camila" não pode deixar "Neurologia" pendurada). Especialidade digitada à mão
 * nunca é sobrescrita.
 */
export function aoEscolherMedico(
  atual: { medico?: string; especialidade?: string },
  novoNome: string,
  conhecidos: MedicoConhecido[],
): { medico: string; especialidade: string } {
  const anterior = acharMedico(conhecidos, atual.medico ?? "");
  const novo = acharMedico(conhecidos, novoNome);
  const esp = (atual.especialidade ?? "").trim();
  const veioDoAnterior = !esp || (!!anterior && esp === anterior.especialidade);
  if (novo?.especialidade && veioDoAnterior) return { medico: novoNome, especialidade: novo.especialidade };
  if (!novo && anterior && veioDoAnterior && esp) return { medico: novoNome, especialidade: "" };
  return { medico: novoNome, especialidade: atual.especialidade ?? "" };
}

export const SEM_MEDICO = "__sem__";
export const TODOS = "__todos__";
/** Pasta de especialidade (16/10): `esp:cardiologia`. A de médico é a chave pura. */
export const PREFIXO_ESPECIALIDADE = "esp:";

/**
 * Chave da especialidade: "Cardiologista", "cardiologia" e "Cardio" são a
 * mesma pasta — a consulta costuma vir com o profissional ("Dermatologista") e
 * o exame com a área ("Dermatologia").
 */
const APELIDOS_ESPECIALIDADE: Record<string, string> = {
  cardio: "cardiologia", dermato: "dermatologia", neuro: "neurologia", gineco: "ginecologia",
  endocrino: "endocrinologia", orto: "ortopedia", gastro: "gastroenterologia", oftalmo: "oftalmologia",
  otorrinolaringologia: "otorrino", "medica da familia": "medico da familia", "clinica geral": "clinico geral",
  clinico: "clinico geral", "clinica medica": "clinico geral",
};
export const chaveEspecialidade = (esp?: string | null): string => {
  const k = chaveMedico(typeof esp === "string" ? esp : "")
    .replace(/logista$/, "logia")
    .replace(/pedista$/, "pedia")
    .replace(/iatra$/, "iatria");
  return APELIDOS_ESPECIALIDADE[k] ?? k;
};

export type TipoDePasta = "medico" | "especialidade" | "sem";
export interface PastaDeMedico { chave: string; rotulo: string; total: number; tipo?: TipoDePasta }

/** Qualquer coisa que pode ir pra uma pasta: exame, documento ou consulta já convertida. */
export type ItemDePasta = { medico?: string; especialidade?: string; date?: string };

const textoOuVazio = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * As pastas de uma lista (chips do topo dos Exames e dos Documentos, e a
 * estante de pastas):
 *  1. uma por MÉDICO (ordem alfabética). O nome do chip é a grafia mais usada;
 *     empate → a mais "caprichada" (com acento, ponto e maiúscula: "Dr. Hélio"
 *     ganha de "dr helio"). A especialidade é a do registro mais recente que
 *     tem uma.
 *  2. uma por ESPECIALIDADE (16/10, pedido de cliente: "faltam as categorias de
 *     médicos e especialistas") — só quando ela junta mais do que o chip do
 *     médico já mostra: dois médicos da mesma área, ou registro com a área mas
 *     sem o nome do médico. "Dr. Hélio · Neurologia" sozinho não ganha uma
 *     pasta "Neurologia" idêntica do lado.
 *  3. "Sem médico", se houver mistura.
 */
export function pastasDosItens(itens: ItemDePasta[]): PastaDeMedico[] {
  const lista = (Array.isArray(itens) ? itens : []).filter((e) => e && typeof e === "object");
  const porChave = new Map<string, { grafias: Map<string, number>; esp: string; espData: string; total: number }>();
  const porEsp = new Map<string, { grafias: Map<string, number>; medicos: Set<string>; semMedico: number; total: number }>();
  let semMedico = 0;
  for (const e of lista) {
    const nome = textoOuVazio(e.medico).trim();
    const esp = textoOuVazio(e.especialidade).trim();
    const data = textoOuVazio(e.date);
    const k = chaveMedico(nome);
    const ke = chaveEspecialidade(esp);
    if (ke) {
      const g = porEsp.get(ke) ?? { grafias: new Map<string, number>(), medicos: new Set<string>(), semMedico: 0, total: 0 };
      g.grafias.set(esp, (g.grafias.get(esp) ?? 0) + 1);
      if (k) g.medicos.add(k); else g.semMedico++;
      g.total++;
      porEsp.set(ke, g);
    }
    if (!k) { semMedico++; continue; }
    const g = porChave.get(k) ?? { grafias: new Map<string, number>(), esp: "", espData: "", total: 0 };
    g.grafias.set(nome, (g.grafias.get(nome) ?? 0) + 1);
    if (esp && (!g.esp || data >= g.espData)) { g.esp = esp; g.espData = data; }
    g.total++;
    porChave.set(k, g);
  }
  const capricho = (n: string) => n.length + (/[A-ZÀ-Ý]/.test(n) ? 1 : 0);
  const maisUsada = (grafias: Map<string, number>) =>
    [...grafias.entries()].sort((a, b) => b[1] - a[1] || capricho(b[0]) - capricho(a[0]) || a[0].localeCompare(b[0]))[0][0];
  const medicos: PastaDeMedico[] = [...porChave.entries()]
    .map(([chave, g]) => ({ chave, rotulo: rotuloMedico(maisUsada(g.grafias), g.esp), total: g.total, tipo: "medico" as const }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const especialidades: PastaDeMedico[] = [...porEsp.entries()]
    .filter(([, g]) => g.medicos.size >= 2 || g.semMedico > 0)
    .map(([ke, g]) => {
      // nome da ÁREA: "Cardiologista" (como a consulta costuma vir) vira
      // "Cardiologia" da lista de sugestões; "Médica da família" fica como está
      const usada = maisUsada(g.grafias);
      const comum = ESPECIALIDADES_COMUNS.find((c) => chaveEspecialidade(c) === ke);
      const rotulo = comum && /(ista|iatra)$/i.test(usada) ? comum : usada;
      return { chave: PREFIXO_ESPECIALIDADE + ke, rotulo, total: g.total, tipo: "especialidade" as const };
    })
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const pastas = [...medicos, ...especialidades];
  if (pastas.length && semMedico) pastas.push({ chave: SEM_MEDICO, rotulo: "Sem médico", total: semMedico, tipo: "sem" });
  return pastas;
}

/** Os chips do topo da lista de exames (13/10) — agora com as especialidades (16/10). */
export const pastasDosExames = (exames: ComMedicoExame[]): PastaDeMedico[] => pastasDosItens(exames);

/** O item (exame, documento ou consulta convertida) entra na pasta escolhida? */
export const naPasta = (e: ItemDePasta, pasta: string): boolean => {
  if (pasta === TODOS) return true;
  const k = chaveMedico(textoOuVazio(e?.medico));
  if (pasta === SEM_MEDICO) return !k;
  if (pasta.startsWith(PREFIXO_ESPECIALIDADE)) {
    const ke = chaveEspecialidade(textoOuVazio(e?.especialidade));
    return !!ke && ke === pasta.slice(PREFIXO_ESPECIALIDADE.length);
  }
  return !!k && k === pasta;
};

/** A consulta vista como item de pasta (o médico dela é `doctor`). */
export const consultaComoItem = (c: ComMedicoConsulta): ItemDePasta => ({
  medico: textoOuVazio(c?.doctor), especialidade: textoOuVazio(c?.specialty), date: textoOuVazio(c?.date),
});

/**
 * A ESTANTE (16/10): as pastas juntando consultas, exames e documentos, e o que
 * tem dentro de cada uma, separado por tipo e do mais recente pro mais antigo.
 */
export function pastasDeSaude<C extends ComMedicoConsulta, E extends ItemDePasta, D extends ItemDePasta>(
  dados: { consultas: C[]; exames: E[]; documentos: D[] },
): PastaDeMedico[] {
  const arr = <T,>(v: T[]) => (Array.isArray(v) ? v : []);
  return pastasDosItens([...arr(dados.consultas).map(consultaComoItem), ...arr(dados.exames), ...arr(dados.documentos)]);
}

export function conteudoDaPasta<C extends ComMedicoConsulta, E extends ItemDePasta, D extends ItemDePasta>(
  pasta: string,
  dados: { consultas: C[]; exames: E[]; documentos: D[] },
): { consultas: C[]; exames: E[]; documentos: D[]; total: number } {
  const arr = <T,>(v: T[]) => (Array.isArray(v) ? v : []).filter((x) => x && typeof x === "object");
  const recentePrimeiro = (a: { date?: string }, b: { date?: string }) => textoOuVazio(b.date).localeCompare(textoOuVazio(a.date));
  const consultas = arr(dados.consultas).filter((c) => naPasta(consultaComoItem(c), pasta)).sort(recentePrimeiro);
  const exames = arr(dados.exames).filter((e) => naPasta(e, pasta)).sort(recentePrimeiro);
  const documentos = arr(dados.documentos).filter((d) => naPasta(d, pasta)).sort(recentePrimeiro);
  return { consultas, exames, documentos, total: consultas.length + exames.length + documentos.length };
}
