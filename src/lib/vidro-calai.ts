/**
 * VIDRO "CAL AI" — a VARIANTE da barra de vidro pro dono comparar com a atual (rodada 3, 26/10; vídeos dele: no Cal AI
 * a pílula e o "+" são bem mais transparentes, o que passa por trás fica nítido-desfocado e reconhecível, com um
 * realce fino de borda e sombra suave). Não substitui a atual: é uma classe no <html> (`he-vidro-calai`, home-e.css)
 * ligada por:
 *   · força de QA: `?vidro=calai` (ou `?vidro=atual` pra voltar) — fica guardada no aparelho (`core-vidro-calai`);
 *   · a opção escondida do dono no TestFlight: 5 toques seguidos na versão, no fim da aba Você (alterna);
 *   · a rota de dev (/dev/home-nova?layout=e&vidro=calai).
 * Chave do aparelho (lib/chaves-do-aparelho): nenhuma vassoura apaga; vale pra todas as contas deste aparelho.
 */
export const CHAVE_VIDRO_CALAI = "core-vidro-calai";
export const CLASSE_VIDRO_CALAI = "he-vidro-calai";
export const PARAM_VIDRO = "vidro";

const ler = (): boolean => { try { return localStorage.getItem(CHAVE_VIDRO_CALAI) === "on"; } catch { return false; } };
const gravar = (on: boolean): void => { try { localStorage.setItem(CHAVE_VIDRO_CALAI, on ? "on" : "off"); } catch { /* sem storage: só a sessão */ } };

/** Põe/tira a classe no <html> conforme o guardado (ou o valor dado). */
export function aplicarVidroCalai(on: boolean = ler()): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(CLASSE_VIDRO_CALAI, on);
}

export const vidroCalaiLigado = (): boolean => ler();

/** Alterna atual ↔ Cal AI; devolve o estado novo. */
export function alternarVidroCalai(): boolean {
  const on = !ler();
  gravar(on);
  aplicarVidroCalai(on);
  return on;
}

/** A força de QA na URL (`?vidro=calai` | `?vidro=atual`): guarda e aplica. */
export function guardarForcaVidro(busca?: string | URLSearchParams): void {
  try {
    const sp = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? (typeof location !== "undefined" ? location.search : ""));
    const v = sp.get(PARAM_VIDRO);
    if (v === "calai") { gravar(true); aplicarVidroCalai(true); }
    else if (v === "atual") { gravar(false); aplicarVidroCalai(false); }
    else aplicarVidroCalai();
  } catch { aplicarVidroCalai(); }
}
