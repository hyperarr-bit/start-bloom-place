import { useCallback, useEffect, useMemo, useRef } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import {
  CATALOGO, CHAVE_MOSTRAR_VALORES, candidatasAHeroi, congelarMesAnterior, herois, montarInsignia, montarInsignias, ordenarPagina,
  type Insignia, type PaginaOrdenada,
} from "./insignias";

/**
 * As insígnias de hoje (27/09): monta o catálogo com os números de verdade,
 * escolhe o herói, as 3 melhores de áreas diferentes e as candidatas (pra
 * trocar antes de postar); lê e grava a preferência "mostrar valores"
 * (`conquistas-mostrar-valores`, padrão desligado); e, na 1ª abertura de um
 * mês novo, congela o mês que acabou (`conquistas-insignias-AAAA-MM`).
 */
export interface EstadoInsignias {
  lista: Insignia[];
  ordenada: PaginaOrdenada;
  heroi: Insignia | null;
  tres: Insignia[];
  candidatas: Insignia[];
  valoresLigados: boolean;
  ligarValores: (ligado: boolean) => void;
  mesIdx: number;
  ano: number;
}

export function useInsignias(): EstadoInsignias {
  const { get, set, loaded } = useUserData();
  const hoje = localDayKey();
  const valoresLigados = get<unknown>(CHAVE_MOSTRAR_VALORES, false) === true;

  const lista = useMemo(() => {
    try {
      return montarInsignias(get, hoje);
    } catch (e) {
      console.error("[conquistas] as insígnias não montaram:", e);
      return CATALOGO.map((d) => montarInsignia(d, undefined));
    }
  }, [get, hoje]);

  const ordenada = useMemo(() => ordenarPagina(lista, { valoresLigados }), [lista, valoresLigados]);
  const tres = useMemo(() => herois(lista, 3, valoresLigados), [lista, valoresLigados]);
  const candidatas = useMemo(() => candidatasAHeroi(lista, valoresLigados), [lista, valoresLigados]);

  // congela o mês anterior UMA vez por montagem, com o servidor respondido
  const congelou = useRef(false);
  useEffect(() => {
    if (!loaded || congelou.current) return;
    congelou.current = true;
    try {
      const r = congelarMesAnterior(get, set, hoje);
      if (r) trackEvent("insignias_congeladas", { mes: r.mes });
    } catch (e) {
      console.error("[conquistas] não congelou o mês anterior:", e);
    }
  }, [loaded, get, set, hoje]);

  const ligarValores = useCallback((ligado: boolean) => {
    set(CHAVE_MOSTRAR_VALORES, ligado);
    trackEvent("insignias_valores", { ligado });
  }, [set]);

  const d = new Date();
  return { lista, ordenada, heroi: ordenada.heroiConquistado ? ordenada.heroi : null, tres, candidatas, valoresLigados, ligarValores, mesIdx: d.getMonth(), ano: d.getFullYear() };
}
