/**
 * "Mandar a carteirinha" (29/09): o texto da carteirinha pro WhatsApp do vet,
 * do hotel, da creche. Folha nativa no app; Web Share no site; sem nenhum dos
 * dois, copia e avisa.
 */
import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { linhasDaCarteirinha } from "@/lib/pet-cuidados";
import { compartilharTexto, textoDaCarteirinha } from "@/lib/pet-compartilhar";
import type { Pet } from "@/lib/pet";
import type { UsePet } from "./use-pet";

export const MandarCarteirinha = ({ pet, dados }: { pet: Pet; dados: UsePet }) => {
  const [enviando, setEnviando] = useState(false);
  const mandar = async () => {
    if (enviando) return;
    setEnviando(true);
    const linhas = linhasDaCarteirinha(pet.id, dados.cuidadosBrutos, dados.registrosBrutos, dados.hoje);
    const texto = textoDaCarteirinha(pet, linhas, dados.pesosBrutos, dados.hoje);
    const r = await compartilharTexto(texto, `Carteirinha de ${pet.name}`);
    setEnviando(false);
    if (r === "copiado") toast("Carteirinha copiada", { description: "É só colar no WhatsApp ou no e-mail." });
    if (r === "falhou") toast.error("Não deu pra compartilhar deste aparelho.");
  };
  return (
    <button
      type="button"
      onClick={() => void mandar()}
      disabled={enviando}
      className="w-full min-h-[44px] border-t border-dashed border-border inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-60"
      data-testid="mandar-carteirinha"
    >
      <Share2 className="w-4 h-4" aria-hidden="true" /> Mandar a carteirinha (WhatsApp, e-mail…)
    </button>
  );
};
