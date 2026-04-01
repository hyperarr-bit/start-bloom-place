import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, TrendingUp, Camera } from "lucide-react";
import type { SkinEntry } from "./utils";

const genId = () => crypto.randomUUID();
const getDateKey = () => new Date().toISOString().slice(0, 10);

const skinTypes = ["oleosa", "seca", "normal", "mista", "sensível", "acneica"];
const moods = ["😊", "😐", "😔", "🤩", "😴"];
const skinEmoji: Record<string, string> = { oleosa: "💦", seca: "🏜️", normal: "✨", mista: "🔄", sensível: "🌸", acneica: "🔴" };

export const SkinAnalysis = () => {
  const [entries, setEntries] = usePersistedState<SkinEntry[]>("beauty-skin-diary", []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ skin: "normal", mood: "😊", notes: "", products: "", photoUrl: "" });
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const today = getDateKey();
  const todayEntry = entries.find(e => e.date === today);

  const save = () => {
    setEntries(prev => [{ id: genId(), date: today, ...form }, ...prev]);
    setForm({ skin: "normal", mood: "😊", notes: "", products: "", photoUrl: "" });
    setShowForm(false);
  };

  // Monthly stats
  const thisMonth = today.slice(0, 7);
  const monthEntries = entries.filter(e => e.date.startsWith(thisMonth));
  const skinCounts = monthEntries.reduce<Record<string, number>>((acc, e) => {
    acc[e.skin] = (acc[e.skin] || 0) + 1;
    return acc;
  }, {});
  const topSkin = Object.entries(skinCounts).sort((a, b) => b[1] - a[1])[0];

  const photosEntries = entries.filter(e => e.photoUrl);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Análise de Pele</h3>
          <p className="text-[10px] text-muted-foreground">{entries.length} registros</p>
        </div>
        <div className="flex gap-2">
          {photosEntries.length >= 2 && (
            <Button size="sm" variant="outline" onClick={() => setShowBeforeAfter(!showBeforeAfter)}>
              <Camera className="w-3.5 h-3.5 mr-1" /> Antes & Depois
            </Button>
          )}
          {!todayEntry && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Hoje</Button>}
        </div>
      </div>

      {/* Today done */}
      {todayEntry && (
        <Card className="bg-green-50 dark:bg-green-500/10 border-green-300">
          <CardContent className="p-3">
            <p className="text-xs font-bold text-green-700">✅ Registro de hoje feito!</p>
            <p className="text-[10px] text-green-600">Pele: {skinEmoji[todayEntry.skin]} {todayEntry.skin} | Humor: {todayEntry.mood}</p>
          </CardContent>
        </Card>
      )}

      {/* Monthly insights */}
      {monthEntries.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs font-bold">Resumo do Mês</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(skinCounts).sort((a, b) => b[1] - a[1]).map(([skin, count]) => (
                <div key={skin} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50 text-[10px]">
                  <span>{skinEmoji[skin]}</span>
                  <span className="font-medium">{skin}</span>
                  <span className="text-muted-foreground">×{count}</span>
                </div>
              ))}
            </div>
            {topSkin && <p className="text-[10px] text-muted-foreground mt-2">Tendência: pele predominantemente <span className="font-medium">{topSkin[0]}</span> este mês</p>}
          </CardContent>
        </Card>
      )}

      {/* Before & After carousel */}
      {showBeforeAfter && photosEntries.length >= 2 && (
        <Card>
          <CardContent className="p-3">
            <h4 className="text-xs font-bold mb-2">📸 Evolução</h4>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {photosEntries.slice(0, 10).map(e => (
                <div key={e.id} className="shrink-0 text-center">
                  <img src={e.photoUrl} alt={e.date} className="w-20 h-20 rounded-xl object-cover" />
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </p>
                  <span className="text-xs">{e.mood}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="text-xs font-medium mb-1">Como está sua pele hoje?</p>
              <div className="flex gap-1.5 flex-wrap">
                {skinTypes.map(s => (
                  <button key={s} onClick={() => setForm(p => ({ ...p, skin: s }))}
                    className={`px-2 py-1 rounded-lg text-[10px] border transition-all ${form.skin === s ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                    {skinEmoji[s]} {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Humor</p>
              <div className="flex gap-2">
                {moods.map(m => (
                  <button key={m} onClick={() => setForm(p => ({ ...p, mood: m }))}
                    className={`text-xl p-1 rounded-lg border transition-all ${form.mood === m ? "border-primary bg-primary/10 scale-110" : "border-transparent"}`}>{m}</button>
                ))}
              </div>
            </div>
            <Input value={form.photoUrl} onChange={e => setForm(p => ({ ...p, photoUrl: e.target.value }))} placeholder="📷 URL da foto de hoje (opcional)" className="h-8 text-xs" />
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Observações (irritações, melhorias...)" className="text-xs min-h-[60px]" />
            <Input value={form.products} onChange={e => setForm(p => ({ ...p, products: e.target.value }))} placeholder="Produtos usados hoje" className="h-8 text-xs" />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={save}>Salvar</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <div className="space-y-2">
        {entries.slice(0, 20).map(e => (
          <Card key={e.id}>
            <CardContent className="p-3 flex items-start gap-3">
              {e.photoUrl ? (
                <img src={e.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <span className="text-xl w-10 text-center shrink-0">{skinEmoji[e.skin]}</span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                  <Badge variant="outline" className="text-[9px]">{skinEmoji[e.skin]} {e.skin}</Badge>
                  <span className="text-sm">{e.mood}</span>
                </div>
                {e.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{e.notes}</p>}
                {e.products && <p className="text-[9px] text-muted-foreground/70 mt-0.5">🧴 {e.products}</p>}
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => setEntries(prev => prev.filter(x => x.id !== e.id))}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {entries.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Comece a acompanhar sua pele! 🌟</p>}
    </div>
  );
};
