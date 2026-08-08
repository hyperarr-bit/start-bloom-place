import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { Plus, Trash2, Syringe, AlertTriangle, Pencil, Check, X } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { format, differenceInDays } from "date-fns";

interface HealthRecord {
  id: string;
  petId: string;
  type: "vaccine" | "deworming" | "visit";
  name: string;
  date: string;
  nextDate: string;
}

const typeLabels: Record<string, string> = { vaccine: "Vacina", deworming: "Vermífugo", visit: "Consulta" };

export const PetHealth = () => {
  const { get, set } = useUserData();
  const pets = get<any[]>("pet-list", []);
  const records = get<HealthRecord[]>("pet-health", []);
  const [petId, setPetId] = useState("");
  const [type, setType] = useState<"vaccine" | "deworming" | "visit">("vaccine");
  const [name, setName] = useState("");
  const [date, setDate] = useState(localDayKey());
  const [nextDate, setNextDate] = useState("");

  const addRecord = () => {
    if (!name.trim()) return;
    const updated = [...records, { id: Date.now().toString(), petId, type, name: name.trim(), date, nextDate }];
    set("pet-health", updated);
    setName(""); setNextDate("");
  };

  const removeRecord = (id: string) => set("pet-health", records.filter(r => r.id !== id));

  /* Edição na própria linha (padrão do IncomeTable). Errar a data da próxima
     vacina obrigava a apagar e refazer o registro — e o alerta de vencimento
     sumia junto. O petId NÃO entra no rascunho de propósito: o vínculo com o
     pet é o que amarra o histórico, quem errou de pet apaga e lança de novo. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<{ type: "vaccine" | "deworming" | "visit"; name: string; date: string; nextDate: string }>({ type: "vaccine", name: "", date: "", nextDate: "" });

  const comecarEdicao = (r: HealthRecord) => {
    setEditandoId(r.id);
    setRascunho({ type: r.type, name: r.name, date: r.date, nextDate: r.nextDate || "" });
  };

  const salvarEdicao = () => {
    const nome = rascunho.name.trim();
    if (!nome) return;
    set("pet-health", records.map(r => r.id !== editandoId ? r : {
      ...r, // mantém id e petId
      type: rascunho.type,
      name: nome,
      date: rascunho.date || r.date,
      nextDate: rascunho.nextDate,
    }));
    setEditandoId(null);
  };

  const alerts = records.filter(r => {
    if (!r.nextDate) return false;
    const days = differenceInDays(new Date(r.nextDate), new Date());
    return days <= 14 && days >= 0;
  });

  return (
    <div className="mt-3 space-y-3">
      {alerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Próximos vencimentos
          </p>
          {alerts.map(a => {
            const pet = pets.find((p: any) => p.id === a.petId);
            const days = differenceInDays(new Date(a.nextDate), new Date());
            return (
              <p key={a.id} className="text-[10px] text-amber-300">
                {pet?.name || "Pet"} — {a.name}: {days === 0 ? "Hoje!" : `em ${days} dias`}
              </p>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-green-200 dark:bg-green-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Syringe className="w-3.5 h-3.5 text-green-700 dark:text-green-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-green-800 dark:text-green-200">Saúde</span>
          </div>
          <span className="text-[10px] text-green-600 dark:text-green-300">{records.length}</span>
        </div>

        <div className="bg-green-50/50 dark:bg-green-950/20 p-2 space-y-1.5">
          {/* A tabela de 5 colunas saiu (mesmo motivo dos Gastos): lápis e
              lixeira de 36px não cabem ao lado de 5 colunas num celular. */}
          {/* cópia antes do sort: `records` vem do store do useUserData e
              .sort() ordena NO LUGAR — ordenar em render mexia no dado guardado */}
          {[...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(r => {
            const pet = pets.find((p: any) => p.id === r.petId);

            if (editandoId === r.id) {
              return (
                <div key={r.id} className="border border-primary/40 bg-background/70 rounded-lg p-2 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground">Editando · {pet?.name || "sem pet"}</p>
                  <select value={rascunho.type} onChange={e => setRascunho({ ...rascunho, type: e.target.value as any })} className="h-9 w-full text-[11px] bg-background border border-input rounded-md px-2">
                    <option value="vaccine">Vacina</option>
                    <option value="deworming">Vermífugo</option>
                    <option value="visit">Consulta</option>
                  </select>
                  <Input autoFocus placeholder="Nome (ex: V8, Antirrábica)" value={rascunho.name} onChange={e => setRascunho({ ...rascunho, name: e.target.value })} className="h-9 text-[11px]" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <CampoData rotulo="Data" value={rascunho.date} onChange={e => setRascunho({ ...rascunho, date: e.target.value })} className="h-9 text-[11px]" />
                    <CampoData rotulo="Próxima" value={rascunho.nextDate} onChange={e => setRascunho({ ...rascunho, nextDate: e.target.value })} className="h-9 text-[11px]" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={salvarEdicao} className="h-9 flex-1 rounded-md bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                      <Check className="w-3.5 h-3.5" /> Salvar
                    </button>
                    <button onClick={() => setEditandoId(null)} className="h-9 px-3 rounded-md border border-border text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={r.id} className="flex items-center gap-0.5 bg-background/60 rounded-lg px-2 py-1">
                {/* toque no texto abre a edição; os ícones ficam SEMPRE visíveis
                    (o hover de antes não existe em tela de celular) */}
                <button onClick={() => comecarEdicao(r)} aria-label={`Editar ${r.name}`} className="flex items-center gap-2 flex-1 min-w-0 text-left min-h-9">
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium truncate">{r.name}</span>
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {[pet?.name, typeLabels[r.type], format(new Date(r.date), "dd/MM")].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {/* a próxima data é o que a pessoa vem conferir aqui — fica
                      com rótulo próprio em vez de virar mais um "dd/MM" solto */}
                  <span className="text-[10px] text-right shrink-0 leading-tight">
                    <span className="block text-[9px] uppercase text-muted-foreground">Próxima</span>
                    <span className="block font-medium">{r.nextDate ? format(new Date(r.nextDate), "dd/MM") : "—"}</span>
                  </span>
                </button>
                <button onClick={() => comecarEdicao(r)} aria-label={`Editar ${r.name}`} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
                <button onClick={() => removeRecord(r.id)} aria-label={`Apagar ${r.name}`} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {records.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum registro ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <select value={petId} onChange={e => setPetId(e.target.value)} className="h-7 text-[11px] bg-background border border-input rounded-md px-2">
                {/* disabled hidden: sem isso o placeholder vira uma OPÇÃO
                    clicável no select nativo do Android e a pessoa vê um pet
                    fantasma chamado "Pet" no meio dos dela (relato 08/08). */}
                <option value="" disabled hidden>Selecione o pet</option>
                {pets.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={type} onChange={e => setType(e.target.value as any)} className="h-7 text-[11px] bg-background border border-input rounded-md px-2">
                <option value="vaccine">Vacina</option>
                <option value="deworming">Vermífugo</option>
                <option value="visit">Consulta</option>
              </select>
            </div>
            <Input placeholder="Nome (ex: V8, Antirrábica)" value={name} onChange={e => setName(e.target.value)} className="h-7 text-[11px]" />
            {/* rótulos trocados até aqui: o 1º campo é a data DO registro e
                aparecia como "Próxima"; o 2º (a próxima de verdade) não tinha
                rótulo nenhum e o navegador só mostrava dd/mm/aaaa */}
            <div className="grid grid-cols-2 gap-1.5">
              <CampoData rotulo="Data" value={date} onChange={e => setDate(e.target.value)} className="h-7 text-[11px]" />
              <CampoData rotulo="Próxima" value={nextDate} onChange={e => setNextDate(e.target.value)} className="h-7 text-[11px]" />
            </div>
            <button onClick={addRecord} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Adicionar registro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
