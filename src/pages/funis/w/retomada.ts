/**
 * RETOMADA DO FUNIL W (02/09) — o progresso sobrevive ao app morrer.
 *
 * Autópsia de 3 dias: 13–31% das tentativas de compra terminavam com o app
 * REINICIANDO 15–60s depois do toque (Android mata a activity enquanto a
 * folha do Google está na frente, sobretudo Samsung A0x/A1x, Xiaomi e
 * dobráveis). Quando voltava, a pessoa caía na WELCOME — instalação nova,
 * quiz de novo — porque passo/área/respostas viviam em sessionStorage, que
 * morre com o processo. 0 de 19 compraram depois disso hoje; 3 de 83 no dia 28.
 *
 * Aqui o progresso vai pro localStorage com carimbo de hora e validade
 * curta. Só o SHELL retoma (na web o /w continua nascendo na welcome).
 */
export const CHAVES_FUNIL_W = {
  area: "core-funil-w-area",
  respostas: "core-funil-w-respostas",
  passo: "core-funil-w-passo",
  posCompra: "core-funil-w-pos-compra",
} as const;

export const VALIDADE_PROGRESSO_MS = 6 * 60 * 60 * 1000;

export const guardarChave = (chave: string, valor: unknown): void => {
  try { localStorage.setItem(chave, JSON.stringify({ v: valor, t: Date.now() })); } catch { /* modo privado */ }
};

/** Devolve o valor guardado, ou null se não existe, venceu ou está corrompido. */
export const lerChave = <T,>(chave: string): T | null => {
  try {
    const cru = localStorage.getItem(chave);
    if (!cru) return null;
    const j = JSON.parse(cru) as { v?: T; t?: number } | null;
    if (!j || typeof j !== "object" || typeof j.t !== "number") return null;
    return Date.now() - j.t < VALIDADE_PROGRESSO_MS ? (j.v as T) : null;
  } catch { return null; }
};

export const limparProgresso = (): void => {
  try { for (const k of Object.values(CHAVES_FUNIL_W)) localStorage.removeItem(k); } catch { /* noop */ }
};

/**
 * Onde retomar a partir do passo salvo. Passos de "carregando" viram o passo
 * seguinte (progress → result); os pós-cadastro viram o cadastro (a conta
 * ainda não existe, senão o RootGate nem teria trazido a pessoa pra cá);
 * welcome/promessas/porta não valem retomada — é o começo mesmo.
 */
const RETOMAVEIS: Record<string, string> = {
  quiz: "quiz", progress: "result", result: "result", central: "central",
  compromissos: "compromissos", contrato: "contrato", notif: "notif", offer: "offer",
  signup: "signup", confirm: "signup", liberando: "signup",
};
export const passoDeRetomada = (salvo: string | null, noShell: boolean): string | null =>
  noShell && salvo ? (RETOMAVEIS[salvo] ?? null) : null;
