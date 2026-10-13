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
  (nome ?? "")
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
 * Os médicos que a pessoa já usou — das consultas e dos exames — pra sugerir no
 * campo "Pedido por". Um por chave; a especialidade é a do registro mais
 * recente que tem especialidade (médico que mudou de clínica não muda de área,
 * mas a grafia mais nova é a que a pessoa usa hoje).
 */
export function medicosConhecidos(consultas: ComMedicoConsulta[], exames: ComMedicoExame[]): MedicoConhecido[] {
  const todos = [
    ...(Array.isArray(consultas) ? consultas : []).map((c) => ({ nome: c?.doctor ?? "", esp: c?.specialty ?? "", date: c?.date ?? "" })),
    ...(Array.isArray(exames) ? exames : []).map((e) => ({ nome: e?.medico ?? "", esp: e?.especialidade ?? "", date: e?.date ?? "" })),
  ]
    .filter((x) => chaveMedico(x.nome))
    // mais antigo primeiro: o mais recente sobrescreve
    .sort((a, b) => a.date.localeCompare(b.date));
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

export interface PastaDeMedico { chave: string; rotulo: string; total: number }

/** Os chips do topo da lista de exames: um por médico (ordem alfabética) + "Sem médico" se misturado.
 *  O nome do chip é a grafia mais usada; empate → a mais "caprichada" (com
 *  acento, ponto e maiúscula: "Dr. Hélio" ganha de "dr helio"). A especialidade
 *  é a do exame mais recente que tem uma. */
export function pastasDosExames(exames: ComMedicoExame[]): PastaDeMedico[] {
  const lista = Array.isArray(exames) ? exames : [];
  const porChave = new Map<string, { grafias: Map<string, number>; esp: string; espData: string; total: number }>();
  let semMedico = 0;
  for (const e of lista) {
    const k = chaveMedico(e?.medico);
    if (!k) { semMedico++; continue; }
    const g = porChave.get(k) ?? { grafias: new Map<string, number>(), esp: "", espData: "", total: 0 };
    const nome = (e.medico ?? "").trim();
    g.grafias.set(nome, (g.grafias.get(nome) ?? 0) + 1);
    const esp = e.especialidade?.trim() ?? "";
    const data = e.date ?? "";
    if (esp && (!g.esp || data >= g.espData)) { g.esp = esp; g.espData = data; }
    g.total++;
    porChave.set(k, g);
  }
  const capricho = (n: string) => n.length + (/[A-ZÀ-Ý]/.test(n) ? 1 : 0);
  const pastas = [...porChave.entries()]
    .map(([chave, g]) => {
      const nome = [...g.grafias.entries()].sort((a, b) => b[1] - a[1] || capricho(b[0]) - capricho(a[0]) || a[0].localeCompare(b[0]))[0][0];
      return { chave, rotulo: rotuloMedico(nome, g.esp), total: g.total };
    })
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  if (pastas.length && semMedico) pastas.push({ chave: SEM_MEDICO, rotulo: "Sem médico", total: semMedico });
  return pastas;
}

/** O exame entra na pasta escolhida? */
export const naPasta = (e: ComMedicoExame, pasta: string): boolean => {
  if (pasta === TODOS) return true;
  const k = chaveMedico(e?.medico);
  return pasta === SEM_MEDICO ? !k : k === pasta;
};
