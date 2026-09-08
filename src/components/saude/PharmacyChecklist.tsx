import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Check, Package } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { isNativeShell } from "@/lib/native-shell";
import { pedirPermissao, temPermissao } from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs } from "@/lib/prefs-notificacoes";
import { reagendarTudo, type Leitor } from "@/lib/reagendar";
import { trackEvent } from "@/lib/analytics";

interface Supplement {
  id: string;
  name: string;
  time: string;
  stock: number;
  dosesPerDay: number;
}

const todayStr = () => localDayKey(); // dia LOCAL — toISOString virava amanhã depois das 21h (fix 16/07)

const nameColors = [
  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
];

export const PharmacyChecklist = () => {
  const today = todayStr();
  const { get } = useUserData();
  const [supplements, setSupplements] = usePersistedState<Supplement[]>("core-saude-supplements", []);
  const [supplementLog, setSupplementLog] = usePersistedState<Record<string, string[]>>("core-saude-supplement-log", {});
  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("08:00");
  const takenToday = supplementLog[today] || [];

  const toggleTaken = (id: string) => {
    const alreadyTaken = takenToday.includes(id);
    const newTaken = alreadyTaken ? takenToday.filter(x => x !== id) : [...takenToday, id];
    setSupplementLog(prev => ({ ...prev, [today]: newTaken }));
    if (!alreadyTaken) {
      setSupplements(prev => prev.map(s => s.id === id ? { ...s, stock: Math.max(0, s.stock - 1) } : s));
    } else {
      setSupplements(prev => prev.map(s => s.id === id ? { ...s, stock: s.stock + 1 } : s));
    }
  };

  /* Notificação na hora do remédio (07/09, avaliação da Play: "adicionem
     notificação pra tomar remédio"). A permissão do Android é pedida AQUI, no
     cadastro — o momento em que a pessoa acabou de dizer "me lembra às 8h" —
     e não na abertura do app: no Android 13+ a recusa é definitiva, então a
     única chance é gasta quando faz sentido (mesma regra do PedirLembreteRotina).
     Se já foi negada, pedirPermissao devolve false sem incomodar.

     O useLembretes reagenda sozinho a cada mudança de dado, mas ele roda no
     render seguinte — ANTES da permissão chegar no primeiro cadastro. Por isso
     o reagendamento explícito aqui, com um leitor que já enxerga a lista nova
     (o `get` deste render ainda tem a lista antiga). */
  const rearmarLembretes = async (lista: Supplement[], pedir: boolean) => {
    if (!isNativeShell()) return;
    if (pedir) {
      const ok = await pedirPermissao();
      trackEvent("lembrete_remedio_permissao", { concedida: ok, total: lista.length });
      if (!ok) return;
    } else if (!(await temPermissao())) return;
    const leitor: Leitor = (k, fb) => (k === "core-saude-supplements" ? (lista as unknown as typeof fb) : get(k, fb));
    try { await reagendarTudo(leitor, lerPrefs(get<unknown>(CHAVE_PREFS, undefined))); } catch { /* sem plugin */ }
  };

  const addSupplement = () => {
    if (!newName.trim()) return;
    const lista = [...supplements, { id: Date.now().toString(), name: newName.trim(), time: newTime, stock: 30, dosesPerDay: 1 }];
    setSupplements(lista);
    setNewName("");
    void rearmarLembretes(lista, true);
  };

  const removeSupplement = (id: string) => {
    const lista = supplements.filter(s => s.id !== id);
    setSupplements(lista);
    void rearmarLembretes(lista, false); // cancela o aviso do que foi apagado
  };

  /** Horário editável na própria linha — antes era só texto, e mudar de 8h
   *  pra 20h exigia apagar e recadastrar (perdendo o estoque). */
  const changeTime = (id: string, time: string) => {
    if (!time) return;
    const lista = supplements.map(s => s.id === id ? { ...s, time } : s);
    setSupplements(lista);
    void rearmarLembretes(lista, false);
  };

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-card">
      {/* Colored header band */}
      <div className="bg-amber-100 dark:bg-amber-900/30 px-5 py-4 flex items-center justify-between">
        <h3 className="text-base font-black uppercase tracking-wide text-foreground">Vitaminas e Remédios</h3>
        <span className="text-3xl">💊</span>
      </div>

      {/* Table */}
      {supplements.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="w-10 px-3 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Horário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Estoque</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {supplements.map((s, idx) => {
                  const taken = takenToday.includes(s.id);
                  const lowStock = s.stock <= 5;
                  const color = nameColors[idx % nameColors.length];
                  return (
                    <motion.tr
                      key={s.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`border-t border-border/50 transition-colors ${taken ? "bg-[hsl(var(--saude-green)/0.05)]" : "hover:bg-muted/30"}`}
                    >
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleTaken(s.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${taken ? "bg-[hsl(var(--saude-green))] border-[hsl(var(--saude-green))]" : "border-muted-foreground/30 hover:border-[hsl(var(--saude-green)/0.5)]"}`}
                        >
                          {taken && <Check className="w-3 h-3 text-white" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${taken ? "line-through opacity-60" : ""} ${color}`}>
                          {s.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <input
                          type="time"
                          value={s.time}
                          aria-label={`Horário de ${s.name}`}
                          onChange={e => changeTime(s.id, e.target.value)}
                          className="bg-transparent text-xs text-muted-foreground min-w-[5.5rem] w-auto focus:outline-none focus:text-foreground"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {lowStock ? (
                          <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--saude-yellow))] font-semibold">
                            <Package className="w-3 h-3" /> {s.stock}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{s.stock}</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <button onClick={() => removeSupplement(s.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {/* Empty rows for visual padding */}
              {supplements.length < 4 && Array.from({ length: 4 - supplements.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-t border-border/50">
                  <td className="px-3 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-2 py-3" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhum suplemento e remédio cadastrado</p>
        </div>
      )}

      {/* Add form */}
      <div className="px-4 pb-4 pt-2 flex gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addSupplement()}
          placeholder="Novo suplemento..."
          className="text-xs h-9 flex-1"
        />
        <Input
          type="time"
          value={newTime}
          onChange={e => setNewTime(e.target.value)}
          className="text-xs h-9 w-24"
        />
        <button
          onClick={addSupplement}
          className="h-9 w-9 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
