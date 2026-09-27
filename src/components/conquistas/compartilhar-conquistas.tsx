import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { compartilharImagem, type ResultadoCompartilhar } from "@/lib/compartilhar";
import { gerarPng } from "./gerar-imagem";
import { RECORTE_ROSETA, STORIES, StoriesAdesivo, StoriesCapa, StoriesRoseta } from "./Stories";
import type { CapaId, DadosCapa } from "./CapaPlanner";

/**
 * Compartilhar das Conquistas (26/09) — substitui o profile-share/badge-share
 * de canvas. Os nomes de evento antigos ficam (`profile_share`, `badge_share`)
 * pra série histórica não quebrar; `capa_share` é novo e diz a cor da capa.
 * O resultado é tratado como nos outros compartilhares do app: "downloaded"
 * avisa que salvou, "failed" diz a verdade.
 */

const avisar = (r: ResultadoCompartilhar | "sem-imagem") => {
  if (r === "downloaded") toast.success("Imagem salva! Agora é só postar 🎉");
  else if (r === "sem-imagem") toast.error("Não consegui montar a imagem agora. Tenta de novo em instantes?");
  else if (r === "failed") toast.error("Não consegui abrir o compartilhar. Atualize o CORE na loja e tente de novo.");
};

async function enviar(blob: Blob | null, arquivo: string, titulo: string, origem: string): Promise<ResultadoCompartilhar> {
  if (!blob) {
    avisar("sem-imagem");
    return "failed";
  }
  const r = await compartilharImagem(blob, arquivo, titulo, origem);
  avisar(r);
  return r;
}

export async function compartilharCapa(dados: DadosCapa & { capa: CapaId; adesivos: number }) {
  trackEvent("profile_share", { level: dados.nivel, badges: dados.adesivos, capa: dados.capa });
  trackEvent("capa_share", { capa: dados.capa, nivel: dados.nivel, dias: dados.dias });
  const blob = await gerarPng(<StoriesCapa {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, "core-meu-planner.png", "Meu planner no CORE", "capa");
}

export async function compartilharRoseta(dados: { dias: number; nome: string; membroDesde: string; nivel: string; transparente?: boolean }) {
  trackEvent("badge_share", { badge: `sequencia-${dados.dias}`, formato: dados.transparente ? "roseta-transparente" : "roseta" });
  const blob = dados.transparente
    ? await gerarPng(<StoriesRoseta {...dados} transparente />, { largura: RECORTE_ROSETA.w, altura: RECORTE_ROSETA.h })
    : await gerarPng(<StoriesRoseta {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, `core-${dados.dias}-dias${dados.transparente ? "-adesivo" : ""}.png`, `${dados.dias} dias seguidos no CORE`, "conquista");
}

export async function compartilharAdesivo(dados: { id: string; titulo: string; descricao: string; nome: string; membroDesde: string }) {
  trackEvent("badge_share", { badge: dados.id, formato: "adesivo" });
  const blob = await gerarPng(<StoriesAdesivo {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, `core-adesivo-${dados.id}.png`, `Adesivo: ${dados.titulo}`, "conquista");
}
