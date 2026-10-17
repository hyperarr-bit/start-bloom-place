import { useEffect, useRef, useState } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { CHAVE_VISTAS } from "@/lib/conquistas-registro";
import { raridadeDe, type Badge, type Raridade } from "@/components/gamification/types";
import { useConquistas, useSequencia } from "@/components/conquistas/use-conquistas";
import { temArte } from "@/components/conquistas/adesivos-arte";
import { AdesivoRaro } from "@/components/conquistas/adesivos-raridade";
import { Fogo } from "@/components/conquistas/Fogo";
import { eventoDaMissao, type DiaDaMissao, type ModuloDaMissao } from "@/lib/missao-doses";

/**
 * O ADESIVO DA DOSE (1.0.16) — a comemoração de cada dose MOSTRA um adesivo de verdade, do registro de
 * Conquistas. Contrato com o ramo das Conquistas (v1016-conquistas): nenhum id novo e nenhum prêmio à
 * parte — quem dá o adesivo é a regra dele no registro (a dose ganha porque é um registro de verdade); a
 * comemoração só mostra o que acabou de abrir e marca como VISTO, pra ele não pular de novo num popup.
 *
 *   · dia 1: o adesivo que o 1º registro do módulo da dose abre ("Primeira Despesa" / "Primeiro Salário"
 *     em Finanças, "Primeiro Dia" na Rotina, "Primeiro Treino"), se abriu agora; senão, a marca "Dia 1"
 *     (sem id nenhum);
 *   · dias 2 e 3: o adesivo da SEQUÊNCIA — `sequencia-2` ("Voltei") e `sequencia-3` ("3 Dias Seguidos"),
 *     que o ramo das Conquistas cria. Enquanto o id não existe no registro (como neste ramo), a reserva é a
 *     arte genérica do fogo + "2 dias seguidos" / "3 dias seguidos", contada pela sequência do app (dias com
 *     QUALQUER registro — a mesma régua do adesivo). Pulou um dia: nenhum adesivo de sequência, só
 *     "Voltou! A sequência recomeça hoje" (sem drama);
 *   · os outros adesivos que a dose abriu entram na MESMA comemoração ("e mais 1"), nunca num popup por
 *     cima — uma comemoração por dose (desenho 8, seção 4.4).
 * A tela cheia é só a do "3 dias seguidos".
 */

/** O adesivo do 1º registro de cada módulo (ids do registro de hoje), na ordem de preferência. */
export const PRIMEIRO_REGISTRO: Partial<Record<ModuloDaMissao, string[]>> = {
  financas: ["first-expense", "first-income"],
  rotina: ["rotina-1"],
  treino: ["treino-1"],
};

/** Os marcos da sequência que a dose pode mostrar (o ramo das Conquistas cria os dois). */
export const MARCOS_DA_DOSE = [2, 3] as const;
const idDaSequencia = (dias: number) => `sequencia-${dias}`;
/** O nome de cada marco enquanto o registro não tem o id (o ramo das Conquistas chama o de 2 de "Voltei"). */
const NOME_DE_RESERVA: Record<2 | 3, string> = { 2: "2 dias seguidos", 3: "3 dias seguidos" };

export type AdesivoDaDose =
  /** um adesivo REAL do registro (com a arte dele, ou o fogo se for de sequência sem arte própria) */
  | { tipo: "registro"; id: string; nome: string; raridade: Raridade; sequencia?: 2 | 3 }
  /** o marco da sequência sem o id no registro: fogo genérico + texto */
  | { tipo: "reserva"; id: string; nome: string; sequencia: 2 | 3 }
  /** o dia 1 sem adesivo de 1º registro: só a marca "Dia 1" */
  | { tipo: "marca"; id: "marca:dia-1"; nome: string }
  /** pulou um dia: a sequência recomeça (nenhum adesivo) */
  | { tipo: "recomeca" };

export interface EscolhaDoAdesivo {
  principal: AdesivoDaDose | null;
  /** os outros que abriram junto (entram na mesma comemoração) */
  extras: Array<{ id: string; nome: string }>;
  /** só o "3 dias seguidos" vira festa em tela cheia */
  telaCheia: boolean;
  /** ids que entram em `conquistas-vistas.adesivos` (o popup não repete) */
  vistos: string[];
  /** marcos que entram em `conquistas-vistas.marcos` (a roseta da sequência não repete) */
  marcos: number[];
}

/**
 * A ESCOLHA (pura, pra teste): o que a comemoração da dose `n` mostra, dado o registro (`adesivos`, com
 * `unlocked`), o que já foi comemorado (`vistos`) e a sequência do app HOJE (dias seguidos com registro).
 */
export function escolherAdesivoDaDose(p: {
  n: DiaDaMissao;
  modulo: ModuloDaMissao;
  adesivos: Pick<Badge, "id" | "name" | "unlocked" | "xp" | "raridade">[];
  /** `conquistas-vistas.adesivos`; null = a linha de base ainda não existe (aí não dá pra saber o que é
   *  novo além do 1º registro e da sequência: nada de "e mais N") */
  vistos: string[] | null;
  sequencia: number;
  /** o que esta missão já mostrou (não mostra duas vezes, nem a reserva) */
  jaMostrados?: string[];
}): EscolhaDoAdesivo {
  const semBase = p.vistos === null;
  const ja = new Set([...(p.vistos ?? []), ...(p.jaMostrados ?? [])]);
  const novo = (b: { id: string; unlocked: boolean }) => b.unlocked && !ja.has(b.id);
  const porId = new Map(p.adesivos.map((b) => [b.id, b]));
  let principal: AdesivoDaDose | null = null;
  const marcos: number[] = [];

  if (p.n === 1) {
    const id = (PRIMEIRO_REGISTRO[p.modulo] ?? []).find((x) => { const b = porId.get(x); return !!b && novo(b); });
    const b = id ? porId.get(id) : undefined;
    principal = b ? { tipo: "registro", id: b.id, nome: b.name, raridade: raridadeDe(b) } : { tipo: "marca", id: "marca:dia-1", nome: "Dia 1" };
  } else if (p.sequencia >= 2) {
    const dias = (p.sequencia >= 3 ? 3 : 2) as 2 | 3;
    const id = idDaSequencia(dias);
    const b = porId.get(id);
    if (b) {
      // o registro tem o marco (ramo das Conquistas): só mostra se abriu e ninguém comemorou ainda
      if (novo(b)) principal = { tipo: "registro", id: b.id, nome: b.name, raridade: raridadeDe(b), sequencia: dias };
    } else if (!ja.has(id)) {
      principal = { tipo: "reserva", id, nome: NOME_DE_RESERVA[dias], sequencia: dias };
    }
    if (principal) for (const m of MARCOS_DA_DOSE) if (m <= dias) marcos.push(m);
  } else {
    principal = { tipo: "recomeca" };
  }

  const idPrincipal = principal && "id" in principal ? principal.id : null;
  const extras = semBase ? [] : p.adesivos
    .filter((b) => novo(b) && b.id !== idPrincipal && !/^sequencia-/.test(b.id))
    .map((b) => ({ id: b.id, nome: b.name }));
  const vistos = [
    ...(principal && (principal.tipo === "registro" || principal.tipo === "reserva") ? [principal.id] : []),
    // o marco maior mostrado cobre os menores (sem um "2 dias" atrasado depois do "3 dias")
    ...marcos.map(idDaSequencia).filter((id) => id !== idPrincipal),
    ...extras.map((e) => e.id),
  ];
  const telaCheia = !!principal && (principal.tipo === "registro" || principal.tipo === "reserva") && (principal as { sequencia?: number }).sequencia === 3;
  return { principal, extras, telaCheia, vistos, marcos };
}

type Vistas = { adesivos: string[]; marcos: number[] };
/** `conquistas-vistas` normalizado; null = ainda não existe (a linha de base dos Momentos não rodou). */
const lerVistas = (v: unknown): Vistas | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as { adesivos?: unknown; marcos?: unknown };
  return {
    adesivos: Array.isArray(o.adesivos) ? o.adesivos.filter((x): x is string => typeof x === "string") : [],
    marcos: Array.isArray(o.marcos) ? o.marcos.filter((x): x is number => typeof x === "number") : [],
  };
};

/**
 * O adesivo desta comemoração, decidido UMA vez quando ela aparece (marcar como visto não muda o que já
 * está na tela) — e marcado como visto na conta, uma escrita de sistema (não conta como registro do dia).
 * `aoMostrar` recebe os ids pra missão guardar (`adesivosMostrados`).
 */
export function useAdesivoDaDose(n: DiaDaMissao, modulo: ModuloDaMissao, jaMostrados: string[] | undefined, aoMostrar?: (ids: string[]) => void): EscolhaDoAdesivo {
  const { get, set } = useUserData();
  const conq = useConquistas();
  const seq = useSequencia();
  const [escolha] = useState<EscolhaDoAdesivo>(() => {
    try {
      return escolherAdesivoDaDose({ n, modulo, adesivos: conq.adesivos, vistos: lerVistas(get<unknown>(CHAVE_VISTAS, undefined))?.adesivos ?? null, sequencia: seq.dias, jaMostrados });
    } catch {
      return { principal: n === 1 ? { tipo: "marca", id: "marca:dia-1", nome: "Dia 1" } : null, extras: [], telaCheia: false, vistos: [], marcos: [] };
    }
  });
  const gravou = useRef(false);
  useEffect(() => {
    if (gravou.current) return;
    gravou.current = true;
    try {
      const v = lerVistas(get<unknown>(CHAVE_VISTAS, undefined));
      if (!v || escolha.vistos.length || escolha.marcos.length) {
        // sem a linha de base (Momentos ainda não montou nesta conta): ela nasce AQUI, como os Momentos fariam —
        // tudo o que já está aberto vira visto (senão as insígnias "de graça" da conta vazia pulariam num popup)
        const base = v ?? { adesivos: conq.adesivos.filter((b) => b.unlocked).map((b) => b.id), marcos: [] };
        set(CHAVE_VISTAS, {
          adesivos: [...new Set([...base.adesivos, ...escolha.vistos])],
          marcos: [...new Set([...base.marcos, ...escolha.marcos])].sort((a, b) => a - b),
        }, { system: true });
      }
      const p = escolha.principal;
      const mostrados = [...(p && "id" in p ? [p.id] : []), ...escolha.extras.map((e) => e.id)];
      if (mostrados.length) aoMostrar?.(mostrados);
      trackEvent("missao_adesivo_mostrado", eventoDaMissao({
        dia: n, modulo, tipo: p?.tipo ?? "nenhum", id: p && "id" in p ? p.id : null, extras: escolha.extras.length, tela_cheia: escolha.telaCheia, sequencia: seq.dias,
      }));
    } catch { /* a comemoração nunca cai por causa do adesivo */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return escolha;
}

/** A arte do adesivo: a do registro (com a raridade), o fogo (sequência sem arte própria / reserva) ou a marca "Dia 1". */
export function ArteDoAdesivo({ adesivo, tamanho }: { adesivo: AdesivoDaDose; tamanho: number }) {
  if (adesivo.tipo === "recomeca") return null;
  if (adesivo.tipo === "marca") {
    return (
      <span className="md-marca-dia" style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.3) }} data-testid="missao-doses-adesivo-arte" data-arte="marca" aria-hidden>
        <small style={{ fontSize: Math.round(tamanho * 0.16) }}>DIA</small>1
      </span>
    );
  }
  const sequencia = "sequencia" in adesivo ? adesivo.sequencia : undefined;
  if (adesivo.tipo === "reserva" || (sequencia && !temArte(adesivo.id))) {
    return (
      <span className="md-adesivo-fogo" style={{ width: tamanho, height: tamanho }} data-testid="missao-doses-adesivo-arte" data-arte="fogo" aria-hidden>
        <Fogo dias={sequencia ?? 2} tamanho={Math.round(tamanho * 0.62)} />
        <b style={{ fontSize: Math.round(tamanho * 0.2) }}>{sequencia}</b>
      </span>
    );
  }
  return (
    <span data-testid="missao-doses-adesivo-arte" data-arte="registro" aria-hidden>
      <AdesivoRaro id={adesivo.id} raridade={adesivo.raridade} tamanho={tamanho} giro={-6} />
    </span>
  );
}
