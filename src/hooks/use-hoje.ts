import { useEffect, useState } from "react";
import { localDayKey } from "@/lib/utils";

/**
 * "Hoje" que acompanha a virada do dia com a tela aberta (celular mantém a aba viva).
 * A resposta sai do relógio a cada desenho, e o estado só redesenha quando o dia vira: depois de um toque a tela já
 * está no dia certo, mesmo que o aviso de volta ainda não tenha chegado (07/11, agua-meia-noite).
 * Isto é para DESENHAR. Quem GRAVA pergunta o dia na hora do toque (localDayKey): tela de ontem ainda pode estar aberta.
 */
export function useHoje(): string {
  const [, setHoje] = useState(localDayKey());
  useEffect(() => {
    const sync = () => setHoje((h) => (h === localDayKey() ? h : localDayKey()));
    const visivel = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", visivel);
    window.addEventListener("focus", sync);
    const id = window.setInterval(sync, 60_000);
    return () => { document.removeEventListener("visibilitychange", visivel); window.removeEventListener("focus", sync); window.clearInterval(id); };
  }, []);
  return localDayKey();
}
