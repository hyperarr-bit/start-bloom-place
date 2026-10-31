/**
 * Baixar / imprimir o PLANNER 2027 da versão B (src/lib/planner-2027.ts). Onde ela está decide o caminho
 * (modoDeEntrega):
 *   "nativo"       app (Capacitor): cada folha vira um PNG A4 (gerarPng, o mesmo das Conquistas) e todas vão juntas pela
 *                  folha nativa (compartilharImagens: Imprimir, Salvar imagens, Arquivos). Um toque só.
 *   "compartilhar" site no CELULAR com Web Share de arquivos (Safari do iPhone, Chrome do Android): os 12 PNG são
 *                  preparados primeiro e DEPOIS um 2º toque compartilha (o navigator.share exige gesto recente, e
 *                  preparar leva uns segundos). Crítica r1: o window.print no celular não é garantido.
 *   "safari"       navegador de dentro do Instagram/Facebook/TikTok SEM Web Share de arquivos: nem a impressão nem o
 *                  share funcionam de verdade → "Abra no Safari" + copiar o link (nunca uma janela gigante sem saída).
 *   "imprimir"     PC (e celular sem nenhum dos dois): a janela com as 12 folhas A4 e a impressão (→ "Salvar como PDF").
 * Nada de <a download> (não funciona no WebView).
 */
import { cssDoPlanner, folhasDoPlanner, htmlDoPlannerNovo, A4_PX, type DadosDoPlanner, type EstiloPlanner } from "@/lib/planner-2027";
import { isNativeShell } from "@/lib/native-shell";

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

export type ModoDeEntrega = "nativo" | "compartilhar" | "safari" | "imprimir";

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent || "");
/** o navegador de dentro de um app (Instagram, Facebook, TikTok…) */
export const navegadorDeApp = (u = ua()) => /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|MicroMessenger|TikTok|musical_ly/i.test(u);
/** celular/tablet (toque) — o PC continua na impressão */
export const ehCelular = (u = ua()) => {
  if (/iPhone|iPad|iPod|Android/i.test(u)) return true;
  try { return typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches && /Mobile/i.test(u); } catch { return false; }
};
/** o navegador aceita compartilhar ARQUIVOS de imagem (Web Share level 2)? */
export function compartilhaArquivos(): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.canShare !== "function" || typeof File === "undefined") return false;
    return navigator.canShare({ files: [new File([new Uint8Array([137, 80, 78, 71])], "planner-2027-01.png", { type: "image/png" })] });
  } catch { return false; }
}

export function modoDeEntrega(): ModoDeEntrega {
  if (isNativeShell()) return "nativo";
  if (!ehCelular()) return "imprimir";
  if (compartilhaArquivos()) return "compartilhar";
  if (navegadorDeApp()) return "safari";
  return "imprimir";
}

/** iOS (iPhone/iPad, inclusive o iPad que se diz Mac) — muda só o texto da dica */
export const ehIos = (u = ua()) => /iPhone|iPad|iPod/i.test(u) || (/Macintosh/.test(u) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);

/** Site: a janela de impressão. Abre a janela NO TOQUE (sem await antes: senão o bloqueador de pop-up segura). */
export function imprimirPlannerNoSite(d: DadosDoPlanner, estilo: EstiloPlanner): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(htmlDoPlannerNovo(d, estilo));
  w.document.close();
  const imprimir = () => { try { w.focus(); w.print(); } catch { /* a pessoa imprime pela barra "Imprimir" */ } };
  const prontas = w.document.fonts?.ready;
  const teto = new Promise((ok) => window.setTimeout(ok, 2500));
  void Promise.race([prontas ?? Promise.resolve(), teto]).then(() => window.setTimeout(imprimir, 150));
  return true;
}

/** O nome de cada arquivo (crítica r1: não diz a direção — é o planner dela, não "core"). */
export const nomeDaFolha = (i: number) => `planner-2027-${String(i + 1).padStart(2, "0")}.png`;

/** As 12 folhas em PNG A4. `aoAvancar(n)` = quantas já ficaram prontas. null = alguma falhou. */
export async function gerarFolhasPng(d: DadosDoPlanner, estilo: EstiloPlanner, aoAvancar?: (n: number, total: number) => void): Promise<Blob[] | null> {
  garantirCssDoPlanner(estilo);
  const { gerarPng } = await import("@/components/conquistas/gerar-imagem");
  const folhas = folhasDoPlanner(d, estilo);
  const blobs: Blob[] = [];
  for (let i = 0; i < folhas.length; i++) {
    const blob = await gerarPng(<div className={`pl pl-${estilo}`} style={{ width: A4_PX.largura, height: A4_PX.altura }} dangerouslySetInnerHTML={{ __html: folhas[i] }} />, A4_PX);
    if (!blob || !blob.size) return null;
    blobs.push(blob);
    aoAvancar?.(i + 1, folhas.length);
  }
  return blobs;
}

/**
 * Prepara as 12 folhas E o módulo de compartilhar; devolve a função que compartilha (ou null se falhou). No site do
 * celular ela é chamada no 2º toque: nada de await antes do navigator.share (o Safari exige o gesto "fresco").
 */
export async function prepararFolhas(d: DadosDoPlanner, estilo: EstiloPlanner, aoAvancar?: (n: number, total: number) => void) {
  const [blobs, { compartilharImagens }] = await Promise.all([gerarFolhasPng(d, estilo, aoAvancar), import("@/lib/compartilhar")]);
  if (!blobs) return null;
  return () => compartilharImagens(blobs, blobs.map((_, i) => nomeDaFolha(i)), "Planner 2027", "planner_2027");
}

/** App: prepara e já manda (o share do Capacitor não pede gesto recente). */
export async function salvarPlannerNoAparelho(d: DadosDoPlanner, estilo: EstiloPlanner, aoAvancar?: (n: number, total: number) => void) {
  const compartilhar = await prepararFolhas(d, estilo, aoAvancar);
  return compartilhar ? compartilhar() : ("failed" as const);
}
