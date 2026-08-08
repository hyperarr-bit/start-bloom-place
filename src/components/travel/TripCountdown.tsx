import { usePersistedState } from "@/hooks/use-persisted-state";
import { parseLocalDay } from "@/lib/utils";
import { TripCountdown as TripCountdownType, genId, daysUntil } from "./types";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { PhotoPicker } from "@/components/ui/PhotoPicker";
import { useState } from "react";

export const TripCountdown = () => {
  const [countdowns, setCountdowns] = usePersistedState<TripCountdownType[]>("travel-countdowns", []);
  const [inlineForm, setInlineForm] = useState({ tripName: "", departureDate: "", photoUrl: "" });

  const add = () => {
    if (!inlineForm.tripName || !inlineForm.departureDate) return;
    setCountdowns(prev => [...prev, { id: genId(), ...inlineForm }]);
    setInlineForm({ tripName: "", departureDate: "", photoUrl: "" });
  };

  const remove = (id: string) => {
    setCountdowns(prev => prev.filter(c => c.id !== id));
    setEditandoId(prev => (prev === id ? null : prev));
  };

  /** Edição inline (padrão da IncomeTable). Data de embarque é justamente o
   *  campo que mais muda — voo remarcado não pode obrigar a refazer a
   *  contagem (e reenviar a foto) do zero. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ tripName: "", departureDate: "", photoUrl: "" });

  const comecarEdicao = (c: TripCountdownType) => {
    setEditandoId(c.id);
    setRascunho({ tripName: c.tripName, departureDate: c.departureDate, photoUrl: c.photoUrl || "" });
  };

  const salvarEdicao = () => {
    if (!rascunho.tripName.trim() || !rascunho.departureDate) return;
    setCountdowns(prev => prev.map(c => c.id !== editandoId ? c : {
      ...c, tripName: rascunho.tripName.trim(), departureDate: rascunho.departureDate, photoUrl: rascunho.photoUrl,
    }));
    setEditandoId(null);
  };

  /** Formulário de edição — mesmo bloco pras viagens futuras e passadas. */
  const formEdicao = (
    <div className="bg-teal-50 dark:bg-teal-950/20 p-3 space-y-2">
      <Input
        autoFocus
        placeholder="Nome da viagem"
        value={rascunho.tripName}
        onChange={e => setRascunho(p => ({ ...p, tripName: e.target.value }))}
        onKeyDown={e => e.key === "Enter" && salvarEdicao()}
        className="h-9 text-xs"
      />
      <CampoData
        rotulo="Data de embarque"
        value={rascunho.departureDate}
        onChange={e => setRascunho(p => ({ ...p, departureDate: e.target.value }))}
        className="h-9 text-xs"
      />
      <PhotoPicker
        value={rascunho.photoUrl || undefined}
        onChange={v => setRascunho(p => ({ ...p, photoUrl: v }))}
        onClear={() => setRascunho(p => ({ ...p, photoUrl: "" }))}
      />
      <div className="flex items-center gap-2">
        <button onClick={salvarEdicao} className="h-9 flex-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> Salvar
        </button>
        <button onClick={() => setEditandoId(null)} className="h-9 px-4 rounded-lg border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );

  const upcoming = countdowns.filter(c => daysUntil(c.departureDate) > 0).sort((a, b) => daysUntil(a.departureDate) - daysUntil(b.departureDate));
  const past = countdowns.filter(c => daysUntil(c.departureDate) <= 0);

  return (
    <div className="space-y-3">
      {/* Upcoming */}
      {upcoming.map(c => {
        const days = daysUntil(c.departureDate);
        const editando = editandoId === c.id;
        return (
          <div key={c.id} className="rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
            {c.photoUrl && !editando && (
              <div className="h-28 bg-cover bg-center" style={{ backgroundImage: `url(${c.photoUrl})` }}>
                <div className="h-full w-full bg-gradient-to-t from-black/80 to-transparent" />
              </div>
            )}
            <div className="bg-teal-200 dark:bg-teal-800/50 px-3 py-1.5 flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider flex-1 min-w-0 truncate">✈️ {c.tripName}</span>
              <span className="text-[10px] font-bold whitespace-nowrap">
                {parseLocalDay(c.departureDate).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
              </span>
              {/* Antes a lixeira só existia DENTRO da foto e escondida atrás
                  de hover: contagem sem foto era impossível de apagar no
                  celular. Agora editar e apagar moram no cabeçalho, sempre. */}
              <button onClick={() => editando ? setEditandoId(null) : comecarEdicao(c)} aria-label={`Editar ${c.tripName}`} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-background/40 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => remove(c.id)} aria-label={`Apagar ${c.tripName}`} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-background/40 transition-colors">
                <Trash2 className="w-3.5 h-3.5 hover:text-destructive" />
              </button>
            </div>
            {editando ? formEdicao : (
              <div className="bg-teal-50 dark:bg-teal-950/20 p-4 flex items-center justify-between">
                <p className="text-xs font-medium">
                  {days === 1 ? "Amanhã! ✈️" : `${days} dias restantes`}
                </p>
                <div className="text-right">
                  <p className="text-3xl font-black">{days}</p>
                  <p className="text-[9px] text-muted-foreground">dias</p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Past trips */}
      {past.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-gray-200 dark:bg-gray-800/50 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">📋 VIAGENS PASSADAS</span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-950/20 divide-y divide-border">
            {past.map(c => editandoId === c.id ? (
              <div key={c.id}>{formEdicao}</div>
            ) : (
              <div key={c.id} className="flex items-center gap-1 px-3 py-1 text-xs opacity-60">
                <span className="flex-1 min-w-0 truncate">{c.tripName}</span>
                {/* parseLocalDay: `new Date("2026-08-10")` parseia como UTC e
                    no Brasil mostrava o DIA ANTERIOR (bug já visto no diário). */}
                <span className="text-muted-foreground whitespace-nowrap">{parseLocalDay(c.departureDate).toLocaleDateString("pt-BR")}</span>
                <button onClick={() => comecarEdicao(c)} aria-label={`Editar ${c.tripName}`} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-background/50 transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
                <button onClick={() => remove(c.id)} aria-label={`Apagar ${c.tripName}`} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-background/50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Countdown card with inline form */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-teal-200 dark:bg-teal-800/50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">⏳ CONTAGENS REGRESSIVAS</span>
        </div>
        <div className="bg-teal-100 dark:bg-teal-900/20 px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="col-span-5">Viagem</span>
          <span className="col-span-4">Data</span>
          <span className="col-span-3 text-right">Ação</span>
        </div>
        <div className="bg-teal-50 dark:bg-teal-950/20">
          {countdowns.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] text-muted-foreground">Nenhuma viagem ainda</p>
            </div>
          )}
          {/* Inline add row */}
          <div className="px-3 py-2 grid grid-cols-12 gap-1 items-center border-t border-dashed border-border/50">
            <div className="col-span-5">
              <Input
                placeholder="Nome da viagem..."
                value={inlineForm.tripName}
                onChange={e => setInlineForm(p => ({ ...p, tripName: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && add()}
                className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="col-span-4 relative">
              <CampoData rotulo="Data"
 value={inlineForm.departureDate}
 onChange={e => setInlineForm(p => ({ ...p, departureDate: e.target.value }))}
 onKeyDown={e => e.key === "Enter" && add()}
 className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30" />
            </div>
            <div className="col-span-3 text-right">
              <button onClick={add} className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">+ Add</button>
            </div>
          </div>
          <div className="px-3 pb-2">
            <PhotoPicker value={inlineForm.photoUrl || undefined} onChange={v => setInlineForm(p => ({ ...p, photoUrl: v }))} onClear={() => setInlineForm(p => ({ ...p, photoUrl: "" }))} />
          </div>
        </div>
      </div>
    </div>
  );
};
