/**
 * Baixar / imprimir o PLANNER 2027 da versão B (src/lib/planner-2027.ts).
 *   site     abre a janela com as 12 folhas A4 e chama a impressão depois das fontes (→ "Salvar como PDF").
 *   app      cada folha vira um PNG A4 (gerarPng, o mesmo das Conquistas) e todas vão juntas pela folha nativa
 *            (compartilharImagens: Imprimir, Salvar imagens, Arquivos). Nada de <a download> (não funciona no WebView).
 */
import { cssDoPlanner, folhasDoPlanner, htmlDoPlannerNovo, A4_PX, type DadosDoPlanner, type EstiloPlanner } from "@/lib/planner-2027";

/** Põe o CSS do planner no documento (1x por direção). A prévia e a foto usam o mesmo. */
export function garantirCssDoPlanner(estilo: EstiloPlanner): void {
  if (typeof document === "undefined") return;
  const id = `pl-css-${estilo}`;
  if (document.getElementById(id)) return;
  const st = document.createElement("style");
  st.id = id;
  // escopa a direção: .pl.pl-codex / .pl.pl-core (as duas podem estar na mesma página, lado a lado)
  st.textContent = cssDoPlanner(estilo, `.pl.pl-${estilo}`);
  document.head.appendChild(st);
}

/** Site: a janela de impressão. Abre a janela NO TOQUE (sem await antes: senão o bloqueador de pop-up segura). */
export function imprimirPlannerNoSite(d: DadosDoPlanner, estilo: EstiloPlanner): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(htmlDoPlannerNovo(d, estilo));
  w.document.close();
  const imprimir = () => { try { w.focus(); w.print(); } catch { /* a pessoa imprime pelo menu */ } };
  const prontas = w.document.fonts?.ready;
  const teto = new Promise((ok) => window.setTimeout(ok, 2500));
  void Promise.race([prontas ?? Promise.resolve(), teto]).then(() => window.setTimeout(imprimir, 150));
  return true;
}

/** App: as 12 folhas em PNG A4 pela folha nativa. `aoAvancar(n)` = quantas já ficaram prontas. */
export async function salvarPlannerNoAparelho(d: DadosDoPlanner, estilo: EstiloPlanner, aoAvancar?: (n: number, total: number) => void) {
  garantirCssDoPlanner(estilo);
  const [{ gerarPng }, { compartilharImagens }] = await Promise.all([import("@/components/conquistas/gerar-imagem"), import("@/lib/compartilhar")]);
  const folhas = folhasDoPlanner(d, estilo);
  const blobs: Blob[] = [];
  for (let i = 0; i < folhas.length; i++) {
    const blob = await gerarPng(<div className={`pl pl-${estilo}`} style={{ width: A4_PX.largura, height: A4_PX.altura }} dangerouslySetInnerHTML={{ __html: folhas[i] }} />, A4_PX);
    if (!blob || !blob.size) return "failed" as const;
    blobs.push(blob);
    aoAvancar?.(i + 1, folhas.length);
  }
  const nomes = blobs.map((_, i) => `planner-2027-core-${String(i + 1).padStart(2, "0")}.png`);
  return compartilharImagens(blobs, nomes, "Planner 2027", "planner_2027");
}
