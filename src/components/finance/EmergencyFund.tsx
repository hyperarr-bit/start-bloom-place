import { useState } from "react";
import { ShieldCheck, Pencil, Check, X, PiggyBank } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePersistedState } from "@/hooks/use-persisted-state";

/**
 * RESERVA DE EMERGÊNCIA — o lugar que não existia (08/08).
 *
 * Pergunta de usuária real: "como eu coloco a reserva de emergência? quero
 * registrar mas não acho onde fica". Ela não achou porque não existia: o app
 * só DERIVAVA um número (despesas × 6) e assumia que TODO investimento
 * cadastrado era reserva — enterrado numa linha do score, na 9ª aba de uma
 * barra rolável. Quem investe em ação ou cripto via aquilo contado como
 * reserva sem nunca ter dito isso.
 *
 * Aqui ela DECLARA: quantos meses quer de colchão e quanto já tem guardado.
 * Enquanto não declarar, o app segue estimando como antes — nada muda pra
 * quem não usar.
 *
 * A meta continua saindo da despesa mensal real (não de um valor digitado):
 * reserva é "quantos meses eu aguento", e a despesa muda sozinha ao longo do
 * ano. Só o número de meses e o guardado são escolha da pessoa.
 */
export type ReservaEmergencia = {
  meses: number;
  guardado: number;
  registrada: boolean;
};

export const CHAVE_RESERVA = "finance-emergency-fund";
export const RESERVA_PADRAO: ReservaEmergencia = { meses: 6, guardado: 0, registrada: false };

/** Meta em reais = despesa mensal real × meses escolhidos. */
export const metaDaReserva = (despesaMensal: number, meses: number) =>
  despesaMensal > 0 ? despesaMensal * meses : 0;

export const useReservaEmergencia = () => {
  const [reserva, setReserva] = usePersistedState<ReservaEmergencia>(CHAVE_RESERVA, RESERVA_PADRAO);
  // Dado vindo do servidor pode estar incompleto (versão antiga do objeto).
  const segura: ReservaEmergencia = {
    meses: Number(reserva?.meses) > 0 ? Number(reserva.meses) : 6,
    guardado: Number(reserva?.guardado) || 0,
    registrada: !!reserva?.registrada,
  };
  return [segura, setReserva] as const;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const EmergencyFund = ({ despesaMensal }: { despesaMensal: number }) => {
  const [reserva, setReserva] = useReservaEmergencia();
  const [editando, setEditando] = useState(false);
  const [rascunhoMeses, setRascunhoMeses] = useState(String(reserva.meses));
  const [rascunhoGuardado, setRascunhoGuardado] = useState(String(reserva.guardado || ""));

  const meta = metaDaReserva(despesaMensal, reserva.meses);
  const pct = meta > 0 ? Math.min(100, Math.round((reserva.guardado / meta) * 100)) : 0;
  const faltam = Math.max(0, meta - reserva.guardado);

  const abrirEdicao = () => {
    setRascunhoMeses(String(reserva.meses));
    setRascunhoGuardado(reserva.guardado ? String(reserva.guardado) : "");
    setEditando(true);
  };

  const salvar = () => {
    const meses = Math.min(24, Math.max(1, parseInt(rascunhoMeses, 10) || 6));
    // Campo vazio = zero guardado, e ainda assim conta como REGISTRADA: dizer
    // "minha meta é 6 meses e hoje tenho nada" é uma declaração legítima.
    const guardado = Math.max(0, parseFloat(rascunhoGuardado.replace(",", ".")) || 0);
    setReserva({ meses, guardado, registrada: true });
    setEditando(false);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-emerald-200 dark:bg-emerald-900/60 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
            Reserva de emergência
          </span>
        </div>
        {!editando && (
          <button
            onClick={abrirEdicao}
            aria-label="Editar reserva de emergência"
            className="w-9 h-9 -mr-2 flex items-center justify-center text-emerald-700 dark:text-emerald-300"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-2">
        {editando ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Quantos meses</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={24}
                  value={rascunhoMeses}
                  onChange={(e) => setRascunhoMeses(e.target.value)}
                  className="h-9 text-sm mt-0.5"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Já guardei (R$)</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={rascunhoGuardado}
                  onChange={(e) => setRascunhoGuardado(e.target.value)}
                  className="h-9 text-sm mt-0.5"
                />
              </label>
            </div>
            <p className="text-[10.5px] text-muted-foreground leading-snug">
              A meta é calculada com a sua despesa mensal de verdade
              {despesaMensal > 0 ? ` (${brl(despesaMensal)}/mês)` : ""} — se ela mudar, a meta acompanha.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={salvar}
                className="h-9 flex-1 rounded-md bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Salvar
              </button>
              <button
                onClick={() => setEditando(false)}
                className="h-9 px-3 rounded-md border border-border text-[11px] font-bold text-muted-foreground flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            </div>
          </div>
        ) : !reserva.registrada ? (
          <button onClick={abrirEdicao} className="w-full text-left flex items-center gap-2.5 py-1">
            <PiggyBank className="w-8 h-8 text-emerald-600/70 shrink-0" />
            <span className="min-w-0">
              <span className="block text-xs font-bold">Registre sua reserva</span>
              <span className="block text-[11px] text-muted-foreground leading-snug">
                Diga quantos meses quer de colchão e quanto já tem guardado — o resto o app calcula.
              </span>
            </span>
          </button>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-bold tabular-nums">{brl(reserva.guardado)}</span>
              <span className="text-[11px] text-muted-foreground">
                de {meta > 0 ? brl(meta) : "—"} · {reserva.meses} {reserva.meses === 1 ? "mês" : "meses"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {meta <= 0
                ? "Lance suas despesas do mês pra eu calcular quanto você precisa guardar."
                : faltam > 0
                  ? `${pct}% do caminho — faltam ${brl(faltam)}.`
                  : "Reserva completa. Esse é o colchão que segura o susto. 🎉"}
            </p>
          </>
        )}
      </div>
    </div>
  );
};
