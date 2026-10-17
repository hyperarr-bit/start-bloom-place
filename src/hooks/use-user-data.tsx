import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { markActivation, trackEvent } from "@/lib/analytics";
import { localDayKey } from "@/lib/utils";
import { vassouraLeva } from "@/lib/chaves-do-aparelho";
import { iguais, mesclar3 } from "@/lib/mesclar-dados";
import { CHAVE_DIAS_ANOTADOS, CHAVE_HUB_STREAK, calcularSequencia, contaComoAnotacao, registrarDia, registrarDiaRetroativo, temConteudo } from "@/lib/sequencia";

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
  { match: /task|rotina/i, action: "first_task" },
  { match: /note/i, action: "first_note" },
];

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
  /**
   * De onde a tela partiu, quando ela escreveu ANTES de a conta chegar do servidor
   * (o `initial` do usePersistedState). Só serve pra juntar a escrita segurada com o
   * servidor sem ressuscitar itens-padrão que a pessoa já tinha apagado.
   */
  base?: unknown;
}

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
   * A conta ainda não chegou do servidor e a leitura falhou ("sem") ou está demorando
   * ("lenta"); null quando está tudo certo (ou convidado). Opcional no tipo pra não
   * obrigar os mocks de teste.
   */
  semConexao?: "sem" | "lenta" | null;
  /** Tenta ler a conta de novo agora (botão do aviso de sem conexão). */
  tentarDeNovo?: () => void;
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
/** Espera entre as tentativas de ler a conta depois de uma falha (a última se repete). */
const ESPERAS_NOVA_TENTATIVA = [2_000, 5_000, 10_000, 20_000, 30_000];

/**
 * Escrita feita ANTES de a conta chegar do servidor (16/10). Não sobe: fica aqui até a
 * leitura dar certo e aí é juntada com o servidor (lib/mesclar-dados). `base` é o que a
 * tela via quando escreveu pela 1ª vez; `valor`, a última escrita; `sistema`, se TODAS
 * foram escritas de sistema (essas não geram aviso).
 */
type EscritaSegurada = { base: unknown; valor: unknown; sistema: boolean };

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
  const leituraNoAr = useRef(false);
  const falhasSeguidas = useRef(0);
  /** Quando a conta começou a faltar (1ª tentativa desta pessoa) — telemetria da recuperação. */
  const inicioDaEspera = useRef<number | null>(null);
  const [semConexao, setSemConexao] = useState<"sem" | "lenta" | null>(null);
  const [tentativa, setTentativa] = useState(0);

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
      seguradas.current = {};
      ultimaEscrita.current.clear();
      falhasSeguidas.current = 0;
      inicioDaEspera.current = null;
      setSemConexao(null);
      setStore({});
      setLoaded(false);
      // On switch/logout we wipe per-user cache, but NOT guest data.
      purgeUserLocalCache();
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
    const ac = new AbortController();
    let timerLenta: ReturnType<typeof setTimeout> | null = null;
    let timerDeNovo: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      leituraNoAr.current = true; // (16/10) uma rodada por vez: "tentar de novo" espera esta acabar
      if (inicioDaEspera.current === null) inicioDaEspera.current = Date.now();
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
      if (ac.signal.aborted) return;
      const pedidoEm = Date.now();
      if (!sincronizadoRef.current) {
        timerLenta = setTimeout(() => {
          if (!sincronizadoRef.current && !ac.signal.aborted) setSemConexao((s) => s ?? "lenta");
        }, MS_LEITURA_LENTA);
      }
      let data: any[] | null = null;
      let error: any = null;
      try {
        if (!(await sessaoEhDaConta(user.id))) {
          error = { message: "sessão do auth ausente ou de outra conta" };
        } else {
          const r = await (supabase as any)
            .from("user_data")
            .select("key, value")
            .eq("user_id", user.id)
            .abortSignal(ac.signal);
          data = r?.data ?? null;
          error = r?.error ?? null;
          if (!error && !Array.isArray(data)) error = { message: "resposta sem lista" };
        }
      } catch (e: any) {
        error = { message: String(e?.message ?? e) };
      }
      if (timerLenta) { clearTimeout(timerLenta); timerLenta = null; }
      // cancelada (troca de conta, 2ª rodada, desmontou): a rodada nova já é dona do estado
      if (ac.signal.aborted) return;
      leituraNoAr.current = false;

      if (!error && data) {
        const uid = user.id;
        const eraSincronizado = sincronizadoRef.current;
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

        /*
         * 16/10 — O QUE FOI ESCRITO ANTES DE A CONTA CHEGAR É JUNTADO, NÃO SOBRESCRITO.
         * A escrita segurada partiu de uma base que não era o dado da pessoa (o vazio da
         * tela); mandar como está apagaria o servidor. lib/mesclar-dados junta em 3 vias:
         * o que ela acrescentou entra, conflito fica com o servidor (e ela é avisada).
         */
        const mesclados: Record<string, any> = {};
        const perdidas: string[] = [];
        let juntadas = 0;
        const nSeguradas = Object.keys(seguradas.current).length;
        for (const [k, h] of Object.entries(seguradas.current)) {
          const r = mesclar3(h.base, h.valor, k in map ? map[k] : undefined);
          mesclados[k] = r.valor;
          if (!iguais(r.valor, h.valor)) juntadas++;
          if (r.perdeu && !h.sistema && contaComoAnotacao(k)) perdidas.push(k);
        }
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
        for (const [k, v] of Object.entries(mesclados)) {
          if (!(k in map) || !iguais(v, map[k])) pendingWrites.current[k] = v;
        }
        for (const [k, v] of Object.entries(map)) {
          if (k in mesclados || recentes.has(k) || k in pendingWrites.current) continue;
          const json = JSON.stringify(v);
          if (json.length < HEAVY_KEY_BYTES) safeSetItem(userKey(uid, k), json);
        }
        for (const [k, v] of Object.entries(mesclados)) safeSetItem(userKey(uid, k), JSON.stringify(v));
        sincronizadoRef.current = true;
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
        if (!eraSincronizado) {
          const ms = Date.now() - (inicioDaEspera.current ?? pedidoEm);
          // Medida da exposição (16/10): só quando algo fugiu do normal — leitura que falhou
          // antes, que demorou, ou escrita feita em cima do vazio que teria apagado o servidor
          // (`juntadas`: o servidor tinha dado e a junção trouxe de volta).
          if (falhasSeguidas.current > 0 || ms > MS_LEITURA_LENTA || juntadas > 0 || perdidas.length > 0) {
            trackEvent("dados_conta_atrasada", {
              falhas: falhasSeguidas.current,
              ms,
              seguradas: nSeguradas,
              juntadas,
              perdidas: perdidas.length,
            });
          }
          if (perdidas.length > 0) {
            toast("Seus dados voltaram", {
              description: "Parte do que você mudou sem internet não deu pra juntar com o que já estava salvo. Dá uma conferida?",
            });
          }
        }
        falhasSeguidas.current = 0;
        inicioDaEspera.current = null;
        setSemConexao(null);
        setLoaded(true);
        return;
      }

      if (error?.message && !String(error.message).includes("aborted")) {
        console.error("[user-data] failed to load:", error);
      }
      // Já sincronizado nesta sessão (2ª rodada, ex.: volta pro app): segue com o que tem.
      if (sincronizadoRef.current) {
        setLoaded(true);
        return;
      }
      // 16/10: a conta NÃO chegou — `loaded` fica false (nada de tela "carregada" com o
      // store vazio), o aviso aparece e tenta de novo sozinho.
      falhasSeguidas.current += 1;
      setSemConexao("sem");
      const espera = ESPERAS_NOVA_TENTATIVA[Math.min(falhasSeguidas.current - 1, ESPERAS_NOVA_TENTATIVA.length - 1)];
      timerDeNovo = setTimeout(() => setTentativa((t) => t + 1), espera);
    };

    run();
    return () => {
      ac.abort();
      leituraNoAr.current = false;
      if (timerLenta) clearTimeout(timerLenta);
      if (timerDeNovo) clearTimeout(timerDeNovo);
    };
  }, [user, authLoading, tentativa]);

  // 16/10: sem a conta ainda, tenta de novo assim que a rede volta ou a pessoa volta pro app.
  const tentarDeNovo = useCallback(() => {
    if (!userRef.current || sincronizadoRef.current || leituraNoAr.current) return;
    setTentativa((t) => t + 1);
  }, []);
  useEffect(() => {
    const aoVoltarPraTela = () => { if (document.visibilityState !== "hidden") tentarDeNovo(); };
    window.addEventListener("online", tentarDeNovo);
    document.addEventListener("visibilitychange", aoVoltarPraTela);
    return () => {
      window.removeEventListener("online", tentarDeNovo);
      document.removeEventListener("visibilitychange", aoVoltarPraTela);
    };
  }, [tentarDeNovo]);

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

  const persistKey = useCallback(async (userId: string, key: string, value: any, attempt = 0) => {
    if (userRef.current?.id !== userId) return;
    const { error } = await (supabase as any)
      .from("user_data")
      .upsert({ user_id: userId, key, value }, { onConflict: "user_id,key" });
    if (error) {
      console.error(`[user-data] upsert failed for "${key}" (attempt ${attempt + 1}):`, error);
      if (attempt < 2) {
        setTimeout(() => persistKey(userId, key, value, attempt + 1), 500 * Math.pow(2, attempt));
      }
    }
  }, []);

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
  const registrarDiaRetro = useCallback((key: string, value: any, dia: string | null) => {
    if (!dia || !loadedRef.current || escopoDiaRef.current?.feito) return;
    if (!contaComoAnotacao(key) || !temConteudo(value)) return;
    try { if (JSON.stringify(value) === JSON.stringify(storeRef.current[key])) return; } catch { return; }
    const nova = registrarDiaRetroativo(storeRef.current[CHAVE_DIAS_ANOTADOS], dia, localDayKey(), storeRef.current[CHAVE_HUB_STREAK]);
    if (!nova) return; // o dia já estava na lista (ou fora da janela de 2 dias)
    // um gesto que grava várias chaves (Treino: histórico, registro, volume…) anota o dia UMA vez
    if (escopoDiaRef.current) escopoDiaRef.current.feito = true;
    setRef.current(CHAVE_DIAS_ANOTADOS, nova, { system: true });
  }, []);
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
    const nova = registrarDia(storeRef.current[CHAVE_DIAS_ANOTADOS], hoje, storeRef.current[CHAVE_HUB_STREAK]);
    if (!nova) return; // hoje já estava na lista (outra sessão/aparelho)
    setRef.current(CHAVE_DIAS_ANOTADOS, nova, { system: true });
    const { dias } = calcularSequencia(nova, hoje);
    import("@/components/conquistas/aviso-sequencia").then((m) => m.avisarSequencia(dias)).catch(() => {});
  }, []);
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

    // a base de uma escrita segurada é o que a tela via ANTES desta escrita
    const antes = storeRef.current;
    setStore(prev => ({ ...prev, [key]: value }));
    const userId = userRef.current?.id;
    if (userId) {
      safeSetItem(userKey(userId, key), JSON.stringify(value));
      ultimaEscrita.current.set(key, Date.now());
      if (!sincronizadoRef.current) {
        // 16/10: a conta ainda não chegou do servidor — NÃO sobe (apagaria o que está
        // lá). Fica segurada e é juntada com o servidor quando a leitura der certo.
        const h = seguradas.current[key];
        if (h) {
          h.valor = value;
          h.sistema = h.sistema && !!opts?.system;
        } else {
          seguradas.current[key] = { base: key in antes ? antes[key] : opts?.base, valor: value, sistema: !!opts?.system };
        }
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
    seguradas.current = {}; // o que estava esperando a conta chegar também sai
    purgeUserLocalCache();
    setStore({});
    return { ok: true };
  }, []);

  return (
    <UserDataContext.Provider value={{ get, set, comDia, loaded, fetchKey, isGuest: !user, apagarTudo, semConexao: user ? semConexao : null, tentarDeNovo }}>
      {children}
    </UserDataContext.Provider>
  );
};

export const useUserData = () => {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error("useUserData must be used within UserDataProvider");
  return ctx;
};
