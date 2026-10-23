import type { CSSProperties } from "react";
import { LockKeyhole } from "lucide-react";
import type { Badge, Raridade } from "@/components/gamification/types";
import { ARTES_CADERNO } from "./artes-caderno";
import { Adesivo } from "./adesivos-arte";
import "./figurinhas-caderno.css";

/** O último trecho da conquista dá uma espiada, sem entregar a cena inteira. */
export const quaseConquistada = (progresso?: Badge["progresso"]): boolean =>
  !!progresso && progresso.alvo > 1 && progresso.atual >= progresso.alvo * .8;

export const FigurinhaOculta = ({ id, raridade, tamanho, progresso }: { id: string; raridade: Raridade; tamanho: number; progresso?: Badge["progresso"] }) => {
  const quase = quaseConquistada(progresso);
  const mascara = `url("${ARTES_CADERNO[id]}")`;
  return (
    <span className="fig-oculta" data-rar={raridade} data-estado={quase ? "quase" : "bloqueada"} style={{ width: tamanho, height: tamanho, "--fig-mascara": mascara } as CSSProperties} aria-hidden>
      <span className="fig-oculta-papel" />
      <span className="fig-oculta-silhueta" />
      {quase ? <>
        <span className="fig-oculta-espiada"><Adesivo id={id} tamanho={tamanho} /></span>
        <span className="fig-oculta-dobra" />
      </> : <LockKeyhole className="fig-oculta-cadeado" strokeWidth={1.8} />}
    </span>
  );
};
