/**
 * O VIDRO DA BARRA (rodada 4, 26/10 — o dono elogiou o tom do Cal AI: transparente, sem o exagero do iOS): o "vidro
 * Cal AI" é o PADRÃO da barra (home-e.css, `.he-vidro`). A versão ANTIGA (mais branca, desfoque 24) fica como
 * alternativa pelo atalho escondido de 5 toques na versão no fim do Você — SÓ ADMIN — e pela força de QA:
 *   · `?vidro=antigo` liga a antiga (guardada no aparelho, `core-vidro-antigo`); `?vidro=calai` volta ao padrão;
 *   · a classe `he-vidro-antigo` no <html> é o que troca.
 * Chave do aparelho (lib/chaves-do-aparelho): nenhuma vassoura apaga; vale pra todas as contas deste aparelho.
 */
export const CHAVE_VIDRO_ANTIGO = "core-vidro-antigo";
export const CLASSE_VIDRO_ANTIGO = "he-vidro-antigo";
export const PARAM_VIDRO = "vidro";

const CHAVE_LEGADA = "core-vidro-calai"; // rodada 3: o experimento "Cal AI" era opcional; agora é o padrão — a chave velha sai
const ler = (): boolean => { try { localStorage.removeItem(CHAVE_LEGADA); return localStorage.getItem(CHAVE_VIDRO_ANTIGO) === "on"; } catch { return false; } };
const gravar = (on: boolean): void => { try { localStorage.setItem(CHAVE_VIDRO_ANTIGO, on ? "on" : "off"); } catch { /* sem storage: só a sessão */ } };

/** Põe/tira a classe do vidro ANTIGO no <html> conforme o guardado (ou o valor dado). */
export function aplicarVidroAntigo(on: boolean = ler()): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(CLASSE_VIDRO_ANTIGO, on);
}

export const vidroAntigoLigado = (): boolean => ler();

/** Alterna padrão (Cal AI) ↔ antigo; devolve true quando o ANTIGO ficou ligado. */
export function alternarVidroAntigo(): boolean {
  const on = !ler();
  gravar(on);
  aplicarVidroAntigo(on);
  return on;
}

/** A força de QA na URL (`?vidro=antigo` | `?vidro=calai`): guarda e aplica. */
export function guardarForcaVidro(busca?: string | URLSearchParams): void {
  try {
    const sp = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? (typeof location !== "undefined" ? location.search : ""));
    const v = sp.get(PARAM_VIDRO);
    if (v === "antigo") { gravar(true); aplicarVidroAntigo(true); }
    else if (v === "calai") { gravar(false); aplicarVidroAntigo(false); }
    else aplicarVidroAntigo();
  } catch { aplicarVidroAntigo(); }
}
