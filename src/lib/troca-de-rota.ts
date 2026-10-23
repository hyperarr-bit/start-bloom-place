/**
 * TROCA DE ROTA SEM QUADRO EM BRANCO (1.0.17 QA, dono: "nenhum quadro vazio").
 *
 * Antes: na troca de rota comum (Home → Finanças, módulo → Home…) a página velha sumia na hora e a nova entrava com o fade
 * de 180 ms do PageTransition a partir do fundo — 1 a 5 quadros de tela vazia (gravação no Simulador). Agora, no app
 * (shell nativo), no instante em que a URL muda (pushState/replaceState/popstate, ANTES de o React trocar a árvore) a
 * tela de agora vira uma foto parada por cima (lib/movimento fotoDaTela); a página nova monta embaixo já inteira (sem o
 * fade dela) e, quando ela pinta (2 quadros depois do mount do PageTransition), a foto some em 200 ms — um cross-fade
 * direto. Se a página nova não usar PageTransition, a foto solta sozinha em 1,2 s. Sem animação ("reduzir movimento",
 * jsdom) nada muda: o PageTransition faz o fade de sempre. Na web (site) nada muda.
 */
import { fotoDaTela, type FotoDaTela } from "@/lib/movimento";

export const DURACAO_DA_TROCA_MS = 200;
let pendente: FotoDaTela | null = null;
let ultimaRota = typeof location !== "undefined" ? location.pathname : "";
let instalada = false;

const fotografar = () => {
  try {
    if (pendente) return;
    if (document.querySelector('[data-saida-calma="tela"]')) return; // a missão já pôs a foto dela (festa → Home)
    pendente = fotoDaTela();
  } catch { pendente = null; }
};

/** A rota nova (PageTransition) montou: solta a foto depois que ela pintar. */
export function rotaMontou(): void {
  const f = pendente;
  if (!f) return;
  pendente = null;
  try { requestAnimationFrame(() => requestAnimationFrame(() => f.soltar(DURACAO_DA_TROCA_MS))); } catch { f.soltar(DURACAO_DA_TROCA_MS); }
}
/** Há uma foto esperando a rota nova? (o PageTransition entra sem o fade dele) */
export const rotaComFoto = (): boolean => !!pendente;

export function instalarTrocaDeRotaSemBranco(): void {
  if (instalada || typeof window === "undefined" || typeof history === "undefined") return;
  instalada = true;
  const embrulhar = (nome: "pushState" | "replaceState") => {
    const original = history[nome].bind(history);
    history[nome] = function (estado: unknown, titulo: string, url?: string | URL | null) {
      try {
        const nova = url != null ? new URL(String(url), location.href).pathname : location.pathname;
        if (nova !== location.pathname) fotografar();
        ultimaRota = nova;
      } catch { /* a navegação nunca depende disto */ }
      return original(estado, titulo, url);
    } as History[typeof nome];
  };
  embrulhar("pushState");
  embrulhar("replaceState");
  // voltar/avançar: a URL já trocou, mas o React ainda não — captura antes do ouvinte do roteador
  window.addEventListener("popstate", () => {
    try { if (location.pathname !== ultimaRota) { ultimaRota = location.pathname; fotografar(); } } catch { /* noop */ }
  }, true);
}
