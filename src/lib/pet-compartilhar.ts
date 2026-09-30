/**
 * MANDAR A CARTEIRINHA (29/09) — o pedido brasileiro mais concreto das
 * avaliações de apps de pet: "falta opção de exportar a carteira de vacina…
 * viajei com meus pets e esqueci a carteira em casa", "gerar um relatório pra
 * mandar pro veterinário por WhatsApp" (pesquisa do módulo, 43 pedidos).
 *
 * Onda 1 = TEXTO, que cabe em qualquer lugar (WhatsApp, e-mail, hotel, creche)
 * e não depende de nada novo: no app, a folha nativa (@capacitor/share, que já
 * está no app desde 26/09); no site, o Web Share; sem nenhum dos dois, copia.
 * PDF/imagem da carteirinha fica pra onda 2.
 */
import { dataSegura } from "@/lib/utils";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { NOME_DA_ESPECIE, especieDe, idadeExtenso, pesoComUnidade, pesosDoPet, type Pet } from "@/lib/pet";
import { GRUPOS, TIPOS, rotuloIntervalo, type LinhaDaCarteirinha } from "@/lib/pet-cuidados";

const data = (dia?: string) => (dia ? dataSegura(dia, "dd/MM/yyyy") : "");

export function textoDaCarteirinha(pet: Pet, linhas: LinhaDaCarteirinha[], pesos: unknown, hoje: string): string {
  const esp = especieDe(pet.species);
  const sexo = pet.sexo === "femea" ? "fêmea" : pet.sexo === "macho" ? "macho" : "";
  const castrado = pet.castrado === true ? (pet.sexo === "femea" ? "castrada" : "castrado") : "";
  const serie = pesosDoPet(pet, pesos);
  const ultimoPeso = serie[serie.length - 1];
  const cabecalho = [
    `🐾 Carteirinha de ${pet.name}`,
    [pet.species?.trim() || NOME_DA_ESPECIE[esp], pet.breed?.trim(), sexo, castrado, idadeExtenso(pet, hoje)].filter(Boolean).join(" · "),
    pet.birthday ? `Nascimento: ${data(pet.birthday)}${pet.nascimentoAprox ? " (aproximado)" : ""}` : "",
    ultimoPeso ? `Peso: ${pesoComUnidade(ultimoPeso.kg)}${ultimoPeso.dia ? ` (${data(ultimoPeso.dia)})` : ""}` : "",
    pet.chip ? `Microchip: ${pet.chip}` : "",
    pet.alergias ? `Alergias e cuidados: ${pet.alergias}` : "",
  ].filter(Boolean);

  const blocos: string[] = [];
  for (const g of GRUPOS) {
    const doGrupo = linhas.filter((l) => TIPOS[l.tipo].grupo === g.id);
    if (!doGrupo.length) continue;
    const itens = doGrupo.map((l) => {
      if (l.tipo === "remedio" && l.cuidado?.horarios?.length) {
        const c = l.cuidado;
        return `• ${c.nome}${c.dose ? ` ${c.dose}` : ""} — ${c.horarios!.join(", ")}${c.ate ? ` · até ${data(c.ate)}` : " · uso contínuo"}`;
      }
      const partes = [
        l.ultima ? `última ${data(l.ultima)}` : "sem registro",
        l.proxima ? (l.status === "atrasado" ? `venceu ${data(l.proxima)}` : `próxima ${data(l.proxima)}`) : "",
        l.intervaloDias ? rotuloIntervalo(l.intervaloDias) : "",
      ].filter(Boolean);
      const lote = l.registros[0]?.obs ? ` (${l.registros[0].obs})` : "";
      return `• ${l.nome} — ${partes.join(" · ")}${lote}`;
    });
    blocos.push([g.titulo.toUpperCase(), ...itens].join("\n"));
  }

  const vet = [pet.vetNome, pet.vetTelefone].filter(Boolean).join(" · ");
  return [
    cabecalho.join("\n"),
    blocos.length ? blocos.join("\n\n") : "Nenhuma vacina ou cuidado registrado ainda.",
    vet ? `Veterinário: ${vet}` : "",
    `Atualizada em ${data(hoje)} · feita no CORE`,
  ].filter(Boolean).join("\n\n");
}

export type ResultadoTexto = "compartilhado" | "copiado" | "cancelado" | "falhou";

export async function compartilharTexto(texto: string, titulo: string): Promise<ResultadoTexto> {
  const fim = (r: ResultadoTexto, via: string) => { trackEvent("pet_carteirinha_mandar", { resultado: r, via }); return r; };
  if (isNativeShell()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: titulo, text: texto, dialogTitle: titulo });
      return fim("compartilhado", "nativo");
    } catch (e) {
      if (/cancel/i.test(String((e as Error)?.message ?? e))) return fim("cancelado", "nativo");
      // app sem o plugin (antes de 26/09): tenta o resto
    }
  }
  try {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      await nav.share({ title: titulo, text: texto });
      return fim("compartilhado", "web");
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return fim("cancelado", "web");
  }
  try {
    await navigator.clipboard.writeText(texto);
    return fim("copiado", "area-de-transferencia");
  } catch {
    return fim("falhou", "nenhuma");
  }
}
