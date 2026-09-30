/**
 * PESO (29/09) — o número que o vet pergunta em toda consulta e que manda na
 * dose do remédio e do antipulgas. Histórico em `pet-pesos` (chave nova, por
 * pet); o campo `weight` de sempre acompanha o mais novo, pro app antigo.
 */
import { useMemo, useState } from "react";
import { dataSegura } from "@/lib/utils";
import { lerPeso, pesoComUnidade, pesosDoPet, type Pet } from "@/lib/pet";
import { BotaoPet, CartaoPet, campoClasse } from "./kit";
import type { UsePet } from "./use-pet";

const Linha = ({ pontos }: { pontos: { dia: string; kg: number }[] }) => {
  const L = 280, A = 56, M = 6;
  const kgs = pontos.map((p) => p.kg);
  const min = Math.min(...kgs), max = Math.max(...kgs);
  const faixa = max - min || 1;
  const xy = pontos.map((p, i) => [M + (i * (L - 2 * M)) / Math.max(1, pontos.length - 1), A - M - ((p.kg - min) / faixa) * (A - 2 * M)]);
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-14" role="img" aria-label={`Peso de ${pesoComUnidade(kgs[0])} a ${pesoComUnidade(kgs[kgs.length - 1])}`}>
      <polyline points={xy.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="hsl(var(--pet-mel))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === xy.length - 1 ? 4 : 2.5} fill={i === xy.length - 1 ? "hsl(var(--pet-mel))" : "hsl(var(--card))"} stroke="hsl(var(--pet-mel))" strokeWidth="2" />)}
    </svg>
  );
};

export const PesoDoPet = ({ pet, dados }: { pet: Pet; dados: UsePet }) => {
  const { pesosBrutos, registrarPeso, hoje } = dados;
  const serie = useMemo(() => pesosDoPet(pet, pesosBrutos), [pet, pesosBrutos]);
  const [valor, setValor] = useState("");
  const ultimo = serie[serie.length - 1];
  const datados = serie.filter((p) => p.dia);
  // o atual pode ser o `weight` sem data (mudado no app antigo depois da última pesagem): compara com a última pesada
  const anterior = ultimo && !ultimo.dia ? datados[datados.length - 1] : datados.length >= 2 ? datados[datados.length - 2] : undefined;
  const delta = anterior && ultimo ? Math.round((ultimo.kg - anterior.kg) * 1000) / 1000 : null;
  const kg = lerPeso(valor);

  const salvar = () => {
    if (kg === null || kg > 150) return;
    registrarPeso(pet, kg, hoje);
    setValor("");
  };

  return (
    <CartaoPet titulo="Peso" direita={ultimo?.dia ? <span>pesado em {dataSegura(ultimo.dia, "dd/MM")}</span> : undefined} dataCard="PESO">
      <div className="px-3.5 pt-3 pb-3.5">
        {ultimo ? (
          <div className="flex items-end gap-3">
            <p className="text-[30px] font-extrabold tracking-tight leading-none tabular-nums text-foreground">
              {pesoComUnidade(ultimo.kg).split(" ")[0]}<span className="text-[15px] font-bold text-muted-foreground ml-1">{pesoComUnidade(ultimo.kg).split(" ")[1]}</span>
            </p>
            {delta !== null && delta !== 0 && anterior && (
              <p className="text-[12.5px] text-muted-foreground pb-0.5">{delta > 0 ? "+" : "−"}{pesoComUnidade(Math.abs(delta))} desde {dataSegura(anterior.dia, "dd/MM")}</p>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Sem peso ainda. O vet pergunta em toda consulta — e a dose do remédio depende dele.</p>
        )}
        {datados.length >= 2 && <div className="mt-2"><Linha pontos={datados.slice(-10)} /></div>}
        <div className="mt-3 flex gap-2">
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/[^\d.,\sgkGK]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
            placeholder={ultimo ? `Novo peso (ex.: ${pesoComUnidade(ultimo.kg)})` : "Peso (ex.: 12,5 kg ou 65 g)"}
            aria-label="Peso em kg"
            className={`${campoClasse} flex-1 tabular-nums`}
            data-testid="peso-input"
          />
          <BotaoPet onClick={salvar} disabled={kg === null || kg > 150} data-testid="peso-salvar">Pesar hoje</BotaoPet>
        </div>
      </div>
    </CartaoPet>
  );
};
