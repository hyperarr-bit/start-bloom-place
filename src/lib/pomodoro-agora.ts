/**
 * POMODORO ÚNICO (1.0.22, sem repetição — dono 28/10). As chaves `pomodoro-*` já eram as mesmas nos três lugares
 * (Rotina › Foco, Carreira › Meu dia, widget da Home), mas cada tela tinha o PRÓPRIO relógio em memória: começar o foco
 * na Home e abrir a Rotina mostrava 25:00 parado; dava pra rodar dois ao mesmo tempo e contar a sessão em dobro.
 *
 * Agora existe UM estado do timer neste aparelho (este módulo), e todas as telas leem e mexem nele:
 *   · `modo` (foco/pausa/pausa longa), `rodando`, `fimEm` (relógio de parede, ms) e `restante` (s, pausado no meio;
 *     null = cheio, segue o tempo escolhido em `pomodoro-duracoes`).
 *   · Guardado no localStorage em `pomodoro-agora` (do APARELHO, fora dos prefixos varridos e fora do user_data):
 *     fechar e reabrir o app com o foco rodando continua contando — e se acabou com o app fechado, a sessão conta
 *     na próxima abertura de qualquer tela com o timer.
 *   · A sessão concluída é reivindicada UMA vez (`concluir(fimEm)`): com duas telas montadas, só uma grava as chaves.
 *
 * As chaves da conta (`pomodoro-sessions-today`, `pomodoro-sessions-dia`, `pomodoro-total-focus`, `pomodoro-log`,
 * `pomodoro-duracoes`) continuam exatamente no mesmo formato — o app antigo lê igual.
 */

export type ModoPomodoro = "focus" | "break" | "longBreak";
export interface EstadoPomodoro {
  modo: ModoPomodoro;
  rodando: boolean;
  /** ms (Date.now) em que o período acaba — só vale com `rodando` */
  fimEm: number;
  /** segundos que faltam, pausado no meio; null = cheio (o tempo escolhido do modo) */
  restante: number | null;
}

export const CHAVE_POMODORO_AGORA = "pomodoro-agora";
export const ESTADO_INICIAL: EstadoPomodoro = { modo: "focus", rodando: false, fimEm: 0, restante: null };

const MODOS: readonly ModoPomodoro[] = ["focus", "break", "longBreak"];

/** Qualquer coisa estranha no aparelho vira o estado inicial (nunca derruba a tela). */
export function lerEstado(v: unknown): EstadoPomodoro {
  if (!v || typeof v !== "object") return { ...ESTADO_INICIAL };
  const o = v as Partial<EstadoPomodoro>;
  const modo = MODOS.includes(o.modo as ModoPomodoro) ? (o.modo as ModoPomodoro) : "focus";
  const fimEm = typeof o.fimEm === "number" && Number.isFinite(o.fimEm) && o.fimEm > 0 ? o.fimEm : 0;
  const rodando = o.rodando === true && fimEm > 0;
  const restante = typeof o.restante === "number" && Number.isFinite(o.restante) && o.restante >= 0 ? Math.round(o.restante) : null;
  return { modo, rodando, fimEm: rodando ? fimEm : 0, restante: rodando ? null : restante };
}

/** Segundos que faltam agora. */
export function tempoRestante(e: EstadoPomodoro, cheio: number, agora = Date.now()): number {
  if (e.rodando) return Math.max(0, Math.round((e.fimEm - agora) / 1000));
  return e.restante ?? cheio;
}

/* ------------------------------------------------------------------ o estado único do aparelho */

let estado: EstadoPomodoro | null = null;
const ouvintes = new Set<() => void>();

function carregar(): EstadoPomodoro {
  if (estado) return estado;
  try {
    const raw = localStorage.getItem(CHAVE_POMODORO_AGORA);
    estado = lerEstado(raw ? JSON.parse(raw) : null);
  } catch { estado = { ...ESTADO_INICIAL }; }
  return estado;
}

function gravar(novo: EstadoPomodoro) {
  estado = novo;
  try { localStorage.setItem(CHAVE_POMODORO_AGORA, JSON.stringify(novo)); } catch { /* sem storage: vale a memória */ }
  ouvintes.forEach((f) => f());
}

export const estadoDoPomodoro = (): EstadoPomodoro => carregar();
export const ouvirPomodoro = (f: () => void): (() => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

/** Começa (ou retoma) com `segundos` pela frente. */
export function iniciarPomodoro(segundos: number, agora = Date.now()) {
  const e = carregar();
  if (e.rodando) return;
  gravar({ ...e, rodando: true, fimEm: agora + Math.max(1, segundos) * 1000, restante: null });
}

export function pausarPomodoro(agora = Date.now()) {
  const e = carregar();
  if (!e.rodando) return;
  gravar({ ...e, rodando: false, fimEm: 0, restante: Math.max(0, Math.round((e.fimEm - agora) / 1000)) });
}

/** Para e enche de novo (o modo fica). */
export function recomecarPomodoro() {
  const e = carregar();
  gravar({ ...e, rodando: false, fimEm: 0, restante: null });
}

/** Troca de modo: para e enche. */
export function irParaModo(modo: ModoPomodoro) {
  gravar({ modo, rodando: false, fimEm: 0, restante: null });
}

/**
 * O período acabou: só quem chega primeiro com o mesmo `fimEm` leva (devolve o modo que terminou); os outros recebem
 * null. Quem leva grava as chaves e escolhe o próximo modo com `irParaModo`.
 */
export function concluirPomodoro(fimEm: number, agora = Date.now()): ModoPomodoro | null {
  const e = carregar();
  if (!e.rodando || e.fimEm !== fimEm || agora < fimEm) return null;
  const terminou = e.modo;
  gravar({ ...e, rodando: false, fimEm: 0, restante: null });
  return terminou;
}

/** Só testes. */
export function _zerarPomodoro() {
  estado = null;
  try { localStorage.removeItem(CHAVE_POMODORO_AGORA); } catch { /* segue */ }
  ouvintes.forEach((f) => f());
}

/** Só testes: esquece a memória e relê do aparelho — é o que acontece ao fechar e reabrir o app. */
export function _reabrirPomodoro() {
  estado = null;
  ouvintes.forEach((f) => f());
}
