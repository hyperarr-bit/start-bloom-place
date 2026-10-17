import { useSearchParams } from "react-router-dom";
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

export default function DevMissao1PorDia() {
  const [p] = useSearchParams();
  const cena = p.get("cena") ?? "festa1";
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
