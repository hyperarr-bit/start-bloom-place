/**
 * PESO (29/09) — o número que o vet pergunta em toda consulta e que manda na
 * dose do remédio e do antipulgas. Histórico em `pet-pesos` (chave nova, por
 * pet); o campo `weight` de sempre acompanha o mais novo, pro app antigo.
 *
 * "Ver as pesagens" (07/11, chamado 18cc19fe): a lista com a lixeira, fechada por
 * padrão pra não crescer o card. Só as datadas: o `weight` sem data não é pesagem
 * e se troca pesando de novo.
 */
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { avisarApagado } from "@/lib/desfazer";
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
  const { pesosBrutos, registrarPeso, apagarPeso, hoje } = dados;
  const serie = useMemo(() => pesosDoPet(pet, pesosBrutos), [pet, pesosBrutos]);
  const [valor, setValor] = useState("");
  const [verPesagens, setVerPesagens] = useState(false);
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
        {datados.length > 0 && (
          <button
            type="button"
            onClick={() => setVerPesagens((v) => !v)}
            aria-expanded={verPesagens}
            className="mt-1 -mb-2 min-h-[44px] text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
            data-testid="peso-ver-pesagens"
          >
            {verPesagens ? "Esconder as pesagens" : `Ver as pesagens (${datados.length})`}
          </button>
        )}
        {verPesagens && datados.length > 0 && (
          <ul className="mt-2 max-h-[264px] overflow-y-auto rounded-xl border border-border bg-card">
            {[...datados].reverse().map((p, idx) => (
              <li key={p.dia} className={`flex items-center gap-3 pl-3 pr-1 ${idx ? "border-t border-border" : ""}`}>
                <span className="flex-1 min-w-0 text-[13px] tabular-nums text-muted-foreground">{dataSegura(p.dia, "dd/MM/yyyy")}</span>
                <span className="text-[13.5px] font-semibold tabular-nums text-foreground">{pesoComUnidade(p.kg)}</span>
                {/* `p-0`: sem ele a regra dos botões só-ícone (index.css) estica a lixeira pra 60 px, e o toque
                    na divisa das linhas de 44 px caía na lixeira da pesagem de baixo */}
                <button
                  type="button"
                  aria-label={`Apagar a pesagem de ${dataSegura(p.dia, "dd/MM/yyyy")}`}
                  onClick={() => avisarApagado(`Pesagem de ${dataSegura(p.dia, "dd/MM")} apagada`, apagarPeso(pet, p.dia))}
                  className="w-11 h-11 p-0 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CartaoPet>
  );
};
