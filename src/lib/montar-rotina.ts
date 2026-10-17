/**
 * "ROTINA PRONTA EM 3 TOQUES" (1.0.16, 17/10) — a régua, a chave, os horários e o que vira dado, sem tela.
 * A tela mora em components/rotina/montar/MontarRotina.tsx (o cabeçalho de lá diz como ligar).
 *
 * Ideia do dono: em vez de uma Rotina vazia, 3 perguntas — que horas acorda, o que não pode faltar no
 * dia (chips) e se quer um lembrete de manhã — e a Rotina DE VERDADE já aparece cheia, com horário,
 * e o 1º quadradinho guiado ("Sua rotina está pronta. Marca o primeiro quando fizer.").
 *
 * ── ONDE APARECE (dono, 17/10: "não quero que a pessoa clique em um módulo e apareça um quiz") ──
 *   SÓ pela missão do teste: a dose 1 de quem escolheu Rotina como 1ª área chama
 *   <MontarRotina origem="missao" />. Entrar na Rotina por curiosidade NÃO abre o quiz (lá vai o tutorial
 *   guiado da Rotina, de outro ramo). `MONTAR_ROTINA_NO_MODULO = false` guarda o caminho do módulo
 *   (o hook useMontarRotinaNoModulo existe e devolve sempre "nao"); religar = `true` + build.
 *
 * ── O QUE VIRA DADO (as chaves de sempre da Rotina, sobem pro user_data) ──────────────────────
 *   · `rotina-habits`          ← 1 hábito por item escolhido, na ordem do dia (o 1º é "o primeiro"):
 *       é a tabela HÁBITOS DIÁRIOS da aba MINHA SEMANA, a linha "N hábitos pendentes" das Pendências de
 *       hoje da Home, o widget de hábitos, o Score do Dia (bloco hábitos) e a dose da missão
 *       (`rotina-habits-checked`). Marcar o quadradinho é o caminho normal da Rotina: grade + log por
 *       data + heatmap = o dia na sequência.
 *   · `rotina-schedule`        ← a ROTINA SEMANAL (hora × dia) com cada item no horário sugerido a partir
 *       da hora de acordar: "7:00 Acordar · beber água", "7:30 Treinar", "19:00 Estudar", "22:30 Dormir".
 *       Treinar, Estudar e Trabalho focado de segunda a sexta; o resto todos os dias. Meia hora fora da
 *       grade vira linha extra ordenada (regra da própria Rotina: célula salva nunca some).
 *   · `rotina-agenda-inicio`   ← o "começa às" da agenda = a hora cheia em que acorda (só se ainda não
 *       foi escolhido e se não é o padrão 6:00; a grade vai de 3:00 a 9:00).
 *   · `rotina-lembrete-manha-prefs` ← só com "Sim" no lembrete (lib/rotina-manha).
 *   As três primeiras vão como escrita de SISTEMA (`{ system: true }`): montar a estrutura não conta como
 *   dia anotado nem dispara as ativações/`uso_modulo` — o 1º registro (e o 1º dia da sequência) é o 1º
 *   quadradinho marcado, como o dono pediu.
 *
 * ── A CHAVE ─────────────────────────────────────────────────────────────────────────────────
 *   `MONTAR_ROTINA` (app das lojas) LIGADA · `MONTAR_ROTINA_WEB` (site) desligada.
 *   Metadata do RevenueCat `montar_rotina: "on" | "off"` em QUALQUER offering (a `current` vence) manda
 *   no app sem build (revenuecat.ts registra). QA só no navegador: `?montar-rotina=on|off|auto|recomecar`
 *   (recomecar apaga o "já vi" do aparelho e libera a régua de conta nova). Ordem: QA > metadata > constante.
 *
 * ── QUEM VÊ (deveMostrarMontarRotina) ────────────────────────────────────────────────────────
 *   chave ligada · conta logada (não convidado, não demo) · conta NOVA (< 48 h, a régua da missão; a
 *   força de QA pula só esta) · Rotina sem NENHUM dado (hábito, marca, agenda, ritual, tarefa,
 *   urgência, compromisso, meta do mês) · ainda não terminou nem pulou · menos de 2 vistas sem decisão.
 *   Cliente antigo e quem já usa a Rotina nunca veem.
 *
 * ── UMA VEZ SÓ ──────────────────────────────────────────────────────────────────────────────
 *   "Pronto/pulou" em DOIS lugares: no aparelho (`core-montar-rotina`, em CHAVES_DO_APARELHO — nenhuma
 *   vassoura leva) e na conta (mesma chave via useUserData; volta no login em outro aparelho). Fechar o
 *   app NO MEIO deixa ver de novo UMA vez (1 vista por abertura do app), e ela volta com o que já tinha
 *   sido respondido (rascunho na mesma chave do aparelho).
 *
 * ── O QUE O ONBOARDING JÁ RESPONDEU (reaproveitarDoOnboarding) ─────────────────────────────
 *   Conferido em 17/10: o funil do iPhone (funis/w) guarda a ÁREA e as respostas da dor só até o
 *   cadastro (`limparProgresso` no "liberando"); a Porta grava em `user_metadata.porta` só área e rota.
 *   Ninguém pergunta hora de acordar nem hábito. O que dá pra reaproveitar no aparelho/conta:
 *     · a PERMISSÃO de notificação (pedida no meio do quiz do funil): "negada" → a pergunta do lembrete
 *       SAI (o sistema não mostra o pedido de novo — perguntar seria beco sem saída); "concedida" → o
 *       "Sim" não abre diálogo nenhum;
 *     · "sem aviso" combinado na missão (`core-dia2.horaEscolhida === "sem"`) → a pergunta do lembrete sai;
 *     · o "começa às" da agenda, se a conta já escolheu → vem marcado na 1ª pergunta;
 *     · respostas de quiz que ainda estejam no aparelho e citem um item ("Beber água", "Dormir direito",
 *       "Treinar a semana sem furar"…) → o chip já vem marcado (na prática só o funil antigo da web).
 *
 * ── O LEMBRETE DE MANHÃ ───────────────────────────────────────────────────────────────────────
 *   lib/rotina-manha + notificacoes `agendarRotinaManha` (faixa 1820000): 1 por dia, 15 min depois da
 *   hora de acordar, com os hábitos do dia; nada pro que já foi marcado hoje. É aviso de USO que a
 *   pessoa pediu (como o skincare), não um dos avisos do teste — esses continuam 1 por dia entre eles.
 */
import { isNativeShell } from "@/lib/native-shell";
import { localDayKey } from "@/lib/utils";
import { marcadosDoDia, nomesDosHabitos } from "@/lib/rotina-habitos";

export type ModoChave = "on" | "off";
/** App das lojas. ROLLBACK = "off" aqui (ou metadata `montar_rotina: "off"` no RevenueCat, sem build). */
export const MONTAR_ROTINA: ModoChave = "on";
/** Site (Vercel). */
export const MONTAR_ROTINA_WEB: ModoChave = "off";
/**
 * Abrir sozinho na 1ª entrada da Rotina. DESLIGADO por ordem do dono (17/10): "não quero que a pessoa
 * clique em um módulo e apareça um quiz" — o quiz é só da missão (dose 1 de quem escolheu Rotina);
 * quem entra na Rotina por curiosidade recebe o tutorial guiado do módulo (outro ramo).
 */
export const MONTAR_ROTINA_NO_MODULO = false;

/** Nome da chave no metadata das offerings do RevenueCat. */
export const CHAVE_REMOTA_MONTAR_ROTINA = "montar_rotina";
/** Força de QA (só navegador) — sem prefixo varrido, sobrevive às vassouras. */
export const CHAVE_FORCA_MONTAR_ROTINA = "montar-rotina-force";
export const PARAM_QA_MONTAR_ROTINA = "montar-rotina";
/** "Já vi / feito" — no aparelho (localStorage direto) E na conta (useUserData). Ver chaves-do-aparelho.ts. */
export const CHAVE_MONTAR_ROTINA = "core-montar-rotina";

/** Eventos (sem dado pessoal: só contagens, a faixa da hora de acordar e o passo).
 *  `montar_rotina_passo.n`: 1 acordar · 2 o que não pode faltar · 3 lembrete · 4 pronto (o guia). */
export const EV_VIEW = "montar_rotina_view";
export const EV_PASSO = "montar_rotina_passo";
export const EV_PRONTO = "montar_rotina_pronto";
export const EV_PULAR = "montar_rotina_pular";
export const EV_PRIMEIRO = "montar_rotina_primeiro_marcado";
/** Como o guia do 1º quadradinho terminou: marcou · entendi · tempo · segundo_plano (+ achou_alvo). */
export const EV_GUIA = "montar_rotina_guia";
/** O "Sim" do lembrete abriu o pedido do sistema: `{ concedida }` (separa "Agora não" de "negou no iPhone"). */
export const EV_PERMISSAO = "montar_rotina_permissao";

/** Disparado na window quando a pessoa termina ou pula. `detail: { resultado: "pronto" | "pulou", itens: number }` */
export const EVENTO_MONTAR_ROTINA_FIM = "montar-rotina:fim";
/** Disparado na window quando uma tela abre (`detail: { origem }`) — a do módulo cede pra da missão. */
export const EVENTO_MONTAR_ROTINA_ABERTA = "montar-rotina:aberta";
/** No <html> enquanto a tela OU o guia do 1º quadradinho estão na tela (valor: a origem). Quem tem anel
 *  próprio (missão, tutorial do módulo) espera ele sair. */
export const ATRIBUTO_NA_TELA = "data-montar-rotina";
/** No <html> junto do de cima: "folha" (as perguntas, trava a rolagem do fundo) ou "guia". */
export const ATRIBUTO_FASE = "data-montar-rotina-fase";

export type Resultado = "pronto" | "pulou";
export type OrigemMontar = "modulo" | "missao";

/* ───────────────────────── os itens ───────────────────────── */

export type ItemId = "agua" | "treinar" | "estudar" | "ler" | "meditar" | "focado" | "dormir";
export interface ItemDaRotina {
  id: ItemId;
  emoji: string;
  /** o chip da 2ª pergunta */
  chip: string;
  /** o nome do hábito na tabela HÁBITOS DIÁRIOS (e na Home) */
  habito: string;
  /** o texto na célula da ROTINA SEMANAL */
  agenda: string;
  /** "semana" = segunda a sexta na agenda (o hábito é diário, como todo hábito da Rotina) */
  dias: "todos" | "semana";
}
/** Na ordem dos chips (a do dono). */
export const ITENS_DA_ROTINA: readonly ItemDaRotina[] = [
  { id: "agua", emoji: "💧", chip: "Beber água", habito: "Beber água", agenda: "beber água", dias: "todos" },
  { id: "treinar", emoji: "🏋️", chip: "Treinar", habito: "Treinar", agenda: "Treinar", dias: "semana" },
  { id: "estudar", emoji: "📚", chip: "Estudar", habito: "Estudar", agenda: "Estudar", dias: "semana" },
  { id: "ler", emoji: "📖", chip: "Ler", habito: "Ler", agenda: "Ler", dias: "todos" },
  { id: "meditar", emoji: "🧘", chip: "Meditar", habito: "Meditar", agenda: "Meditar", dias: "todos" },
  { id: "focado", emoji: "🎯", chip: "Trabalhar focado", habito: "Trabalhar focado", agenda: "Trabalho focado", dias: "semana" },
  { id: "dormir", emoji: "🌙", chip: "Dormir cedo", habito: "Dormir cedo", agenda: "Dormir", dias: "todos" },
];
const ITEM: Record<ItemId, ItemDaRotina> = Object.fromEntries(ITENS_DA_ROTINA.map((i) => [i.id, i])) as Record<ItemId, ItemDaRotina>;
export const itemDe = (id: ItemId): ItemDaRotina => ITEM[id];
export const ehItem = (x: unknown): x is ItemId => typeof x === "string" && x in ITEM;
/** Ids válidos, sem repetição, na ordem dos chips. */
export const itensValidos = (lista: unknown): ItemId[] => {
  const marcados = new Set((Array.isArray(lista) ? lista : []).filter(ehItem));
  return ITENS_DA_ROTINA.map((i) => i.id).filter((id) => marcados.has(id));
};

/* ───────────────────────── a hora de acordar ───────────────────────── */

export type OpcaoAcordar = "6h" | "7h" | "8h" | "outro";
export const OPCOES_ACORDAR: readonly { id: OpcaoAcordar; rotulo: string; hora: string | null }[] = [
  { id: "6h", rotulo: "6h", hora: "06:00" },
  { id: "7h", rotulo: "7h", hora: "07:00" },
  { id: "8h", rotulo: "8h", hora: "08:00" },
  { id: "outro", rotulo: "Outro", hora: null },
];
const ehOpcao = (x: unknown): x is OpcaoAcordar => x === "6h" || x === "7h" || x === "8h" || x === "outro";

const RE_HORA = /^(\d{1,2}):(\d{2})$/;
/** "6:5"/"06:05"/"6:05" → "06:05"; lixo → null. */
export const normalizarHora = (h: unknown): string | null => {
  if (typeof h !== "string") return null;
  const m = RE_HORA.exec(h.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${m[2]}`;
};
const DIA_MIN = 1440;
const noDia = (min: number) => ((Math.round(min) % DIA_MIN) + DIA_MIN) % DIA_MIN;
/** "07:30" → 450 */
export const minutosDe = (hora: string): number => {
  const [h, m] = hora.split(":").map(Number);
  return noDia((h || 0) * 60 + (m || 0));
};
/** 450 → "07:30" */
export const horaDe = (min: number): string => {
  const m = noDia(min);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
/** 450 → "7:30" — o formato da ROTINA SEMANAL (as linhas da grade e as chaves de `rotina-schedule`). */
export const horaDaAgenda = (min: number): string => {
  const m = noDia(min);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};
/** 450 → "7h30"; 420 → "7h"; 1140 → "19h" — como a gente fala (frases e chips). */
export const horaFalada = (min: number): string => {
  const m = noDia(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
};
/** A hora ("HH:MM") de uma resposta da 1ª pergunta, ou null se ainda não dá pra seguir. */
export const horaDaResposta = (opcao: OpcaoAcordar | null, outro: string | null | undefined): string | null => {
  if (!opcao) return null;
  if (opcao === "outro") return normalizarHora(outro);
  return OPCOES_ACORDAR.find((o) => o.id === opcao)?.hora ?? null;
};
/** O valor que vai no evento (`acordar`): a hora exata nunca sai do aparelho. */
export const opcaoDaHora = (hora: string): OpcaoAcordar =>
  OPCOES_ACORDAR.find((o) => o.hora === normalizarHora(hora))?.id ?? "outro";

/* ───────────────────────── os horários do dia ───────────────────────── */

/** Arredonda pra meia hora mais perto (a grade da Rotina é de hora em hora; meia hora vira linha extra). */
const meiaHora = (min: number) => noDia(Math.round(min / 30) * 30);
/** Dormir cedo = 8h30 de sono antes de acordar; sem ele, a noite de referência (Ler/Meditar) é 8h antes. */
const SONO_CEDO = 510;
const SONO_PADRAO = 480;

export interface ItemNoDia { item: ItemDaRotina; min: number }
/**
 * O horário sugerido de cada item, a partir da hora de acordar (A):
 *   Beber água A (junto do "Acordar") · Treinar A+30 · Trabalho focado A+2h · Estudar A+12h ·
 *   Dormir A−8h30 · Ler 1 h antes de dormir · Meditar 30 min antes de dormir.
 * Acordando às 7h: 7:00 água · 7:30 treinar · 9:00 trabalho focado · 19:00 estudar · 21:30 ler ·
 * 22:00 meditar · 22:30 dormir. Tudo cai em meia hora cheia (hora "quebrada" no "Outro" é arredondada);
 * só a água fica colada no despertar. Ordenado pelo dia DELA (a partir de quando acorda).
 */
export function horariosDosItens(acordar: string, escolhidos: readonly ItemId[]): ItemNoDia[] {
  const A = minutosDe(acordar);
  const lista = itensValidos(escolhidos);
  const noite = meiaHora(A - (lista.includes("dormir") ? SONO_CEDO : SONO_PADRAO));
  const quando: Record<ItemId, number> = {
    agua: A,
    treinar: meiaHora(A + 30),
    focado: meiaHora(A + 120),
    estudar: meiaHora(A + 720),
    ler: noDia(noite - 60),
    meditar: noDia(noite - 30),
    dormir: noite,
  };
  const desdeAcordar = (m: number) => noDia(m - A);
  return lista
    .map((id) => ({ item: ITEM[id], min: quando[id] }))
    .sort((a, b) => desdeAcordar(a.min) - desdeAcordar(b.min));
}

/** "O primeiro" do guia: o 1º item do dia dela (é a 1ª coluna da tabela de hábitos). */
export const primeiroDoDia = (acordar: string, escolhidos: readonly ItemId[]): ItemNoDia | null =>
  horariosDosItens(acordar, escolhidos)[0] ?? null;

export const DIAS_DA_AGENDA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"] as const;
const DIAS_UTEIS = DIAS_DA_AGENDA.slice(0, 5);

/** Uma linha do "Seu dia" (a prévia da 2ª pergunta): hora, o texto da célula, e se é só de segunda a sexta. */
export interface LinhaDoDia { min: number; texto: string; soSemana: boolean }
/**
 * O dia montado, linha por linha, na ordem do dia (a prévia da tela e a fonte da agenda).
 * Itens que caem na mesma hora dividem a célula ("Acordar · beber água").
 */
export function linhasDoDia(acordar: string, escolhidos: readonly ItemId[]): LinhaDoDia[] {
  const A = minutosDe(acordar);
  const porHora = new Map<number, { textos: string[]; todos: boolean }>();
  const juntar = (min: number, texto: string, todos: boolean) => {
    const atual = porHora.get(min);
    if (atual) { atual.textos.push(texto); atual.todos = atual.todos || todos; }
    else porHora.set(min, { textos: [texto], todos });
  };
  juntar(A, "Acordar", true);
  for (const { item, min } of horariosDosItens(acordar, escolhidos)) juntar(min, item.agenda, item.dias === "todos");
  return [...porHora.entries()]
    .sort(([a], [b]) => noDia(a - A) - noDia(b - A))
    .map(([min, { textos, todos }]) => ({ min, texto: textos.join(" · "), soSemana: !todos }));
}

type Agenda = Record<string, Record<string, string>>;
const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/**
 * A ROTINA SEMANAL a gravar: a agenda que já existe (normalmente vazia — a régua só deixa conta sem
 * Rotina) + cada item no horário, nos dias dele. Célula já preenchida não é apagada: o item entra
 * depois de " · ". Mesma hora, dias diferentes: cada dia leva só o que é dele.
 */
export function agendaParaGravar(acordar: string, escolhidos: readonly ItemId[], atual?: unknown): Agenda {
  const A = minutosDe(acordar);
  const entradas: { min: number; texto: string; dias: readonly string[] }[] = [
    { min: A, texto: "Acordar", dias: DIAS_DA_AGENDA },
    ...horariosDosItens(acordar, escolhidos).map(({ item, min }) => ({ min, texto: item.agenda, dias: item.dias === "todos" ? DIAS_DA_AGENDA : DIAS_UTEIS })),
  ];
  const agenda: Agenda = {};
  if (ehObjeto(atual)) {
    for (const [hora, dias] of Object.entries(atual)) if (ehObjeto(dias)) agenda[hora] = Object.fromEntries(Object.entries(dias).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  }
  const novas: Agenda = {};
  for (const e of entradas) {
    const chave = horaDaAgenda(e.min);
    novas[chave] ??= {};
    for (const dia of e.dias) novas[chave][dia] = novas[chave][dia] ? `${novas[chave][dia]} · ${e.texto}` : e.texto;
  }
  for (const [hora, dias] of Object.entries(novas)) {
    const linha = { ...(agenda[hora] ?? {}) };
    for (const [dia, texto] of Object.entries(dias)) {
      const antes = (linha[dia] ?? "").trim();
      linha[dia] = !antes ? texto : antes.includes(texto) ? antes : `${antes} · ${texto}`;
    }
    agenda[hora] = linha;
  }
  return agenda;
}

/** Nomes da lista de hábitos (aceita o formato antigo `{ name }`), sem vazios. */
const nomesDe = (lista: unknown): string[] =>
  (Array.isArray(lista) ? lista : [])
    .map((h) => (typeof h === "string" ? h : (h as { name?: unknown })?.name))
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((n) => n.trim());
/** A lista de hábitos a gravar: os que já existem + os novos, na ordem do dia, sem repetir (sem caixa). */
export function habitosParaGravar(acordar: string, escolhidos: readonly ItemId[], atual?: unknown): string[] {
  const existentes = nomesDe(atual);
  const ja = new Set(existentes.map((n) => n.toLowerCase()));
  const novos = horariosDosItens(acordar, escolhidos).map(({ item }) => item.habito).filter((n) => !ja.has(n.toLowerCase()));
  return [...existentes, ...novos];
}

/** O "começa às" da ROTINA SEMANAL: a hora cheia em que acorda (a grade aceita 3:00–9:00). Null quando dá
 *  o padrão (6:00) — aí não precisa gravar nada. */
export function inicioDaAgenda(acordar: string): string | null {
  const h = Math.min(9, Math.max(3, Math.floor(minutosDe(acordar) / 60)));
  const inicio = `${h}:00`;
  return inicio === "6:00" ? null : inicio;
}

/* ───────────────────────── a régua ───────────────────────── */

type Leitor = <T>(k: string, f: T) => T;
const cheia = (v: unknown) => Array.isArray(v) && v.length > 0;
/** A Rotina já tem QUALQUER dado da pessoa? (o que a aba MINHA SEMANA e o MEU MÊS mostram) */
export function temDadosDeRotina(get: Leitor): boolean {
  if (nomesDe(get<unknown>("rotina-habits", null)).length) return true;
  for (const k of ["ritual-morning-items", "ritual-night-items", "rotina-day-tasks", "rotina-urgencies", "rotina-compromissos"]) {
    if (cheia(get<unknown>(k, null))) return true;
  }
  const log = get<unknown>("rotina-habit-log", null);
  if (ehObjeto(log) && Object.values(log).some(cheia)) return true;
  const heat = get<unknown>("heatmap-log", null);
  if (ehObjeto(heat) && Object.values(heat).some((v) => v === true || (typeof v === "number" && v > 0))) return true;
  const grade = get<unknown>("rotina-habits-checked", null);
  if (ehObjeto(grade) && Object.values(grade).some((d) => Array.isArray(d) && d.some((x) => x === true))) return true;
  const agenda = get<unknown>("rotina-schedule", null);
  if (ehObjeto(agenda) && Object.values(agenda).some((d) => ehObjeto(d) && Object.values(d).some((t) => typeof t === "string" && t.trim() !== ""))) return true;
  const metas = get<unknown>("month-goals", null);
  if (ehObjeto(metas) && Object.values(metas).some(cheia)) return true;
  return false;
}

/* A régua de conta nova (lib/missao-doses `contaNova`), copiada pra não puxar a missão pro grafo do
   revenuecat.ts (que registra a chave remota daqui). */
const contaNova = (criadoEm: string | null | undefined, agora: number): boolean =>
  !!criadoEm && agora - new Date(criadoEm).getTime() < 48 * 3600e3;

/* ───────────────────────── chave ───────────────────────── */

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

let remota: ModoChave | null = null;
const modoDe = (v: unknown): ModoChave | null => {
  const s = String(v ?? "").toLowerCase();
  return s === "on" ? "on" : s === "off" ? "off" : null;
};
/** Decisão pura: o `montar_rotina` do metadata das offerings (a `current` vence). */
export function lerChaveRemotaMontarRotina(offerings: unknown): ModoChave | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoChave | null = null;
  for (const off of Object.values(o?.all ?? {})) {
    if (off === o?.current) continue;
    const m = modoDe(off?.metadata?.[CHAVE_REMOTA_MONTAR_ROTINA]);
    if (m) lido = m;
  }
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_MONTAR_ROTINA]) ?? lido;
}
/** revenuecat.ts chama a cada getOfferings(). */
export function registrarChaveMontarRotina(offerings: unknown): void {
  try { remota = lerChaveRemotaMontarRotina(offerings); } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarRemotaMontarRotina = (): void => { remota = null; };

const forcaQa = (): ModoChave | null => {
  if (isNativeShell()) return null;
  const f = ls.get(CHAVE_FORCA_MONTAR_ROTINA);
  return f === "on" || f === "off" ? f : null;
};
/** A força de QA está ligada neste navegador (pula a régua de conta nova). */
export const montarRotinaForcadoPorQa = (): boolean => forcaQa() === "on";

let ultimaBusca: string | null = null;
/** Lê `?montar-rotina=` uma vez por busca e guarda neste navegador. Devolve true quando pediu
 *  `recomecar` (quem chama também apaga a marca da CONTA — aqui só existe o aparelho). */
export function guardarForcaMontarRotinaDaUrl(busca?: string): boolean {
  if (isNativeShell()) return false;
  let v: string | null;
  try {
    const texto = busca ?? window.location.search;
    if (texto === ultimaBusca) return false;
    ultimaBusca = texto;
    v = new URLSearchParams(texto).get(PARAM_QA_MONTAR_ROTINA);
  } catch { return false; }
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_MONTAR_ROTINA, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_MONTAR_ROTINA);
  else if (v === "recomecar") { ls.set(CHAVE_FORCA_MONTAR_ROTINA, "on"); ls.del(CHAVE_MONTAR_ROTINA); return true; }
  return false;
}

/** Está ligado AQUI? força de QA (navegador) > metadata do RevenueCat (app) > constante. */
export function montarRotinaLigado(): boolean {
  const f = forcaQa();
  if (f) return f === "on";
  if (isNativeShell()) return (remota ?? MONTAR_ROTINA) === "on";
  return MONTAR_ROTINA_WEB === "on";
}

/* ───────────────────────── marca de uma vez só ───────────────────────── */

export type EtapaComRascunho = "acordar" | "itens" | "lembrete";
/** O que já foi respondido e ainda não virou dado (fechou o app no meio): volta preenchido. */
export interface RascunhoRotina { etapa: EtapaComRascunho; opcao: OpcaoAcordar | null; outro: string | null; itens: ItemId[]; lembrete: boolean | null }
export interface MarcaRotina {
  r?: Resultado;
  em?: string;
  /** de onde abriu quando decidiu (o evento do 1º quadradinho marcado depois leva junto) */
  o?: OrigemMontar;
  vistas?: number;
  rascunho?: RascunhoRotina;
  /** quando o 1º quadradinho depois do "pronto" foi contado (o evento sai uma vez só) */
  primeiro?: string;
}

const lerMarcaJson = (raw: unknown): MarcaRotina | null => {
  if (!raw) return null;
  if (typeof raw === "object") return raw as MarcaRotina;
  try { const v = JSON.parse(String(raw)); return v && typeof v === "object" ? (v as MarcaRotina) : null; } catch { return null; }
};
export const marcaDoAparelho = (): MarcaRotina | null => lerMarcaJson(ls.get(CHAVE_MONTAR_ROTINA));
/** A marca que voltou da conta (o `get` do useUserData). */
export const marcaDaConta = (get?: Leitor): MarcaRotina | null => {
  try { return lerMarcaJson(get?.(CHAVE_MONTAR_ROTINA, null)); } catch { return null; }
};
const gravarNoAparelho = (m: MarcaRotina) => ls.set(CHAVE_MONTAR_ROTINA, JSON.stringify(m));

/** Terminou ou pulou — no aparelho OU na conta. */
export function montarRotinaJaDecidido(get?: Leitor): boolean {
  return !!marcaDoAparelho()?.r || !!marcaDaConta(get)?.r;
}
/** Vista sem decisão (o app fechou no meio): a 2ª é a última. 1 por abertura do app — a tela do módulo
 *  cedendo pra da missão (ou remontando) não gasta a 2ª vista. */
export const MAX_VISTAS_SEM_DECISAO = 2;
let vistaNestaAbertura = false;
export function registrarVistaMontarRotina(): void {
  if (vistaNestaAbertura) return;
  vistaNestaAbertura = true;
  const m = marcaDoAparelho() ?? {};
  gravarNoAparelho({ ...m, vistas: (m.vistas ?? 0) + 1 });
}
/** Só testes: simula fechar e abrir o app de novo (a vista volta a contar). */
export const _novaAberturaMontarRotina = (): void => { vistaNestaAbertura = false; };

export function guardarRascunhoRotina(r: RascunhoRotina): void {
  const m = marcaDoAparelho() ?? {};
  if (m.r) return;
  gravarNoAparelho({ ...m, rascunho: r });
}
export function lerRascunhoRotina(): RascunhoRotina | null {
  const r = marcaDoAparelho()?.rascunho as Partial<RascunhoRotina> | undefined;
  if (!r || (r.etapa !== "acordar" && r.etapa !== "itens" && r.etapa !== "lembrete")) return null;
  const opcao = ehOpcao(r.opcao) ? r.opcao : null;
  const outro = normalizarHora(r.outro);
  const itens = itensValidos(r.itens);
  const lembrete = r.lembrete === true ? true : r.lembrete === false ? false : null;
  if (!opcao && !itens.length && lembrete === null) return null; // nada respondido: não há o que retomar
  // sem a resposta da etapa anterior, volta pra ela (rascunho torto nunca prende ninguém numa tela sem saída)
  const etapa: EtapaComRascunho = !horaDaResposta(opcao, outro) ? "acordar" : r.etapa === "lembrete" && !itens.length ? "itens" : r.etapa;
  return { etapa, opcao, outro, itens, lembrete };
}

/** Grava a decisão no aparelho; devolve a marca pra quem também grava na conta. */
export function marcarMontarRotinaDecidido(r: Resultado, origem: OrigemMontar, agora: Date = new Date()): MarcaRotina {
  const { rascunho: _r, ...sem } = marcaDoAparelho() ?? {};
  const marca: MarcaRotina = { ...sem, r, o: origem, em: agora.toISOString() };
  gravarNoAparelho(marca);
  return marca;
}

/* ───────────────────────── o 1º quadradinho depois do "pronto" ───────────────────────── */

/**
 * A marca GUIADA: o quadradinho de HOJE do 1º hábito (`indice` na lista) está marcado? Outro hábito hoje
 * ou outro dia da semana não contam como a marca do guia (a mesma regra da tabela: grade desta semana,
 * senão o log por data).
 */
export function primeiroMarcadoHoje(p: { habitos: unknown; checked: unknown; semana: unknown; habitLog: unknown; indice: number; hoje: string }): boolean {
  const nomes = nomesDosHabitos(p.habitos);
  if (p.indice < 0 || p.indice >= nomes.length) return false;
  const marcados = marcadosDoDia({
    nomes,
    checked: (ehObjeto(p.checked) ? p.checked : {}) as Record<string, boolean[]>,
    semana: typeof p.semana === "string" ? p.semana : "",
    habitLog: (ehObjeto(p.habitLog) ? p.habitLog : {}) as Record<string, string[]>,
    dia: p.hoje,
    hoje: p.hoje,
  });
  return !!marcados[p.indice];
}

const ehDia = (k: unknown): k is string => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
const diaDoIso = (iso: string | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : localDayKey(d);
};
const diasEntre = (a: string, b: string): number => {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime()) / 864e5);
};

/**
 * O 1º dia, desde o "pronto", com algum hábito marcado (pelo log por data da Rotina, que a tabela e o
 * widget da Home gravam) — e quantos dias depois do "pronto" foi. Null se ainda não marcou nada.
 */
export function primeiroDiaMarcado(habitLog: unknown, desdeIso: string | undefined): { dia: string; dias: number } | null {
  const desde = diaDoIso(desdeIso);
  if (!desde || !ehObjeto(habitLog)) return null;
  const dias = Object.keys(habitLog).filter((k) => ehDia(k) && k >= desde && cheia(habitLog[k])).sort();
  return dias.length ? { dia: dias[0], dias: diasEntre(desde, dias[0]) } : null;
}

/**
 * O 1º quadradinho depois do "pronto" ainda não foi contado? (montou, não pulou, e nem o aparelho nem a
 * conta têm o carimbo `primeiro`). Devolve a marca de quem decidiu, pra quem vai contar.
 */
export function primeiroAindaNaoContado(get?: Leitor): MarcaRotina | null {
  const aparelho = marcaDoAparelho();
  const conta = marcaDaConta(get);
  if (aparelho?.primeiro || conta?.primeiro) return null;
  const base = aparelho?.r ? aparelho : conta;
  return base?.r === "pronto" ? base : null;
}

/** Carimba o 1º quadradinho no aparelho (a conta grava a mesma marca). Devolve null se já tinha. */
export function carimbarPrimeiro(get?: Leitor, agora: Date = new Date()): MarcaRotina | null {
  const base = primeiroAindaNaoContado(get);
  if (!base) return null;
  const marca: MarcaRotina = { ...base, ...(marcaDoAparelho() ?? {}), primeiro: agora.toISOString() };
  gravarNoAparelho(marca);
  return marca;
}

/* ───────────────────────── uma tela por vez (módulo × missão) ───────────────────────── */

const abertas: Record<OrigemMontar, number> = { modulo: 0, missao: 0 };
const pintarAtributo = () => {
  try {
    const html = document.documentElement;
    if (abertas.missao > 0) html.setAttribute(ATRIBUTO_NA_TELA, "missao");
    else if (abertas.modulo > 0) html.setAttribute(ATRIBUTO_NA_TELA, "modulo");
    else { html.removeAttribute(ATRIBUTO_NA_TELA); html.removeAttribute(ATRIBUTO_FASE); }
  } catch { /* sem document */ }
};
/** A tela montou; devolve o "desmontou". */
export function registrarTelaAberta(origem: OrigemMontar): () => void {
  abertas[origem] += 1;
  pintarAtributo();
  try { window.dispatchEvent(new CustomEvent(EVENTO_MONTAR_ROTINA_ABERTA, { detail: { origem } })); } catch { /* sem window */ }
  return () => { abertas[origem] = Math.max(0, abertas[origem] - 1); pintarAtributo(); };
}
/** A missão está com a tela aberta agora (a do módulo não aparece). */
export const montarRotinaAbertoPelaMissao = (): boolean => abertas.missao > 0;

/* ───────────────────────── quem vê ───────────────────────── */

/** Conta nova (< 48 h) — ou a força de QA ligada neste navegador. */
export const contaNovaParaMontarRotina = (criadoEm: string | null | undefined, agora: number = Date.now()): boolean =>
  montarRotinaForcadoPorQa() || contaNova(criadoEm, agora);

export interface ContextoMontarRotina {
  criadoEm: string | null | undefined;
  get: Leitor;
  isGuest: boolean;
  isPreview?: boolean;
  agora?: number;
}
/** A tela aparece? (a missão pergunta antes de abrir; o módulo, se um dia for religado, também) */
export function deveMostrarMontarRotina({ criadoEm, get, isGuest, isPreview, agora = Date.now() }: ContextoMontarRotina): boolean {
  if (!montarRotinaLigado()) return false;
  if (isGuest || isPreview) return false;
  if (montarRotinaJaDecidido(get)) return false;
  if ((marcaDoAparelho()?.vistas ?? 0) >= MAX_VISTAS_SEM_DECISAO) return false;
  if (!contaNovaParaMontarRotina(criadoEm, agora)) return false;
  if (temDadosDeRotina(get)) return false;
  return true;
}

/* ───────────────────────── o que o onboarding já respondeu ───────────────────────── */

export type PerguntaDoLembrete = "perguntar" | "negado" | "sem_aviso";
export interface DoOnboarding {
  opcao: OpcaoAcordar | null;
  outro: string | null;
  itens: ItemId[];
  /** "negado": a permissão de notificação foi negada no sistema; "sem_aviso": a missão combinou "sem aviso". */
  lembrete: PerguntaDoLembrete;
}
/** Respostas de quiz que citam um item com todas as letras (funil antigo da web e o funil W até o cadastro). */
const RESPOSTA_PARA_ITEM: Record<string, ItemId> = {
  "Beber água": "agua",
  "Bater a meta de água todo dia": "agua",
  "Dormir direito": "dormir",
  "Dormir melhor essa semana": "dormir",
  "Treinar a semana sem furar": "treinar",
  "Começo a treinar e desisto": "treinar",
  "Ler 10 minutos": "ler",
};
const lerJsonLocal = (k: string, ler: (k: string) => string | null): unknown => {
  try { const raw = ler(k); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
/**
 * O que já dá pra preencher sem perguntar (ver o cabeçalho). `permissao` é o estadoPermissao() do
 * plugin (null = ainda não sabe: pergunta). `ler` = o localStorage (injetável nos testes).
 */
export function reaproveitarDoOnboarding(p: {
  get: Leitor;
  permissao?: "granted" | "denied" | "prompt" | "indisponivel" | null;
  ler?: (k: string) => string | null;
}): DoOnboarding {
  const ler = p.ler ?? ls.get;
  // 1ª pergunta: o "começa às" que a conta já escolheu na agenda
  const inicio = normalizarHora(p.get<unknown>("rotina-agenda-inicio", null));
  const opcao: OpcaoAcordar | null = inicio ? opcaoDaHora(inicio) : null;
  const outro = inicio && opcao === "outro" ? inicio : null;
  // 2ª pergunta: respostas de quiz que ainda estão no aparelho
  const respostas: unknown[] = [];
  const quiz = lerJsonLocal("funnel-quiz-answers", ler);
  if (ehObjeto(quiz)) respostas.push(...Object.values(quiz));
  const funilW = lerJsonLocal("core-funil-w-respostas", ler);
  const doW = ehObjeto(funilW) ? (funilW as { v?: unknown }).v : null;
  if (ehObjeto(doW)) respostas.push(...Object.values(doW));
  const itens = itensValidos(respostas.map((r) => (typeof r === "string" ? RESPOSTA_PARA_ITEM[r.trim()] : undefined)));
  // 3ª pergunta: permissão negada no sistema, ou "sem aviso" combinado na missão
  const dia2 = lerJsonLocal("core-dia2", ler);
  const lembrete: PerguntaDoLembrete = p.permissao === "denied" ? "negado"
    : ehObjeto(dia2) && dia2.horaEscolhida === "sem" ? "sem_aviso"
    : "perguntar";
  return { opcao, outro, itens, lembrete };
}
