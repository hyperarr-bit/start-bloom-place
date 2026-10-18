import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import {
  ATRIBUTO_FASE, CHAVE_MONTAR_ROTINA, EV_PRIMEIRO, MONTAR_ROTINA_NO_MODULO, carimbarPrimeiro, contaNovaParaMontarRotina,
  deveMostrarMontarRotina, guardarForcaMontarRotinaDaUrl, montarRotinaAbertoPelaMissao, montarRotinaJaDecidido, montarRotinaLigado,
  primeiroAindaNaoContado, primeiroDiaMarcado,
} from "@/lib/montar-rotina";

/**
 * O 1º QUADRADINHO DEPOIS DO "MONTAR", quando ele não acontece no guia (1.0.16). O guia conta o que é marcado
 * enquanto ele está na tela; quem tocou em "Entendi" e marcou depois — na mesma noite, na manhã seguinte, pelo
 * widget da Home — é contado aqui, na próxima vez que a Rotina abre, com o DIA certo (o 1º dia do log por data
 * desde o "pronto"). Uma vez só: o carimbo `primeiro` vai pro aparelho e pra conta. Sem tela, sem custo: lê
 * duas chaves e sai.
 */
export function useVigiaDoPrimeiroMarcado(): void {
  const { get, set, loaded } = useUserData();
  const habitLog = loaded ? get<unknown>("rotina-habit-log", null) : null;
  useEffect(() => {
    if (!loaded) return;
    const base = primeiroAindaNaoContado(get);
    if (!base) return;
    // o guia está na tela: ele mesmo conta (como "guiado")
    try { if (document.documentElement.getAttribute(ATRIBUTO_FASE) === "guia") return; } catch { /* sem document */ }
    const achado = primeiroDiaMarcado(habitLog, base.em);
    if (!achado) return;
    const marca = carimbarPrimeiro(get);
    if (!marca) return;
    set(CHAVE_MONTAR_ROTINA, marca, { system: true });
    trackEvent(EV_PRIMEIRO, { origem: base.o ?? "missao", guiado: false, dias: achado.dias });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, habitLog]);
}

/**
 * O CAMINHO DO MÓDULO — FECHADO (dono, 17/10: "não quero que a pessoa clique em um módulo e apareça um quiz").
 * Com MONTAR_ROTINA_NO_MODULO = false (lib/montar-rotina) devolve sempre "nao" e a Rotina abre como sempre (o
 * DOM de hoje); o quiz só existe pela missão. Fica pronto pro dia em que o dono quiser a 1ª abertura da Rotina
 * de uma conta nova vazia com o quiz (a mesma régua da missão, decidida UMA vez quando o dado da conta carrega):
 *   · "nao"       → a Rotina de sempre;
 *   · "decidindo" → conta nova esperando o dado da conta (a página cobre com o fundo, sem piscar a Rotina vazia);
 *   · "mostrar"   → <MontarRotina origem="modulo" /> por cima.
 */
export function useMontarRotinaNoModulo() {
  const { pathname } = useLocation();
  const isPreview = pathname.startsWith("/preview");
  const { user } = useAuth();
  const { get, set, loaded, isGuest } = useUserData();
  const criadoEm = (user as { created_at?: string } | null)?.created_at;
  // `?montar-rotina=recomecar` (QA, navegador): lido UMA vez por montagem — só com o caminho ligado
  const recomecou = useRef<boolean | null>(null);
  if (recomecou.current === null) recomecou.current = MONTAR_ROTINA_NO_MODULO ? guardarForcaMontarRotinaDaUrl() : false;
  const candidato = () =>
    MONTAR_ROTINA_NO_MODULO && !isPreview && !isGuest && montarRotinaLigado() && contaNovaParaMontarRotina(criadoEm) && !montarRotinaJaDecidido();
  const decidir = (): "mostrar" | "nao" => {
    const getSemMarca = recomecou.current ? (<T,>(k: string, f: T): T => (k === CHAVE_MONTAR_ROTINA ? f : get(k, f))) : get;
    if (montarRotinaAbertoPelaMissao()) return "nao";
    return deveMostrarMontarRotina({ criadoEm, get: getSemMarca, isGuest, isPreview }) ? "mostrar" : "nao";
  };
  const [estado, setEstado] = useState<"decidindo" | "mostrar" | "nao">(() => {
    if (!candidato()) return "nao";
    return loaded ? decidir() : "decidindo";
  });
  useEffect(() => {
    if (recomecou.current) set(CHAVE_MONTAR_ROTINA, null, { system: true }); // a marca da conta também sai
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (estado !== "decidindo" || !loaded) return;
    setEstado(decidir());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, estado]);
  return {
    estado,
    aoPronto: () => setEstado("nao"),
    aoPular: () => setEstado("nao"),
    /** A missão abriu a tela dela por cima: a do módulo sai sem decidir (a da missão decide). */
    aoCeder: () => setEstado("nao"),
  };
}
