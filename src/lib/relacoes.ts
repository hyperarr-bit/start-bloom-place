import { localDayKey, parseLocalDay } from "@/lib/utils";

/**
 * RELAÇÕES — a conta pura do módulo (29/09, Onda 1).
 *
 * O módulo era aberto por 29% das pessoas e quase ninguém ficava: 60% passavam
 * menos de 10 s NO MÊS inteiro, e 89% de quem via o cartão de pessoas tinha a
 * lista vazia (o "Comece pelas pessoas" aparecia pra 227 de 256). Ao mesmo
 * tempo, 21 pessoas foram até a central de notificações ligar o "Aniversário
 * chegando" — o quarto aviso mais ligado do app — e só 4 tinham alguém com
 * data pra ser avisado. A demanda existe; o que faltava era o começo.
 *
 * AS CHAVES NÃO MUDAM DE TIPO (regra da casa, 28/09: o app antigo lê a mesma
 * nuvem). Tudo o que é novo entra como CAMPO OPCIONAL nos objetos de sempre, e
 * os campos que o app antigo lê continuam sempre gravados como texto:
 *   rel-people   Pessoa[]    + circulo, semAno, cadencia, cadenciaDesde
 *   rel-dates    DataEspecial[] + pessoaId
 *   rel-moments  Momento[]   + pessoaId, tipo
 *   rel-gifts    Presente[]  + pessoaId, preco
 *   rel-events   Evento[]    (igual)
 * O que liga um presente/momento/data a uma pessoa era o NOME digitado
 * (`person`). Continua valendo pro dado antigo; o novo leva também o id, que
 * sobrevive a renomear.
 */

export const CHAVE_PESSOAS = "rel-people";
export const CHAVE_DATAS = "rel-dates";
export const CHAVE_MOMENTOS = "rel-moments";
export const CHAVE_PRESENTES = "rel-gifts";
export const CHAVE_EVENTOS = "rel-events";

export type Circulo = "familia" | "amigos" | "amor" | "trabalho" | "outros";
export const CIRCULOS: { id: Circulo; rotulo: string }[] = [
  { id: "familia", rotulo: "Família" },
  { id: "amigos", rotulo: "Amigos" },
  { id: "amor", rotulo: "Amor" },
  { id: "trabalho", rotulo: "Trabalho" },
  { id: "outros", rotulo: "Outros" },
];

export interface Pessoa {
  id: string;
  name: string;
  relation: string;
  /** "YYYY-MM-DD" ou "" (sem aniversário). */
  birthday: string;
  /** Livre: o que lembrar da pessoa (gostos, tamanho, alergias, nomes dos filhos). */
  notes?: string;
  /** (29/09) família, amigos, amor, trabalho — sem ele, deduzido da relação. */
  circulo?: Circulo;
  /** (29/09) não sei o ano: o aniversário é gravado com o ano 2000 (bissexto, cabe 29/02). */
  semAno?: boolean;
  /** (29/09) de quantos em quantos dias lembrar de falar com a pessoa; 0/ausente = não lembrar. */
  cadencia?: number;
  /** (29/09) dia em que a frequência foi escolhida — conta a primeira vez de quem nunca teve conversa registrada. */
  cadenciaDesde?: string;
}

export interface DataEspecial {
  id: string;
  title: string;
  person: string;
  /** "YYYY-MM-DD" — sempre preenchida (o app antigo formata sem checar). */
  date: string;
  type: "birthday" | "anniversary" | "custom";
  pessoaId?: string;
}

export type TipoMomento = "momento" | "conversa" | "encontro";
export interface Momento {
  id: string;
  date: string;
  person: string;
  description: string;
  pessoaId?: string;
  /** (29/09) "conversa" = o "falei hoje" do manter contato. Ausente = momento. */
  tipo?: TipoMomento;
}

export type StatusPresente = "idea" | "bought" | "delivered";
export interface Presente {
  id: string;
  person: string;
  idea: string;
  link: string;
  status: StatusPresente;
  pessoaId?: string;
  /** (29/09) quanto custa, em reais. Opcional. */
  preco?: number;
}

export interface Evento {
  id: string;
  name: string;
  date: string;
  location: string;
  rsvp: "confirmed" | "maybe" | "declined";
  tasks: { id: string; text: string; done: boolean }[];
}

/* ------------------------------------------------------------ leitura defensiva */

const ehTexto = (v: unknown): v is string => typeof v === "string";
const texto = (v: unknown): string => (ehTexto(v) ? v : v == null ? "" : String(v));
const lista = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));

const ehCirculo = (v: unknown): v is Circulo => CIRCULOS.some((c) => c.id === v);

/**
 * A lista de pessoas como veio da nuvem, sem derrubar a tela com item torto.
 * PRESERVA qualquer campo que não conhece (o spread): gravar de volta nunca
 * apaga o que um app mais novo pôs ali.
 */
export const pessoasValidas = (v: unknown): Pessoa[] =>
  lista(v)
    .filter((p) => texto(p.id) !== "" && texto(p.name).trim() !== "")
    .map((p) => ({
      ...(p as object),
      id: texto(p.id),
      name: texto(p.name),
      relation: texto(p.relation),
      birthday: ehDiaValido(texto(p.birthday)) ? texto(p.birthday) : "",
      notes: texto(p.notes),
      ...(ehCirculo(p.circulo) ? { circulo: p.circulo } : { circulo: undefined }),
      /* "sem ano" só vale enquanto o aniversário ainda está no ano de marcação (2000). O app
         ANTIGO só conhece `birthday`: quando a pessoa põe o ano de verdade lá, o `semAno` que
         ficou no item (ele preserva o resto com `...p`) não pode esconder a idade pra sempre (30/09). */
      semAno: p.semAno === true && texto(p.birthday).startsWith(`${ANO_SEM_ANO}-`),
      cadencia: Number.isFinite(Number(p.cadencia)) && Number(p.cadencia) > 0 ? Math.round(Number(p.cadencia)) : 0,
    })) as Pessoa[];

export const datasValidas = (v: unknown): DataEspecial[] =>
  lista(v)
    .filter((d) => texto(d.id) !== "" && ehDiaValido(texto(d.date)))
    .map((d) => ({
      ...(d as object),
      id: texto(d.id),
      title: texto(d.title),
      person: texto(d.person),
      date: texto(d.date),
      type: d.type === "birthday" || d.type === "anniversary" ? d.type : "custom",
    })) as DataEspecial[];

export const momentosValidos = (v: unknown): Momento[] =>
  lista(v)
    .filter((m) => texto(m.id) !== "")
    .map((m) => ({
      ...(m as object),
      id: texto(m.id),
      date: texto(m.date),
      person: texto(m.person),
      description: texto(m.description),
      tipo: m.tipo === "conversa" || m.tipo === "encontro" ? m.tipo : "momento",
    })) as Momento[];

export const presentesValidos = (v: unknown): Presente[] =>
  lista(v)
    .filter((g) => texto(g.id) !== "" && texto(g.idea).trim() !== "")
    .map((g) => ({
      ...(g as object),
      id: texto(g.id),
      person: texto(g.person),
      idea: texto(g.idea),
      link: texto(g.link),
      status: g.status === "bought" || g.status === "delivered" ? g.status : "idea",
      ...(Number.isFinite(Number(g.preco)) && Number(g.preco) > 0 ? { preco: Number(g.preco) } : {}),
    })) as Presente[];

export const eventosValidos = (v: unknown): Evento[] =>
  lista(v)
    .filter((e) => texto(e.id) !== "" && texto(e.name).trim() !== "")
    .map((e) => ({
      ...(e as object),
      id: texto(e.id),
      name: texto(e.name),
      date: texto(e.date),
      location: texto(e.location),
      rsvp: e.rsvp === "confirmed" || e.rsvp === "declined" ? e.rsvp : "maybe",
      tasks: lista(e.tasks).map((t) => ({ ...(t as object), id: texto(t.id), text: texto(t.text), done: t.done === true })),
    })) as Evento[];

/* ------------------------------------------------------------ datas */

/** "YYYY-MM-DD" que existe no calendário (31/04 não passa; 29/02 só em ano bissexto). */
export function ehDiaValido(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (me < 1 || me > 12 || d < 1) return false;
  return d <= new Date(a, me, 0).getDate();
}

/** Ano usado quando a pessoa não sabe o ano: bissexto, pra 29/02 caber. */
export const ANO_SEM_ANO = 2000;

/** Monta a data gravada a partir do que a pessoa escolheu (ano opcional). Devolve "" se não fecha. */
export function montarAniversario(dia: number, mes: number, ano?: number | null): string {
  const a = ano && ano >= 1900 && ano <= 2100 ? ano : ANO_SEM_ANO;
  const s = `${a}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return ehDiaValido(s) ? s : "";
}

const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
/** Dias inteiros entre dois dias locais (b − a), sem tropeçar em horário de verão. */
export const diasEntre = (a: Date, b: Date) => Math.round((utc(b) - utc(a)) / 86400000);

const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * O próximo dia (hoje incluído) em que cai o dia/mês. 29/02 em ano comum vira
 * 28/02 — quem nasceu em 29/02 comemora no último dia de fevereiro.
 */
export function proximaOcorrencia(mes: number, dia: number, hoje: Date = new Date()): Date {
  const base = meiaNoite(hoje);
  for (const ano of [base.getFullYear(), base.getFullYear() + 1]) {
    const ultimo = new Date(ano, mes, 0).getDate();
    const d = new Date(ano, mes - 1, Math.min(dia, ultimo));
    if (d.getTime() >= base.getTime()) return d;
  }
  return new Date(base.getFullYear() + 1, mes - 1, dia);
}

export type ItemDeData = {
  /** "bday-<pessoaId>" pros aniversários de PESSOAS; o id da data especial nas outras. */
  id: string;
  tipo: "aniversario" | "casal" | "data";
  titulo: string;
  pessoaId?: string;
  circulo?: Circulo;
  mes: number;
  dia: number;
  /** ano conhecido (null = não sei o ano) */
  ano: number | null;
  proxima: Date;
  /** dias até a próxima (0 = hoje) */
  dias: number;
  /** a idade que a pessoa faz / quantos anos a data completa, quando dá pra saber */
  faz: number | null;
  origem: "pessoa" | "data";
  /** o registro de rel-dates (só origem "data") */
  data?: DataEspecial;
};

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** A pessoa é a dona deste registro? Pelo id (dado novo) ou pelo nome (dado antigo). */
export const ehDaPessoa = (p: Pessoa, reg: { pessoaId?: string; person?: string }) =>
  reg.pessoaId ? reg.pessoaId === p.id : !!reg.person && normalizar(reg.person) === normalizar(p.name);

/** Quantos anos a data completa na ocorrência (null se o ano é desconhecido ou estranho). */
function anosNa(ano: number | null, ocorrencia: Date): number | null {
  if (ano == null) return null;
  const n = ocorrencia.getFullYear() - ano;
  return n >= 1 && n <= 120 ? n : null;
}

/**
 * Todas as datas do ano (aniversários de PESSOAS + datas especiais), da mais
 * próxima pra mais longe. Uma data especial "aniversário" da mesma pessoa e do
 * mesmo dia que o aniversário cadastrado na pessoa não aparece duas vezes (o
 * app antigo deixava — a AGENDA mostrava "Aniversário de Mãe" e "Aniversário
 * da mãe" lado a lado).
 */
export function datasDoAno(pessoas: Pessoa[], datas: DataEspecial[], hoje: Date = new Date()): ItemDeData[] {
  const out: ItemDeData[] = [];
  for (const p of pessoas) {
    if (!ehDiaValido(p.birthday)) continue;
    const [a, m, d] = p.birthday.split("-").map(Number);
    const proxima = proximaOcorrencia(m, d, hoje);
    const ano = p.semAno ? null : a;
    out.push({
      id: `bday-${p.id}`, tipo: "aniversario", titulo: p.name, pessoaId: p.id, circulo: circuloDe(p),
      mes: m, dia: d, ano, proxima, dias: diasEntre(hoje, proxima), faz: anosNa(ano, proxima), origem: "pessoa",
    });
  }
  for (const dt of datas) {
    if (!ehDiaValido(dt.date)) continue;
    const [a, m, d] = dt.date.split("-").map(Number);
    const dono = pessoas.find((p) => ehDaPessoa(p, dt));
    if (dt.type === "birthday" && dono && ehDiaValido(dono.birthday)) {
      const [, m2, d2] = dono.birthday.split("-").map(Number);
      if (m2 === m && d2 === d) continue; // repetida
    }
    const proxima = proximaOcorrencia(m, d, hoje);
    const casal = dt.type === "anniversary";
    out.push({
      id: dt.id, tipo: dt.type === "birthday" ? "aniversario" : casal ? "casal" : "data",
      titulo: dt.title || dt.person || "Data especial", pessoaId: dono?.id, circulo: dono ? circuloDe(dono) : undefined,
      mes: m, dia: d, ano: a, proxima, dias: diasEntre(hoje, proxima),
      // "1 ano de namoro" gravado em 2025: em 2026 são 2 anos — a conta, não o título, diz quantos
      faz: dt.type === "custom" ? null : anosNa(a, proxima),
      origem: "data", data: dt,
    });
  }
  return out.sort((x, y) => x.dias - y.dias || x.titulo.localeCompare(y.titulo, "pt-BR"));
}

/** As próximas N datas (ou todas dentro da janela, o que for maior até o teto). */
export function proximasDatas(itens: ItemDeData[], janelaDias = 30, minimo = 3, teto = 8): ItemDeData[] {
  const dentro = itens.filter((i) => i.dias <= janelaDias);
  return (dentro.length >= minimo ? dentro : itens.slice(0, minimo)).slice(0, teto);
}

const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA_CURTA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
export const mesCurto = (mes: number) => MESES_CURTOS[mes - 1] ?? "";
export const mesLongo = (mes: number) => MESES_LONGOS[mes - 1] ?? "";
export const semanaCurta = (d: Date) => SEMANA_CURTA[d.getDay()];
export const ddmm = (mes: number, dia: number) => `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;

/** "hoje", "amanhã", "em 4 dias", "em 5 semanas", "em 2 meses". */
export function quandoFalta(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias <= 31) return `em ${dias} dias`;
  if (dias < 60) return `em ${Math.round(dias / 7)} semanas`;
  const meses = Math.round(dias / 30.4);
  return meses <= 1 ? "em 1 mês" : `em ${meses} meses`;
}

/** "há 5 dias", "há 3 semanas", "há 2 meses", "há mais de 1 ano". */
export function haQuanto(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 14) return `há ${dias} dias`;
  if (dias < 60) return `há ${Math.round(dias / 7)} semanas`;
  if (dias < 365) return `há ${Math.round(dias / 30.4)} meses`;
  return "há mais de 1 ano";
}

/** Rótulo do "faz" de cada tipo: "faz 29", "3 anos juntos", "completa 10 anos". */
export function rotuloDoFaz(item: Pick<ItemDeData, "tipo" | "faz">): string {
  if (item.faz == null) return "";
  if (item.tipo === "aniversario") return `faz ${item.faz}`;
  if (item.tipo === "casal") return item.faz === 1 ? "1 ano juntos" : `${item.faz} anos juntos`;
  return item.faz === 1 ? "1 ano" : `${item.faz} anos`;
}

/** Chave do "Agora não" do começo pronto (sufixo -visto: fica fora da sequência de dias anotados). */
export const CHAVE_COMECO_VISTO = "rel-comeco-visto";

/** "4 dias", "hoje", "3 sem.", "10 meses" — a coluna FALTA da tabela. */
export function faltaCurta(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias <= 31) return `${dias} dias`;
  if (dias < 60) return `${Math.round(dias / 7)} sem.`;
  const m = Math.round(dias / 30.4);
  return m <= 1 ? "1 mês" : `${m} meses`;
}

/* ------------------------------------------------------------ círculos */

/** O círculo da pessoa: o escolhido, ou deduzido do texto da relação (dado antigo). */
export function circuloDe(p: Pick<Pessoa, "circulo" | "relation">): Circulo {
  if (p.circulo && ehCirculo(p.circulo)) return p.circulo;
  return circuloDaRelacao(p.relation);
}

export function circuloDaRelacao(relacao: string): Circulo {
  const r = normalizar(relacao || "");
  if (!r) return "outros";
  if (/namor|marido|esposa|noiv|\bamor\b|companheir|mozao|conjuge|crush|parceir/.test(r)) return "amor";
  if (/\b(mae|mamae|pai|papai|irma|irmao|irmaos|avo|avos|vo|vovo|tia|tio|prima|primo|sogr|cunhad|filh|sobrinh|afilhad|madrinha|padrinho|enteado|enteada|madrasta|padrasto|nora|genro|familia|bisavo)/.test(r)) return "familia";
  if (/chefe|colega|trabalho|client|socio|socia|gestor|gerente|equipe|professor|professora|aluno|aluna|mentor|lider/.test(r)) return "trabalho";
  if (/amig|best|bff|vizinh|comadre|compadre/.test(r)) return "amigos";
  return "outros";
}

/* ------------------------------------------------------------ manter contato */

/** Frequências oferecidas (em dias). 0 = não lembrar. */
export const CADENCIAS: { dias: number; rotulo: string }[] = [
  { dias: 0, rotulo: "Não lembrar" },
  { dias: 7, rotulo: "Toda semana" },
  { dias: 14, rotulo: "A cada 2 semanas" },
  { dias: 30, rotulo: "Todo mês" },
  { dias: 90, rotulo: "A cada 3 meses" },
];
export const rotuloCadencia = (dias: number) =>
  CADENCIAS.find((c) => c.dias === dias)?.rotulo ?? (dias > 0 ? `A cada ${dias} dias` : "Não lembrar");

/** O dia (YYYY-MM-DD) do último contato registrado com a pessoa, ou null. */
export function ultimoContatoDe(p: Pessoa, momentos: Momento[], hoje: Date = new Date()): string | null {
  const limite = localDayKey(hoje);
  let ultimo: string | null = null;
  for (const m of momentos) {
    if (!ehDiaValido(m.date) || m.date > limite) continue; // momento marcado no futuro não é contato
    if (!ehDaPessoa(p, m)) continue;
    if (!ultimo || m.date > ultimo) ultimo = m.date;
  }
  return ultimo;
}

export type SituacaoDoContato = {
  cadencia: number;
  ultimo: string | null;
  /** dias desde o último contato (null = nunca registrado) */
  desde: number | null;
  /** YYYY-MM-DD em que a conversa "vence" (null = sem frequência) */
  vence: string | null;
  /** dias de atraso (≥ 0 = já está na hora; negativo = ainda falta) */
  atraso: number;
  devido: boolean;
};

export function situacaoDoContato(p: Pessoa, momentos: Momento[], hoje: Date = new Date()): SituacaoDoContato {
  const cadencia = p.cadencia && p.cadencia > 0 ? p.cadencia : 0;
  const ultimo = ultimoContatoDe(p, momentos, hoje);
  const desde = ultimo ? diasEntre(parseLocalDay(ultimo), hoje) : null;
  if (!cadencia) return { cadencia: 0, ultimo, desde, vence: null, atraso: 0, devido: false };
  const ancora = ultimo ?? (p.cadenciaDesde && ehDiaValido(p.cadenciaDesde) ? p.cadenciaDesde : localDayKey(hoje));
  const venceData = parseLocalDay(ancora);
  venceData.setDate(venceData.getDate() + cadencia);
  const atraso = diasEntre(venceData, hoje);
  return { cadencia, ultimo, desde, vence: localDayKey(venceData), atraso, devido: atraso >= 0 };
}

/** Quem está na hora de receber um "oi", o mais atrasado primeiro (proporcional à frequência). */
export function pessoasPraFalar(pessoas: Pessoa[], momentos: Momento[], hoje: Date = new Date()) {
  return pessoas
    .map((pessoa) => ({ pessoa, situacao: situacaoDoContato(pessoa, momentos, hoje) }))
    .filter((x) => x.situacao.devido)
    .sort((a, b) => (b.situacao.atraso / b.situacao.cadencia) - (a.situacao.atraso / a.situacao.cadencia) || a.pessoa.name.localeCompare(b.pessoa.name, "pt-BR"));
}

/* ------------------------------------------------------------ começo pronto */

/**
 * "Quem você não pode esquecer?" — os papéis mais comuns, pra quem abre o
 * módulo vazio sair com 3 pessoas e as datas em menos de um minuto. Nos
 * papéis de família o nome já vem preenchido (é assim que a maioria guarda a
 * mãe no celular: "Mãe"); nos outros, a pessoa digita.
 */
export type SugestaoDeInicio = { id: string; rotulo: string; emoji: string; relation: string; circulo: Circulo; nome: string };
export const COMECO_PRONTO: SugestaoDeInicio[] = [
  { id: "mae", rotulo: "Mãe", emoji: "🌷", relation: "Mãe", circulo: "familia", nome: "Mãe" },
  { id: "pai", rotulo: "Pai", emoji: "☕", relation: "Pai", circulo: "familia", nome: "Pai" },
  { id: "amor", rotulo: "Meu amor", emoji: "💛", relation: "Meu amor", circulo: "amor", nome: "" },
  { id: "melhor-amiga", rotulo: "Melhor amiga", emoji: "✨", relation: "Melhor amiga", circulo: "amigos", nome: "" },
  { id: "irma", rotulo: "Irmã", emoji: "🌻", relation: "Irmã", circulo: "familia", nome: "" },
  { id: "irmao", rotulo: "Irmão", emoji: "🎈", relation: "Irmão", circulo: "familia", nome: "" },
  { id: "avo", rotulo: "Avó", emoji: "🧶", relation: "Avó", circulo: "familia", nome: "Vó" },
  { id: "sogra", rotulo: "Sogra", emoji: "🍰", relation: "Sogra", circulo: "familia", nome: "" },
  { id: "afilhado", rotulo: "Afilhado(a)", emoji: "🧸", relation: "Afilhado(a)", circulo: "familia", nome: "" },
  { id: "amiga", rotulo: "Amiga", emoji: "💌", relation: "Amiga", circulo: "amigos", nome: "" },
];
/** Quantas pessoas o começo pronto pede — "3 pessoas pra não esquecer". */
export const META_DO_COMECO = 3;

/** Qual sugestão já foi usada (a relação e o círculo batem com alguém da lista). */
export const sugestaoUsada = (s: SugestaoDeInicio, pessoas: Pessoa[]) =>
  pessoas.some((p) => normalizar(p.relation) === normalizar(s.relation));

/** Os começos de linha que o "o que lembrar" oferece (um toque, sem formulário). */
export const CAMPOS_SUGERIDOS = ["Gosta de", "Não gosta de", "Tamanho", "Alergias", "Filhos e pets", "Perguntar sobre"];

/* ------------------------------------------------------------ presentes */

export const presentesDe = (p: Pessoa, presentes: Presente[]) => presentes.filter((g) => ehDaPessoa(p, g));

export const ORDEM_STATUS: StatusPresente[] = ["idea", "bought", "delivered"];
export const proximoStatus = (s: StatusPresente): StatusPresente => ORDEM_STATUS[(ORDEM_STATUS.indexOf(s) + 1) % ORDEM_STATUS.length];
export const ROTULO_STATUS: Record<StatusPresente, string> = { idea: "Ideia", bought: "Comprado", delivered: "Entregue" };

/** "R$ 89,90" */
export const reais = (v: number) => `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

/** Lê "89,90", "89.90", "R$ 1.299,00" → número (ou null). */
export function lerReais(s: string): number | null {
  const limpo = s.replace(/[^\d,.-]/g, "");
  if (!limpo) return null;
  const n = limpo.includes(",") ? Number(limpo.replace(/\./g, "").replace(",", ".")) : Number(limpo);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Link digitado sem protocolo vira https:// (só http/https saem daqui). */
export function linkSeguro(link: string): string | null {
  const l = link.trim();
  if (!l) return null;
  const comProtocolo = /^https?:\/\//i.test(l) ? l : `https://${l}`;
  try {
    const u = new URL(comProtocolo);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ mensagens */

export const primeiroNome = (nome: string) => (nome.trim().split(/\s+/)[0] || nome).trim();

/**
 * MENSAGENS PRONTAS (29/09). No Brasil o canal é o WhatsApp (mensagem/parabéns
 * aparece em 4,4% das avaliações BR contra 0,8% nas dos EUA, e cobrar pra
 * mandar "pelo zap" vira 1★): três modelos escritos à mão, em português e sem
 * gênero, que a pessoa ainda edita no WhatsApp antes de mandar. Nada de IA.
 */
export type ModeloDeMensagem = { id: string; rotulo: string; texto: (nome: string) => string };
export const MODELOS_PARABENS: ModeloDeMensagem[] = [
  { id: "carinho", rotulo: "Carinhosa", texto: (n) => `Feliz aniversário, ${primeiroNome(n)}! 🎉 Que seu novo ano seja leve e cheio de coisa boa. Que bom ter você na minha vida. Um beijo!` },
  { id: "festa", rotulo: "Animada", texto: (n) => `Parabéns, ${primeiroNome(n)}! 🥳 Mais um ano de muita história pra contar. Bora comemorar?` },
  { id: "curta", rotulo: "Curtinha", texto: (n) => `Feliz aniversário, ${primeiroNome(n)}! Muita saúde e alegria pra você 💛` },
];
export const MODELOS_OI: ModeloDeMensagem[] = [
  { id: "lembrei", rotulo: "Lembrei de você", texto: (n) => `Oi, ${primeiroNome(n)}! Lembrei de você 💛 Como você tá?` },
  { id: "cafe", rotulo: "Bora marcar", texto: (n) => `Oi, ${primeiroNome(n)}! Faz um tempinho que a gente não se fala… bora marcar um café?` },
  { id: "saber", rotulo: "Saber de você", texto: (n) => `Oi, ${primeiroNome(n)}! Passando pra saber de você. Tudo bem por aí?` },
];

/** O texto que vai pro WhatsApp (a pessoa escolhe o contato e pode editar antes de mandar). */
export const mensagemDeParabens = (nome: string): string => MODELOS_PARABENS[0].texto(nome);
export const mensagemDeOi = (nome: string): string => MODELOS_OI[0].texto(nome);

/* ------------------------------------------------------------ ids */

let ultimoId = 0;
/** Id novo (texto, como os antigos), único mesmo com dois cliques no mesmo milissegundo. */
export function novoId(): string {
  const agora = Date.now();
  ultimoId = agora > ultimoId ? agora : ultimoId + 1;
  return String(ultimoId);
}
