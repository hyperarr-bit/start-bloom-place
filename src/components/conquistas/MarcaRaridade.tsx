import { Crown, Diamond, Sparkles } from "lucide-react";
import type { Raridade } from "@/components/gamification/types";
import "./marca-raridade.css";

/** Desligar restaura o tratamento anterior sem desfazer os bugs corrigidos. */
export const RARIDADES_EM_TESTE = false;
const NOMES: Record<Raridade, string> = { comum: "Comum", raro: "Rara", epico: "Épica", lendario: "Lendária" };

export const MarcaRaridade = ({ raridade }: { raridade: Raridade }) => {
  if (!RARIDADES_EM_TESTE || raridade === "comum") return null;
  const Icone = raridade === "raro" ? Diamond : raridade === "epico" ? Sparkles : Crown;
  return <span className="fig-marca-raridade" data-rar={raridade} role="img" aria-label={`Figurinha ${NOMES[raridade].toLowerCase()}`} title={NOMES[raridade]}><Icone aria-hidden strokeWidth={2} /></span>;
};
