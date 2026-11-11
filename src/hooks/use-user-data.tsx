import { CHAVE_ACOES_CONQUISTAS, acoesDaEscrita, registrarAcao } from "@/lib/conquistas-acoes";
import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { markActivation, trackEvent } from "@/lib/analytics";
import { localDayKey } from "@/lib/utils";
import { vassouraLeva } from "@/lib/chaves-do-aparelho";
import { chaveSoDoServidor } from "@/lib/conteudo-pago";
import { iguais, mesclar3 } from "@/lib/mesclar-dados";
import { CHAVE_DIAS_ANOTADOS, CHAVE_HUB_STREAK, calcularSequencia, contaComoAnotacao, registrarDia, registrarDiaRetroativo, temConteudo } from "@/lib/sequencia";
import { registrarLeitorDosDados } from "@/lib/medicao-total";

// Map user_data keys → activation action_key. Triggered first time a key is written
// with non-empty value.
const ACTIVATION_RULES: Array<{ match: RegExp; action: string; meaningful?: (v: any) => boolean }> = [
  // ORDEM IMPORTA: a primeira regra que casar ganha (break no loop). As duas
  // abaixo precisam vir antes da genérica /transac|financ/i — sem elas, criar
  // um LIMITE emitia "first_transaction" e o tutorial nunca via o evento que
  // esperava. Era o passo 9 travado (27/07).
  { match: /finance-category-budgets/i, action: "first_limit" },
  { match: /goals-board-v2/i, action: "first_goal", meaningful: (v) => Array.isArray(v) && v.length > 0 },
  { match: /finance-incomes/i, action: "first_income" },
  { match: /finance-fixed-expenses/i, action: "first_fixed_expense" },
  { match: /finance-dueDays/i, action: "first_bill", meaningful: (v) => Array.isArray(v) && v.some((d: any) => Array.isArray(d?.bills) && d.bills.length > 0) },
  { match: /finance-notes/i, action: "first_note" },
  { match: /finance-expenses/i, action: "first_transaction" },
  { match: /finance-installments/i, action: "first_installment" },
  { match: /finance-investments/i, action: "first_investment" },
  { match: /finance-wishlist/i, action: "first_wish" },
  { match: /transac|financ/i, action: "first_transaction" },
  { match: /rotina-habits|^habit/i, action: "first_habit" },
  { match: /rotina-schedule/i, action: "first_schedule" },
  { match: /month-goals/i, action: "first_month_goal" },
  { match: /todo-list/i, action: "first_task" },
  { match: /water-log|hidrat/i, action: "first_water_log" },
  { match: /sleep-log/i, action: "first_sleep_log" },
  { match: /workout|treino|exercise/i, action: "first_workout" },
  { match: /saude-meals|dieta-diary|dieta-recipes|meal/i, action: "first_meal" },
  { match: /dieta-smart-list/i, action: "first_grocery" },
  // 16/10 (intro do módulo): módulos que não tinham regra nenhuma — a 1ª escrita deles não virava
  // uso_modulo. Só chaves que NÃO casavam com nada acima nem com as genéricas abaixo (estudos-notebooks
  // segue first_note; career-day-tasks e pet-routine-tasks seguem first_task — os painéis não mudam).
  { match: /^casa-(grocery-categories|rooms|maint-tasks|shopping-list)/i, action: "first_casa", meaningful: (v) => Array.isArray(v) && v.some((c: any) => (Array.isArray(c?.items) && c.items.length > 0) || (Array.isArray(c?.tasks) && c.tasks.length > 0) || (!c?.items && !c?.tasks)) },
  { match: /^estudos-(cursos-andamento|aprendizados|subjects|exams|cursos-desejo)/i, action: "first_estudo" },
  { match: /^lib-books/i, action: "first_book" },
  { match: /^career-(day-phases|jobs|skills|contacts|portfolio)/i, action: "first_career", meaningful: (v) => Array.isArray(v) && v.some((f: any) => !f?.counts || Object.keys(f.counts).length > 0) },
  { match: /^(hiperfoco-thoughts|mente-dreams)/i, action: "first_thought" },
  { match: /^rel-(people|dates|moments|gifts|events)/i, action: "first_relacao" },
  { match: /^detox-(habits|diary)/i, action: "first_detox" },
  { match: /^pet-(list|health|cuidados|pesos|expenses|diary)/i, action: "first_pet" },
  { match: /^travel-/i, action: "first_trip" },
  { match: /^(skincare|beauty|cabelo|beleza)-/i, action: "first_beleza" },
  { match: /^dp-/i, action: "first_dp" },
  { match: /task|rotina/i, action: "first_task" },
  { match: /note/i, action: "first_note" },
];
/** Só testes (src/test/intro-modulo.test.tsx): as regras são privadas do hook. */
export const _regrasDeAtivacao = ACTIVATION_RULES;

const isMeaningful = (value: any): boolean => {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return value > 0;
  return Boolean(value);
};

// uso_modulo (v56): a ÚNICA visão server-side de uso do CONVIDADO. O dado de
// convidado vive só no localStorage (nada em user_data até criar conta) e o
// key_action_completed exige login — então "quantos do teste grátis usaram de
// verdade?" era irrespondível (medido 17/08: 14 de 40 'mexeram' sem deixar
// rastro nenhum). Uma vez por chave por sessão pra não inundar o banco.
const usoJaContado = new Set<string>();

const checkActivation = (key: string, value: any) => {
  if (!isMeaningful(value)) return;
  if (key.startsWith("spotlight-") || key.startsWith("quickstart-") || key.startsWith("core-")) return;
  // 1.0.22: `abas-ocultas:financas` / `abas-ordem:treino` são preferência da fileira de abas — sem isto o /financ|treino/
  // das regras viraria "first_transaction"/"first_workout" (e avançaria missão/holofote) só por ocultar uma aba
  if (key.startsWith("abas-")) return;
  for (const rule of ACTIVATION_RULES) {
    if (rule.match.test(key)) {
      if (rule.meaningful && !rule.meaningful(value)) return;
      markActivation(rule.action, { source_key: key });
      // *-last-seen-* é escrita de ABERTURA do módulo (marcador de navegação,
      // não ação da pessoa) — provado no emulador 17/08: abrir /financas já
      // emitia uso_modulo sem nenhum toque. Uso = ação, não visita.
      if (!usoJaContado.has(key) && !/last-seen/.test(key)) {
        usoJaContado.add(key);
        trackEvent("uso_modulo", { key, action: rule.action });
      }
      try {
        window.dispatchEvent(new CustomEvent("core:activation", { detail: { action: rule.action, key } }));
      } catch {}
      break;
    }
  }
};

// As chaves do APARELHO (o que nenhuma vassoura apaga) moram em src/lib/chaves-do-aparelho.ts,
// a fonte única desta vassoura e da do logout (use-auth). Chave nova gravada direto no
// localStorage com prefixo varrido entra lá — o teste chaves-do-aparelho-guarda cobra.

const userKey = (userId: string, key: string) => `u:${userId}:${key}`;
// Guest (pre-signup) keys — survive across reloads, migrated on signup/login.
const GUEST_PREFIX = "guest:";
const guestKey = (key: string) => `${GUEST_PREFIX}${key}`;
// Tutorial-related keys where the guest flow should win over an existing
// account value (so a user that signs in mid-tutorial doesn't have to redo it).
const GUEST_WINS_KEYS = new Set<string>([
  "core-onboarding-done",
  "core-all-modules-celebrated",
  "spotlight-done-financas",
  "spotlight-done-rotina",
  "spotlight-done-dieta",
  "spotlight-done-treino",
]);

const safeGetItem = (k: string): string | null => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const safeSetItem = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch {}
};
const safeRemoveItem = (k: string) => {
  try { localStorage.removeItem(k); } catch {}
};

const readAllGuestData = (): Record<string, any> => {
  const out: Record<string, any> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(GUEST_PREFIX)) continue;
      const real = k.slice(GUEST_PREFIX.length);
      const raw = safeGetItem(k);
      if (!raw) continue;
      try { out[real] = JSON.parse(raw); } catch {}
    }
  } catch {}
  return out;
};

const clearAllGuestData = () => {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(GUEST_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach(safeRemoveItem);
  } catch {}
};

export const readUserLocal = (userId: string | null | undefined, key: string): any => {
  if (!userId) return null;
  const raw = safeGetItem(userKey(userId, key));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const writeUserLocal = (userId: string | null | undefined, key: string, value: any) => {
  if (!userId) return;
  safeSetItem(userKey(userId, key), JSON.stringify(value));
};

export const purgeUserLocalCache = () => {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      // Never purge guest data here — it belongs to a separate, pre-signup session.
      if (k.startsWith(GUEST_PREFIX)) continue;
      // 14/10: roda em TODA abertura (lastUserIdRef nasce null) — o que é do aparelho fica.
      if (vassouraLeva(k)) toRemove.push(k);
    }
    toRemove.forEach(safeRemoveItem);
  } catch {}
};

/** Opções de uma escrita. */
interface OpcoesDeEscrita {
  /** Escrita de SISTEMA (virada do mês, carimbos): não conta como gesto da pessoa. */
  system?: boolean;
  /** Estado anterior do formulário, inclusive quando ele usa valores padrão. */
  baseDaAcao?: unknown;
  /**
   * De onde a tela partiu, quando ela escreveu ANTES de a conta chegar do servidor
   * (o `initial` do usePersistedState). Só serve pra juntar a escrita segurada com o
   * servidor sem ressuscitar itens-padrão que a pessoa já tinha apagado.
   */
  base?: unknown;
}

/** Situação da leitura da conta, pro aviso na tela (ver `semConexao`). */
export type SituacaoDaConta = "sem" | "lenta" | "demorando" | null;

interface UserDataContextType {
  get: <T>(key: string, fallback: T) => T;
  set: (key: string, value: any, opts?: OpcoesDeEscrita) => void;
  /**
   * Logado: só vira true quando a conta CHEGOU do servidor nesta sessão (16/10). Leitura
   * que falha não libera mais a tela com o store vazio — senão o vazio era gravado por
   * cima do servidor assim que a rede voltava.
   */
  loaded: boolean;
  /**
   * A conta ainda não chegou do servidor: a última leitura falhou ("sem"); a leitura no ar
   * passou de 8 s mas está dentro do prazo ("lenta" — nada a corta); ou passou do prazo e segue
   * no ar ("demorando" — aí o "tentar de novo" troca por uma nova). null quando está tudo certo
   * (ou convidado). Opcional no tipo pra não obrigar os mocks de teste.
   */
  semConexao?: SituacaoDaConta;
  /**
   * A última leitura da conta trouxe TODAS as páginas (revisão S1, 17/10). Só com isso o usePersistedState
   * trata "chave fora do store" como "chave que não existe no servidor" e pula a busca por chave. Leitura
   * que falha (também a 2ª rodada, com a conta já lida) põe false: a busca por chave volta até uma leitura
   * inteira chegar. Opcional no tipo pra não obrigar os mocks de teste — ausente vale como NÃO completa.
   */
  contaCompleta?: boolean;
  /**
   * Tenta ler a conta de novo agora (botão do aviso, rede voltando, volta pro app). Com a leitura
   * no ar dentro do prazo não faz nada: o que está chegando não é cortado (revisão 2, 17/10).
   */
  tentarDeNovo?: () => void;
  /**
   * A última leitura INTEIRA da conta que deu certo nesta sessão (07/11): quantas já deram certo
   * e quando o PEDIDO saiu — o retrato do servidor que está no store é desse instante. Quem decide
   * com o store na mão e grava a chave inteira por cima (virada do mês, dia anotado) confere se o
   * retrato é deste mês/dia; não sendo, pede `relerConta` antes. Objeto novo a cada leitura, pra
   * entrar em deps. Ausente no convidado e nos mocks de teste (vale como "não sei": segue como antes).
   * Ver "SESSÃO VIVA" no provider.
   */
  ultimaLeitura?: { vez: number; pedidaEm: number };
  /**
   * Pede uma leitura inteira da conta AGORA, mesmo já sincronizado (07/11). Leitura no ar dentro
   * do prazo: a que está chegando serve. Falhou: tenta de novo sozinha (escada de esperas, rede
   * voltando, volta pro app) até dar certo — sem a faixa, a pessoa tem a conta e segue usando.
   */
  relerConta?: () => void;
  /**
   * Marcar OUTRO dia (02/10): roda `fn` (uma ou várias escritas, SÍNCRONAS) dizendo
   * a que dia elas pertencem. `dia` = ontem/anteontem → a anotação entra na
   * sequência NAQUELE dia, não em hoje; `null` → não anota dia nenhum (ex.:
   * desmarcar, ou dia fora da janela de 2 dias). Opcional no tipo pra não obrigar
   * os mocks de teste: sem ele, quem chama só roda a função.
   */
  comDia?: <T>(dia: string | null, fn: () => T) => T;
  /** True when running without an authenticated user (data is local-only). */
  isGuest: boolean;
  /** Lazy fetch a single heavy key from Supabase on demand. */
  fetchKey: <T>(key: string) => Promise<T | null>;
  /** Apaga TODOS os registros da pessoa (servidor + cache do aparelho) e mantém
   *  conta e acesso. Opcional no tipo pra não obrigar os mocks de teste. */
  apagarTudo?: () => Promise<{ ok: boolean; erro?: string }>;
}

export const UserDataContext = createContext<UserDataContextType | undefined>(undefined);
export type { UserDataContextType };

const DEBOUNCE_MS = 250;
const HEAVY_KEY_BYTES = 50_000;
const WRITE_WARN_BYTES = 100_000;
/** Leitura da conta no ar há mais que isto: o aviso "conexão lenta" aparece (a leitura segue). */
const MS_LEITURA_LENTA = 8_000;
/** (07/11, bug "retrato-minutos") Conta lida há mais que isto (no mesmo dia): o 1º gesto é juntado com o servidor e a
 *  volta pra aba/app relê — ver "O RETRATO VELHO NO MESMO DIA". */
const MS_RETRATO_VELHO = 10 * 60_000;
/** Espera entre as tentativas de ler a conta depois de uma falha (a última se repete). */
const ESPERAS_NOVA_TENTATIVA = [2_000, 5_000, 10_000, 20_000, 30_000];
/*
 * PRAZO DE CADA LEITURA DA CONTA — O PRAZO NÃO CORTA (revisão 2, 17/10).
 *
 * A 1ª versão (15/30/60 s) cancelava a leitura no estouro. Só que o user_data guarda FOTO em
 * base64 (desejos, viagens, pet antigo): uma chave sozinha passa de MB, e conta pesada em rede
 * fraca leva minutos. Uma leitura de 70 s era cortada aos 15, 30 e 60 s, recomeçava do zero a
 * cada vez e o app ficava sem a conta pra sempre (9 pedidos em 10 min) — na v1016, sem prazo,
 * carregava em 70 s com UM pedido; uma de 20 s levava 37 s, com 2 downloads e a faixa de falha.
 * Sem como medir o progresso do download, "pendurada" e "pesada" são iguais vistas daqui.
 *
 * Então o prazo só diz até quando a leitura no ar é "normal":
 *  - dentro dele, NADA a interrompe: nem o botão, nem a volta pro app, nem a rede voltando, nem o
 *    auth reemitindo a sessão (volta pro app, token renovado) — a faixa diz "ainda carregando";
 *  - passou dele, a leitura SEGUE (pode ser só pesada), mas a faixa mostra o "Tentar de novo" e
 *    esses gatilhos podem trocá-la por uma nova (a velha é cancelada — se estava pendurada numa
 *    conexão morta, ninguém mais espera por ela);
 *  - cada troca (ou falha) depois do prazo DOBRA o prazo da próxima, sem teto — o botão nunca
 *    volta a escada pros 15 s; só a conta chegando (ou outra conta entrando) zera. O limite de 16
 *    dobras só mantém o setTimeout válido (~11 dias).
 */
const MS_PRAZO_LEITURA = 15_000;
const prazoDaLeitura = (degrau: number) => MS_PRAZO_LEITURA * 2 ** Math.min(degrau, 16);

/** A leitura da conta no ar (uma por vez): de quem, desde quando, até quando é "normal". */
type LeituraNoAr = {
  uid: string;
  ac: AbortController;
  desde: number;
  prazo: number;
  /** relógios da faixa desta leitura ("lenta" aos 8 s, "demorando" no prazo) */
  timers: ReturnType<typeof setTimeout>[];
};
const cancelarLeitura = (l: LeituraNoAr) => {
  l.ac.abort();
  l.timers.forEach(clearTimeout);
};

/**
 * Escrita feita ANTES de a conta chegar do servidor (16/10). Não sobe: fica aqui até a
 * leitura dar certo e aí é juntada com o servidor (lib/mesclar-dados). `base` é o que a
 * tela via quando escreveu pela 1ª vez; `valor`, a última escrita; `sistema`, se TODAS
 * foram escritas de sistema (essas não geram aviso nem contam como dia anotado); `dia`, o
 * dia (localDayKey) da última escrita de gesto — é o dia que entra na sequência; dentro de
 * "marcar outro dia" (comDia) é o dia dito ali, e null quando ali se disse "dia nenhum".
 */
type EscritaSegurada = { base: unknown; valor: unknown; sistema: boolean; dia: string | null };

/*
 * ESCRITA SEGURADA SOBREVIVE A FECHAR O APP (revisão 17/10). Anotou antes de a conta chegar
 * e o iPhone matou o app: a escrita morava só na memória e no cache `u:<id>:…`, que a vassoura
 * da próxima abertura apaga — o registro sumia. Agora cada escrita segurada também vai pra uma
 * chave do APARELHO, `core-seguradas-<id da conta>:<chave>` (família em
 * src/lib/chaves-do-aparelho.ts), e volta na abertura seguinte DA MESMA conta pra ser juntada
 * na 1ª leitura que der certo. Sai quando o servidor confirma a gravação (ou quando não há o que
 * gravar), no "sair da conta" e quando outra conta entra no aparelho.
 *
 * Limite conhecido (revisão 2, 17/10): se o envio CHEGOU mas a resposta não (a cópia fica) e,
 * antes desta abertura, a pessoa apagou aquele item noutro aparelho, a junção traz o item de
 * volta. Daqui é indistinguível de "o envio não chegou" (mesmo servidor, mesma cópia) — sem
 * versão no servidor, a escolha é não perder registro.
 */
/**
 * (07/11, bug "recusa-laco") O envio caiu por falta de REDE (o pedido nem chegou ao servidor)? O postgrest-js
 * devolve `status: 0` quando o fetch falha; quando o servidor responde e recusa, vem o HTTP (≥ 400) e, do Postgres,
 * o `code` (22P05, 42501…). Sem status (dublês de teste, cliente antigo): `code` preenchido = recusa; sem nada,
 * na dúvida é rede — o caminho que não perde o que ela anotou.
 */
const ehFalhaDeRede = (error: unknown, status: unknown): boolean => {
  if (status === 0) return true;
  if (typeof status === "number" && status >= 400) return false;
  const code = (error as { code?: unknown } | null)?.code;
  return !(typeof code === "string" && code.trim() !== "");
};

const PREFIXO_SEGURADAS = "core-seguradas-";
const prefixoSeguradasDe = (uid: string) => `${PREFIXO_SEGURADAS}${uid}:`;
const guardarSegurada = (uid: string, key: string, e: EscritaSegurada) =>
  safeSetItem(prefixoSeguradasDe(uid) + key, JSON.stringify(e));
const esquecerSegurada = (uid: string, key: string) => safeRemoveItem(prefixoSeguradasDe(uid) + key);
const lerSeguradasGuardadas = (uid: string): Record<string, EscritaSegurada> => {
  const out: Record<string, EscritaSegurada> = {};
  const prefixo = prefixoSeguradasDe(uid);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefixo)) continue;
      const raw = safeGetItem(k);
      if (!raw) continue;
      try {
        const e = JSON.parse(raw);
        if (e && typeof e === "object" && "valor" in e) {
          out[k.slice(prefixo.length)] = { base: e.base, valor: e.valor, sistema: !!e.sistema, dia: typeof e.dia === "string" || e.dia === null ? e.dia : localDayKey() };
        }
      } catch { /* entrada estragada: ignora */ }
    }
  } catch { /* storage bloqueado */ }
  return out;
};
/** Apaga as escritas seguradas guardadas no aparelho: as de uma conta, ou as de todas MENOS uma. */
const apagarSeguradasGuardadas = (filtro: { daConta: string } | { menosDa: string }) => {
  try {
    const manter = "menosDa" in filtro ? prefixoSeguradasDe(filtro.menosDa) : null;
    const apagar = "daConta" in filtro ? prefixoSeguradasDe(filtro.daConta) : PREFIXO_SEGURADAS;
    const sair: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(apagar) || (manter && k.startsWith(manter))) continue;
      sair.push(k);
    }
    sair.forEach(safeRemoveItem);
  } catch { /* storage bloqueado */ }
};

/**
 * Aviso de "esta chave mudou" pras telas abertas (o mesmo evento do usePersistedState —
 * EVENTO_MESMA_CHAVE lá; o teste dados-offline-guard confere que é o mesmo texto). Disparado
 * SÍNCRONO: a tela adota o valor antes de a próxima escrita dela sair.
 */
export const EVENTO_TELAS_DA_CHAVE = "core:persisted-state";
const avisarTelasDaChave = (key: string, value: unknown) => {
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_TELAS_DA_CHAVE, {
      detail: { key, json: JSON.stringify(value), value, origem: Symbol("servidor") },
    }));
  } catch { /* sem window */ }
};

/** O que a 1ª leitura certa deixa pro momento em que as telas já têm o valor juntado. */
type Liberacao = {
  uid: string;
  /** como o servidor fica depois de subir o juntado */
  confirmado: Record<string, unknown>;
  /** como o servidor estava na leitura */
  servidor: Record<string, unknown>;
  juntadasNaLeitura: string[];
  dias: Set<string>;
  perdidas: string[];
  medida: { falhas: number; ms: number; seguradas: number; juntadas: number } | null;
};

/**
 * A sessão do auth é mesmo desta conta? Sem token válido o supabase-js manda a chave
 * anônima, a RLS devolve ZERO linhas SEM erro e o "vazio" passaria por conta lida.
 * (Mock de teste sem `auth`: não dá pra conferir — segue.)
 */
const sessaoEhDaConta = async (userId: string): Promise<boolean> => {
  try {
    const auth = (supabase as any).auth;
    if (!auth || typeof auth.getSession !== "function") return true;
    const { data } = await auth.getSession();
    const s = data?.session;
    return !!s?.access_token && s.user?.id === userId;
  } catch {
    return false;
  }
};

/*
 * LEITURA DA CONTA EM PÁGINAS (revisão S1, 17/10). O PostgREST devolve no máximo `max-rows` linhas
 * por pedido (1000 neste projeto — conferido em produção em 17/10: pedido de 1500 linhas volta 1000,
 * content-range 0-999) e corta o resto SEM erro: conta com mais de 1000 linhas perdia as de depois,
 * calada. Na 1.0.16 isso passou a apagar dado: chave fora do store vale como "não existe no servidor"
 * (usePersistedState, sem a busca por chave) e a guarda junta as escritas seguradas contra esta
 * leitura — a próxima escrita numa chave cortada sobrescrevia o servidor. Agora:
 *  - páginas de PAGINA_DA_CONTA linhas, ordenadas por `key` (única por conta: a ordem é total e uma
 *    página não muda de um pedido pro outro), até uma vir com menos que isso — conta com menos de 1000
 *    linhas continua sendo UM pedido; as páginas são juntadas antes de qualquer coisa ser aplicada;
 *  - offset (`range`) é seguro aqui: linha de user_data só é apagada com a conta inteira (Começar do
 *    zero, excluir conta), então nenhuma linha viva é pulada entre uma página e a seguinte;
 *  - antes de CADA página: a leitura ainda vale (não foi trocada, a conta é a mesma, não desmontou) e a
 *    sessão do auth é desta conta (sem token, a página vazia da chave anônima pareceria o fim);
 *  - falhou QUALQUER página = a leitura inteira falhou (o caminho de tentar de novo); nunca meia conta.
 * PAGINA_DA_CONTA tem de ser ≤ o max-rows do projeto (Settings → API do Supabase): uma página mais
 * curta que o pedido pareceria o fim da conta.
 */
const PAGINA_DA_CONTA = 1000;
/** Teto de páginas (100 mil linhas): só pra um servidor que ignorasse o `range` não prender a leitura num laço. */
const MAX_PAGINAS_DA_CONTA = 100;
type LeituraDaConta = { data: any[] | null; error: any; paginas: number };
const lerContaInteira = async (uid: string, sinal: AbortSignal, vale: () => boolean): Promise<LeituraDaConta> => {
  const linhas: any[] = [];
  let paginas = 0;
  try {
    while (paginas < MAX_PAGINAS_DA_CONTA) {
      if (sinal.aborted || !vale()) return { data: null, error: { message: "aborted: a leitura foi trocada" }, paginas };
      if (!(await sessaoEhDaConta(uid))) return { data: null, error: { message: "sessão do auth ausente ou de outra conta" }, paginas };
      const de = paginas * PAGINA_DA_CONTA;
      paginas += 1;
      const r = await (supabase as any)
        .from("user_data")
        .select("key, value")
        .eq("user_id", uid)
        .order("key", { ascending: true })
        .range(de, de + PAGINA_DA_CONTA - 1)
        .abortSignal(sinal);
      const d = r?.data ?? null;
      const e = r?.error ?? null;
      if (e) return { data: null, error: e, paginas };
      if (!Array.isArray(d)) return { data: null, error: { message: "resposta sem lista" }, paginas };
      for (const linha of d) linhas.push(linha);
      if (d.length < PAGINA_DA_CONTA) return { data: linhas, error: null, paginas };
    }
    return { data: null, error: { message: `conta com mais de ${MAX_PAGINAS_DA_CONTA} páginas` }, paginas };
  } catch (e: any) {
    return { data: null, error: { message: String(e?.message ?? e) }, paginas };
  }
};

export const UserDataProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [store, setStore] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);
  const pendingWrites = useRef<Record<string, any>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(user);
  const lastUserIdRef = useRef<string | null>(null);
  const inFlightFetches = useRef<Map<string, Promise<any>>>(new Map());
  // Sequência (26/09): espelhos síncronos pro `set` (que é estável e não
  // enxerga o store) e o dia já registrado nesta sessão.
  const storeRef = useRef(store);
  storeRef.current = store;
  // 1.0.16 — a medição total lê o store EM MEMÓRIA (só leitura) pra nunca usar texto da pessoa numa
  // chave: texto do código que também está nos dados (sugestão que virou hábito, categoria) fica de fora.
  useEffect(() => {
    registrarLeitorDosDados(() => storeRef.current);
    return () => registrarLeitorDosDados(null);
  }, []);
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  const diaAnotadoRef = useRef<string | null>(null);
  const setRef = useRef<(key: string, value: any, opts?: OpcoesDeEscrita) => void>(() => {});

  /*
   * ABERTURA SEM REDE (16/10). A vassoura da abertura apaga o cache da conta e a conta
   * vem do servidor; se essa leitura falhava, o app dizia "carregado" com o store VAZIO,
   * e a 1ª escrita depois que a rede voltava (da pessoa ou da própria Home: widgets,
   * favoritos, dias anotados) SOBRESCREVIA a chave inteira no servidor. Agora:
   *  - `sincronizadoRef`: a conta desta pessoa chegou do servidor nesta sessão;
   *  - antes disso, escrita não sobe — fica em `seguradas` e é JUNTADA com o servidor
   *    quando a leitura der certo;
   *  - leitura que falha não libera `loaded`; tenta de novo sozinha (espera crescente,
   *    volta da rede, volta pro app) e o aviso "sem conexão" aparece.
   */
  const sincronizadoRef = useRef(false);
  const seguradas = useRef<Record<string, EscritaSegurada>>({});
  /** Hora da última escrita de cada chave: escrita feita DEPOIS do pedido de leitura ganha do retrato. */
  const ultimaEscrita = useRef<Map<string, number>>(new Map());
  /** (07/11) Hora em que o último envio de cada chave SAIU pro servidor, e quantos envios dela estão no ar — ver
   *  "O ENVIO QUE SAIU DEPOIS DO PEDIDO" na hidratação. */
  const envioDaChave = useRef<Map<string, number>>(new Map());
  const enviosNoAr = useRef<Map<string, number>>(new Map());
  /** (07/11, bug "envio-velho") O número do último envio de cada chave (sobe a cada envio NOVO, não a cada nova
   *  tentativa) — ver "A NOVA TENTATIVA DO VALOR VELHO" no persistKey. */
  const ultimoEnvio = useRef<Map<string, number>>(new Map());
  /** (revisão 2, 17/10) a leitura da conta no ar — ver PRAZO DE CADA LEITURA DA CONTA */
  const leituraAtual = useRef<LeituraNoAr | null>(null);
  /** quantas vezes o prazo da leitura já dobrou enquanto a conta não chega */
  const degrauDoPrazo = useRef(0);
  /** a próxima tentativa marcada depois de uma falha */
  const timerNovaTentativa = useRef<ReturnType<typeof setTimeout> | null>(null);
  const falhasSeguidas = useRef(0);
  /** Quando a conta começou a faltar (1ª tentativa desta pessoa) — telemetria da recuperação. */
  const inicioDaEspera = useRef<number | null>(null);
  const [semConexao, setSemConexao] = useState<SituacaoDaConta>(null);
  /** (revisão S1, 17/10) a última leitura da conta veio inteira — ver `contaCompleta` no tipo */
  const [contaCompleta, setContaCompleta] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  /*
   * LIBERAR SÓ DEPOIS QUE AS TELAS TÊM O VALOR JUNTADO (revisão 17/10). A 1ª leitura certa
   * junta e manda o store novo pro React, mas as telas só adotam no efeito de hidratação do
   * próximo commit; um toque nesse intervalo gravava o valor VELHO da tela — e, se a escrita
   * já estivesse liberada, ia direto pro servidor. Então a leitura deixa a `Liberacao` aqui e
   * quem solta as escritas é um efeito do provider, que roda DEPOIS dos efeitos das telas
   * (filhos primeiro) no mesmo commit; o que chegou no intervalo é juntado de novo antes.
   */
  const aLiberar = useRef<Liberacao | null>(null);
  const [liberacao, setLiberacao] = useState(0);
  /**
   * Chaves juntadas cuja cópia guardada no aparelho espera o servidor confirmar a gravação →
   * a BASE original dela (relativa ao servidor de verdade). Escrita que chega antes da
   * confirmação regrava a cópia com ESTA base: se o app morrer antes do envio, a próxima
   * abertura junta de novo contra o servidor (que ainda não tem o juntado) e nada se perde.
   */
  const aConfirmar = useRef<Map<string, unknown>>(new Map());
  /*
   * SESSÃO VIVA (07/11): O STORE PODE SER UM RETRATO DE OUTRO DIA — OU DE OUTRO MÊS.
   *
   * A conta chega do servidor uma vez por sessão (e de novo na volta pro app, quando o auth
   * reemite a sessão — mas essa leitura é ASSÍNCRONA, e numa aba sempre visível nem acontece).
   * Aba do PC aberta dias seguidos, app do celular vivo em segundo plano: o que OUTRO aparelho
   * gravou nesse meio-tempo não está aqui, e o `set` manda a chave INTEIRA. Quem decide em cima do
   * store e grava a chave inteira por cima do servidor apagava o que o celular fez:
   *  - a virada do mês (use-virada-do-mes): aba de 31/10 voltando em 06/11 deixava o servidor com
   *    gastos [], receitas [] e a Luz "não paga" — arquivava outubro e zerava os ✓ em cima do
   *    novembro que o celular já tinha lançado;
   *  - o dia anotado (registrarDiaAnotado/registrarDiaRetro): a lista de dias velha + hoje ia por
   *    cima dos dias que o celular anotou desde a leitura — a sequência perdia esses dias.
   *
   * Saída: `ultimaLeitura` diz de QUANDO é o retrato (o instante do pedido). Quem vai gravar em
   * cima confere se o retrato é do mesmo mês (virada) ou do mesmo dia (dia anotado); não sendo,
   * pede `relerConta` e só grava depois que a leitura dá certo — a virada reavalia quando
   * `ultimaLeitura` muda; o dia fica em `diasPendentes` e entra na lista nova pela MESMA liberação
   * da 1ª leitura (já sabe registrar hoje e ontem/anteontem). Leitura que falha com releitura
   * pedida: tenta de novo sozinha (a escada de esperas, a rede voltando, a volta pro app), sem a
   * faixa — a pessoa tem a conta e segue usando. Offline por muito tempo: a virada e o dia esperam
   * a rede, a tela segue com o que tem (melhor do que apagar o que outro aparelho fez). Convidado
   * não tem servidor: segue como antes. Limite conhecido: o dia pendente mora só na memória —
   * fechar a aba antes de a rede voltar perde o registro daquele dia neste aparelho (a anotação em
   * si, offline, também não sobe). Teste: src/test/sessao-viva-07-11.test.tsx.
   *
   * O GESTO EM CIMA DO RETRATO VELHO (07/11, bug "retrato-velho"). A virada e o dia anotado eram os
   * únicos protegidos. O gesto comum — a aba do PC lida em 03/11 lançando a Farmácia em 06/11 — mandava
   * a chave INTEIRA a partir do retrato de 03/11 e apagava a Padaria que o celular lançou em 05/11; a
   * releitura chegava depois e o valor do aparelho ganhava. Agora, com o retrato de OUTRO DIA (a mesma
   * régua do diaEsperaReleitura), a escrita entra pelo caminho das SEGURADAS — base = o que o servidor
   * tinha na última confirmação (`doServidor`), guardada no aparelho — e pede `relerConta`. A
   * releitura junta com mesclar3 (o que ela acrescentou entra, o que o celular lançou fica; o aviso de
   * conflito já existe) e a liberação avisa as telas abertas. Isso vale também durante a espera da
   * virada (rede lenta): a tela de Finanças ainda mostra outubro e aceita toques — o gasto novo junta
   * com o novembro do celular em vez de ir por cima. E na 2ª rodada a liberação avisa as telas de
   * TODA chave que mudou no servidor (não só as juntadas): a tela que não foi tocada também adota o
   * que o celular lançou, senão o gesto seguinte, já com o retrato de hoje, gravava a lista velha dela.
   * Custo aceito: no 1º gesto de um dia novo a gravação espera a releitura (centenas de ms; offline,
   * até a rede voltar — a cópia no aparelho segura se o app fechar).
   */
  const ultimaLeituraRef = useRef<{ vez: number; pedidaEm: number } | null>(null);
  const [ultimaLeitura, setUltimaLeitura] = useState<{ vez: number; pedidaEm: number } | undefined>(undefined);
  /** alguém pediu a conta de novo e ela ainda não chegou — a falha tenta de novo mesmo sincronizado */
  const releituraPedida = useRef(false);
  /** dias anotados esperando a releitura pra entrar na lista (localDayKey) */
  const diasPendentes = useRef<Set<string>>(new Set());
  /*
   * O RETRATO VELHO NO MESMO DIA (07/11, bug "retrato-minutos"). A régua do "retrato-velho" só olhava o DIA. No mesmo
   * dia, a aba do PC lida às 8h00 e o celular lançando a Padaria: às 8h40 a aba voltava (a volta não relia — quem já
   * está sincronizado sai cedo de `tentarDeNovo`) e o gesto mandava a chave inteira do retrato das 8h00; a Padaria
   * sumia. A releitura só vinha com a renovação do token (~1 h) ou com o auth reemitindo a sessão. Agora o retrato
   * lido há mais de MS_RETRATO_VELHO também é "velho" pro gesto (entra pelas SEGURADAS e pede `relerConta`, o mesmo
   * caminho do outro dia), e a volta pra aba/app com ele pede `relerConta`. A régua do DIA ANOTADO segue só o dia
   * (`retratoDeOutroDia`): a lista de dias só muda de um dia pro outro. Custo aceito: o 1º gesto depois de 10 min
   * sem leitura espera uma leitura (centenas de ms).
   */
  const retratoPassouDoPrazo = (): boolean => {
    const l = ultimaLeituraRef.current;
    if (!userRef.current || !l) return false;
    return localDayKey(new Date(l.pedidaEm)) !== localDayKey() || Date.now() - l.pedidaEm > MS_RETRATO_VELHO;
  };
  /*
   * O QUE NÃO SUBIU (07/11, bug "offline-some"). O envio tenta 3 vezes (~1,5 s) e desistia. Sem rede (metrô), o
   * que ela anotou ficava só na tela e no cache — e a próxima leitura da conta (a rede voltando, o dia novo, a
   * virada) punha o valor do servidor no lugar, na tela e no cache. A gravação seguinte partia desse valor velho
   * e a perda ficava de vez; fechar o app antes da rede voltar também perdia (a vassoura da abertura apaga o
   * cache). Agora:
   *  - `naoSubiram`: chaves cujo último envio desistiu com o valor ainda na tela. Na próxima leitura que dá
   *    certo elas viram escrita SEGURADA (base = `doServidor`, o que o servidor tinha da última vez que
   *    confirmou) e são JUNTADAS com o servidor por mesclar3, como a escrita feita antes de a conta chegar: o
   *    que ela anotou fica, o que outro aparelho lançou nesse meio-tempo também — e o juntado sobe;
   *  - o envio que desiste pede `relerConta`: a escada de tentativas, a rede voltando e a volta pro app
   *    trazem a conta de novo sem ninguém tocar em nada;
   *  - e guarda uma cópia no aparelho (`guardarSegurada`, sem dia nem aviso — escrita de sistema): o app
   *    fechado antes de a rede voltar junta na próxima abertura. Sai quando um envio da chave dá certo.
   * `doServidor` só guarda referências que já estão na memória (o retrato lido e o que subiu).
   */
  const naoSubiram = useRef<Set<string>>(new Set());
  const doServidor = useRef<Map<string, unknown>>(new Map());
  /*
   * O ENVIO RECUSADO NÃO VIRA LAÇO (07/11, bug "recusa-laco"). O "não subiu" acima pedia `relerConta` pra QUALQUER
   * erro. Com o servidor RECUSANDO a chave — texto colado com \u0000 (22P05), corpo grande demais (413), RLS (42501),
   * 503/429 numa queda — a leitura dava certo, juntava, o envio era recusado de novo e pedia outra leitura: uma
   * leitura da conta inteira a cada ~2 s, sem fim, enquanto o app estivesse aberto. Antes do 7884fd5d eram 3
   * tentativas e parava. Agora:
   *  - recusa do servidor (`ehFalhaDeRede` = não): a chave fica em `naoSubiram` e com a cópia no aparelho (a próxima
   *    leitura, a rede voltando e a próxima abertura juntam e tentam de novo — 3 envios, sem laço), sai um
   *    `dados_envio_recusado` e NÃO pede leitura;
   *  - falha de rede: pede `relerConta` uma vez por chave (`releuPorFalha`) até um envio dela dar certo. Se a mesma
   *    chave cai de novo depois de uma leitura que deu certo (a rede está viva), ela segue em `naoSubiram` e no
   *    aparelho, mas não pede outra leitura. O evento `online` zera a trava e junta o que não subiu.
   */
  const releuPorFalha = useRef<Set<string>>(new Set());

  // Sync ref + react to user changes (login/logout/switch).
  useEffect(() => {
    const prevUserId = lastUserIdRef.current;
    const nextUserId = user?.id ?? null;
    userRef.current = user;

    if (prevUserId !== nextUserId) {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      pendingWrites.current = {};
      diaAnotadoRef.current = null; // sequência (26/09): o dia registrado era da outra conta
      inFlightFetches.current.clear();
      // 16/10: o que estava segurado/sincronizado era da outra conta (ou de ninguém)
      sincronizadoRef.current = false;
      ultimaEscrita.current.clear();
      envioDaChave.current.clear();
      enviosNoAr.current.clear();
      ultimoEnvio.current.clear();
      // revisão 2 (17/10): a leitura no ar e a tentativa marcada também — o efeito da hidratação
      // não corta mais leitura ao rodar de novo, então quem corta na troca de conta é aqui
      if (leituraAtual.current) { cancelarLeitura(leituraAtual.current); leituraAtual.current = null; }
      if (timerNovaTentativa.current) { clearTimeout(timerNovaTentativa.current); timerNovaTentativa.current = null; }
      degrauDoPrazo.current = 0;
      falhasSeguidas.current = 0;
      inicioDaEspera.current = null;
      aLiberar.current = null;
      aConfirmar.current.clear();
      // 07/11: o retrato, a releitura pedida e os dias esperando eram da outra conta — ver "SESSÃO VIVA"
      ultimaLeituraRef.current = null;
      setUltimaLeitura(undefined);
      releituraPedida.current = false;
      diasPendentes.current.clear();
      naoSubiram.current.clear(); // (07/11) e o que não subiu era da outra conta — ver "O QUE NÃO SUBIU"
      releuPorFalha.current.clear();
      doServidor.current.clear();
      setSemConexao(null);
      setContaCompleta(false);
      setLoaded(false);
      // On switch/logout we wipe per-user cache, but NOT guest data.
      purgeUserLocalCache();
      // 17/10: escrita segurada guardada no aparelho — a de quem saiu vai embora; a de outra
      // conta também (não fica dado de ninguém esperando aqui); a desta conta VOLTA pro store e
      // pra fila de junção (anotou, o app morreu antes de a conta chegar: o registro não some).
      if (prevUserId) apagarSeguradasGuardadas({ daConta: prevUserId });
      let restauradas: Record<string, EscritaSegurada> = {};
      if (nextUserId) {
        apagarSeguradasGuardadas({ menosDa: nextUserId });
        restauradas = lerSeguradasGuardadas(nextUserId);
        for (const [k, e] of Object.entries(restauradas)) safeSetItem(userKey(nextUserId, k), JSON.stringify(e.valor));
      }
      seguradas.current = restauradas;
      setStore(Object.fromEntries(Object.entries(restauradas).map(([k, e]) => [k, e.valor])));
      lastUserIdRef.current = nextUserId;
    }
  }, [user]);

  // Hydration effect — runs whenever auth state finishes resolving.
  useEffect(() => {
    if (authLoading) return;

    // -------- GUEST MODE --------
    if (!user) {
      const guestData = readAllGuestData();
      setStore(guestData);
      setLoaded(true);
      return;
    }

    // -------- AUTHENTICATED --------
    // Revisão 2 (17/10): uma leitura por vez, e a que está no ar DENTRO DO PRAZO segue — esta
    // rodada (auth reemitindo a sessão na volta pro app ou ao renovar o token, botão, rede
    // voltando, tentativa marcada) não faz nada. Passou do prazo: é trocada por uma nova, com o
    // dobro do prazo. Sem leitura no ar: começa uma (a tentativa marcada, se houver, sai).
    const anterior = leituraAtual.current;
    if (anterior) {
      if (anterior.uid === user.id && Date.now() - anterior.desde < anterior.prazo) return;
      cancelarLeitura(anterior);
      leituraAtual.current = null;
      if (anterior.uid === user.id) {
        degrauDoPrazo.current += 1;
        // trocou a vencida: a faixa volta pro "ainda carregando" sem botão até a nova vencer
        if (!sincronizadoRef.current) setSemConexao("lenta");
      }
    }
    if (timerNovaTentativa.current) { clearTimeout(timerNovaTentativa.current); timerNovaTentativa.current = null; }

    const uid = user.id;
    const leitura: LeituraNoAr = { uid, ac: new AbortController(), desde: Date.now(), prazo: prazoDaLeitura(degrauDoPrazo.current), timers: [] };
    leituraAtual.current = leitura;
    // esta leitura ainda é a dona do estado? (não foi trocada, a conta não mudou, não desmontou)
    const vale = () => leituraAtual.current === leitura && userRef.current?.id === uid;
    if (inicioDaEspera.current === null) inicioDaEspera.current = leitura.desde;
    // a faixa enquanto a conta não chega: "lenta" aos 8 s (sem botão: nada corta a leitura no
    // prazo); passou do prazo, "demorando" (o botão aparece e troca a leitura)
    leitura.timers.push(
      setTimeout(() => { if (vale() && !sincronizadoRef.current) setSemConexao("lenta"); }, MS_LEITURA_LENTA),
      setTimeout(() => { if (vale() && !sincronizadoRef.current) setSemConexao("demorando"); }, leitura.prazo),
    );

    const run = async () => {
      // Step 0: migrate any guest data into this account before we hydrate.
      const guestData = readAllGuestData();
      const guestKeys = Object.keys(guestData);
      if (guestKeys.length > 0) {
        /*
         * MIGRAÇÃO QUE APAGAVA OS DADOS (corrigido 16/08). Dois defeitos que
         * só aparecem quando a rede falha — e ficou muito mais grave com o
         * teste grátis da v53, onde TUDO que a pessoa constrói nos 3 dias
         * nasce em `guest:` e só vira conta depois do pagamento.
         *
         *  1. o supabase-js NÃO LANÇA em falha de rede/RLS: ele RETORNA
         *     {error} (postgrest-js com shouldThrowOnError=false). O
         *     try/catch nunca disparava pras falhas reais, e o
         *     `finally { clearAllGuestData() }` apagava a origem mesmo com a
         *     gravação tendo falhado. Dado perdido, sem retry.
         *  2. o erro do SELECT era ignorado: sem a lista do servidor,
         *     `existingSet` fica vazio, todas as chaves passam no filtro e o
         *     upsert grava o snapshot do convidado POR CIMA da conta.
         *
         * Agora: erro de leitura ou de escrita = migração falhou, os
         * `guest:*` FICAM no aparelho e a próxima abertura tenta de novo (o
         * upsert é idempotente por onConflict user_id,key).
         */
        let migrou = false;
        try {
          const { data: existing, error: selErro } = await (supabase as any)
            .from("user_data")
            .select("key")
            .eq("user_id", user.id)
            .in("key", guestKeys);
          if (selErro) throw selErro;
          const existingSet = new Set<string>((existing ?? []).map((r: any) => r.key));

          const toUpsert = guestKeys
            // 21/10: conteúdo pago só o servidor grava (lib/conteudo-pago) — e a recusa do banco travaria a migração inteira
            .filter(k => !chaveSoDoServidor(k))
            .filter(k => !existingSet.has(k) || GUEST_WINS_KEYS.has(k))
            .map(k => ({ user_id: user.id, key: k, value: guestData[k] }));

          if (toUpsert.length > 0) {
            // Chunk to avoid huge payloads.
            const CHUNK = 50;
            for (let i = 0; i < toUpsert.length; i += CHUNK) {
              const { error: upErro } = await (supabase as any)
                .from("user_data")
                .upsert(toUpsert.slice(i, i + CHUNK), { onConflict: "user_id,key" });
              if (upErro) throw upErro;
            }
          }
          migrou = true;
        } catch (e) {
          console.error("[user-data] migração convidado→conta falhou (dados mantidos pra tentar de novo):", e);
        }
        if (migrou) clearAllGuestData();
      }

      // Step 1: instant hydration from per-user localStorage cache.
      // 16/10: JUNTA com o que já está na memória (a memória ganha). Trocar o store
      // inteiro pelo cache numa 2ª rodada (o auth emite SIGNED_IN a cada volta pro app)
      // tirava da memória as chaves pesadas (≥50KB, que não vão pro cache) — e, se a
      // leitura do servidor falhasse nessa rodada, a tela via vazio e a próxima escrita
      // apagava a chave no servidor.
      try {
        const prefix = `u:${user.id}:`;
        const cached: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith(prefix)) continue;
          const realKey = k.slice(prefix.length);
          const raw = safeGetItem(k);
          if (!raw) continue;
          try { cached[realKey] = JSON.parse(raw); } catch {}
        }
        if (Object.keys(cached).length > 0) {
          setStore(prev => ({ ...cached, ...prev }));
        }
      } catch {}

      // Step 2: refresh from Supabase (server wins for non-heavy keys).
      if (!vale()) return;
      const pedidoEm = Date.now();
      // (07/11) o que ainda vai pro servidor NA HORA DO PEDIDO — na fila (o envio espera 250 ms) ou no ar: o retrato
      // não tem isto. Ver "O ENVIO QUE SAIU DEPOIS DO PEDIDO" abaixo.
      const aCaminhoNoPedido = new Set<string>([...Object.keys(pendingWrites.current), ...enviosNoAr.current.keys()]);
      // revisão 2 (17/10): sem corrida com o prazo — a leitura vai até o fim (ou até ser trocada
      // depois do prazo, que a cancela; aí o `vale()` abaixo descarta a resposta dela)
      // revisão S1 (17/10): TODAS as páginas da conta, ou falha — ver LEITURA DA CONTA EM PÁGINAS
      const { data, error, paginas } = await lerContaInteira(uid, leitura.ac.signal, vale);
      if (!vale()) return; // trocada, outra conta ou desmontou: a dona do estado é outra
      leitura.timers.forEach(clearTimeout);
      leituraAtual.current = null;

      if (!error && data) {
        const eraSincronizado = sincronizadoRef.current;
        // quantas contas passam de uma página (1x por abertura; o admin não lê o user_data dos outros)
        if (!eraSincronizado && paginas > 1) trackEvent("dados_conta_paginada", { paginas, linhas: data.length });
        const map: Record<string, any> = {};
        data.forEach((row: any) => {
          if (row.value === null || row.value === undefined) return;
          /*
           * CHAVE PESADA VAI PRA MEMÓRIA (08/08). Antes, chave ≥50KB era
           * DESCARTADA aqui — e só voltava se alguém chamasse fetchKey, coisa
           * que só o usePersistedState faz. Quem lê com useUserData direto
           * (Pet, Conquistas) via a chave VAZIA, e a escrita seguinte
           * sobrescrevia o histórico no servidor: é o "cadastro o pet e ele
           * some", com perda definitiva.
           *
           * O valor JÁ VEIO nesta resposta — descartar não economizava rede,
           * só criava o buraco. Quem tem limite apertado é o localStorage
           * (~5MB), então a trava de tamanho fica só nele (abaixo).
           */
          map[row.key] = row.value;
        });

        // (07/11) o envio que desistiu vira escrita segurada e é juntado abaixo, como o que foi escrito antes de a
        // conta chegar — ver "O QUE NÃO SUBIU". A base é o último valor que o servidor confirmou.
        for (const k of naoSubiram.current) {
          if (k in seguradas.current) continue;
          const local = k in pendingWrites.current ? pendingWrites.current[k] : storeRef.current[k];
          if (local === undefined) continue;
          seguradas.current[k] = { base: doServidor.current.get(k), valor: local, sistema: true, dia: null };
        }
        naoSubiram.current.clear();
        for (const [k, v] of Object.entries(map)) doServidor.current.set(k, v);

        /*
         * 16/10 — O QUE FOI ESCRITO ANTES DE A CONTA CHEGAR É JUNTADO, NÃO SOBRESCRITO.
         * A escrita segurada partiu de uma base que não era o dado da pessoa (o vazio da
         * tela); mandar como está apagaria o servidor. lib/mesclar-dados junta em 3 vias:
         * o que ela acrescentou entra, conflito fica com o servidor (e ela é avisada).
         */
        const mesclados: Record<string, any> = {};
        const perdidas: string[] = [];
        // dias em que a pessoa ANOTOU algo enquanto a conta não chegava (entram na sequência na liberação)
        const dias = new Set<string>();
        let juntadas = 0;
        const nSeguradas = Object.keys(seguradas.current).length;
        for (const [k, h] of Object.entries(seguradas.current)) {
          const r = mesclar3(h.base, h.valor, k in map ? map[k] : undefined);
          mesclados[k] = r.valor;
          if (!iguais(r.valor, h.valor)) juntadas++;
          if (r.perdeu && !h.sistema && contaComoAnotacao(k)) perdidas.push(k);
          if (h.dia && !h.sistema && contaComoAnotacao(k) && temConteudo(r.valor) && !iguais(r.valor, map[k])) dias.add(h.dia);
        }
        const seguradasDaLeitura = seguradas.current;
        seguradas.current = {};
        /*
         * ESCRITA RECENTE GANHA DO SERVIDOR. A resposta é um retrato tirado
         * ANTES desta hidratação terminar, e a gravação é debounced em
         * 250ms: quem cadastrou algo nesse meio-tempo tinha o item apagado
         * pelo laço abaixo (ou sobrescrito pelo valor velho) ~1-3s depois de
         * salvar. Reaplicar pendingWrites por cima fecha a corrida.
         * 16/10: vale pra qualquer escrita feita depois do PEDIDO (já gravada
         * ou ainda na fila) — o retrato é mais velho que ela.
         */
        const recentes = new Set<string>();
        for (const [k, t] of ultimaEscrita.current) {
          if (t >= pedidoEm && !(k in mesclados)) recentes.add(k);
        }
        /*
         * O ENVIO QUE SAIU DEPOIS DO PEDIDO (07/11, crítica do "sessão viva"). A releitura que a
         * sessão viva pede (1º gesto depois da meia-noite, virada do mês na volta pra aba) sai
         * poucos ms DEPOIS do gesto que a disparou — e o envio do gesto espera 250 ms. Com a
         * resposta chegando depois do envio (rede de celular, conta em várias páginas), a chave
         * não estava mais na fila nem era "escrita depois do pedido": o aparelho voltava pro
         * valor velho (memória e cache) e a próxima gravação feita em cima dele apagava o que
         * ela anotou. Escrita que ainda ia pro servidor no pedido, ou que saiu depois dele,
         * também é mais nova que o retrato.
         */
        for (const k of aCaminhoNoPedido) if (!(k in mesclados)) recentes.add(k);
        for (const [k, t] of envioDaChave.current) {
          if (t >= pedidoEm && !(k in mesclados)) recentes.add(k);
        }
        for (const [k, v] of Object.entries(mesclados)) {
          if (!(k in map) || !iguais(v, map[k])) {
            pendingWrites.current[k] = v;
            ultimaEscrita.current.set(k, Date.now()); // um retrato pedido antes deste envio chegar não desfaz o juntado
            aConfirmar.current.set(k, seguradasDaLeitura[k].base); // a guardada no aparelho sai quando o servidor confirmar
          } else {
            esquecerSegurada(uid, k); // o servidor já tem exatamente isto
          }
        }
        for (const [k, v] of Object.entries(map)) {
          if (k in mesclados || recentes.has(k) || k in pendingWrites.current) continue;
          const json = JSON.stringify(v);
          if (json.length < HEAVY_KEY_BYTES) safeSetItem(userKey(uid, k), json);
        }
        for (const [k, v] of Object.entries(mesclados)) safeSetItem(userKey(uid, k), JSON.stringify(v));
        setStore(prev => {
          const next = { ...prev };
          Object.assign(next, map);
          for (const k of recentes) if (k in prev) next[k] = prev[k];
          Object.assign(next, mesclados, pendingWrites.current);
          for (const k of Object.keys(prev)) {
            if (k in map || k in mesclados || recentes.has(k) || k in pendingWrites.current) continue; // gravação a caminho
            const prevSize = JSON.stringify(prev[k] ?? "").length;
            if (prevSize < HEAVY_KEY_BYTES) {
              delete next[k];
              safeRemoveItem(userKey(uid, k));
            }
          }
          return next;
        });
        if (Object.keys(pendingWrites.current).length > 0) {
          if (flushTimer.current) clearTimeout(flushTimer.current);
          flushTimer.current = setTimeout(() => flushRef.current(), DEBOUNCE_MS);
        }
        // (07/11) dias anotados que esperavam esta releitura — ver "SESSÃO VIVA"
        for (const d of diasPendentes.current) dias.add(d);
        // (07/11, bug "retrato-velho") 2ª rodada: o que mudou no servidor desde o retrato anterior (outro aparelho)
        // também vai pras telas abertas — ver "O GESTO EM CIMA DO RETRATO VELHO". A escrita daqui que ainda vai
        // pro servidor (recentes, fila) não: a tela já mostra a dela.
        const mudaramNoServidor = eraSincronizado
          ? Object.keys(map).filter((k) => !(k in mesclados) && !recentes.has(k) && !(k in pendingWrites.current)
            && !iguais(storeRef.current[k], map[k]))
          : [];
        if (!eraSincronizado) {
          // 17/10: a escrita só volta a subir direto na liberação (efeito do provider, depois que
          // as telas adotaram o valor juntado) — ver `aLiberar`.
          const ms = Date.now() - (inicioDaEspera.current ?? pedidoEm);
          aLiberar.current = {
            uid,
            confirmado: { ...map, ...mesclados },
            servidor: map,
            juntadasNaLeitura: Object.keys(mesclados),
            dias,
            perdidas,
            // Medida da exposição (16/10): só quando algo fugiu do normal — leitura que falhou
            // antes, que demorou, ou escrita feita em cima do vazio que teria apagado o servidor
            // (`juntadas`: o servidor tinha dado e a junção trouxe de volta).
            medida: falhasSeguidas.current > 0 || ms > MS_LEITURA_LENTA || juntadas > 0 || perdidas.length > 0
              ? { falhas: falhasSeguidas.current, ms, seguradas: nSeguradas, juntadas }
              : null,
          };
          setLiberacao((n) => n + 1);
        } else if (dias.size > 0 || Object.keys(mesclados).length > 0 || mudaramNoServidor.length > 0) {
          // (07/11) 2ª rodada com dia anotado esperando a releitura: a MESMA liberação da 1ª leitura
          // registra o dia em cima da lista que o servidor tem AGORA — ver "SESSÃO VIVA".
          // (07/11, bug "offline-some") e com escrita juntada (o envio que desistiu): a liberação avisa as telas
          // abertas do valor juntado — sem isso a tela seguia com o dela e o próximo toque gravava por cima.
          aLiberar.current = { uid, confirmado: { ...map, ...mesclados }, servidor: map, juntadasNaLeitura: [...Object.keys(mesclados), ...mudaramNoServidor], dias, perdidas, medida: null };
          setLiberacao((n) => n + 1);
        }
        diasPendentes.current.clear();
        releituraPedida.current = false;
        // (07/11) de quando é o retrato que está no store, no mesmo lote do store e do `loaded` — ver "SESSÃO VIVA"
        ultimaLeituraRef.current = { vez: (ultimaLeituraRef.current?.vez ?? 0) + 1, pedidaEm: pedidoEm };
        setUltimaLeitura(ultimaLeituraRef.current);
        falhasSeguidas.current = 0;
        degrauDoPrazo.current = 0;
        inicioDaEspera.current = null;
        setSemConexao(null);
        setContaCompleta(true); // no mesmo lote do `loaded`: a tela que hidrata agora já vê a conta inteira
        setLoaded(true);
        return;
      }

      if (error?.message && !String(error.message).includes("aborted")) {
        console.error("[user-data] failed to load:", error);
      }
      // revisão S1: sem a conta inteira desta leitura, chave fora do store não prova nada — a busca por chave volta
      setContaCompleta(false);
      // Já sincronizado nesta sessão (2ª rodada, ex.: volta pro app): segue com o que tem.
      if (sincronizadoRef.current) {
        setLoaded(true);
        // (07/11) ...mas a releitura PEDIDA (virada do mês em sessão viva, dia anotado com a conta
        // lida noutro dia) não desiste: tenta de novo sozinha, pela mesma escada abaixo — sem a
        // faixa, a pessoa tem a conta e segue usando. Ver "SESSÃO VIVA".
        if (!releituraPedida.current) return;
      } else {
        // 16/10: a conta NÃO chegou — `loaded` fica false (nada de tela "carregada" com o
        // store vazio), o aviso aparece e tenta de novo sozinho.
        setSemConexao("sem");
      }
      falhasSeguidas.current += 1;
      // revisão 2: falhou DEPOIS do prazo (ex.: o sistema desistiu da conexão lenta) — a próxima
      // ganha o dobro; falha rápida (sem rede) não mexe no prazo
      if (Date.now() - leitura.desde >= leitura.prazo) degrauDoPrazo.current += 1;
      const espera = ESPERAS_NOVA_TENTATIVA[Math.min(falhasSeguidas.current - 1, ESPERAS_NOVA_TENTATIVA.length - 1)];
      timerNovaTentativa.current = setTimeout(() => {
        timerNovaTentativa.current = null;
        setTentativa((t) => t + 1);
      }, espera);
    };

    run();
    // Sem limpeza de propósito (revisão 2): rodar de novo NÃO corta a leitura no prazo. Quem
    // cancela é a troca de conta (efeito acima), desmontar (efeito abaixo) e a troca da leitura
    // vencida (no começo deste efeito).
  }, [user, authLoading, tentativa]);

  // desmontou: a leitura no ar e a tentativa marcada vão embora
  useEffect(() => () => {
    if (leituraAtual.current) { cancelarLeitura(leituraAtual.current); leituraAtual.current = null; }
    if (timerNovaTentativa.current) { clearTimeout(timerNovaTentativa.current); timerNovaTentativa.current = null; }
  }, []);

  // 16/10: sem a conta ainda, tenta de novo assim que a rede volta ou a pessoa volta pro app.
  // Revisão 2 (17/10): com a leitura no ar DENTRO DO PRAZO o gatilho não faz nada (não corta o
  // que está chegando nem zera o prazo); sem leitura no ar (esperando a tentativa marcada) ou
  // com a do ar vencida, o efeito da hidratação começa outra.
  const tentarDeNovo = useCallback(() => {
    // (07/11) sincronizado COM releitura pedida também entra — ver "SESSÃO VIVA"
    if (!userRef.current || (sincronizadoRef.current && !releituraPedida.current)) return;
    const l = leituraAtual.current;
    if (l && Date.now() - l.desde < l.prazo) return;
    setTentativa((t) => t + 1);
  }, []);
  /** (07/11) Pede a conta de novo AGORA, mesmo sincronizado — ver "SESSÃO VIVA" e `relerConta` no tipo. */
  const relerConta = useCallback(() => {
    if (!userRef.current) return;
    releituraPedida.current = true;
    tentarDeNovo();
  }, [tentarDeNovo]);
  const relerContaRef = useRef(relerConta);
  relerContaRef.current = relerConta;
  useEffect(() => {
    const aoVoltarPraTela = () => {
      if (document.visibilityState === "hidden") return;
      // (07/11, bug "retrato-minutos") sincronizado com o retrato velho: relê (o celular pode ter lançado nesse meio-tempo)
      if (sincronizadoRef.current && retratoPassouDoPrazo()) relerConta();
      else tentarDeNovo();
    };
    // (07/11, bug "recusa-laco") a rede voltou com envio que não subiu: zera a trava de uma leitura por chave e junta
    const aoVoltarARede = () => {
      if (sincronizadoRef.current && naoSubiram.current.size > 0) {
        releuPorFalha.current.clear();
        relerConta();
      } else tentarDeNovo();
    };
    window.addEventListener("online", aoVoltarARede);
    document.addEventListener("visibilitychange", aoVoltarPraTela);
    return () => {
      window.removeEventListener("online", aoVoltarARede);
      document.removeEventListener("visibilitychange", aoVoltarPraTela);
    };
  }, [tentarDeNovo, relerConta]);

  /*
   * LIBERAÇÃO (17/10): roda no commit em que o store juntado e o `loaded` chegam às telas,
   * DEPOIS dos efeitos de hidratação delas (o React roda os efeitos dos filhos antes dos do
   * pai). Só aqui a escrita volta a subir direto pro servidor.
   */
  useEffect(() => {
    const lib = aLiberar.current;
    if (!lib) return;
    aLiberar.current = null;
    if (userRef.current?.id !== lib.uid) return;
    const uid = lib.uid;

    // 1) escrita feita entre a junção e agora: a tela ainda via o valor velho — junta de novo
    const novos: Record<string, unknown> = {};
    const perdidas = [...lib.perdidas];
    for (const [k, h] of Object.entries(seguradas.current)) {
      const atual = k in lib.confirmado ? lib.confirmado[k] : undefined;
      const r = mesclar3(h.base, h.valor, atual);
      novos[k] = r.valor;
      if (r.perdeu && !h.sistema && contaComoAnotacao(k)) perdidas.push(k);
      if (h.dia && !h.sistema && contaComoAnotacao(k) && temConteudo(r.valor) && !iguais(r.valor, lib.servidor[k])) lib.dias.add(h.dia);
      if (atual === undefined || !iguais(r.valor, atual)) {
        pendingWrites.current[k] = r.valor;
        ultimaEscrita.current.set(k, Date.now());
        if (!aConfirmar.current.has(k)) aConfirmar.current.set(k, h.base);
        guardarSegurada(uid, k, { ...h, base: aConfirmar.current.get(k) }); // a cópia do aparelho espera este envio
      } else if (!aConfirmar.current.has(k)) {
        esquecerSegurada(uid, k); // nada a gravar e nenhum envio da leitura pendente nesta chave
      }
    }
    seguradas.current = {};

    // 2) anotou antes de a conta chegar: o dia entra na sequência (registrarDiaAnotado desiste
    //    antes do `loaded`, e a junção sobe o dado sem anotar o dia — revisão 17/10)
    const hoje = localDayKey();
    const listaAntes = CHAVE_DIAS_ANOTADOS in novos ? novos[CHAVE_DIAS_ANOTADOS] : lib.confirmado[CHAVE_DIAS_ANOTADOS];
    const hub = lib.confirmado[CHAVE_HUB_STREAK];
    let lista: unknown = listaAntes;
    let entrouHoje = false;
    for (const dia of [...lib.dias].sort()) {
      const nova = dia === hoje ? registrarDia(lista, hoje, hub) : registrarDiaRetroativo(lista, dia, hoje, hub);
      if (nova) {
        lista = nova;
        if (dia === hoje) entrouHoje = true;
      }
    }
    if (lib.dias.has(hoje)) diaAnotadoRef.current = hoje;
    if (lista !== listaAntes) {
      novos[CHAVE_DIAS_ANOTADOS] = lista;
      pendingWrites.current[CHAVE_DIAS_ANOTADOS] = lista;
      ultimaEscrita.current.set(CHAVE_DIAS_ANOTADOS, Date.now());
    }

    // 3) as telas adotam o valor juntado ANTES de a escrita voltar a subir direto
    if (Object.keys(novos).length > 0) {
      setStore((prev) => ({ ...prev, ...novos }));
      for (const [k, v] of Object.entries(novos)) safeSetItem(userKey(uid, k), JSON.stringify(v));
    }
    for (const k of new Set([...lib.juntadasNaLeitura, ...Object.keys(novos)])) {
      avisarTelasDaChave(k, k in novos ? novos[k] : lib.confirmado[k]);
    }
    sincronizadoRef.current = true;
    if (Object.keys(pendingWrites.current).length > 0) {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => flushRef.current(), DEBOUNCE_MS);
    }

    if (lib.medida) trackEvent("dados_conta_atrasada", { ...lib.medida, perdidas: perdidas.length });
    if (perdidas.length > 0) {
      toast("Seus dados chegaram", {
        description: "Parte do que você mudou enquanto eles carregavam não deu pra juntar com o que já estava salvo. Dá uma conferida?",
      });
    }
    if (entrouHoje && Array.isArray(lista)) {
      const { dias } = calcularSequencia(lista as string[], hoje);
      import("@/components/conquistas/aviso-sequencia").then((m) => m.avisarSequencia(dias)).catch(() => {});
    }
  }, [liberacao]);

  // Lazy fetch a single key (used for heavy entries like dream board).
  const fetchKey = useCallback(async <T,>(key: string): Promise<T | null> => {
    const userId = userRef.current?.id;
    if (!userId) {
      // Guest: just return whatever is in store (no remote storage).
      return (store[key] ?? null) as T | null;
    }

    if (key in store) return store[key] as T;

    const cached = inFlightFetches.current.get(key);
    if (cached) return cached as Promise<T | null>;

    const p = (async () => {
      const pedidoEm = Date.now();
      const { data, error } = await (supabase as any)
        .from("user_data")
        .select("value")
        .eq("user_id", userId)
        .eq("key", key)
        .maybeSingle();

      if (error) {
        console.error(`[user-data] fetchKey "${key}" failed:`, error);
        inFlightFetches.current.delete(key);
        return null;
      }
      const value = data?.value ?? null;
      // 16/10: escreveram nesta chave enquanto a busca estava no ar (ou a escrita está
      // segurada esperando a conta): o valor da memória é o mais novo — a resposta não
      // passa por cima dele (antes o store voltava pro valor velho e a tela ficava com o
      // novo; quem lesse pelo `get` via outra coisa e gravava em cima).
      const escreveuNoMeio = (ultimaEscrita.current.get(key) ?? 0) >= pedidoEm || key in seguradas.current;
      if (value !== null && userRef.current?.id === userId) doServidor.current.set(key, value); // (07/11) base das junções
      if (value !== null && userRef.current?.id === userId && !escreveuNoMeio) {
        setStore(prev => ({ ...prev, [key]: value }));
        safeSetItem(userKey(userId, key), JSON.stringify(value));
      }
      inFlightFetches.current.delete(key);
      if (escreveuNoMeio && key in storeRef.current) return storeRef.current[key];
      return value;
    })();

    inFlightFetches.current.set(key, p);
    return p;
  }, [store]);

  /*
   * A NOVA TENTATIVA DO VALOR VELHO (07/11, bug "envio-velho"). Rede piscando: o envio de [t0,t1] cai; 300 ms depois
   * [t0,t1,t2] sobe na hora; aos 500 ms a nova tentativa de [t0,t1] subia POR CIMA — a tela com o t2, o servidor
   * sem ele, e a próxima leitura (ou reabrir) apagava o t2. Agora cada envio NOVO de uma chave ganha um número
   * (`ultimoEnvio`); a nova tentativa e o "não subiu" só seguem se o número dela ainda for o último. Havendo um
   * envio mais novo, a tentativa velha desiste calada — o mais novo tem o próprio envio e as próprias tentativas. E
   * o envio velho que dá certo depois de sair um mais novo não vira `doServidor` nem tira a chave de `naoSubiram` /
   * da cópia do aparelho: quem confirma é o mais novo. (Dois envios no ar ao mesmo tempo chegando fora de ordem no
   * servidor não se resolvem aqui; o caso real é a nova tentativa, que espera 0,5–1 s.)
   */
  const persistKey = useCallback(async (userId: string, key: string, value: any, attempt = 0, numero?: number) => {
    if (userRef.current?.id !== userId) return;
    // 21/10: conteúdo pago (kit, "Seu 2027") só o SERVIDOR grava — o banco recusa a escrita do cliente (lib/conteudo-pago)
    if (chaveSoDoServidor(key)) return;
    const meu = numero ?? (ultimoEnvio.current.get(key) ?? 0) + 1;
    if (numero === undefined) ultimoEnvio.current.set(key, meu);
    else if (ultimoEnvio.current.get(key) !== meu) return; // (07/11) já saiu um envio mais novo desta chave
    // (07/11) a hidratação precisa saber o que ia pro servidor enquanto o retrato era tirado — ver "O ENVIO QUE SAIU DEPOIS DO PEDIDO"
    envioDaChave.current.set(key, Date.now());
    enviosNoAr.current.set(key, (enviosNoAr.current.get(key) ?? 0) + 1);
    let error: unknown;
    let status: unknown;
    try {
      ({ error, status } = await (supabase as any)
        .from("user_data")
        .upsert({ user_id: userId, key, value }, { onConflict: "user_id,key" }));
    } finally {
      const n = (enviosNoAr.current.get(key) ?? 1) - 1;
      if (n > 0) enviosNoAr.current.set(key, n); else enviosNoAr.current.delete(key);
    }
    if (error) {
      console.error(`[user-data] upsert failed for "${key}" (attempt ${attempt + 1}):`, error);
      if (attempt < 2) {
        setTimeout(() => persistKey(userId, key, value, attempt + 1, meu), 500 * Math.pow(2, attempt));
      } else if (userRef.current?.id === userId && ultimoEnvio.current.get(key) === meu) {
        // (07/11, bug "recusa-laco") recusa do servidor não pede leitura — ver "O ENVIO RECUSADO NÃO VIRA LAÇO"
        marcarQueNaoSubiu(userId, key, value, ehFalhaDeRede(error, status) ? null : { code: (error as { code?: unknown })?.code, status });
      }
      return;
    }
    if (userRef.current?.id !== userId) return;
    if (ultimoEnvio.current.get(key) !== meu) return; // (07/11) um envio mais novo confirma — ver acima
    doServidor.current.set(key, value);
    naoSubiram.current.delete(key);
    releuPorFalha.current.delete(key);
    if (aConfirmar.current.has(key)) {
      // 17/10: o servidor tem o juntado (ou algo feito em cima dele): a cópia guardada no aparelho sai
      aConfirmar.current.delete(key);
      esquecerSegurada(userId, key);
    }
  }, []);
  /** (07/11) O 3º envio da chave desistiu — ver "O QUE NÃO SUBIU". Só se o valor ainda é o da tela: um mais novo
   *  tem o próprio envio. `recusa` = o servidor respondeu e recusou: não pede leitura (ver "O ENVIO RECUSADO NÃO VIRA
   *  LAÇO"); falha de rede pede uma vez por chave até um envio dela dar certo. */
  const marcarQueNaoSubiu = (userId: string, key: string, value: unknown, recusa: { code: unknown; status: unknown } | null = null) => {
    const naTela = key in pendingWrites.current ? pendingWrites.current[key] : storeRef.current[key];
    if (naTela !== value && !iguais(naTela, value)) return;
    naoSubiram.current.add(key);
    const base = aConfirmar.current.has(key) ? aConfirmar.current.get(key) : doServidor.current.get(key);
    aConfirmar.current.set(key, base);
    guardarSegurada(userId, key, { base, valor: value, sistema: true, dia: null });
    if (recusa) {
      trackEvent("dados_envio_recusado", { key, code: typeof recusa.code === "string" ? recusa.code : "", status: typeof recusa.status === "number" ? recusa.status : null });
      return;
    }
    if (releuPorFalha.current.has(key)) return;
    releuPorFalha.current.add(key);
    relerContaRef.current();
  };

  const flush = useCallback(() => {
    const userId = userRef.current?.id;
    if (!userId) return; // guest writes are sync to localStorage, nothing to flush
    const writes = { ...pendingWrites.current };
    pendingWrites.current = {};
    Object.entries(writes).forEach(([key, value]) => persistKey(userId, key, value));
  }, [persistKey]);
  // o efeito da hidratação agenda o envio do que juntou sem depender do `flush` nas deps
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const get = useCallback(<T,>(key: string, fallback: T): T => {
    if (key in store) return store[key] as T;
    if (!loaded) return fallback;
    const userId = userRef.current?.id;
    if (userId) {
      const raw = safeGetItem(userKey(userId, key));
      if (!raw) return fallback;
      try { return JSON.parse(raw) as T; } catch { return fallback; }
    }
    // guest
    const raw = safeGetItem(guestKey(key));
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }, [store, loaded]);

  /*
   * SEQUÊNCIA NOVA (26/09): o dia conta quando a pessoa ANOTA algo em qualquer
   * módulo — não mais quando o app abre. A 1ª escrita de DADO do dia (chave
   * que não é de interface, com conteúdo, que mudou de verdade) acrescenta
   * hoje em `core-dias-anotados`: uma escrita por dia no máximo, conferida em
   * memória, e como {system:true} pra não voltar aqui. Escrita antes do
   * servidor responder não registra: gravar a lista sem a do servidor apagaria
   * o histórico (o próximo registro do dia registra).
   */
  // Escopo do "marcar outro dia": enquanto a função roda, as escritas valem pro dia dito.
  const escopoDiaRef = useRef<{ dia: string | null; feito?: boolean } | null>(null);
  /** (07/11) O retrato do servidor na memória é de OUTRO DIA (sessão viva que atravessou a meia-noite)? Convidado e
   *  conta ainda não lida: não. A régua do dia anotado — ver "SESSÃO VIVA". (O gesto em cima do retrato velho usa
   *  `retratoPassouDoPrazo`, que também conta os minutos — bug "retrato-minutos".) */
  const retratoDeOutroDia = (): boolean => {
    const l = ultimaLeituraRef.current;
    return !!userRef.current && !!l && localDayKey(new Date(l.pedidaEm)) !== localDayKey();
  };
  /**
   * (07/11) A lista de dias no store veio do servidor NOUTRO DIA? Sessão viva que atravessou a
   * meia-noite: outro aparelho pode ter anotado dias desde então, e gravar a lista daqui por cima
   * os apagaria. O dia fica esperando a releitura e entra na lista nova quando ela chegar (o aviso
   * da sequência sai lá) — ver "SESSÃO VIVA". Convidado e conta lida hoje: não espera.
   */
  const diaEsperaReleitura = useCallback((dia: string): boolean => {
    if (!retratoDeOutroDia()) return false;
    diasPendentes.current.add(dia);
    relerConta();
    return true;
  }, [relerConta]);
  const registrarDiaRetro = useCallback((key: string, value: any, dia: string | null) => {
    if (!dia || !loadedRef.current || escopoDiaRef.current?.feito) return;
    if (!contaComoAnotacao(key) || !temConteudo(value)) return;
    try { if (JSON.stringify(value) === JSON.stringify(storeRef.current[key])) return; } catch { return; }
    if (diaEsperaReleitura(dia)) { if (escopoDiaRef.current) escopoDiaRef.current.feito = true; return; }
    const nova = registrarDiaRetroativo(storeRef.current[CHAVE_DIAS_ANOTADOS], dia, localDayKey(), storeRef.current[CHAVE_HUB_STREAK]);
    if (!nova) return; // o dia já estava na lista (ou fora da janela de 2 dias)
    // um gesto que grava várias chaves (Treino: histórico, registro, volume…) anota o dia UMA vez
    if (escopoDiaRef.current) escopoDiaRef.current.feito = true;
    setRef.current(CHAVE_DIAS_ANOTADOS, nova, { system: true });
  }, [diaEsperaReleitura]);
  const comDia = useCallback(<T,>(dia: string | null, fn: () => T): T => {
    const antes = escopoDiaRef.current;
    escopoDiaRef.current = { dia };
    try { return fn(); } finally { escopoDiaRef.current = antes; }
  }, []);

  const registrarDiaAnotado = useCallback((key: string, value: any) => {
    const hoje = localDayKey();
    if (diaAnotadoRef.current === hoje || !loadedRef.current) return;
    if (!contaComoAnotacao(key) || !temConteudo(value)) return;
    try { if (JSON.stringify(value) === JSON.stringify(storeRef.current[key])) return; } catch { return; }
    diaAnotadoRef.current = hoje;
    if (diaEsperaReleitura(hoje)) return; // (07/11) entra na lista nova quando a conta chegar
    const nova = registrarDia(storeRef.current[CHAVE_DIAS_ANOTADOS], hoje, storeRef.current[CHAVE_HUB_STREAK]);
    if (!nova) return; // hoje já estava na lista (outra sessão/aparelho)
    setRef.current(CHAVE_DIAS_ANOTADOS, nova, { system: true });
    const { dias } = calcularSequencia(nova, hoje);
    import("@/components/conquistas/aviso-sequencia").then((m) => m.avisarSequencia(dias)).catch(() => {});
  }, [diaEsperaReleitura]);
  // Lista apagada ("começar do zero"): o próximo registro de hoje entra de novo.
  useEffect(() => {
    if (!(CHAVE_DIAS_ANOTADOS in store)) diaAnotadoRef.current = null;
  }, [store]);

  const set = useCallback((key: string, value: any, opts?: OpcoesDeEscrita) => {
    if (process.env.NODE_ENV !== "production") {
      try {
        const size = JSON.stringify(value ?? "").length;
        if (size > WRITE_WARN_BYTES) {
          console.warn(
            `[user-data] key "${key}" is ${(size / 1024).toFixed(0)} KB — ` +
            `consider uploading binary data to Supabase Storage instead of inlining base64.`
          );
        }
      } catch {}
    }

    // a base de uma escrita segurada é o que a tela via ANTES desta escrita: a que a própria
    // tela diz (usePersistedState manda o estado de onde partiu) ou, sem isso, o store
    const antes = storeRef.current;
    setStore(prev => ({ ...prev, [key]: value }));
    const userId = userRef.current?.id;
    if (userId) {
      safeSetItem(userKey(userId, key), JSON.stringify(value));
      ultimaEscrita.current.set(key, Date.now());
      // (07/11) a conta na memória foi lida noutro dia — ver "O GESTO EM CIMA DO RETRATO VELHO" — ou há mais de
      // 10 min (bug "retrato-minutos") — ver "O RETRATO VELHO NO MESMO DIA"
      const retratoVelho = sincronizadoRef.current && retratoPassouDoPrazo();
      if (!sincronizadoRef.current || retratoVelho) {
        // 16/10: a conta ainda não chegou do servidor — NÃO sobe (apagaria o que está
        // lá). Fica segurada e é juntada com o servidor quando a leitura der certo.
        // 17/10: e fica guardada no aparelho — fechar o app antes da conta chegar não perde.
        const h = seguradas.current[key];
        const diaDaEscrita = escopoDiaRef.current ? escopoDiaRef.current.dia : localDayKey();
        if (h) {
          h.valor = value;
          h.sistema = h.sistema && !!opts?.system;
          if (!opts?.system) h.dia = diaDaEscrita;
        } else {
          // retrato velho: a base é o que o SERVIDOR tinha da última vez (a tela e o store podem ter coisa que
          // ainda está subindo — base com ela faria a junção achar que o servidor apagou)
          const base = retratoVelho ? doServidor.current.get(key)
            : opts && "base" in opts ? opts.base : key in antes ? antes[key] : undefined;
          seguradas.current[key] = { base, valor: value, sistema: !!opts?.system, dia: diaDaEscrita };
        }
        const e = seguradas.current[key];
        guardarSegurada(userId, key, aConfirmar.current.has(key) ? { ...e, base: aConfirmar.current.get(key) } : e);
        if (retratoVelho) relerContaRef.current();
      } else {
        pendingWrites.current[key] = value;
        if (flushTimer.current) clearTimeout(flushTimer.current);
        flushTimer.current = setTimeout(flush, DEBOUNCE_MS);
      }
    } else {
      // Guest: persist to guest:* — survives reload, migrated on signup/login.
      safeSetItem(guestKey(key), JSON.stringify(value));
    }
    // Activation events fire for both guests and authed users so the
    // spotlight tutorial can advance during the pre-signup flow.
    // Escrita de SISTEMA (virada do mês etc.) não é gesto do usuário:
    // não dispara ativação — senão a trilha do teste e o spotlight
    // celebram degrau no BOOT, sem ninguém ter feito nada (review 16/08).
    if (!opts?.system) {
      const evidencias = acoesDaEscrita(key, opts && "baseDaAcao" in opts ? opts.baseDaAcao : opts && "base" in opts ? opts.base : antes[key], value);
      if (evidencias.length) {
        let registro = storeRef.current[CHAVE_ACOES_CONQUISTAS];
        for (const acao of evidencias) registro = registrarAcao(registro, acao, localDayKey());
        // Síncrono só para o registro: duas ações no mesmo evento não se sobrescrevem.
        storeRef.current = { ...storeRef.current, [CHAVE_ACOES_CONQUISTAS]: registro };
        setRef.current(CHAVE_ACOES_CONQUISTAS, registro, { system: true });
      }
      checkActivation(key, value);
      const escopo = escopoDiaRef.current;
      if (escopo) registrarDiaRetro(key, value, escopo.dia);
      else registrarDiaAnotado(key, value);
    }
  }, [flush, registrarDiaAnotado, registrarDiaRetro]);
  setRef.current = set;

  // Force flush on tab hide / unload.
  useEffect(() => {
    const forceFlush = () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") forceFlush();
    };
    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", forceFlush);
    window.addEventListener("beforeunload", forceFlush);
    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", forceFlush);
      window.removeEventListener("beforeunload", forceFlush);
      forceFlush();
    };
  }, [flush]);

  /*
   * COMEÇAR DO ZERO (26/09, chamado do iPhone: "quero excluir tudo o que já
   * botei e iniciar o app novamente"). Apaga as linhas de user_data da pessoa
   * (RLS deixa cada um apagar as próprias) e o cache do aparelho; conta,
   * e-mail e acesso pago moram em outras tabelas e ficam. A ordem importa:
   * primeiro descarta as gravações pendentes (senão o flush recriaria linhas
   * logo depois do delete), só então apaga no servidor, e o cache local só
   * sai quando o servidor confirmou — falha de rede não deixa meio apagado.
   */
  const apagarTudo = useCallback(async (): Promise<{ ok: boolean; erro?: string }> => {
    const userId = userRef.current?.id;
    if (!userId) return { ok: false, erro: "Entre na sua conta pra apagar os dados." };
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    pendingWrites.current = {};
    const { error } = await (supabase as any).from("user_data").delete().eq("user_id", userId);
    if (error) return { ok: false, erro: "Não deu pra apagar agora. Confere a internet e tenta de novo." };
    // 17/10: o que entrou na fila enquanto o delete estava no ar (ex.: a escrita segurada que a
    // liberação soltou) também sai — senão o flush recriava a linha logo depois de apagar
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    pendingWrites.current = {};
    seguradas.current = {}; // o que estava esperando a conta chegar também sai
    diasPendentes.current.clear(); // 07/11: e o dia esperando a releitura
    naoSubiram.current.clear(); // 07/11: e o envio que desistiu
    releuPorFalha.current.clear();
    doServidor.current.clear();
    ultimoEnvio.current.clear();
    aConfirmar.current.clear();
    apagarSeguradasGuardadas({ daConta: userId });
    purgeUserLocalCache();
    setStore({});
    return { ok: true };
  }, []);

  return (
    <UserDataContext.Provider value={{ get, set, comDia, loaded, fetchKey, isGuest: !user, apagarTudo, semConexao: user ? semConexao : null, contaCompleta: user ? contaCompleta : false, tentarDeNovo, ultimaLeitura: user ? ultimaLeitura : undefined, relerConta }}>
      {children}
    </UserDataContext.Provider>
  );
};

export const useUserData = () => {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error("useUserData must be used within UserDataProvider");
  return ctx;
};
