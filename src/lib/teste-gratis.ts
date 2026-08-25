import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";

/**
 * TESTE GRÁTIS DE 3 DIAS DO APP DA LOJA (16/08) — o relógio.
 *
 * O desenho é do dono: em vez de trial do Google (que exige cartão e cortaria
 * a maioria Pix da base já na entrada), o app LIBERA por 3 dias sem paywall e
 * sem cadastro — a pessoa entra, planta a semente (primeira conta/hábito) e
 * usa de verdade. O paywall muda de LUGAR: do minuto 3 pro dia 3, quando já
 * existe algo construído que ela não quer perder. O produto continua o
 * vitalício R$27,90 (+ downsell 19,90) — nada muda no catálogo.
 *
 * Por que relógio LOCAL: não há conta (o cadastro é pós-compra desde a v48),
 * então não há linha no servidor pra ancorar. Reinstalar zera o relógio —
 * furo conhecido e aceito no teste: fraudar dá mais trabalho que pagar
 * R$27,90 uma vez. O evento `teste_iniciado` carimba o início no banco
 * (por sessão/aparelho via telemetria) pra MEDIR o abuso antes de decidir
 * se ele importa.
 *
 * Quem NUNCA iniciou o teste (instalações antigas, ou web) não é afetado:
 * sem marca no storage, todas as funções respondem "sem teste" e o fluxo
 * antigo (paywall no funil) continua valendo para o que for.
 */

const CHAVE_INICIO = "core-teste-inicio";
const DURACAO_MS = 3 * 24 * 3600_000;

export type EstadoTeste =
  | { fase: "nunca" }
  | { fase: "ativo"; dia: 1 | 2 | 3; horasRestantes: number; inicio: number }
  | { fase: "expirado"; inicio: number };

const lerInicio = (): number | null => {
  try {
    const v = Number(localStorage.getItem(CHAVE_INICIO));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};

export function estadoTeste(): EstadoTeste {
  const inicio = lerInicio();
  if (!inicio) return { fase: "nunca" };
  const passado = Date.now() - inicio;
  if (passado >= DURACAO_MS) return { fase: "expirado", inicio };
  const dia = (Math.min(3, Math.floor(passado / 86_400_000) + 1)) as 1 | 2 | 3;
  return { fase: "ativo", dia, horasRestantes: Math.max(0, Math.ceil((DURACAO_MS - passado) / 3600_000)), inicio };
}

/** O teste vale acesso agora? (uma pergunta só, pro gate não pensar) */
export const testeLiberado = (): boolean => estadoTeste().fase === "ativo";

/**
 * Liga o relógio — idempotente (segunda chamada não re-inicia). Chamado no
 * fim do funil da semente, NUNCA no boot: o teste começa quando a pessoa
 * plantou algo, não quando instalou.
 */
export function iniciarTeste(area: string | null): EstadoTeste {
  const existente = lerInicio();
  if (existente) return estadoTeste();
  const agora = Date.now();
  try { localStorage.setItem(CHAVE_INICIO, String(agora)); } catch { /* sem storage: segue sem teste */ }
  trackEvent("teste_iniciado", { area: area ?? "", dias: 3, shell: isNativeShell() });
  return estadoTeste();
}

/* ----------------------------------------- trilha do teste (v53 → v55) */

/**
 * A TRILHA DE 3 PASSOS — a evolução da semente (16/08, decisão do dono com
 * dado da própria base). A semente sozinha não bastava: na base de 1.498
 * usuários com ativação, quem faz 1 ação distinta paga 5%; 2 ações, 42%;
 * 3-4, 69%. E 96% de quem nunca pagou parou EXATAMENTE na 1ª ação. A
 * primeira compradora da assinatura (16/08, 14:50) fez o arco completo:
 * semente → mais ações → pagou em 30 min.
 *
 * Tudo acontece DENTRO dos módulos reais (toque do dono: "nada de mini-demo
 * com cara de fictício") — a faixa (TrilhaDoTeste) instrui UM passo por vez
 * e escuta o core:activation que o useUserData já dispara na primeira
 * escrita de verdade. Os degraus por área vêm da 2ª ação NATURAL medida na
 * base (quem começa por corpo vai pro dinheiro em 57%; rotina monta a
 * agenda em 64%; o dinheiro é o ímã universal).
 *
 * A chave de storage continua "core-guia-semente" de propósito: quem está
 * NO MEIO do teste hoje (formato antigo {area, status}) migra sem perder o
 * lugar — status "feita" do formato velho vira passo 2 pendente.
 */
const CHAVE_GUIA = "core-guia-semente";

export type Guia = {
  area: string;
  passo: 1 | 2 | 3;
  status: "pendente" | "feita";
  ultimaChave?: string;
  // v56: toda chave que JÁ subiu degrau. O degrau sobe por AÇÃO DISTINTA
  // (qualquer uma das 3 do mapa da área, em qualquer ordem) — medido 17/08:
  // gente fazia a ação "do passo 2" durante o passo 1 (gasto antes de conta
  // fixa) e a trilha não acendia nada. A tese é nº de ações distintas
  // (1=5%, 2=42%, 3+=69% pagam), não a ordem delas.
  chavesCreditadas?: string[];
};

/** Chaves que já pontuaram — cobre guia gravado pela v55 (só ultimaChave). */
export function chavesCreditadasDoGuia(g: Guia): string[] {
  return g.chavesCreditadas ?? (g.ultimaChave ? [g.ultimaChave] : []);
}

export function guiaSemente(): Guia | null {
  try {
    const raw = localStorage.getItem(CHAVE_GUIA);
    if (!raw) return null;
    const g = JSON.parse(raw) as Guia & { passo?: number };
    if (!g || typeof g.area !== "string") return null;
    // Formato v53 (sem `passo`): a pessoa já plantou a semente → entra na
    // trilha no passo 2; ainda não plantou → passo 1. Persistimos a migração
    // pra não reavaliar a cada leitura.
    if (typeof g.passo !== "number") {
      const migrado: Guia = g.status === "feita"
        ? { area: g.area, passo: 2, status: "pendente" }
        : { area: g.area, passo: 1, status: "pendente" };
      try { localStorage.setItem(CHAVE_GUIA, JSON.stringify(migrado)); } catch { /* noop */ }
      return migrado;
    }
    return g as Guia;
  } catch {
    return null;
  }
}

export function armarGuiaSemente(area: string): void {
  try { localStorage.setItem(CHAVE_GUIA, JSON.stringify({ area, passo: 1, status: "pendente" } satisfies Guia)); } catch { /* sem guia, o app segue */ }
}

/**
 * Conclui o passo ATUAL. Passos 1 e 2 avançam pro próximo (a faixa celebra e
 * mostra a instrução seguinte); o 3 fecha a trilha de vez. Devolve o estado
 * novo pra faixa decidir o que renderizar.
 */
export function concluirPassoDaTrilha(chave?: string): Guia | null {
  const g = guiaSemente();
  if (!g || g.status === "feita") return g;
  // semente_plantada continua existindo com o mesmo nome/formato: é a métrica
  // que o funil v53 já acompanha — mudar o nome quebraria a série histórica.
  if (g.passo === 1) trackEvent("semente_plantada", { area: g.area, funil: "teste" });
  trackEvent("trilha_passo", { passo: g.passo, area: g.area, funil: "teste" });
  const creditadas = chave
    ? [...chavesCreditadasDoGuia(g), chave]
    : chavesCreditadasDoGuia(g);
  const novo: Guia = g.passo >= 3
    ? { ...g, status: "feita", ultimaChave: chave, chavesCreditadas: creditadas }
    : { ...g, passo: (g.passo + 1) as 2 | 3, ultimaChave: chave, chavesCreditadas: creditadas };
  if (novo.status === "feita") trackEvent("trilha_completa", { area: g.area, funil: "teste" });
  try { localStorage.setItem(CHAVE_GUIA, JSON.stringify(novo)); } catch { /* noop */ }
  return novo;
}

/** Comprou/restaurou: a trilha morreu — assinante não precisa de guia de
 *  teste, e a faixa penduraria pra sempre (review 16/08). */
export function limparGuiaSemente(): void {
  try { localStorage.removeItem(CHAVE_GUIA); } catch { /* noop */ }
}

/* ------------------------------------------------------- trial com cartão
 * v60 (18/08): o trial da folha do Google torna a pessoa ASSINANTE na hora —
 * e o cinto `isSubscribed` escondia a Trilha exatamente de quem mais precisa
 * dela (usar 2+ vezes nos 3 dias é o que evita o cancelamento). O marcador
 * local diz "esse assinante está nos 3 dias de teste do cartão": a Trilha
 * continua visível até ele expirar, e aí some sozinha. */
const CHAVE_TRIAL_CARTAO = "core-trial-cartao-fim";

export function marcarTrialCartao(dias = 7): void {
  // 23/08: default 7 — o trial da vitrine nova é o anual de 7 dias (oferta
  // coretrial7). A Missão continua sendo o sprint dos 3 PRIMEIROS dias (o
  // dia dela sai do próprio início, não deste fim); este marcador só diz
  // "ainda está no período de teste" pra Trilha/save-offer.
  try { localStorage.setItem(CHAVE_TRIAL_CARTAO, String(Date.now() + dias * 86_400_000)); } catch { /* noop */ }
}

/** Igual à de cima, mas com o fim REAL do período (vem do RevenueCat na
 *  sincronização do boot — ver conferirTrialCartao). Cobre quem virou
 *  assinante sem o app saber que era trial: compra implícita do v61, Android
 *  matando o app na folha do Google, retomada pós-compra. O evento acorda a
 *  MissaoDoTrial já montada (o marcador nasce depois do primeiro render). */
export function marcarTrialCartaoAte(fimMs: number): void {
  if (!Number.isFinite(fimMs) || fimMs <= Date.now()) return;
  try {
    localStorage.setItem(CHAVE_TRIAL_CARTAO, String(fimMs));
    window.dispatchEvent(new Event("core:trial-cartao"));
  } catch { /* noop */ }
}

export function trialCartaoAtivo(): boolean {
  try {
    const fim = Number(localStorage.getItem(CHAVE_TRIAL_CARTAO));
    return Number.isFinite(fim) && fim > 0 && Date.now() < fim;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------- a MISSÃO
 * v61 (19/08): o tutorial pós-pago do trial. Dado que mandou no desenho:
 * comprador ativa sozinho em 2 min (97% agem no D0) — o que separa quem
 * fica de quem cancela é VOLTAR (0/8 cancelados voltaram no D1 vs 55%
 * dos ativos). A missão empacota o padrão do pagante que fica: 1 ação
 * guiada agora + a volta do dia 2 + a véspera honesta. */
export type Missao = {
  inicio: number;
  area: string;
  d1: boolean; d2: boolean; d3: boolean;
  vista: boolean;                       // B1 (boas-vindas do pagante) já foi mostrada
  holofote: "pendente" | "feito" | "dispensado";
  // v65 (20/08): quem saiu do holofote por ROLAGEM não fez o registro (2/2
  // nos dados) — a instrução morria junto com o anel. O chip é a instrução
  // que sobrevive: pill discreta no rodapé do módulo até o dia 1 sair.
  chip?: boolean;
};
const CHAVE_MISSAO = "core-missao";

export function missaoAtual(): Missao | null {
  try {
    const raw = localStorage.getItem(CHAVE_MISSAO);
    if (!raw) return null;
    const m = JSON.parse(raw) as Missao;
    return m && typeof m.inicio === "number" ? m : null;
  } catch { return null; }
}

export function iniciarMissao(area: string): Missao {
  const m: Missao = { inicio: Date.now(), area, d1: false, d2: false, d3: false, vista: false, holofote: "pendente" };
  try { localStorage.setItem(CHAVE_MISSAO, JSON.stringify(m)); } catch { /* noop */ }
  return m;
}

export function salvarMissao(m: Missao): void {
  try { localStorage.setItem(CHAVE_MISSAO, JSON.stringify(m)); } catch { /* noop */ }
}

/** Dia da missão em que a pessoa está (1..3), pelo relógio dela. */
export function diaDaMissao(m: Missao): 1 | 2 | 3 {
  const d = Math.floor((Date.now() - m.inicio) / 86_400_000) + 1;
  return (d < 1 ? 1 : d > 3 ? 3 : d) as 1 | 2 | 3;
}
