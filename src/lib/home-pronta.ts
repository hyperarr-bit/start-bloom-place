/**
 * A HOME PINTOU (07/11, desempenho — lente "abertura").
 *
 * Três trabalhos pesados disparavam ASSIM que a entrada rodava, antes de a Home existir na tela, e disputavam a rede
 * e a CPU com a própria Home enquanto ela ainda baixava/montava:
 *  · a pré-carga dos 5 módulos mais usados (792 KB de JS — App.tsx, usarPreCarregamentoDosModulos);
 *  · os Momentos das Conquistas (App.tsx, MomentosNoApp), que ao montar calculam TODAS as figurinhas sobre a conta
 *    inteira (≈0,5 s na conta cheia com a CPU 4× mais lenta) — no mesmo commit da 1ª pintura da Home;
 *  · o dicionário da medição total (114 KB — lib/medicao-total, anotarTela).
 * Medido (novidades-guardadas/2026-11-07/desempenho/diagnostico-abertura.md): na 1ª visita pela rede de celular o
 * pedaço da Home (55 KB) levava 1 s pra chegar porque ~85 pedidos disputavam a banda com ele; no app da loja (JS já no
 * aparelho) o compilar de tudo isso caía no meio da montagem da Home.
 *
 * Agora quem não é a Home espera a Home pintar: pages/Home chama `avisarHomePronta()` no quadro seguinte à 1ª pintura
 * de verdade, e `quandoHomePronta`/`quandoHomeProntaEOciosa` entregam o aviso. Sem Home nesta abertura (login, deep
 * link direto num módulo, notificação), um TETO em ms garante que nada fica esperando pra sempre.
 */
const EVENTO = "core:home-pronta";
let pronta = false;

/** A Home já pintou nesta abertura? */
export const homeJaPronta = (): boolean => pronta;

/** pages/Home: a Home de verdade está na tela. Uma vez por abertura; chamadas repetidas não fazem nada. */
export function avisarHomePronta(): void {
  if (pronta) return;
  pronta = true;
  try { window.dispatchEvent(new Event(EVENTO)); } catch { /* sem window */ }
}

/** Roda `cb` UMA vez: quando a Home pintar (ou já, se pintou), ou depois de `maxMs` sem Home. Devolve o cancelar. */
export function quandoHomePronta(cb: () => void, maxMs = 8000): () => void {
  if (pronta) { cb(); return () => {}; }
  let feito = false;
  let teto: ReturnType<typeof setTimeout> | undefined;
  const limpar = () => { try { window.removeEventListener(EVENTO, rodar); } catch { /* noop */ } if (teto !== undefined) clearTimeout(teto); };
  const rodar = () => { if (feito) return; feito = true; limpar(); cb(); };
  try { window.addEventListener(EVENTO, rodar); } catch { /* sem window: só o teto */ }
  teto = setTimeout(rodar, maxMs);
  return () => { feito = true; limpar(); };
}

/** Depois da Home pronta E no tempo ocioso (requestIdleCallback com teto `ociosoMs`; sem ele, um setTimeout curto). */
export function quandoHomeProntaEOciosa(cb: () => void, { maxMs = 8000, ociosoMs = 4000 }: { maxMs?: number; ociosoMs?: number } = {}): () => void {
  let cancelarOcioso: (() => void) | null = null;
  const cancelarEspera = quandoHomePronta(() => {
    const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(cb, { timeout: ociosoMs });
      cancelarOcioso = () => { if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(id); };
    } else {
      const id = window.setTimeout(cb, 1500);
      cancelarOcioso = () => window.clearTimeout(id);
    }
  }, maxMs);
  return () => { cancelarEspera(); cancelarOcioso?.(); };
}

/** Só testes: esquece que a Home pintou. */
export const _zerarHomePronta = (): void => { pronta = false; };
