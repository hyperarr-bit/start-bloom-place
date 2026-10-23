import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { lerFaixaVista, mudancaDeFaixa } from "@/lib/fogo-sequencia";
import { Fogo } from "../Fogo";
import { CHAVE_FOGO_CADERNO, fogoDoCaderno } from "./fogo-caderno";

/** Uma animação curta ao subir de faixa; primeira visita e queda são silenciosas. */
export const FogoDaSequencia = ({ dias }: { dias: number }) => {
  const { get, set, loaded } = useUserData();
  const reduzir = useReducedMotion();
  const faixa = fogoDoCaderno(dias);
  const vista = lerFaixaVista(get(CHAVE_FOGO_CADERNO, null));
  const [subida, setSubida] = useState<number | null>(null);

  useEffect(() => {
    if (!loaded || vista === faixa.indice) return;
    set(CHAVE_FOGO_CADERNO, faixa.indice, { system: true });
    if (mudancaDeFaixa(faixa.indice, vista) === "subiu" && !reduzir) setSubida(faixa.indice);
    else setSubida(null);
  }, [loaded, vista, faixa.indice, reduzir, set]);

  useEffect(() => {
    if (subida === null) return;
    const timer = setTimeout(() => setSubida(null), 1100);
    return () => clearTimeout(timer);
  }, [subida]);

  return <span className="cn-fogo" data-testid="cn-fogo" data-subiu={!reduzir && subida === faixa.indice ? "" : undefined} data-ouro={dias >= 100 ? "" : undefined} aria-hidden>
    <Fogo dias={dias} faixa={dias > 0 ? faixa : undefined} tamanho={42} semBrilho={dias < 100} />
    <span className="cn-fogo-faisca">✦</span>
  </span>;
};
