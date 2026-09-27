import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { compartilharImagem, type ResultadoCompartilhar } from "@/lib/compartilhar";
import type { Raridade } from "@/components/gamification/types";
import { gerarPng } from "./gerar-imagem";
import { RECORTE_INSIGNIAS, RECORTE_ROSETA, STORIES, StoriesAdesivo, StoriesCapa, StoriesCarteirinha, StoriesInsignias, StoriesRoseta } from "./Stories";
import type { CapaId, DadosCapa } from "./CapaPlanner";
import type { DadosCarteirinha } from "./Carteirinha";
import type { Insignia } from "./insignias";

/**
 * Compartilhar das Conquistas (26/09; carteirinha e insígnias em 27/09) —
 * substitui o profile-share/badge-share de canvas. Os nomes de evento antigos
 * ficam (`profile_share`, `badge_share`) pra série histórica não quebrar;
 * `capa_share`, `carteirinha_share` e `insignias_share` dizem qual arte saiu.
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

export async function compartilharAdesivo(dados: { id: string; titulo: string; descricao: string; raridade?: Raridade; nome: string; membroDesde: string }) {
  trackEvent("badge_share", { badge: dados.id, formato: "adesivo", raridade: dados.raridade ?? "comum" });
  const blob = await gerarPng(<StoriesAdesivo {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, `core-adesivo-${dados.id}.png`, `Adesivo: ${dados.titulo}`, "conquista");
}

export async function compartilharCarteirinha(dados: DadosCarteirinha) {
  trackEvent("carteirinha_share", { nivel: dados.nivel, dias: dados.dias, adesivos: dados.adesivos });
  const blob = await gerarPng(<StoriesCarteirinha {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, "core-carteirinha.png", "Minha carteirinha do CORE", "carteirinha");
}

export async function compartilharInsignias(dados: { insignias: Insignia[]; nome: string; membroDesde: string; nivel: string; transparente?: boolean }) {
  trackEvent("insignias_share", { nivel: dados.nivel, insignias: dados.insignias.filter((i) => i.temDado).map((i) => i.id).join(","), transparente: !!dados.transparente });
  const blob = dados.transparente
    ? await gerarPng(<StoriesInsignias {...dados} transparente />, { largura: RECORTE_INSIGNIAS.w, altura: RECORTE_INSIGNIAS.h })
    : await gerarPng(<StoriesInsignias {...dados} />, { largura: STORIES.w, altura: STORIES.h });
  return enviar(blob, `core-insignias${dados.transparente ? "-faixa" : ""}.png`, "Minhas insígnias no CORE", "insignias");
}
