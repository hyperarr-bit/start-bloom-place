/**
 * PENDÊNCIAS DE HOJE PERSONALIZÁVEIS (10/10).
 *
 * Chamado (2ª pessoa pedindo a mesma coisa): "como configurar as pendências do
 * dia na página inicial? Tem coisas que eu gostaria de retirar: aparece pra
 * registrar o peso, eu não quero fazer isso diariamente, prefiro semanalmente.
 * Também não gostaria que aparecesse anotar as refeições."
 *
 * Cada TIPO de pendência automática da Home (hábitos, treino, água, refeições,
 * suplementos, leitura, humor, gasto, peso, sono, ideia, gratidão) pode ser
 * escondido; e o peso pode ser cobrado 1x por semana, num dia escolhido. O que
 * está escondido sai da lista, da contagem "N pendentes" E do Score do Dia — o
 * score não cobra o que a pessoa escondeu (lembrando do caso "fiz tudo e só vai
 * até 95%", 10/09): os blocos que sobram são reescalados pra fechar em 100.
 *
 * Compromissos, tarefas e contas a vencer que a própria pessoa criou NÃO são
 * ocultáveis por tipo — são dela.
 *
 * A preferência mora numa chave NOVA sincronizada (`home-pendencias-prefs`);
 * nenhuma chave existente muda. O app antigo das lojas não conhece a chave e
 * segue mostrando tudo — nada quebra.
 */

export const CHAVE_PENDENCIAS_PREFS = "home-pendencias-prefs";

export type TipoPendencia =
  | "habitos" | "treino" | "agua" | "refeicoes" | "suplementos" | "leitura"
  | "humor" | "gasto" | "peso" | "sono" | "ideia" | "gratidao";

export type FrequenciaPeso = "diaria" | "semanal";

export interface PendenciasPrefs {
  /** Tipos escondidos ("Ocultar sempre"). */
  ocultos: TipoPendencia[];
  /** Peso: todo dia (padrão) ou 1x por semana num dia (0 = domingo … 6 = sábado). */
  peso: { frequencia: FrequenciaPeso; diaSemana: number };
  /** 1.0.19 (dono 26/10): os tipos que a pessoa LIGOU à mão em Personalizar. Só a conta nova usa (nos primeiros dias
   *  ela vê só o que já usa — lib/pendencias-novato — e o que ligar aqui aparece mesmo sem uso). Ausente = nenhum; o
   *  app antigo não conhece o campo e segue mostrando tudo o que não está em `ocultos`. */
  ligados?: TipoPendencia[];
}

export interface CatalogoPendencia {
  tipo: TipoPendencia;
  emoji: string;
  nome: string;
  /** O que a linha cobra, em uma frase (vai na folha Personalizar). */
  descricao: string;
  /** Peso no Score do Dia (os 12 somam 100). */
  pontos: number;
}

/** Os tipos, na ordem em que aparecem na folha (a da lista: blocos grandes primeiro, registros depois). */
export const CATALOGO_PENDENCIAS: CatalogoPendencia[] = [
  { tipo: "habitos", emoji: "✅", nome: "Hábitos do dia", descricao: "Os hábitos da Rotina que faltam hoje", pontos: 20 },
  { tipo: "treino", emoji: "🏋️", nome: "Treino", descricao: "O treino programado pra hoje", pontos: 15 },
  { tipo: "agua", emoji: "💧", nome: "Água", descricao: "Os copos que faltam pra meta", pontos: 15 },
  { tipo: "refeicoes", emoji: "🍽️", nome: "Refeições", descricao: "Registrar as refeições do dia", pontos: 10 },
  { tipo: "suplementos", emoji: "💊", nome: "Suplementos", descricao: "Os suplementos cadastrados na Saúde", pontos: 5 },
  { tipo: "leitura", emoji: "📖", nome: "Leitura", descricao: "Continuar o livro que está lendo", pontos: 5 },
  { tipo: "humor", emoji: "🙂", nome: "Check de humor", descricao: "Registrar como está hoje", pontos: 5 },
  { tipo: "gasto", emoji: "💸", nome: "Gasto do dia", descricao: "Registrar um gasto em Finanças", pontos: 5 },
  { tipo: "peso", emoji: "⚖️", nome: "Peso", descricao: "Pesar e anotar na Saúde", pontos: 5 },
  { tipo: "sono", emoji: "🌙", nome: "Sono", descricao: "Registrar as horas dormidas", pontos: 5 },
  { tipo: "ideia", emoji: "💡", nome: "Ideia", descricao: "Anotar uma ideia no Hiperfoco", pontos: 5 },
  { tipo: "gratidao", emoji: "🙏", nome: "Gratidão", descricao: "Anotar uma gratidão", pontos: 5 },
];

export const TIPOS_PENDENCIA: TipoPendencia[] = CATALOGO_PENDENCIAS.map((c) => c.tipo);
const TIPOS = new Set<string>(TIPOS_PENDENCIA);

export const PREFS_PADRAO: PendenciasPrefs = { ocultos: [], peso: { frequencia: "diaria", diaSemana: 1 } };

/** Lê o que estiver gravado (ou nada) e devolve prefs válidas — lixo vira padrão. */
export function normalizarPrefs(bruto: unknown): PendenciasPrefs {
  const o = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Record<string, unknown>) : {};
  const ocultos = Array.isArray(o.ocultos)
    ? (Array.from(new Set(o.ocultos.filter((t): t is TipoPendencia => typeof t === "string" && TIPOS.has(t)))))
    : [];
  const p = o.peso && typeof o.peso === "object" ? (o.peso as Record<string, unknown>) : {};
  const frequencia: FrequenciaPeso = p.frequencia === "semanal" ? "semanal" : "diaria";
  const dia = Number(p.diaSemana);
  const diaSemana = Number.isInteger(dia) && dia >= 0 && dia <= 6 ? dia : PREFS_PADRAO.peso.diaSemana;
  // 1.0.19: `ligados` só existe quando tem algo (quem nunca ligou nada continua com o objeto de sempre, campo a campo)
  const ligados = Array.isArray(o.ligados)
    ? Array.from(new Set(o.ligados.filter((t): t is TipoPendencia => typeof t === "string" && TIPOS.has(t))))
    : [];
  return { ocultos, peso: { frequencia, diaSemana }, ...(ligados.length ? { ligados } : {}) };
}

export const estaOculto = (prefs: PendenciasPrefs | undefined, tipo: TipoPendencia): boolean =>
  !!prefs && prefs.ocultos.includes(tipo);

export const ocultar = (prefs: PendenciasPrefs, tipo: TipoPendencia): PendenciasPrefs =>
  prefs.ocultos.includes(tipo) ? prefs : { ...prefs, ocultos: [...prefs.ocultos, tipo] };

export const religar = (prefs: PendenciasPrefs, tipo: TipoPendencia): PendenciasPrefs =>
  ({ ...prefs, ocultos: prefs.ocultos.filter((t) => t !== tipo) });

/** 1.0.19 (conta nova): LIGAR à mão em Personalizar — sai de `ocultos` e entra em `ligados` (aparece mesmo sem uso). */
export const ligarAMao = (prefs: PendenciasPrefs, tipo: TipoPendencia): PendenciasPrefs => {
  const r = religar(prefs, tipo);
  const ligados = prefs.ligados ?? [];
  return ligados.includes(tipo) ? r : { ...r, ligados: [...ligados, tipo] };
};

/** 1.0.19 (conta nova): DESLIGAR à mão — entra em `ocultos` (sai da lista e do score, como sempre) e sai de `ligados`. */
export const desligarAMao = (prefs: PendenciasPrefs, tipo: TipoPendencia): PendenciasPrefs => {
  const { ligados = [], ...resto } = ocultar(prefs, tipo);
  const sobram = ligados.filter((t) => t !== tipo);
  return sobram.length ? { ...resto, ligados: sobram } : resto;
};

export const comPeso = (prefs: PendenciasPrefs, frequencia: FrequenciaPeso, diaSemana?: number): PendenciasPrefs =>
  ({ ...prefs, peso: { frequencia, diaSemana: diaSemana ?? prefs.peso.diaSemana } });

const chaveLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Segunda-feira da semana de `d` ("YYYY-MM-DD") — a mesma semana da Rotina. */
export const inicioDaSemana = (d: Date): string => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return chaveLocal(x);
};

/**
 * O PESO é cobrado hoje?
 *  - frequência diária: sempre (como era);
 *  - semanal: só no dia escolhido, e só se ainda não pesou nesta semana
 *    (uma pesagem em qualquer dia anterior da semana já conta; pesar hoje
 *    mesmo mostra a linha como feita, não a esconde).
 */
export function pesoCobradoHoje(prefs: PendenciasPrefs | undefined, datasDePeso: string[], agora: Date = new Date()): boolean {
  if (!prefs || prefs.peso.frequencia !== "semanal") return true;
  if (agora.getDay() !== prefs.peso.diaSemana) return false;
  const inicio = inicioDaSemana(agora);
  const hoje = chaveLocal(agora);
  const pesouAntesNaSemana = datasDePeso.some((d) => typeof d === "string" && d >= inicio && d < hoje);
  return !pesouAntesNaSemana;
}

/**
 * MÓDULO OCULTO ⇒ PENDÊNCIAS DELE NÃO COBRADAS (10/10, tour da Home, passo 5).
 * O mapa real: cada tipo automático nasce num módulo (a rota da linha e a chave
 * que o hub lê). Humor e gratidão ficam de fora de propósito: são registros da
 * própria Home (ações rápidas, `core-mood-log`/`core-gratitude-log`), gravados em
 * três módulos diferentes — não pertencem a um só.
 * É regra DERIVADA de `core-module-prefs.hidden` (use-module-preferences): nada é
 * copiado pra `ocultos`, então religar o módulo volta ao estado anterior sozinho.
 * Ligada por `MODULO_OCULTA_PENDENCIAS` (lib/tour-home) — quem liga é o hub.
 */
export const TIPOS_DO_MODULO: Record<string, TipoPendencia[]> = {
  financas: ["gasto"],
  treino: ["treino"],
  dieta: ["refeicoes"],
  rotina: ["habitos"],
  saude: ["agua", "peso", "sono", "suplementos"],
  biblioteca: ["leitura"],
  hiperfoco: ["ideia"],
};

/** Os tipos que os módulos ocultos levam junto (ids desconhecidos são ignorados). */
export const tiposDosModulosOcultos = (modulosOcultos: unknown): TipoPendencia[] => {
  const out: TipoPendencia[] = [];
  if (!Array.isArray(modulosOcultos)) return out;
  for (const id of modulosOcultos) {
    for (const t of TIPOS_DO_MODULO[String(id)] ?? []) if (!out.includes(t)) out.push(t);
  }
  return out;
};

/**
 * Quais tipos o score e a lista cobram HOJE (os não ocultos; peso só quando a
 * frequência manda). `ocultosDerivados` (opcional, 10/10): os tipos que um módulo
 * oculto leva junto — sem ele, a conta é a de sempre.
 */
export function tiposCobradosHoje(prefs: PendenciasPrefs | undefined, pesoHoje: boolean, ocultosDerivados: Iterable<TipoPendencia> = []): Set<TipoPendencia> {
  const derivados = new Set(ocultosDerivados);
  const out = new Set<TipoPendencia>();
  for (const t of TIPOS_PENDENCIA) {
    if (estaOculto(prefs, t) || derivados.has(t)) continue;
    if (t === "peso" && !pesoHoje) continue;
    out.add(t);
  }
  return out;
}

export interface BlocoDoScore { tipo: TipoPendencia; pontos: number; max: number }

/**
 * Score do Dia a partir dos blocos: soma só os COBRADOS e reescala pra 100.
 * Com os 12 cobrados o máximo é 100 e a conta é idêntica à de sempre (soma dos
 * pontos); escondendo tipos, quem fez tudo o que sobrou fecha em 100. Nada
 * cobrável (tudo escondido) = 100: não existe o que cobrar.
 */
export function scoreDosBlocos(blocos: BlocoDoScore[], cobrados: Set<TipoPendencia>): number {
  let pontos = 0;
  let max = 0;
  for (const b of blocos) {
    if (!cobrados.has(b.tipo)) continue;
    pontos += b.pontos;
    max += b.max;
  }
  if (max <= 0) return 100;
  return Math.min(100, Math.round((pontos / max) * 100));
}

export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const DIAS_LONGOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "Todo dia" / "1x por semana · sexta" — pro rótulo da folha e do menu. */
export const rotuloDoPeso = (prefs: PendenciasPrefs): string =>
  prefs.peso.frequencia === "semanal" ? `1x por semana · ${DIAS_LONGOS[prefs.peso.diaSemana]}` : "Todo dia";
