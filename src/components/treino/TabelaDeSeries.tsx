/**
 * SÉRIE | CARGA | REPS | FEITO (26/09, mockup p1). Uma linha por série; os
 * números vêm da ÚLTIMA VEZ, em cinza até a pessoa confirmar ou mexer. A linha
 * ativa ganha −/+ (carga no degrau de 2,5 kg — 1 kg abaixo de 20 —, reps de 1
 * em 1) pra ajustar sem abrir teclado; tocar no número deixa digitar (vírgula
 * vale). Marcar FEITO pode ser fora de ordem.
 */
import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { lerNumero } from "@/lib/treino-numeros";
import { ajustarCarga, formatarKg, type SerieDaSessao } from "@/lib/treino-series";
import { Quadradinho, type TomDoDia } from "./planner";

type Campo = "carga" | "reps";

const textoDoValor = (campo: Campo, v: number) => (v > 0 ? (campo === "carga" ? formatarKg(v) : String(v)) : "—");

function Numero({
  campo,
  valor,
  onValor,
  rotulo,
}: {
  campo: Campo;
  valor: number;
  onValor: (v: number) => void;
  rotulo: string;
}) {
  const [digitando, setDigitando] = useState(false);
  const [texto, setTexto] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  // Enter e o blur que vem logo depois não gravam duas vezes; Esc desiste.
  const aberto = useRef(false);
  useEffect(() => {
    if (digitando) ref.current?.select();
  }, [digitando]);
  const fechar = (salvar: boolean) => {
    if (!aberto.current) return;
    aberto.current = false;
    setDigitando(false);
    if (salvar && texto.trim() !== "") onValor(lerNumero(texto));
  };
  if (digitando) {
    return (
      <input
        ref={ref}
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => fechar(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") fechar(true);
          if (e.key === "Escape") fechar(false);
        }}
        inputMode={campo === "carga" ? "decimal" : "numeric"}
        aria-label={rotulo}
        className={cn(
          "h-9 rounded-md border border-border bg-background text-center text-[16px] font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring",
          campo === "carga" ? "w-[3.4em]" : "w-[2.4em]",
        )}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setTexto(valor > 0 ? (campo === "carga" ? formatarKg(valor) : String(valor)) : "");
        aberto.current = true;
        setDigitando(true);
      }}
      aria-label={`${rotulo}: ${textoDoValor(campo, valor)}. Toque pra digitar`}
      className={cn("h-9 text-[16px] font-bold tabular-nums", campo === "carga" ? "min-w-[2.6em]" : "min-w-[1.5em]")}
    >
      {textoDoValor(campo, valor)}
    </button>
  );
}

function Stepper({ campo, valor, onValor, serie }: { campo: Campo; valor: number; onValor: (v: number) => void; serie: number }) {
  const nome = campo === "carga" ? "carga" : "repetições";
  const menos = () => onValor(campo === "carga" ? ajustarCarga(valor, -1) : Math.max(0, valor - 1));
  const mais = () => onValor(campo === "carga" ? ajustarCarga(valor, 1) : valor + 1);
  const botao = "w-9 h-9 shrink-0 rounded-lg border border-border bg-card grid place-items-center active:scale-95 transition-transform";
  return (
    <div className="inline-flex items-center justify-center gap-0.5 min-[400px]:gap-1">
      <button type="button" onClick={menos} aria-label={`Menos ${nome} na série ${serie}`} className={botao}>
        <Minus className="w-3.5 h-3.5" />
      </button>
      <Numero campo={campo} valor={valor} onValor={onValor} rotulo={`${campo === "carga" ? "Carga" : "Reps"} da série ${serie}`} />
      <button type="button" onClick={mais} aria-label={`Mais ${nome} na série ${serie}`} className={botao}>
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function TabelaDeSeries({
  nome,
  series,
  tom,
  ativa,
  onAtivar,
  onAlternar,
  onValor,
}: {
  nome: string;
  series: SerieDaSessao[];
  tom: TomDoDia;
  ativa: number | null;
  onAtivar: (i: number) => void;
  onAlternar: (i: number) => void;
  onValor: (i: number, campo: Campo, v: number) => void;
}) {
  const celula = cn("border-b border-r", tom.linha);
  return (
    <div className={cn("rounded-lg overflow-hidden border", tom.linha)} data-testid={`tabela-${nome}`}>
      <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]">
        <colgroup>
          <col className="w-[12%]" />
          <col className="w-[40%]" />
          <col className="w-[31%]" />
          <col className="w-[17%]" />
        </colgroup>
        <thead>
          <tr className={cn(tom.claro, tom.titulo, "text-[10.5px] font-extrabold tracking-[.06em] min-[400px]:tracking-[.12em]")}>
            <th className={cn(celula, "py-2 font-extrabold")}>SÉRIE</th>
            <th className={cn(celula, "py-2 font-extrabold")}>CARGA</th>
            <th className={cn(celula, "py-2 font-extrabold")}>REPS</th>
            <th className={cn("border-b py-2 font-extrabold", tom.linha)}>FEITO</th>
          </tr>
        </thead>
        <tbody className="text-center">
          {series.map((s, i) => {
            const eAtiva = i === ativa;
            const ultima = i === series.length - 1;
            const cinza = !s.feito && !s.ok && !eAtiva;
            // o fundo da linha ativa vai nas CÉLULAS: no escuro a zebra global
            // (tbody tr:nth-child(even) > td) pinta a célula por cima da linha
            const borda = (col: "meio" | "fim") => cn(!ultima && "border-b", col === "meio" && "border-r", tom.linha, eAtiva && "bg-amber-50");
            return (
              <tr
                key={i}
                className={cn(eAtiva ? "h-14" : "h-12", cinza && "text-muted-foreground")}
                data-testid={`serie-${nome}-${i + 1}`}
                data-ativa={eAtiva || undefined}
              >
                <td className={cn(borda("meio"), "font-bold tabular-nums text-foreground")}>{i + 1}</td>
                {eAtiva ? (
                  <>
                    <td className={cn(borda("meio"), "px-0.5")}>
                      <Stepper campo="carga" valor={s.carga} serie={i + 1} onValor={(v) => onValor(i, "carga", v)} />
                    </td>
                    <td className={cn(borda("meio"), "px-0.5")}>
                      <Stepper campo="reps" valor={s.reps} serie={i + 1} onValor={(v) => onValor(i, "reps", v)} />
                    </td>
                  </>
                ) : (
                  <>
                    <td className={cn(borda("meio"), "cursor-pointer")} onClick={() => onAtivar(i)}>
                      <span className={cn("text-[16px] tabular-nums", !cinza && "font-bold")}>{textoDoValor("carga", s.carga)}</span>
                      {s.carga > 0 && <span className="text-muted-foreground text-[11px]"> kg</span>}
                    </td>
                    <td className={cn(borda("meio"), "cursor-pointer")} onClick={() => onAtivar(i)}>
                      <span className={cn("text-[16px] tabular-nums", !cinza && "font-bold")}>{textoDoValor("reps", s.reps)}</span>
                    </td>
                  </>
                )}
                <td className={borda("fim")}>
                  <Quadradinho
                    marcado={s.feito}
                    onClick={() => onAlternar(i)}
                    rotulo={`${s.feito ? "Desmarcar" : "Marcar"} a série ${i + 1} de ${nome}`}
                    className="mx-auto"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
