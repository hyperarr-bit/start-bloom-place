/**
 * "DICAS PARA COMEÇAR" PELO USO REAL (1.0.22, dono 28/10: "as dicas têm que ser o que os usuários mais vão usar, o que
 * eles mais vão gostar").
 *
 * Antes eram 55 dicas em 14 módulos que apresentavam o módulo inteiro (19 apontavam pra abas que a conta nova começa sem
 * ver). Agora são no MÁXIMO 3 por módulo, nesta ordem:
 *   1. a AÇÃO mais usada pelos pagantes no módulo (card/toque/gravação mais usados na aba de entrada);
 *   2. o que mais se associa a VOLTAR no dia 2 / pagar (seção 4 de cada METRICAS), ou a 2ª coisa mais usada;
 *   3. "Use só o que quiser: oculte as abas que não usa" → a folha "Organizar abas".
 * Fonte: novidades-guardadas/2026-10-28/briefing-codex-modulos/METRICAS-<MODULO>.md e briefing-codex-financas (o número
 * de cada dica está no comentário ao lado e no RELATORIO de dicas-novas/). Regras travadas em src/test/dicas-novas.test.ts:
 * nenhuma dica aponta pra aba da lista enxuta (lib/abas-enxutas) nem pra aba fraca/morta; nada de prometer o que o app
 * não faz; 1 linha, verbo no imperativo, sem exclamação e sem emoji.
 *
 * DUAS APRESENTAÇÕES (dono 28/10, quer comparar antes de decidir), mesma lista:
 *   · "toque" (padrão): cada dica é um botão que abre a aba certa (mesmo oculta — o mesmo caminho dos links) e acende o
 *     campo/botão da ação;
 *   · "texto": só o texto, sem botão nem seta — o cartão mais enxuto (título + até 3 linhas + X).
 * Troca = mudar DICAS_MODO + build. QA: `?dicas=texto|toque` grava neste aparelho (`forcar-dicas`, fora dos prefixos
 * varridos); `?dicas=auto` desfaz.
 */
import { trackEvent } from "@/lib/analytics";

export type ModoDasDicas = "toque" | "texto";
/** A chave. ROLLBACK/troca = mudar aqui + build. */
export const DICAS_MODO: ModoDasDicas = "toque";
export const CHAVE_FORCA_DICAS = "forcar-dicas";
export const PARAM_DICAS = "dicas";

const modoDe = (v: unknown): ModoDasDicas | null => (v === "toque" || v === "texto" ? v : null);

export function guardarForcaDasDicas(busca?: string): void {
  try {
    const v = (new URLSearchParams(busca ?? window.location.search).get(PARAM_DICAS) ?? "").trim().toLowerCase();
    if (modoDe(v)) localStorage.setItem(CHAVE_FORCA_DICAS, v);
    else if (v === "auto") localStorage.removeItem(CHAVE_FORCA_DICAS);
  } catch { /* sem storage: vale a constante */ }
}

let forcaLida = false;
/** O modo AQUI: força de QA > constante. */
export function modoDasDicas(): ModoDasDicas {
  if (!forcaLida) { forcaLida = true; if (typeof window !== "undefined") guardarForcaDasDicas(); }
  try { return modoDe(localStorage.getItem(CHAVE_FORCA_DICAS)) ?? DICAS_MODO; } catch { return DICAS_MODO; }
}
/** Só testes. */
export const _zerarForcaDasDicas = (): void => { forcaLida = false; };

/** O que o toque faz no alvo: acender e só mostrar, pôr o cursor no campo, ou tocar no botão (abre o formulário). */
export type AcaoDoAlvo = "mostrar" | "focar" | "clicar";

export interface Dica {
  /** O texto (as duas apresentações). 1 linha, imperativo, sem exclamação/emoji. */
  texto: string;
  /** Só na apresentação "texto", quando o texto do toque não se explica sozinho (a dica de ocultar abas). */
  textoSemToque?: string;
  /** A aba que o toque abre (id da lista de abas da página). Ausente = a aba em que a pessoa está. */
  aba?: string;
  /** O alvo, em ordem de preferência (o 1º que existir na tela): seletor CSS, ou `texto:<texto exato>` de um
   *  botão/título quando ele não tem atributo. */
  alvos?: string[];
  /** Qual dos elementos que casam com o seletor (ex.: o 3º "Destino..." = a seção PRÓXIMO). Padrão 0. */
  indice?: number;
  acao?: AcaoDoAlvo;
  /** Depois do "clicar": o campo que recebe o cursor (ex.: o link do livro no formulário que abriu). */
  focoDepois?: string;
  /** A dica 3: abre a folha "Organizar abas". */
  organizarAbas?: true;
}

const ORGANIZAR: Dica = {
  texto: "Use só o que quiser: oculte as abas que não usa",
  textoSemToque: "Não usa uma aba? Oculte no ícone ao fim das abas",
  organizarAbas: true,
};

/**
 * As dicas por módulo (o id da rota/ModuleDrawer, o mesmo do useAbasOcultas). Comentário = o número que escolheu a dica
 * (pagantes ativos 28/09–27/10; "usaram" = tocaram no card; toques de 18–27/10; "pagou" = turma do teste do iPhone).
 */
export const DICAS_DO_MODULO: Readonly<Record<string, readonly Dica[]>> = {
  financas: [
    // RECEITAS 65% e CUSTOS FIXOS 65% usaram (257 e 287 em 2+ dias) — os cards mais usados de Finanças
    { texto: "Anote quanto entra no mês e suas contas fixas", aba: "financeiro", alvos: ['[data-spotlight="add-income"]'], acao: "focar" },
    // anotar gasto DE NOVO nos dias 2–3: 46,9% × 15,5% pagaram; 118 pagantes tocaram NOVO GASTO (1.138 toques em 9 dias)
    { texto: "Anote cada gasto e veja quanto pode gastar hoje", aba: "financeiro", alvos: ['[data-cartao-alvo="novo-gasto"]', '[data-spotlight="add-expense"]'], acao: "focar" },
    ORGANIZAR,
  ],
  rotina: [
    // HÁBITOS DIÁRIOS 69% usaram (240 em 2+ dias); marcar hábito 48,4% de quem abriu
    { texto: "Crie seus hábitos e marque cada um quando fizer", aba: "semana", alvos: ['[data-spotlight="add-habit"]'], acao: "clicar" },
    // abrir MEU MÊS no dia 1: 37,1% × 24,0% pagaram (só quem abriu 4+ módulos, significativo)
    { texto: "Em Meu mês, toque num dia para anotar compromissos", aba: "mes", alvos: ['[data-dica="mes-hoje"]'], acao: "clicar" },
    ORGANIZAR,
  ],
  treino: [
    // MEU PLANO DA SEMANA 39,5% usaram (92 em 2+ dias); COMECE COM UM MODELO PRONTO 27,2%
    { texto: "Monte a semana no Plano ou use um modelo pronto", aba: "plano", alvos: ['[data-testid="plano-semana"]'], acao: "mostrar" },
    // gravar treino no dia 1: 30,7% × 21,6% pagaram (4+ módulos, significativo); CONCLUIR TREINO 21,3% de quem abriu
    { texto: "Treinou? Em Hoje, toque em Concluir treino", aba: "hoje", alvos: ['texto:Concluir treino', '[data-spotlight="add-exercise"]'], acao: "mostrar" },
    ORGANIZAR,
  ],
  dieta: [
    // CARDÁPIO: "Clique para adicionar" 37% de quem abriu; card do dia 37,9% usaram; saude-meals 19,6% dos ativos
    { texto: "Toque numa refeição de hoje e anote o que vai comer", aba: "cardapio", alvos: ['[data-spotlight="first-day"]'], acao: "mostrar" },
    // gravar de novo nos dias 2–3: 61,5% × 16,4% pagaram; abrir DIÁRIO no dia 1: 32,9% × 16,9%; dieta-diary-v2 21% em 4+ dias
    { texto: "No Diário, marque se seguiu cada refeição do dia", aba: "diario", acao: "mostrar" },
    ORGANIZAR,
  ],
  saude: [
    // HIDRATAÇÃO 55,9% usaram (142 em 2+ dias); water-log: 475 pagantes (41%), 28% em 4+ dias
    { texto: "Toque no copo para registrar a água do dia", aba: "hoje", alvos: ['[data-spotlight="add-water"]'], acao: "mostrar" },
    // VITAMINAS E REMÉDIOS 47,6% usaram, 143 em 2+ dias (o card que mais repete); gravar de novo nos dias 2–3: 43,8% × 15,9%
    { texto: "Cadastre vitaminas e remédios e marque ao tomar", aba: "hoje", alvos: ['input[placeholder="Novo suplemento..."]'], acao: "focar" },
    ORGANIZAR,
  ],
  beleza: [
    // montar-rotina 52,7% usaram (o card mais usado da Beleza); 44% tocaram
    { texto: "Responda 3 perguntas e ganhe sua rotina de pele", aba: "routine", alvos: ['[data-testid="montar-rotina"]', '[data-testid="skincare-de-hoje"]'], acao: "mostrar" },
    // abrir CABELO no dia 1: 34,3% × 17,6% pagaram; montar-cronograma 42,5% usaram
    { texto: "Em Cabelo, monte seu cronograma capilar", aba: "hair", alvos: ['[data-testid="montar-cronograma"]'], acao: "mostrar" },
    ORGANIZAR,
  ],
  casa: [
    // CÔMODOS: COZINHA 26,8% · QUARTO 23,5% usaram; ADICIONAR ITEM 18,3% de quem abriu
    { texto: "Liste os afazeres de cada cômodo e marque ao fazer", aba: "comodos", alvos: ['input[placeholder="Adicionar item..."]'], acao: "focar" },
    // MERCADO (viva, 6,4%): ADICIONAR é o toque mais usado da Casa (23,8% de quem abriu)
    { texto: "Anote em Mercado o que precisa comprar", aba: "mercado", alvos: ['input[placeholder="Adicionar..."]'], acao: "focar" },
    ORGANIZAR,
  ],
  biblioteca: [
    // LENDO AGORA 51,1% usaram (81 em 2+ dias); COMEÇAR UM LIVRO 29,7% de quem abriu; o link importa capa e dados
    { texto: "Cole o link do livro e a capa vem sozinha", aba: "lendo", alvos: ['texto:Começar um Livro'], acao: "clicar", focoDepois: 'input[placeholder="Cole o link do livro aqui..."]' },
    // voltar à Biblioteca nos dias 2–3: 69,2% × 16,8% pagaram; ATUALIZAR PÁGINA 22,9% de quem abriu
    { texto: "Volte e anote a página em que parou", aba: "lendo", alvos: ['input[placeholder="Atualizar página..."]', 'texto:📖 LENDO AGORA'], acao: "focar" },
    ORGANIZAR,
  ],
  desenvolvimento: [
    // SOBRE MIM é a única aba viva (7,4%); O QUE ME MOTIVA A ACORDAR 25,8% usaram (o card mais usado do módulo)
    { texto: "Escreva o que te motiva a acordar todo dia", aba: "sobre", alvos: ['[data-spotlight="add-motivation"] input', '[data-spotlight="add-motivation"]'], acao: "focar" },
    // AFIRMAÇÕES 16% usaram (2º card de Sobre mim); voltar nos dias 2–3: 57,7% × 17,1% (Metas é aba fraca, 4,2% — fica fora)
    { texto: "Guarde suas afirmações e releia quando precisar", aba: "sobre", alvos: ['input[placeholder="Nova afirmação..."]'], acao: "focar" },
    ORGANIZAR,
  ],
  estudos: [
    // CURSOS EM ANDAMENTO 37,9% usaram; ADICIONAR CURSO 32,8% de quem abriu
    { texto: "Adicione o curso que está fazendo", aba: "estudos", alvos: ['input[placeholder="Adicionar curso..."]'], acao: "focar" },
    // O QUE APRENDI 17,2% e APRENDI HOJE 16,4% de quem abriu; voltar nos dias 2–3: 60% × 17,1% pagaram
    { texto: "Depois de cada aula, toque em Aprendi hoje no curso", aba: "estudos", alvos: ['texto:Aprendi hoje', 'input[placeholder="Adicionar curso..."]'], acao: "mostrar" },
    ORGANIZAR,
  ],
  relacionamentos: [
    // COMEÇO PRONTO 38% usaram (dia/mês do aniversário 37–40% de quem abriu)
    { texto: "Comece pela família: salve os aniversários", aba: "pessoas", alvos: ['[data-testid="comeco-pronto"]', '[data-testid="lista-pessoas"]'], acao: "mostrar" },
    // MINHAS PESSOAS 24,4% usaram; ADICIONAR PESSOA 25,6% de quem abriu
    { texto: "Adicione outras pessoas e as datas delas", aba: "pessoas", alvos: ['texto:Adicionar pessoa', '[data-testid="comeco-pronto"]'], acao: "mostrar" },
    ORGANIZAR,
  ],
  detox: [
    // HÁBITOS 62,8% usaram (todo o uso do Detox); INICIAR DETOX 26,2% de quem abriu
    { texto: "Escolha o que quer largar e toque em Iniciar detox", aba: "rastreador", alvos: ['input[placeholder^="O que quer parar"]'], acao: "focar" },
    // ESTOU LIMPO HOJE 16,7% de quem abriu; gravar de novo nos dias 2–3: 66,7% × 17,9% pagaram
    { texto: "Volte todo dia e toque em Estou limpo hoje", aba: "rastreador", alvos: ['texto:Estou limpo hoje', 'input[placeholder^="O que quer parar"]'], acao: "mostrar" },
    ORGANIZAR,
  ],
  hiperfoco: [
    // DIA é a entrada (4,6%; nenhuma aba viva na Mente); o "+" da aba Dia 19,3% de quem abriu; hiperfoco-thoughts 2,4% dos ativos.
    // Metas/Ideias/Sonhos são abas fracas — ficam fora.
    { texto: "Tire da cabeça: toque na hora e anote o que pensou", aba: "dia", alvos: ['[data-dica="mente-agora"]', 'input[placeholder="O que está pensando?"]'], acao: "clicar" },
    ORGANIZAR,
  ],
  carreira: [
    // NOVA TAREFA DO TRABALHO é o toque mais usado (12,6% de quem abriu); career-day-tasks 32 pagantes gravaram
    { texto: "Anote as tarefas do trabalho de hoje", aba: "dia", alvos: ['input[placeholder="Nova tarefa do trabalho..."]'], acao: "focar" },
    // FASES DE HOJE 13% usaram (o card mais usado da Carreira)
    { texto: "Conte o que se repete no dia em Fases de hoje", aba: "dia", alvos: ['input[placeholder="Nova fase..."]'], acao: "mostrar" },
    ORGANIZAR,
  ],
  pet: [
    // COMEÇO PRONTO 31,7% usaram (SEGUIR 30,7% de quem abriu)
    { texto: "Cadastre seu pet: a rotina do dia já vem pronta", aba: "hoje", alvos: ['[data-testid="comeco-pronto"]', '[data-spotlight="pet-especie"]'], acao: "mostrar" },
    // PET DE HOJE 25,7% usaram, 19 em 2+ dias (o único uso que repete); gravar no dia 1: 31% × 17,2% pagaram
    { texto: "Marque os cuidados do dia em Pet de hoje", aba: "hoje", alvos: ['[data-card="PET DE HOJE"]', '[data-testid="comeco-pronto"]'], acao: "mostrar" },
    ORGANIZAR,
  ],
  viagens: [
    // Destinos é a única aba viva (5,1%); SONHO 21,3% usaram (o card mais usado)
    { texto: "Anote os lugares que sonha conhecer", aba: "destinos", alvos: ['input[placeholder="Destino..."]'], indice: 0, acao: "focar" },
    // PRÓXIMO 17,5% usaram (2º card)
    { texto: "Viagem marcada? Anote o destino em Próximo", aba: "destinos", alvos: ['input[placeholder="Destino..."]'], indice: 2, acao: "focar" },
    ORGANIZAR,
  ],
};

export const dicasDoModulo = (moduloId: string): readonly Dica[] => DICAS_DO_MODULO[moduloId] ?? [];

/* ------------------------------------------------------------------ o toque */

/** Os eventos que a fileira de abas (components/ui/abas-ocultaveis) escuta. */
export const EVENTO_ABRIR_ABA = "dicas:abrir-aba";
export const EVENTO_ORGANIZAR_ABAS = "dicas:organizar-abas";
export type DetalheAbrirAba = { modulo: string; aba: string };
export type DetalheOrganizar = { modulo: string };

/** Atributo (não classe: o React reescreve `className` quando o alvo muda de estado, ex. o dia selecionado). */
export const ATRIBUTO_ACESO = "data-dica-aceso";
const ACESO_MS = 2400;
const PROCURA_MS = 1800;

const visivel = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; };

/** Acha o alvo da dica na tela (o 1º da lista que existir). Exportado pros testes. */
export function acharAlvo(d: Dica, raiz: ParentNode = document): HTMLElement | null {
  for (const alvo of d.alvos ?? []) {
    if (alvo.startsWith("texto:")) {
      const el = porTexto(alvo.slice(6), raiz);
      if (el) return el;
      continue;
    }
    let todos: HTMLElement[] = [];
    try { todos = Array.from(raiz.querySelectorAll<HTMLElement>(alvo)); } catch { continue; }
    const el = todos[d.indice ?? 0] ?? todos[0];
    if (el) return el;
  }
  return null;
}

function porTexto(texto: string, raiz: ParentNode): HTMLElement | null {
  const alvo = texto.trim().toLowerCase();
  const candidatos = Array.from(raiz.querySelectorAll<HTMLElement>("button, h2, h3, span, p"));
  return candidatos.find((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase() === alvo) ?? null;
}

const ehCampo = (el: Element): el is HTMLInputElement | HTMLTextAreaElement => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

function acender(el: HTMLElement, acao: AcaoDoAlvo, focoDepois?: string) {
  const area = (el.closest("[data-cartao-alvo]") as HTMLElement | null) ?? (ehCampo(el) ? (el.parentElement ?? el) : el);
  try { area.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* jsdom */ }
  area.setAttribute(ATRIBUTO_ACESO, "1");
  window.setTimeout(() => area.removeAttribute(ATRIBUTO_ACESO), ACESO_MS);
  if (acao === "clicar") {
    if (el.getAttribute("data-selecionado") !== "true") el.click();
    if (focoDepois) window.setTimeout(() => { try { document.querySelector<HTMLInputElement>(focoDepois)?.focus({ preventScroll: true }); } catch { /* sem foco */ } }, 150);
    return;
  }
  if (acao === "focar") {
    const campo = ehCampo(el) ? el : el.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    try { campo?.focus({ preventScroll: true }); } catch { /* sem foco */ }
  }
}

/**
 * O toque numa dica: abre a aba (a fileira troca mesmo se ela estiver oculta — o mesmo caminho dos links), espera o alvo
 * aparecer, rola até ele e acende; "focar" põe o cursor no campo e "clicar" toca no botão (abre o formulário).
 */
export function irParaDica(moduloId: string, d: Dica, n: number): void {
  trackEvent("dica_toque", { modulo: moduloId, dica: n + 1, modo: "toque" });
  if (d.organizarAbas) {
    window.dispatchEvent(new CustomEvent<DetalheOrganizar>(EVENTO_ORGANIZAR_ABAS, { detail: { modulo: moduloId } }));
    return;
  }
  if (d.aba) window.dispatchEvent(new CustomEvent<DetalheAbrirAba>(EVENTO_ABRIR_ABA, { detail: { modulo: moduloId, aba: d.aba } }));
  if (!d.alvos?.length) {
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* jsdom */ }
    return;
  }
  const inicio = Date.now();
  const procurar = () => {
    const el = acharAlvo(d);
    if (el && visivel(el)) { acender(el, d.acao ?? "mostrar", d.focoDepois); return; }
    if (Date.now() - inicio < PROCURA_MS) window.setTimeout(procurar, 120);
  };
  window.setTimeout(procurar, 80);
}
