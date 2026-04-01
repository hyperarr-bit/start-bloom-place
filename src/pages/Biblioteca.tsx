import { useState, useMemo } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, Trash2, Search, Edit2, BookOpen, Link, Loader2, Star, MessageCircle, Calendar, Target, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ModuleTip } from "@/components/ModuleTip";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ──
interface BookQuote {
  id: string;
  text: string;
  page: number;
  tags: string[];
}

interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  status: "lendo" | "lido" | "quero-ler" | "abandonado";
  rating: number;
  genre: string;
  pages: number;
  currentPage: number;
  notes: string;
  startDate: string;
  endDate: string;
  goalDate: string;
  quotes: BookQuote[];
  lentTo: string;
  lentDate: string;
  lentReturnDate: string;
}

const genId = () => crypto.randomUUID();

const TABS = [
  { v: "lendo", l: "Lendo Agora", icon: "📖" },
  { v: "estante", l: "Estante", icon: "📚" },
  { v: "insights", l: "Insights", icon: "💡" },
  { v: "emprestados", l: "Emprestados", icon: "📤" },
  { v: "desafio", l: "Desafio", icon: "🏆" },
];

const bookGenres = ["Ficção", "Não-Ficção", "Fantasia", "Romance", "Sci-Fi", "Terror", "Autoajuda", "Negócios", "Biografia", "Técnico", "HQ/Mangá", "Outro"];

const StarRating = ({ value, onChange, size = "w-4 h-4" }: { value: number; onChange?: (v: number) => void; size?: string }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} className={`${size} cursor-pointer transition-colors ${i <= value ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
        onClick={() => onChange?.(i)} />
    ))}
  </div>
);

// ── URL Import ──
const ImportFromUrl = ({ onImport }: { onImport: (data: { title: string; author: string; cover: string }) => void }) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchMetadata = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('fetch-book-metadata', { body: { url: url.trim() } });
      if (data?.success && data.data) {
        onImport({ title: data.data.title || "", author: data.data.author || "", cover: data.data.cover || "" });
        setUrl("");
      }
    } catch (err) { console.error('Failed to fetch metadata:', err); }
    finally { setLoading(false); }
  };

  return (
    <div className="rounded-lg border-2 border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1">
        <Link className="w-3 h-3" /> IMPORTAR DE URL (AMAZON, GOODREADS...)
      </p>
      <div className="flex gap-1.5">
        <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Cole o link do livro aqui..."
          className="h-8 text-xs flex-1" onKeyDown={e => e.key === "Enter" && fetchMetadata()} />
        <Button size="sm" className="h-8 px-3 bg-orange-500 hover:bg-orange-600 text-white" onClick={fetchMetadata} disabled={loading || !url.trim()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
};

// ── Main Component ──
const Biblioteca = () => {
  const navigate = useNavigate();
  const [books, setBooks] = usePersistedState<Book[]>("lib-books", []);
  const [yearGoal, setYearGoal] = usePersistedState<number>("lib-year-goal", 12);
  const [tab, setTab] = useState("lendo");

  // ── Form State ──
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Book>>({ status: "quero-ler", rating: 0, pages: 0, currentPage: 0, genre: "Ficção", quotes: [], lentTo: "", lentDate: "", lentReturnDate: "", goalDate: "" });

  // ── Quote Form State ──
  const [quoteBookId, setQuoteBookId] = useState<string | null>(null);
  const [quoteText, setQuoteText] = useState("");
  const [quotePage, setQuotePage] = useState("");
  const [quoteTags, setQuoteTags] = useState("");

  // ── Search/Filter ──
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");

  // ── Derived Data ──
  const currentBook = books.find(b => b.status === "lendo");
  const booksRead = books.filter(b => b.status === "lido");
  const currentYear = new Date().getFullYear();
  const booksReadThisYear = booksRead.filter(b => b.endDate?.startsWith(String(currentYear))).length;
  const totalPagesRead = books.reduce((s, b) => s + (b.status === "lido" ? (b.pages || 0) : (b.currentPage || 0)), 0);

  const allQuotes = useMemo(() => {
    const q: (BookQuote & { bookTitle: string; bookAuthor: string })[] = [];
    books.forEach(b => (b.quotes || []).forEach(qt => q.push({ ...qt, bookTitle: b.title, bookAuthor: b.author })));
    return q;
  }, [books]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allQuotes.forEach(q => q.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [allQuotes]);

  const filteredQuotes = filterTag === "all" ? allQuotes : allQuotes.filter(q => q.tags.includes(filterTag));

  const lentBooks = books.filter(b => b.lentTo);

  // ── Book CRUD ──
  const emptyForm = (): Partial<Book> => ({ status: "quero-ler", rating: 0, pages: 0, currentPage: 0, genre: "Ficção", quotes: [], lentTo: "", lentDate: "", lentReturnDate: "", goalDate: "", notes: "", cover: "", author: "", title: "", startDate: "", endDate: "" });

  const openNew = () => { setForm(emptyForm()); setEditId(null); setShowForm(true); };
  const openEdit = (b: Book) => { setForm({ ...b }); setEditId(b.id); setShowForm(true); };

  const save = () => {
    if (!form.title) return;
    if (editId) {
      setBooks(prev => prev.map(b => b.id === editId ? { ...b, ...form, quotes: b.quotes || [] } as Book : b));
    } else {
      setBooks(prev => [...prev, { ...emptyForm(), ...form, id: genId(), quotes: [] } as Book]);
    }
    setShowForm(false); setEditId(null);
  };

  const remove = (id: string) => setBooks(prev => prev.filter(b => b.id !== id));

  const updatePage = (id: string, page: number) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, currentPage: Math.min(b.pages, Math.max(0, page)) } : b));
  };

  const abandonBook = (id: string) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, status: "abandonado" as const } : b));
  };

  const addQuote = (bookId: string) => {
    if (!quoteText.trim()) return;
    const newQuote: BookQuote = {
      id: genId(),
      text: quoteText.trim(),
      page: parseInt(quotePage) || 0,
      tags: quoteTags.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean).map(t => `#${t}`),
    };
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, quotes: [...(b.quotes || []), newQuote] } : b));
    setQuoteText(""); setQuotePage(""); setQuoteTags(""); setQuoteBookId(null);
  };

  const removeQuote = (bookId: string, quoteId: string) => {
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, quotes: (b.quotes || []).filter(q => q.id !== quoteId) } : b));
  };

  // ── Pace Calculator ──
  const calcPace = (book: Book) => {
    if (!book.startDate || book.pages <= 0) return null;
    const daysElapsed = Math.max(1, differenceInDays(new Date(), new Date(book.startDate)));
    const pagesPerDay = book.currentPage / daysElapsed;
    const remaining = book.pages - book.currentPage;
    const estFinish = pagesPerDay > 0 ? addDays(new Date(), Math.ceil(remaining / pagesPerDay)) : null;

    let neededPerDay: number | null = null;
    if (book.goalDate) {
      const daysLeft = Math.max(1, differenceInDays(new Date(book.goalDate), new Date()));
      neededPerDay = Math.ceil(remaining / daysLeft);
    }

    return { pagesPerDay: Math.round(pagesPerDay * 10) / 10, estFinish, neededPerDay, remaining };
  };

  // ── WhatsApp ──
  const sendWhatsApp = (book: Book) => {
    const msg = encodeURIComponent(`E aí, já terminou de ler meu livro "${book.title}"? A biblioteca do CORE tá cobrando a devolução! rs 📚`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  // ── Filtered books for Estante ──
  const filteredBooks = books.filter(b => {
    const matchSearch = b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusGroups = [
    { key: "lendo", label: "📖 LENDO", bg: "bg-blue-200 dark:bg-blue-800/60", body: "bg-blue-50/80 dark:bg-blue-950/20" },
    { key: "quero-ler", label: "📋 QUERO LER", bg: "bg-amber-200 dark:bg-amber-800/60", body: "bg-amber-50/80 dark:bg-amber-950/20" },
    { key: "lido", label: "✅ LIDOS", bg: "bg-green-200 dark:bg-green-800/60", body: "bg-green-50/80 dark:bg-green-950/20" },
    { key: "abandonado", label: "🪦 ABANDONADOS", bg: "bg-gray-200 dark:bg-gray-700/60", body: "bg-gray-50/80 dark:bg-gray-900/20" },
  ];

  // ── Book Form Modal ──
  const BookForm = () => (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-orange-300 dark:bg-orange-700/60 px-4 py-2.5 flex justify-between items-center">
        <span className="text-sm font-black uppercase tracking-wider">📖 {editId ? "EDITAR" : "NOVO"} LIVRO</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
      </div>
      <div className="bg-orange-50/80 dark:bg-orange-950/20 p-4 space-y-3">
        <ImportFromUrl onImport={(data) => setForm(p => ({ ...p, title: data.title || p.title, author: data.author || p.author, cover: data.cover || p.cover }))} />

        {form.cover && (
          <div className="flex justify-center">
            <img src={form.cover} alt="Capa" className="h-28 rounded-lg shadow-md object-cover" />
          </div>
        )}

        <Input placeholder="Título" value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="h-9 text-sm" />
        <Input placeholder="Autor" value={form.author || ""} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} className="h-9 text-sm" />
        <Input placeholder="URL da capa (opcional)" value={form.cover || ""} onChange={e => setForm(p => ({ ...p, cover: e.target.value }))} className="h-9 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <Select value={form.genre || "Ficção"} onValueChange={v => setForm(p => ({ ...p, genre: v }))}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{bookGenres.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.status || "quero-ler"} onValueChange={v => setForm(p => ({ ...p, status: v as Book["status"] }))}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="quero-ler">📋 Quero Ler</SelectItem>
              <SelectItem value="lendo">📖 Lendo</SelectItem>
              <SelectItem value="lido">✅ Lido</SelectItem>
              <SelectItem value="abandonado">🪦 Abandonado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input type="number" placeholder="Total de páginas" value={form.pages || ""} onChange={e => setForm(p => ({ ...p, pages: +e.target.value }))} className="h-9 text-sm" />

        {/* Only show current page for lendo status */}
        {(form.status === "lendo" || form.status === "lido") && (
          <Input type="number" placeholder="Página atual" value={form.currentPage || ""} onChange={e => setForm(p => ({ ...p, currentPage: +e.target.value }))} className="h-9 text-sm" />
        )}

        {/* Only show dates for lendo/lido */}
        {(form.status === "lendo" || form.status === "lido") && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] font-bold text-muted-foreground">INÍCIO</label><Input type="date" value={form.startDate || ""} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="h-9 text-sm" /></div>
            {form.status === "lido" && <div><label className="text-[10px] font-bold text-muted-foreground">FIM</label><Input type="date" value={form.endDate || ""} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className="h-9 text-sm" /></div>}
          </div>
        )}

        {/* Loan fields */}
        <div className="rounded-lg border border-pink-200 dark:border-pink-800 p-2.5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400">📤 EMPRÉSTIMO (OPCIONAL)</p>
          <Input placeholder="Emprestado para..." value={form.lentTo || ""} onChange={e => setForm(p => ({ ...p, lentTo: e.target.value }))} className="h-8 text-xs" />
          {form.lentTo && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[9px] text-muted-foreground">Data empréstimo</label><Input type="date" value={form.lentDate || ""} onChange={e => setForm(p => ({ ...p, lentDate: e.target.value }))} className="h-8 text-xs" /></div>
              <div><label className="text-[9px] text-muted-foreground">Devolução</label><Input type="date" value={form.lentReturnDate || ""} onChange={e => setForm(p => ({ ...p, lentReturnDate: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
          )}
        </div>

        <Textarea placeholder="Anotações..." value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-sm min-h-[60px]" />

        {/* Only show rating for lido status */}
        {form.status === "lido" && (
          <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Nota:</span><StarRating value={form.rating || 0} onChange={v => setForm(p => ({ ...p, rating: v }))} /></div>
        )}

        <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600 text-white" onClick={save}>Salvar Livro</Button>
      </div>
    </div>
  );

  // ── RENDER ──
  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="px-4 pt-6 pb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2"><BookOpen className="w-5 h-5 text-orange-600" /> MINHA BIBLIOTECA</h1>
          <p className="text-xs text-muted-foreground">Sua estante digital inteligente</p>
        </div>
      </div>

      <ModuleTip moduleId="biblioteca" tips={["📚 Adicione livros por link (Amazon, Goodreads) para importar capa e dados automaticamente!", "💡 Salve citações dos seus livros e filtre por tags depois!", "🏆 Defina sua meta anual de leitura na aba Desafio!"]} />

      {/* Stats */}
      <div className="px-4 py-2">
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: "📚", val: books.length, label: "Total" },
            { icon: "📖", val: books.filter(b => b.status === "lendo").length, label: "Lendo" },
            { icon: "✅", val: booksRead.length, label: "Lidos" },
            { icon: "📄", val: totalPagesRead, label: "Páginas" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-2.5 text-center">
              <div className="text-base">{s.icon}</div>
              <div className="text-lg font-black text-foreground">{s.val}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full h-auto flex-wrap gap-0.5 bg-muted/50 p-1 rounded-xl">
            {TABS.map(t => (
              <TabsTrigger key={t.v} value={t.v} className="text-[10px] px-2 py-1.5 rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white font-bold">
                {t.icon} {t.l}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ══════ TAB: LENDO AGORA ══════ */}
          <TabsContent value="lendo" className="space-y-4 mt-4">
            {currentBook ? (
              <>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-orange-300 dark:bg-orange-700/60 px-4 py-2.5">
                    <span className="text-sm font-black uppercase tracking-wider">📖 LENDO AGORA</span>
                  </div>
                  <div className="bg-orange-50/80 dark:bg-orange-950/20 p-4">
                    <div className="flex gap-4">
                      {currentBook.cover ? (
                        <img src={currentBook.cover} alt={currentBook.title} className="w-20 h-28 rounded-lg object-cover shadow-md flex-shrink-0" />
                      ) : (
                        <div className="w-20 h-28 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-base leading-tight">{currentBook.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{currentBook.author}</p>
                        {currentBook.pages > 0 && (
                          <div className="mt-3 space-y-1.5">
                            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, (currentBook.currentPage / currentBook.pages) * 100)}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                              <span>Pág. {currentBook.currentPage}/{currentBook.pages}</span>
                              <span>{Math.round((currentBook.currentPage / currentBook.pages) * 100)}%</span>
                            </div>
                          </div>
                        )}
                        {currentBook.rating > 0 && <div className="mt-2"><StarRating value={currentBook.rating} size="w-3.5 h-3.5" /></div>}
                      </div>
                    </div>

                    {/* Quick page update */}
                    <div className="mt-4 flex gap-2 items-center">
                      <Input
                        type="number"
                        placeholder="Atualizar página..."
                        value={currentBook.currentPage || ""}
                        onChange={e => updatePage(currentBook.id, +e.target.value)}
                        className="h-9 text-sm flex-1"
                        min={0}
                        max={currentBook.pages}
                      />
                      <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => openEdit(currentBook)}>
                        <Edit2 className="w-3 h-3 mr-1" /> Editar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Pace Calculator */}
                {(() => {
                  const pace = calcPace(currentBook);
                  if (!pace) return null;
                  return (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="bg-amber-200 dark:bg-amber-800/60 px-4 py-2.5">
                        <span className="text-sm font-black uppercase tracking-wider">⏱️ CALCULADORA DE RITMO</span>
                      </div>
                      <div className="bg-amber-50/80 dark:bg-amber-950/20 p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-card border border-border p-3 text-center">
                            <div className="text-lg font-black text-amber-600 dark:text-amber-400">{pace.pagesPerDay}</div>
                            <div className="text-[9px] font-bold uppercase text-muted-foreground">págs/dia</div>
                          </div>
                          <div className="rounded-lg bg-card border border-border p-3 text-center">
                            <div className="text-lg font-black text-amber-600 dark:text-amber-400">{pace.remaining}</div>
                            <div className="text-[9px] font-bold uppercase text-muted-foreground">restantes</div>
                          </div>
                        </div>
                        {pace.estFinish && (
                          <div className="rounded-lg bg-card border border-border p-3">
                            <p className="text-xs text-muted-foreground">Nesse ritmo, você termina em:</p>
                            <p className="font-black text-sm text-foreground mt-0.5">
                              📅 {format(pace.estFinish, "dd 'de' MMMM", { locale: ptBR })}
                            </p>
                          </div>
                        )}

                        {/* Goal date */}
                        <div className="rounded-lg border border-dashed border-amber-300 dark:border-amber-700 p-3 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                            <Target className="w-3 h-3" /> DEFINIR META
                          </p>
                          <Input
                            type="date"
                            value={currentBook.goalDate || ""}
                            onChange={e => setBooks(prev => prev.map(b => b.id === currentBook.id ? { ...b, goalDate: e.target.value } : b))}
                            className="h-8 text-xs"
                          />
                          {pace.neededPerDay && (
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                              → Precisa ler <span className="text-base">{pace.neededPerDay}</span> págs/dia
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Add Quote for current book */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-sky-200 dark:bg-sky-800/60 px-4 py-2.5">
                    <span className="text-sm font-black uppercase tracking-wider">💎 ADICIONAR CITAÇÃO</span>
                  </div>
                  <div className="bg-sky-50/80 dark:bg-sky-950/20 p-4 space-y-2">
                    <Textarea
                      placeholder="Uma frase que te marcou..."
                      value={quoteBookId === currentBook.id ? quoteText : ""}
                      onChange={e => { setQuoteBookId(currentBook.id); setQuoteText(e.target.value); }}
                      className="text-sm min-h-[60px]"
                      onFocus={() => setQuoteBookId(currentBook.id)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Página" type="number" value={quoteBookId === currentBook.id ? quotePage : ""} onChange={e => { setQuoteBookId(currentBook.id); setQuotePage(e.target.value); }} className="h-8 text-xs" />
                      <Input placeholder="#tags, separadas, vírgula" value={quoteBookId === currentBook.id ? quoteTags : ""} onChange={e => { setQuoteBookId(currentBook.id); setQuoteTags(e.target.value); }} className="h-8 text-xs" />
                    </div>
                    <Button size="sm" className="w-full bg-sky-500 hover:bg-sky-600 text-white" onClick={() => addQuote(currentBook.id)} disabled={!quoteText.trim()}>
                      <Plus className="w-3 h-3 mr-1" /> Salvar Citação
                    </Button>

                    {/* Show existing quotes */}
                    {(currentBook.quotes || []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">CITAÇÕES DESTE LIVRO</p>
                        {(currentBook.quotes || []).map(q => (
                          <div key={q.id} className="rounded-lg bg-card border border-border p-3 relative">
                            <p className="text-xs italic text-foreground leading-relaxed">"{q.text}"</p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex gap-1 flex-wrap">
                                {q.page > 0 && <Badge variant="outline" className="text-[9px] h-5">p. {q.page}</Badge>}
                                {q.tags.map(t => <Badge key={t} className="text-[9px] h-5 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">{t}</Badge>)}
                              </div>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive/50 hover:text-destructive" onClick={() => removeQuote(currentBook.id, q.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Abandon button */}
                <Button variant="outline" size="sm" className="w-full border-dashed text-muted-foreground" onClick={() => abandonBook(currentBook.id)}>
                  🪦 Abandonar Leitura
                </Button>
              </>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-orange-300 dark:bg-orange-700/60 px-4 py-2.5">
                  <span className="text-sm font-black uppercase tracking-wider">📖 LENDO AGORA</span>
                </div>
                <div className="bg-orange-50/80 dark:bg-orange-950/20 p-8 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum livro em leitura no momento.</p>
                  <Button size="sm" className="mt-3 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => { setForm({ ...emptyForm(), status: "lendo" }); setShowForm(true); }}>
                    <Plus className="w-3 h-3 mr-1" /> Começar um Livro
                  </Button>
                </div>
              </div>
            )}

            {showForm && <BookForm />}
          </TabsContent>

          {/* ══════ TAB: ESTANTE ══════ */}
          <TabsContent value="estante" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar livro..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="lendo">📖 Lendo</SelectItem>
                  <SelectItem value="lido">✅ Lidos</SelectItem>
                  <SelectItem value="quero-ler">📋 Quero Ler</SelectItem>
                  <SelectItem value="abandonado">🪦 Abandonados</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-9 bg-orange-500 hover:bg-orange-600 text-white" onClick={openNew}><Plus className="w-4 h-4" /></Button>
            </div>

            {showForm && <BookForm />}

            {filterStatus === "all" ? (
              statusGroups.map(group => {
                const groupBooks = filteredBooks.filter(b => b.status === group.key);
                if (groupBooks.length === 0) return null;
                return (
                  <div key={group.key} className="rounded-xl border border-border overflow-hidden">
                    <div className={`${group.bg} px-4 py-2.5`}>
                      <span className="text-sm font-black uppercase tracking-wider">{group.label} ({groupBooks.length})</span>
                    </div>
                    <div className={`${group.body} p-3 space-y-2`}>
                      {groupBooks.map(book => (
                        <BookRow key={book.id} book={book} onEdit={() => openEdit(book)} onRemove={() => remove(book.id)} onUpdatePage={updatePage} />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="space-y-2">
                {filteredBooks.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhum livro encontrado 📚</p>}
                {filteredBooks.map(book => (
                  <BookRow key={book.id} book={book} onEdit={() => openEdit(book)} onRemove={() => remove(book.id)} onUpdatePage={updatePage} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ══════ TAB: INSIGHTS ══════ */}
          <TabsContent value="insights" className="space-y-4 mt-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-sky-200 dark:bg-sky-800/60 px-4 py-2.5">
                <span className="text-sm font-black uppercase tracking-wider">💡 COFRE DE CITAÇÕES ({allQuotes.length})</span>
              </div>
              <div className="bg-sky-50/80 dark:bg-sky-950/20 p-4 space-y-3">
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      className={`text-[10px] cursor-pointer ${filterTag === "all" ? "bg-sky-500 text-white" : "bg-card border-border text-foreground"}`}
                      onClick={() => setFilterTag("all")}
                    >Todas</Badge>
                    {allTags.map(t => (
                      <Badge
                        key={t}
                        className={`text-[10px] cursor-pointer ${filterTag === t ? "bg-sky-500 text-white" : "bg-card border-border text-foreground"}`}
                        onClick={() => setFilterTag(t)}
                      >{t}</Badge>
                    ))}
                  </div>
                )}

                {filteredQuotes.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhuma citação ainda. Leia e salve frases que te marcam! 💎</p>
                ) : (
                  filteredQuotes.map(q => (
                    <div key={q.id} className="rounded-lg bg-card border border-border p-3">
                      <p className="text-xs italic text-foreground leading-relaxed">"{q.text}"</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] font-bold text-muted-foreground">— {q.bookTitle}</span>
                        {q.page > 0 && <Badge variant="outline" className="text-[9px] h-5">p. {q.page}</Badge>}
                        {q.tags.map(t => <Badge key={t} className="text-[9px] h-5 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">{t}</Badge>)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* ══════ TAB: EMPRESTADOS ══════ */}
          <TabsContent value="emprestados" className="space-y-4 mt-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-pink-200 dark:bg-pink-800/60 px-4 py-2.5">
                <span className="text-sm font-black uppercase tracking-wider">📤 AGIOTA LITERÁRIO ({lentBooks.length})</span>
              </div>
              <div className="bg-pink-50/80 dark:bg-pink-950/20 p-4 space-y-3">
                {lentBooks.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhum livro emprestado. Sorte sua! 🎉</p>
                ) : (
                  lentBooks.map(book => {
                    const overdue = book.lentReturnDate && new Date(book.lentReturnDate) < new Date();
                    const daysLeft = book.lentReturnDate ? differenceInDays(new Date(book.lentReturnDate), new Date()) : null;
                    return (
                      <div key={book.id} className={`rounded-lg border p-3 space-y-2 ${overdue ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20" : "border-border bg-card"}`}>
                        <div className="flex gap-3 items-start">
                          {book.cover ? (
                            <img src={book.cover} alt={book.title} className="w-12 h-16 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-12 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-5 h-5 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm leading-tight">{book.title}</h4>
                            <p className="text-[10px] text-muted-foreground">{book.author}</p>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <Badge className="text-[9px] bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800">
                                👤 {book.lentTo}
                              </Badge>
                              {overdue && <Badge className="text-[9px] bg-red-500 text-white border-red-600">⚠️ ATRASADO</Badge>}
                              {daysLeft !== null && !overdue && daysLeft <= 7 && (
                                <Badge className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                                  ⏰ {daysLeft}d
                                </Badge>
                              )}
                            </div>
                            {book.lentReturnDate && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Devolução: {format(new Date(book.lentReturnDate), "dd/MM/yyyy")}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] border-green-300 text-green-700 hover:bg-green-50" onClick={() => setBooks(prev => prev.map(b => b.id === book.id ? { ...b, lentTo: "", lentDate: "", lentReturnDate: "" } : b))}>
                            ✅ Devolvido
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] border-pink-300 text-pink-700 hover:bg-pink-50" onClick={() => sendWhatsApp(book)}>
                            <MessageCircle className="w-3 h-3 mr-1" /> Cobrar
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </TabsContent>

          {/* ══════ TAB: DESAFIO ══════ */}
          <TabsContent value="desafio" className="space-y-4 mt-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-amber-200 dark:bg-amber-800/60 px-4 py-2.5">
                <span className="text-sm font-black uppercase tracking-wider">🏆 DESAFIO DE LEITURA {currentYear}</span>
              </div>
              <div className="bg-amber-50/80 dark:bg-amber-950/20 p-4 space-y-4">
                {/* Goal setter */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground">Meta anual:</span>
                  <Input
                    type="number"
                    value={yearGoal}
                    onChange={e => setYearGoal(Math.max(1, +e.target.value))}
                    className="w-20 h-8 text-sm text-center font-bold"
                    min={1}
                  />
                  <span className="text-xs text-muted-foreground">livros</span>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{booksReadThisYear} de {yearGoal} livros</span>
                    <span>{Math.round((booksReadThisYear / yearGoal) * 100)}%</span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (booksReadThisYear / yearGoal) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Visual Shelf */}
                {booksRead.length > 0 && (
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">📚 SUA ESTANTE</p>
                    <div className="flex flex-wrap gap-1.5">
                      {booksRead.slice(0, yearGoal).map((b, i) => (
                        <div key={b.id} className="w-9 h-12 rounded bg-gradient-to-b from-orange-400 to-orange-600 flex items-center justify-center overflow-hidden" title={b.title}>
                          {b.cover ? (
                            <img src={b.cover} alt={b.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[8px] text-white font-bold text-center leading-tight px-0.5">{b.title.slice(0, 6)}</span>
                          )}
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, yearGoal - booksRead.length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-9 h-12 rounded border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground/30">?</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fun stats */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-green-200 dark:bg-green-800/60 px-4 py-2.5">
                    <span className="text-sm font-black uppercase tracking-wider">📊 ESTATÍSTICAS</span>
                  </div>
                  <div className="bg-green-50/80 dark:bg-green-950/20 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-card border border-border p-3 text-center">
                        <div className="text-2xl font-black text-green-600 dark:text-green-400">{totalPagesRead}</div>
                        <div className="text-[9px] font-bold uppercase text-muted-foreground">páginas lidas</div>
                      </div>
                      <div className="rounded-lg bg-card border border-border p-3 text-center">
                        <div className="text-2xl font-black text-green-600 dark:text-green-400">{booksRead.length}</div>
                        <div className="text-[9px] font-bold uppercase text-muted-foreground">livros completos</div>
                      </div>
                    </div>
                    {totalPagesRead > 0 && (
                      <div className="mt-3 rounded-lg bg-card border border-border p-3 text-center">
                        <p className="text-xs text-muted-foreground">Você leu o equivalente a</p>
                        <p className="font-black text-lg text-foreground">{Math.round(totalPagesRead * 0.01)} metros de altura em livros! 🏢</p>
                        <p className="text-[10px] text-muted-foreground">({Math.round(totalPagesRead * 0.01 / 3)} andares de prédio)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* FAB */}
      <button
        onClick={() => { setTab("estante"); openNew(); }}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex items-center justify-center z-30 transition-transform active:scale-90"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};

// ── BookRow Component ──
const BookRow = ({ book, onEdit, onRemove, onUpdatePage }: { book: Book; onEdit: () => void; onRemove: () => void; onUpdatePage: (id: string, page: number) => void }) => (
  <div className="flex gap-3 items-start rounded-lg bg-card border border-border p-2.5">
    {book.cover ? (
      <img src={book.cover} alt={book.title} className="w-10 h-14 rounded object-cover flex-shrink-0" />
    ) : (
      <div className="w-10 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
        <BookOpen className="w-4 h-4 text-muted-foreground/30" />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <h4 className="font-bold text-xs leading-tight truncate">{book.title}</h4>
      <p className="text-[10px] text-muted-foreground truncate">{book.author}</p>
      {book.status === "lendo" && book.pages > 0 && (
        <div className="mt-1 space-y-0.5">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, (book.currentPage / book.pages) * 100)}%` }} />
          </div>
          <p className="text-[9px] text-muted-foreground">{book.currentPage}/{book.pages} págs</p>
        </div>
      )}
      {book.status === "abandonado" && <p className="text-[9px] italic text-muted-foreground mt-0.5">🪦 A vida é curta demais para livros ruins.</p>}
      {book.rating > 0 && <div className="mt-0.5"><StarRating value={book.rating} size="w-3 h-3" /></div>}
      {book.lentTo && <Badge className="mt-1 text-[8px] h-4 bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800">📤 {book.lentTo}</Badge>}
      {(book.quotes || []).length > 0 && <Badge variant="outline" className="mt-1 ml-1 text-[8px] h-4">💡 {book.quotes.length} citações</Badge>}
    </div>
    <div className="flex flex-col gap-0.5">
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}><Edit2 className="w-3 h-3" /></Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/50 hover:text-destructive" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
    </div>
  </div>
);

export default Biblioteca;
