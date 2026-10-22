/**
 * O PACOTE "SEU 2027" DENTRO DO APP (21/10) — o upsell de R$ 19,90 da web (src/lib/upsell-2027.ts). Só aparece pra
 * conta com `core-pacote-2027` = { comprado: true, em } (gravada pelo servidor no pagamento, chave da CONTA em
 * user_data, o mesmo jeito do Kit Primeiro Mês). Sem ela, nada — nem cadeado, nem anúncio, nem link de compra (a
 * compra é só na web; o app iOS nunca mostra Pix/site).
 *
 * O QUE ENTREGA (só o que o app faz de verdade):
 *   1. PLANEJAR 2027 (4 folhas): 3 metas → módulo Metas (`goals-board-v2`, com os 4 trimestres como grupos de ação e
 *      ano 2027 na etiqueta `goals-etiquetas`); quanto gastar/guardar por mês → fica no pacote e no PDF (Finanças não
 *      tem orçamento anual planejado; os limites por categoria seguem em Finanças → Limites, na revisão do mês); as
 *      datas que importam → aniversários e outras datas em Relações (`rel-dates`, repetem todo ano), check-ups em Saúde
 *      (`core-saude-appointments`: o app das lojas avisa na véspera, como toda consulta); a hora da revisão → 12
 *      compromissos na Rotina (`rotina-compromissos`, dia 1 de cada mês, aviso na hora — no app das lojas, que agenda
 *      com até 60 dias de antecedência).
 *   2. 12 REVISÕES DO MÊS: abrem no dia 1 de cada mês de 2027; 5 tarefas que abrem a tela certa (retrospectiva do mês
 *      que passou, Metas, Finanças, Relações → Datas, o cofrinho) + 1 dica curta do mês. Progresso na conta.
 *   3. BÔNUS: o Cofrinho das 52 semanas (R$ 1 a R$ 52 = R$ 1.378; tabela marcável, ordem livre ou invertida) e o
 *      Planner 2027 pra imprimir (src/lib/pacote-2027-pdf.ts: o "Imprimir → Salvar como PDF" do navegador).
 *
 * TUDO O QUE O PACOTE GRAVA NOS MÓDULOS tem dono: o id começa com `p27-` (datas, consultas, compromissos) ou está em
 * `criados.metas` — salvar de novo ATUALIZA o que é do pacote e nunca toca no resto. Meta que a pessoa já editou não é
 * apagada (só o título acompanha o plano). Chave sincronizada nunca muda de tipo: listas continuam listas.
 */

export const ANO_2027 = 2027;
export const CHAVE_PACOTE_2027 = "core-pacote-2027";
/** As respostas do "Planejar 2027" + o que foi criado nos módulos + o progresso das revisões. */
export const CHAVE_PLANO_2027 = "core-pacote-2027-plano";
export const CHAVE_COFRINHO_2027 = "core-pacote-2027-cofrinho";
/** "Já viu a explicação do pacote" — família `core-tip-seen-*` (conta, sincronizada; já classificada). */
export const CHAVE_DICA_2027 = "core-tip-seen-pacote-2027";
export const PREFIXO_P27 = "p27-";

export interface Pacote2027 { comprado: true; em?: string; pedido?: string }
export const pacote2027Liberado = (v: unknown): v is Pacote2027 =>
  !!v && typeof v === "object" && (v as { comprado?: unknown }).comprado === true;

/* ───────────────────────────── o plano ───────────────────────────── */

export type TipoData2027 = "aniversario" | "checkup" | "data";
export interface Data2027 { id: string; tipo: TipoData2027; titulo: string; /** "2027-MM-DD" */ dia: string }
export interface Plano2027 {
  v: 1;
  metas: string[];
  gastarMes: number;
  guardarMes: number;
  datas: Data2027[];
  /** "HH:MM" da revisão do mês; null = sem compromisso na Rotina */
  horaRevisao: string | null;
  /** quando salvou no CORE (null = ainda não planejou) */
  salvoEm: string | null;
  /** ids das metas criadas no Metas (na ordem das 3) */
  criadasMetas: string[];
  /** mês ("1".."12") → tarefa → dia em que marcou */
  revisoes: Record<string, Record<string, string>>;
}
export const novoPlano2027 = (): Plano2027 => ({
  v: 1, metas: ["", "", ""], gastarMes: 0, guardarMes: 0, datas: [], horaRevisao: "20:00", salvoEm: null, criadasMetas: [], revisoes: {},
});

const DIA_2027 = /^2027-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v) * 100) / 100 : 0);
const txt = (v: unknown, max = 80) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Tolerante: qualquer coisa vira um plano válido. */
export function lerPlano2027(v: unknown): Plano2027 {
  const o = v && typeof v === "object" ? (v as Partial<Plano2027>) : {};
  const metas = Array.isArray(o.metas) ? o.metas.slice(0, 3).map((m) => txt(m)) : [];
  while (metas.length < 3) metas.push("");
  const datas = (Array.isArray(o.datas) ? o.datas : [])
    .filter((d): d is Data2027 => !!d && typeof d === "object" && typeof (d as Data2027).id === "string" && DIA_2027.test(String((d as Data2027).dia)))
    .map((d) => ({ id: d.id.slice(0, 40), tipo: (["aniversario", "checkup", "data"] as const).includes(d.tipo) ? d.tipo : "data", titulo: txt(d.titulo) || "Data", dia: d.dia }))
    .slice(0, 40);
  const revisoes: Record<string, Record<string, string>> = {};
  if (o.revisoes && typeof o.revisoes === "object") {
    for (const [m, r] of Object.entries(o.revisoes)) {
      const n = Number(m);
      if (!Number.isInteger(n) || n < 1 || n > 12 || !r || typeof r !== "object") continue;
      revisoes[String(n)] = Object.fromEntries(Object.entries(r).filter(([, d]) => typeof d === "string")) as Record<string, string>;
    }
  }
  return {
    v: 1, metas, gastarMes: num(o.gastarMes), guardarMes: num(o.guardarMes), datas,
    horaRevisao: o.horaRevisao === null ? null : HORA.test(String(o.horaRevisao ?? "")) ? String(o.horaRevisao) : "20:00",
    salvoEm: typeof o.salvoEm === "string" ? o.salvoEm : null,
    criadasMetas: Array.isArray(o.criadasMetas) ? o.criadasMetas.filter((s): s is string => typeof s === "string").slice(0, 3) : [],
    revisoes,
  };
}

export const metasPreenchidas = (p: Plano2027): string[] => p.metas.map((m) => m.trim()).filter(Boolean);
export const guardarNoAno = (p: Plano2027): number => Math.round(p.guardarMes * 12 * 100) / 100;

export const IDEIAS_DE_META = ["💰 Quitar uma dívida", "✈️ Fazer uma viagem", "📚 Terminar um curso", "🩺 Cuidar da saúde", "🏡 Organizar a casa", "🐷 Juntar uma reserva"];
export const HORAS_REVISAO = ["08:00", "12:00", "20:00", "21:00"];

/* ───────────────────────────── gravar nos módulos ───────────────────────────── */

const TRIMESTRES = ["Jan–Mar", "Abr–Jun", "Jul–Set", "Out–Dez"];
type Obj = Record<string, unknown>;
const lista = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === "object") : []);
const mapa = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Obj) } : {});
const ehDoPacote = (x: Obj) => typeof x.id === "string" && x.id.startsWith(PREFIXO_P27);

export interface ModulosAtuais { goals: unknown; etiquetas: unknown; relDates: unknown; consultas: unknown; compromissos: unknown }
export interface ModulosNovos { goals: Obj[]; etiquetas: Record<string, unknown>; relDates: Obj[]; consultas: Obj[]; compromissos: Obj[]; criadasMetas: string[] }

/** O id de cada coisa que o pacote cria nos módulos (dono = o prefixo). */
export const idDaData = (d: Data2027) => `${PREFIXO_P27}${d.id}`;
export const idDaRevisao = (mes: number) => `${PREFIXO_P27}rev-${String(mes).padStart(2, "0")}`;

/**
 * O que salvar em cada módulo com o plano. Puro: recebe o que está lá e devolve o novo valor de cada chave.
 * `novoId` (Date.now) cria o id da meta do jeito do GoalsBoardV2 (o ano da meta vem do id quando falta etiqueta).
 */
export function aplicarPlano2027(p: Plano2027, atuais: ModulosAtuais, novoId: (i: number) => string = (i) => String(Date.now() + i)): ModulosNovos {
  // METAS: atualiza o título das que o pacote criou; cria as que faltam; nunca apaga meta (pode ter conteúdo dela)
  const goals = lista(atuais.goals).map((g) => ({ ...g }));
  const etiquetas = mapa(atuais.etiquetas);
  const criadas: string[] = [];
  p.metas.forEach((titulo, i) => {
    const t = titulo.trim();
    const antigo = p.criadasMetas[i];
    const existente = antigo ? goals.find((g) => g.id === antigo) : undefined;
    if (existente) {
      if (t) { existente.title = t; existente.vision = { ...mapa(existente.vision), meta: t, tempo: "2027" }; }
      criadas.push(antigo);
      return;
    }
    if (!t) { criadas.push(""); return; }
    const id = novoId(i);
    goals.push({
      id, title: t,
      actionGroups: TRIMESTRES.map((label, k) => ({ id: `${id}-t${k + 1}`, label: `${label} 2027:`, tasks: [] })),
      referenceLinks: [], referenceImages: [],
      vision: { meta: t, objetivo: "", tempo: "2027" },
      problems: [{ id: `${id}-p1`, problem: "", solution: "" }],
    });
    etiquetas[id] = { tags: [], ano: ANO_2027, notas: "" };
    criadas.push(id);
  });
  while (criadas.length && !criadas[criadas.length - 1]) criadas.pop();

  // DATAS (Relações): as do pacote são refeitas a partir do plano; as da pessoa ficam como estão
  const rel = lista(atuais.relDates).filter((d) => !ehDoPacote(d));
  for (const d of p.datas) {
    if (d.tipo === "checkup") continue;
    rel.push({ id: idDaData(d), title: d.tipo === "aniversario" ? `🎂 Aniversário: ${d.titulo}` : d.titulo, person: d.tipo === "aniversario" ? d.titulo : "", date: d.dia, type: "custom" });
  }

  // CHECK-UPS (Saúde): idem — o app das lojas avisa na véspera (consulta-avisos)
  const consultas = lista(atuais.consultas).filter((c) => !ehDoPacote(c));
  for (const d of p.datas) {
    if (d.tipo !== "checkup") continue;
    consultas.push({ id: idDaData(d), doctor: d.titulo, specialty: "Check-up", date: d.dia, time: "", address: "", questions: "" });
  }

  // REVISÃO DO MÊS (Rotina): 12 compromissos, dia 1 de cada mês, aviso na hora
  const compromissos = lista(atuais.compromissos).filter((c) => !ehDoPacote(c));
  if (p.horaRevisao) {
    for (let m = 1; m <= 12; m++) {
      compromissos.push({ id: idDaRevisao(m), titulo: "Revisão do mês · Seu 2027", data: `2027-${String(m).padStart(2, "0")}-01`, hora: p.horaRevisao, aviso: 0, origem: "pacote-2027" });
    }
  }
  return { goals, etiquetas, relDates: rel, consultas, compromissos, criadasMetas: criadas };
}

/* ───────────────────────────── as 12 revisões ───────────────────────────── */

export const MESES_2027 = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
/** Uma linha por mês — lembretes gerais do calendário brasileiro, sem prometer nada. */
export const DICA_DO_MES = [
  "IPVA, IPTU e material escolar pesam. Olhe antes de gastar.",
  "Carnaval: separe o valor antes da folia.",
  "Começa a declaração do Imposto de Renda: junte os comprovantes.",
  "Ainda dá tempo do Imposto de Renda. Confira se falta algum papel.",
  "Dia das Mães: o presente cabe no mês?",
  "Metade do ano: como estão as 3 metas?",
  "Férias escolares: planeje os passeios antes.",
  "Dia dos Pais e volta às aulas.",
  "Faltam 4 meses: ajuste as metas, sem culpa.",
  "Dia das Crianças: combine o valor antes.",
  "Black Friday: só o que já estava na lista.",
  "13º e presentes: feche o ano com calma.",
];

/** Dia 1 do mês (local) — a revisão abre nele. */
export const aberturaDoMes = (mes: number) => new Date(ANO_2027, mes - 1, 1);
export const mesAberto = (mes: number, hoje: Date = new Date()) => hoje.getTime() >= aberturaDoMes(mes).getTime();
/** A revisão "da vez": a do mês corrente de 2027 (antes de 2027: janeiro; depois: dezembro). */
export const mesDaVez = (hoje: Date = new Date()): number =>
  hoje.getFullYear() < ANO_2027 ? 1 : hoje.getFullYear() > ANO_2027 ? 12 : hoje.getMonth() + 1;

export type DestinoDaRevisao = { rota: string; rotulo: string } | { interno: "cofrinho"; rotulo: string };
export interface TarefaDaRevisao { id: string; titulo: string; como: string; destino: DestinoDaRevisao }

const dm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/* ───────────────────────────── o cofrinho ───────────────────────────── */

export const SEMANAS_COFRINHO = 52;
export const TOTAL_COFRINHO = (SEMANAS_COFRINHO * (SEMANAS_COFRINHO + 1)) / 2; // 1378
export interface Cofrinho2027 { marcadas: number[]; invertido: boolean }
export const lerCofrinho = (v: unknown): Cofrinho2027 => {
  const o = v && typeof v === "object" ? (v as Partial<Cofrinho2027>) : {};
  const marcadas = Array.isArray(o.marcadas)
    ? [...new Set(o.marcadas.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= SEMANAS_COFRINHO))].sort((a, b) => a - b)
    : [];
  return { marcadas, invertido: o.invertido === true };
};
/** Semana 1 = R$ 1 … semana 52 = R$ 52 (invertido: semana 1 = R$ 52). */
export const valorDaSemana = (semana: number, invertido: boolean) => (invertido ? SEMANAS_COFRINHO + 1 - semana : semana);
export const totalGuardado = (c: Cofrinho2027) => c.marcadas.reduce((s, n) => s + valorDaSemana(n, c.invertido), 0);
export const alternarSemana = (c: Cofrinho2027, semana: number): Cofrinho2027 =>
  ({ ...c, marcadas: c.marcadas.includes(semana) ? c.marcadas.filter((n) => n !== semana) : [...c.marcadas, semana].sort((a, b) => a - b) });
/** A semana N começa em 01/01/2027 + 7(N−1) dias. As semanas de um mês = as que começam nele. */
export const inicioDaSemana = (semana: number) => new Date(ANO_2027, 0, 1 + 7 * (semana - 1));
export const semanasDoMes = (mes: number): number[] =>
  Array.from({ length: SEMANAS_COFRINHO }, (_, i) => i + 1).filter((s) => inicioDaSemana(s).getMonth() === mes - 1);

export function tarefasDoMes(mes: number, p: Plano2027, c: Cofrinho2027 = { marcadas: [], invertido: false }): TarefaDaRevisao[] {
  const nome = MESES_2027[mes - 1];
  const anterior = mes === 1 ? "Dezembro" : MESES_2027[mes - 2];
  const metas = metasPreenchidas(p);
  const datas = p.datas.filter((d) => Number(d.dia.slice(5, 7)) === mes).sort((a, b) => a.dia.localeCompare(b.dia));
  const sem = semanasDoMes(mes);
  const valorMes = sem.reduce((s, n) => s + valorDaSemana(n, c.invertido), 0);
  return [
    { id: "olhar", titulo: `Olhe o seu ${anterior.toLowerCase()}`, como: "A retrospectiva do mês que passou: o que funcionou, o que pesou.", destino: { rota: `/retrospectiva?mes=${encodeURIComponent(anterior)}`, rotulo: "Abrir a retrospectiva" } },
    { id: "metas", titulo: `Suas metas: 1 passo pra ${nome.toLowerCase()}`, como: metas.length ? metas.join(" · ") : "Escreva no trimestre da meta o passo deste mês.", destino: { rota: "/desenvolvimento?tab=metas", rotulo: "Abrir Metas" } },
    { id: "limites", titulo: `Os limites de ${nome.toLowerCase()}`, como: p.gastarMes > 0 ? `Gastar até ${brl(p.gastarMes)} e guardar ${brl(p.guardarMes)}. Ponha o teto das categorias.` : "Ponha o teto de gasto das categorias que mais pesam.", destino: { rota: "/financas", rotulo: "Abrir Finanças → Limites" } },
    { id: "datas", titulo: `As datas de ${nome.toLowerCase()}`, como: datas.length ? datas.map((d) => `${d.titulo} ${dm(d.dia)}`).join(" · ") : "Confira aniversários e datas do mês.", destino: { rota: "/relacionamentos?aba=datas", rotulo: "Abrir Relações → Datas" } },
    { id: "cofrinho", titulo: `Cofrinho: semanas ${sem[0]} a ${sem[sem.length - 1]}`, como: `${brl(valorMes)} no mês, se fizer na ordem.`, destino: { interno: "cofrinho", rotulo: "Abrir o cofrinho" } },
  ];
}

export const revisaoFeita = (p: Plano2027, mes: number): number => Object.keys(p.revisoes[String(mes)] ?? {}).length;
export const revisoesCompletas = (p: Plano2027): number =>
  Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => revisaoFeita(p, m) >= 5).length;
export const marcarTarefa = (p: Plano2027, mes: number, tarefa: string, feito: boolean, dia: string): Plano2027 => {
  const atual = { ...(p.revisoes[String(mes)] ?? {}) };
  if (feito) atual[tarefa] = dia; else delete atual[tarefa];
  return { ...p, revisoes: { ...p.revisoes, [String(mes)]: atual } };
};
