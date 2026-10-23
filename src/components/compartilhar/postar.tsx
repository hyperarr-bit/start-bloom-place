import type { ReactNode } from "react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { compartilharImagem, compartilharVideo, type ResultadoCompartilhar } from "@/lib/compartilhar";
import { gerarPng } from "@/components/conquistas/gerar-imagem";
import { CardDeCompartilhar } from "./cards";
import { FORMATOS, type DadosCard, type Formato } from "./tipos";

/**
 * POSTAR UM CARD (29/09): gera a imagem (ou o vídeo) NO APARELHO e abre o
 * compartilhar do sistema — no app a folha nativa (Stories, Status do
 * WhatsApp, Salvar…), na web o Web Share, no PC o download. Os mesmos
 * caminhos das Conquistas (`src/lib/compartilhar.ts`), com a verdade no
 * aviso: "failed" diz que falhou, nunca "salvo!".
 *
 * Eventos: `card_share` (o toque) e `card_video` (o vídeo saiu ou caiu pra
 * imagem). O resultado final continua em `compartilhar_resultado` (origem
 * "card-<tipo>").
 */

const avisar = (r: ResultadoCompartilhar | "sem-imagem", tipo: "imagem" | "video" | "adesivo" = "imagem") => {
  if (r === "downloaded") toast.success(tipo === "video" ? "Vídeo salvo! Agora é só postar 🎉" : tipo === "adesivo" ? "Adesivo salvo! Cole por cima da sua foto 🎉" : "Imagem salva! Agora é só postar 🎉");
  else if (r === "sem-imagem") toast.error("Não consegui montar a imagem agora. Tenta de novo em instantes?");
  else if (r === "failed") toast.error("Não consegui abrir o compartilhar. Atualize o CORE na loja e tente de novo.");
};

const blobParaDataUrl = (b: Blob) => new Promise<string>((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => erro(r.error); r.readAsDataURL(b); });

/**
 * As capas dos livros vêm de fora (Storage, importação por link). O
 * html-to-image precisa buscar a imagem com CORS; se a capa não vier em 4 s
 * (ou o servidor não deixa), o card desenha a capa tipográfica — nunca um
 * buraco no card.
 */
export async function prepararCapas(dados: DadosCard): Promise<DadosCard> {
  if (dados.tipo !== "livros") return dados;
  const livros = await Promise.all(dados.livros.map(async (l) => {
    if (!l.capa || l.capa.startsWith("data:")) return l;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(l.capa, { mode: "cors", signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(String(r.status));
      return { ...l, capa: await blobParaDataUrl(await r.blob()) };
    } catch {
      return { ...l, capa: undefined };
    }
  }));
  return { ...dados, livros };
}

const nomeDoArquivo = (d: DadosCard, formato: Formato, ext: "png" | "mp4") => `core-${d.tipo}-${formato}.${ext}`;
const tituloDo = (d: DadosCard) => ({ treinos: "Meus treinos no CORE", azul: "No azul, com o CORE", poupanca: "Guardei no CORE", livros: "Minhas leituras no CORE", sequencia: "Minha sequência no CORE", agua: "Minha água no CORE", sono: "Meu sono no CORE", habitos: "Meu hábito no CORE", metas: "Minhas metas no CORE", insignia: "Minha insígnia no CORE", figurinha: "Minha figurinha no CORE", numero: "Minha conquista no CORE", lancamentos: "Minhas finanças no CORE", "retro-abertura": "Meu mês no CORE", "retro-resumo": "Meu mês no CORE" })[d.tipo];

/** A imagem do card (PNG no tamanho do formato; o adesivo com fundo transparente). */
export async function gerarImagemDoCard(dados: DadosCard, formato: Formato, moeda?: ReactNode): Promise<Blob | null> {
  const d = await prepararCapas(dados);
  const { w, h } = FORMATOS[formato];
  return gerarPng(<CardDeCompartilhar dados={d} formato={formato} moeda={moeda} />, { largura: w, altura: h });
}

const valoresDe = (d: DadosCard) => ("valoresLigados" in d ? !!d.valoresLigados : false);

export async function postarCardImagem(dados: DadosCard, formato: Formato, origem: string, moeda?: ReactNode): Promise<ResultadoCompartilhar> {
  trackEvent("card_share", { tipo: dados.tipo, formato, midia: formato === "adesivo" ? "adesivo" : "imagem", origem, valores: valoresDe(dados) });
  const blob = await gerarImagemDoCard(dados, formato, moeda);
  if (!blob) {
    avisar("sem-imagem");
    return "failed";
  }
  const r = await compartilharImagem(blob, nomeDoArquivo(dados, formato, "png"), tituloDo(dados), `card-${dados.tipo}`);
  avisar(r, formato === "adesivo" ? "adesivo" : "imagem");
  return r;
}

/** O VÍDEO do card (Stories/Status ou feed). Sem como gerar, ou o compartilhar recusou: vai a imagem. */
export async function postarCardVideo(dados: DadosCard, formato: "stories" | "feed", origem: string, onProgresso?: (f: number) => void, moeda?: ReactNode): Promise<ResultadoCompartilhar> {
  trackEvent("card_share", { tipo: dados.tipo, formato, midia: "video", origem, valores: valoresDe(dados) });
  const t0 = performance.now();
  let gerado: Awaited<ReturnType<typeof import("./video-card").gerarVideoDoCard>> = null;
  try {
    const d = await prepararCapas(dados);
    const { gerarVideoDoCard } = await import("./video-card");
    gerado = await gerarVideoDoCard(d, formato, (f) => onProgresso?.(f), moeda);
  } catch (e) {
    console.error("[compartilhar] o vídeo do card falhou:", e);
    gerado = null;
  }
  if (!gerado) {
    trackEvent("card_video", { tipo: dados.tipo, ok: false, ms: Math.round(performance.now() - t0), fallback: "imagem" });
    toast.message("O vídeo não saiu desta vez — vai a imagem.");
    return postarCardImagem(dados, formato, origem, moeda);
  }
  const r = await compartilharVideo(gerado.blob, nomeDoArquivo(dados, formato, "mp4"), tituloDo(dados), `card-${dados.tipo}`);
  if (r === "failed") {
    trackEvent("card_video", { tipo: dados.tipo, ok: false, ms: Math.round(performance.now() - t0), formato_video: gerado.formato, fallback: "imagem" });
    return postarCardImagem(dados, formato, origem, moeda);
  }
  trackEvent("card_video", { tipo: dados.tipo, ok: true, ms: Math.round(performance.now() - t0), geracao_ms: gerado.ms, formato_video: gerado.formato, resolucao: `${gerado.largura}x${gerado.altura}`, duracao: gerado.duracao, resultado: r });
  avisar(r, "video");
  return r;
}
