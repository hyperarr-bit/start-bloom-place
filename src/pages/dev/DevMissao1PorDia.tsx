import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext } from "@/hooks/use-user-data";
import { PlanoDeAmanhaA } from "@/components/missao-doses/PlanoDeAmanhaA";
import { EscolhaDoDia2 } from "@/components/missao-doses/EscolhaDoDia2";
import { ConstruiuEm3Dias } from "@/components/missao-doses/ConstruiuEm3Dias";
import { LinhaDoseDeHoje } from "@/components/missao-doses/LinhaDoseDeHoje";
import { guardarForcaDia1Cheio } from "@/lib/dia1-cheio";
import { guardarForcaDias23 } from "@/lib/dias23";
import { bracoConstruiu, guardarForcaConstruiu } from "@/lib/construiu-ab";
import { porDiaDasFinancas } from "@/lib/lembrete-dia2";
import { ROTULO_DOSE_PELA_INTRO } from "@/lib/missao-doses";
import { BoasVindasDoses } from "@/components/missao-doses/BoasVindasDoses";
import { ComemoracaoDoDia } from "@/components/missao-doses/PassoDoDia";
import { ConviteDoDia } from "@/components/missao-doses/ConviteDoDia";
import { somarDias } from "@/lib/sequencia";
import { localDayKey } from "@/lib/utils";
import type { EstadoMissaoDoses } from "@/lib/missao-doses";
import "@/components/missao-doses/missao-doses.css";

/**
 * /dev/missao-1-por-dia — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de
 * `import.meta.env.DEV`; some do build). As telas do braço A da 1.0.16 ("uma dose por dia",
 * metadata `missao_1_por_dia`) sem conta nem loja, pra fotografar em tamanho de celular:
 *   ?cena=boas | festa1 | convite2 | festa2 | convite3 | festa3
 *   &braco=B  · a comemoração do braço B (as 3 doses no dia 1, com a passagem pra próxima) — só nas cenas festaN
 * 1.0.18 (chave `dias23`): ?cena=d23-dia1 | d23-dia1-sem | d23-dia2 | d23-dia2-sem | d23-linha | d23-dia3 — liga a força
 * de QA `?dia1-cheio=a` + `?dias23=on` NESTE navegador e monta uma conta de mentira em memória (Finanças com renda e
 * 1 conta fixa nas cenas com número; vazia nas "-sem").
 * 29/10 (A/B do resumo, lib/construiu-ab): ?cena=construiu&caso=ativa|pouca|abrir&construiu=a|b — o resumo dos 3 dias
 * nos 3 casos (ativa: 4 dias seguidos, 3 doses, 8 figurinhas; pouca: 1 dose, sem sequência/figurinha, aberta no dia 3;
 * abrir: dia 3 com 2 dias seguidos e a dose 3 por fazer). O `?construiu=` grava a força de QA deste navegador.
 * O estado da missão é montado aqui, em memória (nada é gravado no aparelho).
 */
const HOJE = localDayKey();
const missaoNoDia = (dia: 1 | 2 | 3, feitas: number, braco: "A" | "B" = "A"): EstadoMissaoDoses => {
  const inicio = somarDias(HOJE, -(dia - 1));
  const feitos: EstadoMissaoDoses["feitos"] = {};
  if (feitas >= 1) feitos[1] = { dia: inicio, rotulo: "Café · R$ 12" };
  if (feitas >= 2) feitos[2] = { dia: somarDias(inicio, 1), rotulo: "Beber água ao acordar" };
  if (feitas >= 3) feitos[3] = { dia: somarDias(inicio, 2), rotulo: "1 copo" };
  return { v: 1, inicio, modulos: ["financas", "rotina", "saude"], feitos, boasVindas: true, braco, lembrete: "20h" };
};
const nada = () => {};

function HomeDeFundo({ titulo }: { titulo: string }) {
  return (
    <div className="min-h-dvh bg-background text-foreground px-4" style={{ paddingTop: "calc(var(--app-safe-top) + 16px)" }}>
      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{titulo}</p>
      <h1 className="text-[24px] font-black tracking-tight mt-1">Boa tarde</h1>
      <div className="mt-5 space-y-4">
        <div className="rounded-2xl border border-border/50 bg-card h-40" />
        <div className="rounded-2xl border border-border/50 bg-card h-28" />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/50 bg-card h-24" />
          <div className="rounded-2xl border border-border/50 bg-card h-24" />
        </div>
      </div>
    </div>
  );
}

/** Uma conta em memória (nada vai pro servidor) pras cenas da 1.0.18. */
function ContaDeMentira({ dados, children }: { dados: Record<string, unknown>; children: ReactNode }) {
  const [d, setD] = useState(dados);
  const get = useCallback(<T,>(k: string, f: T): T => (k in d ? (d[k] as T) : f), [d]);
  const valor = useMemo(() => ({ get, set: (k: string, v: unknown) => setD((x) => ({ ...x, [k]: v })), loaded: true, isGuest: false, fetchKey: async () => null }), [get]);
  return <UserDataContext.Provider value={valor as never}>{children}</UserDataContext.Provider>;
}
const FINANCAS = { "finance-incomes": [{ id: 1, name: "Salário", value: 3200 }], "finance-fixed-expenses": [{ id: 2, name: "Aluguel", value: 1300 }], "finance-expenses": [{ id: 3, name: "Café", value: 12, date: HOJE }] };

function CenaDias23({ cena, p23 }: { cena: string; p23?: string | null }) {
  useState(() => { guardarForcaDia1Cheio("?dia1-cheio=a"); guardarForcaDias23("?dias23=on"); return 0; });
  const sem = cena.endsWith("-sem");
  const dados = sem ? {} : FINANCAS;
  if (cena.startsWith("d23-dia1")) {
    const m = { ...missaoNoDia(1, 1), lembrete: undefined, feitos: { 1: { dia: HOJE, rotulo: sem ? "Treino A" : "Pode gastar R$ 61 por dia" } } };
    return <ContaDeMentira dados={dados}><HomeDeFundo titulo="Dia 1 · fim do dia" /><PlanoDeAmanhaA missao={m} aoCombinar={nada} aoSemLembrete={nada} /></ContaDeMentira>;
  }
  if (cena.startsWith("d23-dia2")) {
    const m = missaoNoDia(2, 1);
    m.feitos[1] = { dia: somarDias(HOJE, -1), rotulo: sem ? "Treino A" : "Pode gastar R$ 61 por dia" };
    if (sem) m.modulos = ["treino", "saude", "financas"];
    const porDia = sem ? null : porDiaDasFinancas(<T,>(k: string, f: T): T => (k in FINANCAS ? (FINANCAS as Record<string, unknown>)[k] as T : f));
    return <><HomeDeFundo titulo="Dia 2 · abriu o app" /><EscolhaDoDia2 missao={m} opcoes={sem ? ["dieta", "beleza", "casa"] : ["casa", "beleza", "estudos"]} porDia={porDia} aoComecar={nada} aoAgoraNao={nada} /></>;
  }
  if (cena === "d23-linha") {
    return (
      <div className="min-h-dvh bg-background text-foreground px-4" style={{ paddingTop: "calc(var(--app-safe-top) + 16px)" }}>
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Dia 2 · depois do "Agora não"</p>
        <h1 className="text-[24px] font-black tracking-tight mt-1">Bom dia</h1>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mt-6 mb-2">Pendências de hoje</p>
        <LinhaDoseDeHoje dose={{ n: 2, modulo: "rotina", diaCal: 2, escolher: true }} />
      </div>
    );
  }
  // d23-dia3: abriu no dia 3 com 2 doses (Finanças + Beleza pela intro) — o resumo ao abrir
  const m = { ...missaoNoDia(3, 1), modulos: ["financas", "beleza", "rotina"] as EstadoMissaoDoses["modulos"], scoreNoInicio: 14 };
  m.feitos = { 1: { dia: somarDias(HOJE, -2), rotulo: "Pode gastar R$ 61 por dia" }, 2: { dia: somarDias(HOJE, -1), rotulo: ROTULO_DOSE_PELA_INTRO } };
  const usou = p23 === "faltou" ? [somarDias(HOJE, -2)] : [somarDias(HOJE, -2), somarDias(HOJE, -1), HOJE];
  if (p23 === "faltou") delete m.feitos[2];
  return <ContaDeMentira dados={{ ...FINANCAS, "core-dias-anotados": usou }}><ConstruiuEm3Dias missao={m} aoAbrir aoContinuar={nada} /></ContaDeMentira>;
}

/** 29/10: o resumo dos 3 dias nos 3 casos do A/B (os dados de mentira são os do teste construiu-ab) */
function CenaConstruiu({ caso }: { caso: string }) {
  useState(() => { guardarForcaConstruiu(); return 0; });
  const d = (n: number) => somarDias(HOJE, n);
  const base = (inicio: string): EstadoMissaoDoses => ({ v: 1, inicio, modulos: ["financas", "rotina", "saude"], feitos: {}, boasVindas: true, braco: "A", lembrete: "20h" });
  let m: EstadoMissaoDoses;
  let dados: Record<string, unknown>;
  let aoAbrir = true;
  if (caso === "pouca") {
    m = { ...base(d(-2)), feitos: { 1: { dia: d(-2), rotulo: "Pode gastar R$ 61 por dia" } } };
    dados = { ...FINANCAS, "finance-expenses": [] };
  } else if (caso === "abrir") {
    m = { ...base(d(-2)), feitos: { 1: { dia: d(-2), rotulo: "Pode gastar R$ 61 por dia" }, 2: { dia: d(-1), rotulo: "Beber água ao acordar" } } };
    dados = { ...FINANCAS, "finance-expenses": [], "core-dias-anotados": [d(-2), d(-1)], "conquistas-desbloqueadas": { "sequencia-1": d(-2), "first-income": d(-2), "sequencia-2": d(-1), "rotina-1": d(-1), "habito-criado": d(-1) } };
  } else {
    aoAbrir = false;
    m = { ...base(d(-3)), feitos: { 1: { dia: d(-3), rotulo: "Pode gastar R$ 61 por dia" }, 2: { dia: d(-2), rotulo: "Beber água ao acordar" }, 3: { dia: HOJE, rotulo: "1 copo d'água · meta 8" } } };
    dados = {
      ...FINANCAS, "core-user-name": "João Victor", "core-dias-anotados": [d(-3), d(-2), d(-1), HOJE],
      "conquistas-desbloqueadas": { "sequencia-1": d(-3), "first-expense": d(-3), "first-income": d(-3), "sequencia-2": d(-2), "rotina-1": d(-2), "habito-criado": d(-2), "sequencia-3": d(-1), "agua-1": HOJE },
    };
  }
  return <ContaDeMentira dados={dados}><HomeDeFundo titulo="Home" /><ConstruiuEm3Dias missao={m} aoAbrir={aoAbrir} braco={bracoConstruiu(null)} aoContinuar={nada} aoFazerDose={aoAbrir ? nada : undefined} /></ContaDeMentira>;
}

export default function DevMissao1PorDia() {
  const [p] = useSearchParams();
  const cena = p.get("cena") ?? "festa1";
  if (cena === "construiu") return <CenaConstruiu caso={p.get("caso") ?? "ativa"} />;
  if (cena.startsWith("d23-")) return <CenaDias23 cena={cena} p23={p.get("caso")} />;
  if (cena === "boas") {
    const m = { ...missaoNoDia(1, 0), boasVindas: false };
    return <><HomeDeFundo titulo="Dia 1" /><BoasVindasDoses missao={m} nome="" areaNome="Dinheiro" hoje={HOJE} braco="A" aoComecar={nada} aoExplorar={nada} /></>;
  }
  if (cena === "convite2" || cena === "convite3") {
    const dia = cena === "convite2" ? 2 : 3;
    return <><HomeDeFundo titulo={`Dia ${dia} · reabriu o app`} /><ConviteDoDia missao={missaoNoDia(dia, dia - 1)} hoje={HOJE} aoIr={nada} aoDepois={nada} /></>;
  }
  const n = cena === "festa3" ? 3 : cena === "festa2" ? 2 : 1;
  const braco = p.get("braco") === "B" ? "B" : "A";
  const m = missaoNoDia(n as 1 | 2 | 3, n - 1, braco);
  const rotulo = n === 1 ? "Café · R$ 12" : n === 2 ? "Beber água ao acordar" : "1 copo";
  return (
    <>
      <HomeDeFundo titulo={braco === "B" ? `Dia 1 · dose ${n} feita` : `Dia ${n} · dose feita`} />
      <ComemoracaoDoDia n={n as 1 | 2 | 3} missao={m} modulo={m.modulos[n - 1]} rotulo={rotulo} hoje={HOJE} braco={braco} aoCombinar={nada} aoAmanhaAgora={nada} aoVerFim={nada} aoBoraProxima={nada} aoAgoraNao={nada} aoFecharDia={nada} aoConhecerMais={nada} />
    </>
  );
}
