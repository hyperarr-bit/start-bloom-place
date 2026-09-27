import { useRef, useState } from "react";
import { localDayKey } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Check, Package, Pencil } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { CHAVE_DEPENDENTES } from "@/lib/saude-dependentes";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { isNativeShell } from "@/lib/native-shell";
import { pedirPermissao, temPermissao } from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs } from "@/lib/prefs-notificacoes";
import { reagendarTudo, type Leitor } from "@/lib/reagendar";
import { trackEvent } from "@/lib/analytics";
import { avisarApagado } from "@/lib/desfazer";

interface Supplement {
  id: string;
  name: string;
  time: string;
  stock: number;
  dosesPerDay: number;
  /** De quem é o remédio (22/09, mesmo chamado das consultas: "qual medicação
   *  seria meu ou do dependente"). Ausente = seu. Vai no texto do lembrete. */
  quem?: string;
}

const todayStr = () => localDayKey(); // dia LOCAL — toISOString virava amanhã depois das 21h (fix 16/07)

/* ESTOQUE EDITÁVEL (25/09, cliente: "como alterar a quantidade de
 * medicamentos"). Todo remédio nascia com 30 e o número só descia marcando
 * "tomado" — caixa de 60 ou caixa nova não tinha como acertar sem apagar e
 * recadastrar. Agora: "Qtd" no cadastro e toque no número pra corrigir. */
const ESTOQUE_PADRAO = 30;
const soDigitos = (v: string) => v.replace(/\D/g, "").slice(0, 4);
const lerEstoque = (v: string): number | null => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(9999, n) : null;
};

const EstoqueEditavel = ({ nome, valor, baixo, onSalvar }: { nome: string; valor: number; baixo: boolean; onSalvar: (n: number) => void }) => {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const salvar = () => {
    const n = lerEstoque(rascunho);
    if (n !== null && n !== valor) onSalvar(n); // vazio ou inválido não zera nada
    setEditando(false);
  };
  if (editando) {
    return (
      <input
        type="text"
        inputMode="numeric"
        autoFocus
        value={rascunho}
        aria-label={`Estoque de ${nome}`}
        onChange={e => setRascunho(soDigitos(e.target.value))}
        onFocus={e => e.currentTarget.select()}
        onBlur={salvar}
        onKeyDown={e => { if (e.key === "Enter") salvar(); if (e.key === "Escape") setEditando(false); }}
        className="w-14 h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid="estoque-input"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => { setRascunho(String(valor)); setEditando(true); }}
      aria-label={`Alterar estoque de ${nome} (${valor})`}
      title="Toque pra alterar a quantidade"
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -mx-1.5 border border-dashed border-transparent hover:border-border transition-colors ${baixo ? "text-[10px] font-semibold text-[hsl(var(--saude-yellow))]" : "text-xs text-muted-foreground"}`}
      data-testid="estoque-botao"
    >
      {baixo && <Package className="w-3 h-3" />}
      {valor}
      <Pencil className="w-2.5 h-2.5 opacity-40" aria-hidden />
    </button>
  );
};

/* DESMARCAR DEVOLVE SÓ O QUE O MARCAR TIROU (26/09, varredura): com estoque 0,
 * marcar "tomado" não tira nada (não existe estoque negativo), mas desmarcar
 * somava 1 — tomar e destomar por engano criava um comprimido do nada. Quem foi
 * marcado hoje SEM baixa fica anotado nesta chave à parte (só o dia de hoje):
 * o log de "tomado" é lido pelos lembretes e pela Home e não muda de formato. */
export const CHAVE_SEM_BAIXA = "core-saude-supplement-sem-baixa";
type SemBaixa = { dia: string; ids: string[] };

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
  const [newQuem, setNewQuem] = useState("");
  const [newStock, setNewStock] = useState(String(ESTOQUE_PADRAO));
  const [dependentes, setDependentes] = usePersistedState<string[]>(CHAVE_DEPENDENTES, []);
  const [semBaixa, setSemBaixa] = usePersistedState<SemBaixa>(CHAVE_SEM_BAIXA, { dia: "", ids: [] });
  const takenToday = supplementLog[today] || [];
  const semBaixaHoje = semBaixa?.dia === today && Array.isArray(semBaixa.ids) ? semBaixa.ids : [];

  const toggleTaken = (id: string) => {
    const alreadyTaken = takenToday.includes(id);
    const newTaken = alreadyTaken ? takenToday.filter(x => x !== id) : [...takenToday, id];
    setSupplementLog(prev => ({ ...prev, [today]: newTaken }));
    const semEstoque = (supplements.find(s => s.id === id)?.stock ?? 0) <= 0;
    if (!alreadyTaken && semEstoque) {
      setSemBaixa({ dia: today, ids: [...semBaixaHoje.filter(x => x !== id), id] });
    } else if (!alreadyTaken) {
      setSupplements(prev => prev.map(s => s.id === id ? { ...s, stock: Math.max(0, s.stock - 1) } : s));
    } else if (semBaixaHoje.includes(id)) {
      setSemBaixa({ dia: today, ids: semBaixaHoje.filter(x => x !== id) }); // não tirou, não devolve
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
    const quem = newQuem.trim();
    const stock = lerEstoque(newStock) ?? ESTOQUE_PADRAO;
    const lista = [...supplements, { id: Date.now().toString(), name: newName.trim(), time: newTime, stock, dosesPerDay: 1, ...(quem ? { quem } : {}) }];
    setSupplements(lista);
    if (quem && !dependentes.includes(quem)) setDependentes([...dependentes, quem]);
    setNewName("");
    setNewQuem("");
    setNewStock(String(ESTOQUE_PADRAO));
    void rearmarLembretes(lista, true);
  };

  // lista mais recente pro "Desfazer" do toast, que roda segundos depois
  const listaAtual = useRef(supplements);
  listaAtual.current = supplements;

  /* APAGAR COM DESFAZER (26/09, varredura): um toque na lixeira sumia com o
     remédio, o horário e o estoque, sem volta. Agora apaga já e o toast
     oferece desfazer — volta no mesmo lugar e o lembrete é reagendado. */
  const removeSupplement = (id: string) => {
    const pos = supplements.findIndex(s => s.id === id);
    if (pos < 0) return;
    const removido = supplements[pos];
    const lista = supplements.filter(s => s.id !== id);
    setSupplements(lista);
    void rearmarLembretes(lista, false); // cancela o aviso do que foi apagado
    avisarApagado(`${removido.name} apagado`, () => {
      const atual = listaAtual.current;
      if (atual.some(s => s.id === removido.id)) return;
      const volta = [...atual];
      volta.splice(Math.min(pos, volta.length), 0, removido);
      setSupplements(volta);
      void rearmarLembretes(volta, false);
    });
  };

  /** Horário editável na própria linha — antes era só texto, e mudar de 8h
   *  pra 20h exigia apagar e recadastrar (perdendo o estoque). */
  const changeTime = (id: string, time: string) => {
    if (!time) return;
    const lista = supplements.map(s => s.id === id ? { ...s, time } : s);
    setSupplements(lista);
    void rearmarLembretes(lista, false);
  };

  const changeStock = (id: string, stock: number) => {
    setSupplements(prev => prev.map(s => s.id === id ? { ...s, stock } : s));
  };

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-card">
      {/* Colored header band */}
      <div className="bg-amber-100 dark:bg-amber-900/30 px-5 py-4 flex items-center justify-between">
        <h3 className="text-base font-black uppercase tracking-wide text-foreground">Vitaminas e Remédios</h3>
        <span className="text-3xl">💊</span>
      </div>

      {/* Table — LIXEIRA À VISTA (26/09, varredura): a 360 px a tabela passava
          da largura e a lixeira ficava escondida numa rolagem lateral. Colunas
          mais justas cabem no celular; se um nome comprido ainda estourar, a
          coluna da lixeira gruda na direita com o fundo do card. */}
      {supplements.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="w-9 pl-3 pr-1 py-3" />
                <th className="text-left px-2 py-3 text-xs font-semibold text-muted-foreground">Nome</th>
                <th className="text-left px-1 py-3 text-xs font-semibold text-muted-foreground">Horário</th>
                <th className="text-left pl-2 pr-1 py-3 text-xs font-semibold text-muted-foreground">Estoque</th>
                <th className="sticky right-0 bg-card pl-0 pr-1.5 py-3"><span aria-hidden className="absolute inset-0 bg-muted/50" /></th>
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
                      <td className="pl-3 pr-1 py-3">
                        <button
                          onClick={() => toggleTaken(s.id)}
                          aria-label={taken ? `Desmarcar ${s.name}` : `Marcar ${s.name} como tomado`}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${taken ? "bg-[hsl(var(--saude-green))] border-[hsl(var(--saude-green))]" : "border-muted-foreground/30 hover:border-[hsl(var(--saude-green)/0.5)]"}`}
                        >
                          {taken && <Check className="w-3 h-3 text-white" />}
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${taken ? "line-through opacity-60" : ""} ${color}`}>
                          {s.name}
                        </span>
                        {s.quem?.trim() && (
                          <span className="ml-1 inline-block px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" data-testid="remedio-de">
                            👤 {s.quem.trim()}
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-3 text-xs text-muted-foreground">
                        <input
                          type="time"
                          value={s.time}
                          aria-label={`Horário de ${s.name}`}
                          onChange={e => changeTime(s.id, e.target.value)}
                          className="bg-transparent text-xs text-muted-foreground min-w-[5.5rem] w-auto focus:outline-none focus:text-foreground"
                        />
                      </td>
                      <td className="pl-2 pr-1 py-3">
                        <EstoqueEditavel nome={s.name} valor={s.stock} baixo={lowStock} onSalvar={n => changeStock(s.id, n)} />
                      </td>
                      {/* célula grudada precisa de fundo opaco: o do card, com o
                          verde de "tomado" por cima (a zebra do escuro, mais
                          específica, troca este fundo igual troca o das vizinhas) */}
                      <td className={`sticky right-0 pl-0 pr-1.5 py-1 ${taken ? "[background:linear-gradient(hsl(var(--saude-green)/0.05),hsl(var(--saude-green)/0.05)),hsl(var(--card))]" : "bg-card"}`}>
                        <button onClick={() => removeSupplement(s.id)} aria-label={`Apagar ${s.name}`}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-destructive transition-colors">
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
      <div className="px-4 pb-4 pt-2 space-y-2">
        <div className="flex gap-2">
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
        {/* de quem é (22/09): vazio = seu; o nome vai no lembrete ("Hora do Ômega 3 (Mãe)") */}
        <div className="flex gap-2">
          <Input
            value={newQuem}
            onChange={e => setNewQuem(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addSupplement()}
            placeholder="Pra quem? (vazio = você · ex.: Filho, Mãe)"
            className="text-xs h-9 flex-1"
            list="saude-dependentes-remedio"
            aria-label="Pra quem é o remédio"
            data-testid="remedio-quem"
          />
          {/* quantidade da caixa (25/09): vira o estoque inicial; vazio = 30 */}
          <label className="flex items-center gap-1.5 h-9 rounded-md border border-input bg-background px-2.5 text-xs text-muted-foreground flex-shrink-0">
            Qtd
            <input
              type="text"
              inputMode="numeric"
              value={newStock}
              onChange={e => setNewStock(soDigitos(e.target.value))}
              onFocus={e => e.currentTarget.select()}
              onKeyDown={e => e.key === "Enter" && addSupplement()}
              aria-label="Quantidade em estoque"
              data-testid="remedio-qtd"
              className="w-9 bg-transparent text-foreground focus:outline-none"
            />
          </label>
        </div>
        <datalist id="saude-dependentes-remedio">
          {dependentes.map(d => <option key={d} value={d} />)}
        </datalist>
      </div>
    </div>
  );
};
