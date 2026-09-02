import { useState, useEffect, useMemo } from "react";
import { SerieHistorico } from "@/components/historico/SerieHistorico";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, X, Trash2, Check, Utensils, Clock,
  Apple, ChefHat, Calendar, Heart, Settings,
  ArrowUp, ArrowDown, Copy, Search, BookOpen,
  ShoppingCart, Send, UtensilsCrossed, Pencil, Link2, ExternalLink, Tag
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { useModuleCompletionFlow } from "@/hooks/use-module-completion-flow";
import { Switch } from "@/components/ui/switch";

const weekDays = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const dayColors: Record<string, string> = {
  SEGUNDA: "bg-blue-500", TERÇA: "bg-indigo-500", QUARTA: "bg-green-500",
  QUINTA: "bg-yellow-500", SEXTA: "bg-pink-500", SÁBADO: "bg-purple-500", DOMINGO: "bg-violet-500"
};

const defaultMeals = ["Café da Manhã", "Almoço", "Lanche", "Janta"];
const defaultMealEmojis: Record<string, string> = { "Café da Manhã": "🌅", "Almoço": "🍽️", "Lanche": "🍎", "Janta": "🌙", "Pré-Treino": "⚡", "Pós-Treino": "💪", "Ceia": "🌙", "Café da Tarde": "☕" };
const defaultMealColors: Record<string, string> = {
  "Café da Manhã": "bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30",
  "Almoço": "bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/30",
  "Lanche": "bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/30",
  "Janta": "bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/30",
  "Pré-Treino": "bg-orange-100 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/30",
  "Pós-Treino": "bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/30",
  "Ceia": "bg-indigo-100 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30",
  "Café da Tarde": "bg-teal-100 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/30",
};
const availableMeals = ["Café da Manhã", "Almoço", "Lanche", "Janta", "Pré-Treino", "Pós-Treino", "Ceia", "Café da Tarde"];

/* =========================== RECEITAS: CATEGORIAS ===========================
 * FONTE ÚNICA. Antes a lista de categorias vivia em QUATRO lugares — os chips
 * de filtro, o <Select> do formulário, o mapa de cor da borda do formulário e
 * o mapa de cor dos cards. Mexer num não refletia nos outros, e "Sobremesa"
 * era a prova viva disso: tinha cor nos DOIS mapas e não existia em NENHUMA
 * lista selecionável — uma categoria fantasma, impossível de escolher.
 *
 * Decisão sobre a órfã: MANTER "Sobremesa" e torná-la selecionável. Ela é
 * óbvia num caderno de receitas e, como nunca foi escolhível, nenhuma receita
 * de cliente pode estar nela hoje — incluir é 100% aditivo, zero risco. Só
 * troquei o rosa dela por rose: dividir a cor exata com "Doce Fit" fazia as
 * duas parecerem a mesma coisa na lista.
 *
 * As classes são LITERAIS de propósito: o Tailwind só gera o CSS do que
 * enxerga escrito no código — string de cor montada em runtime não existe no
 * bundle final e a cor sairia sem efeito.
 * ========================================================================== */
type RecipeCatStyle = { border: string; bg: string; darkBg: string; text: string };
type RecipeCategory = RecipeCatStyle & { name: string };

const RECIPE_CATEGORIES: RecipeCategory[] = [
  { name: "Café", border: "border-l-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", darkBg: "dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400" },
  { name: "Almoço", border: "border-l-green-400", bg: "bg-green-50 dark:bg-green-500/10", darkBg: "dark:bg-green-950/30", text: "text-green-700 dark:text-green-400" },
  { name: "Janta", border: "border-l-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10", darkBg: "dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
  { name: "Lanche", border: "border-l-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", darkBg: "dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" },
  { name: "Doce Fit", border: "border-l-pink-400", bg: "bg-pink-50 dark:bg-pink-500/10", darkBg: "dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-400" },
  { name: "Sobremesa", border: "border-l-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10", darkBg: "dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-400" },
  { name: "Fitness", border: "border-l-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10", darkBg: "dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400" },
  { name: "Salgado", border: "border-l-red-400", bg: "bg-red-50 dark:bg-red-500/10", darkBg: "dark:bg-red-950/30", text: "text-red-700 dark:text-red-400" },
  { name: "Shake", border: "border-l-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-500/10", darkBg: "dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-400" },
  { name: "Receita Rápida", border: "border-l-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", darkBg: "dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400" },
];

// Paleta das categorias que o USUÁRIO cria. A cor sai por índice salvo junto
// da categoria (e não pela posição na lista): assim ela não troca de cor
// quando o usuário cria ou apaga outra categoria.
const CUSTOM_RECIPE_PALETTE: RecipeCatStyle[] = [
  { border: "border-l-teal-400", bg: "bg-teal-50 dark:bg-teal-500/10", darkBg: "dark:bg-teal-950/30", text: "text-teal-700 dark:text-teal-400" },
  { border: "border-l-violet-400", bg: "bg-violet-50 dark:bg-violet-500/10", darkBg: "dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-400" },
  { border: "border-l-sky-400", bg: "bg-sky-50 dark:bg-sky-500/10", darkBg: "dark:bg-sky-950/30", text: "text-sky-700 dark:text-sky-400" },
  { border: "border-l-lime-400", bg: "bg-lime-50 dark:bg-lime-500/10", darkBg: "dark:bg-lime-950/30", text: "text-lime-700 dark:text-lime-400" },
  { border: "border-l-fuchsia-400", bg: "bg-fuchsia-50 dark:bg-fuchsia-500/10", darkBg: "dark:bg-fuchsia-950/30", text: "text-fuchsia-700 dark:text-fuchsia-400" },
  { border: "border-l-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-500/10", darkBg: "dark:bg-yellow-950/30", text: "text-yellow-700 dark:text-yellow-400" },
  { border: "border-l-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10", darkBg: "dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-400" },
  { border: "border-l-stone-400", bg: "bg-stone-50 dark:bg-stone-500/10", darkBg: "dark:bg-stone-950/30", text: "text-stone-700 dark:text-stone-400" },
];
const DEFAULT_RECIPE_STYLE: RecipeCatStyle = { border: "border-l-primary", bg: "bg-muted/30", darkBg: "", text: "text-primary" };
const paletteStyle = (i: number) => {
  const n = CUSTOM_RECIPE_PALETTE.length;
  return CUSTOM_RECIPE_PALETTE[((i % n) + n) % n];
};

/** Categoria criada pelo usuário. A identidade é o NOME porque é o nome que a
 *  receita guarda em `category` (mesmo formato das categorias padrão) — sem
 *  id nenhum pra traduzir, e o dado antigo continua legível do jeito que está. */
type CustomRecipeCategory = { name: string; palette: number };
const MAX_CUSTOM_RECIPE_CATS = 20;

/** Tudo que o formulário precisa saber sobre categorias, num objeto só. */
type CategoryCatalog = {
  selectable: string[];
  custom: CustomRecipeCategory[];
  styleOf: (name: string) => RecipeCatStyle;
  add: (raw: string) => { name?: string; error?: string };
  remove: (name: string) => void;
  nextStyle: RecipeCatStyle;
};

/** Receita. `link` é OPCIONAL de propósito: receita já salva por cliente real
 *  não tem esse campo, e torná-lo obrigatório quebraria a leitura de
 *  `dieta-recipes-v2` (chave com dado real — nome e formato preservados). */
type Recipe = {
  id: string; name: string; ingredients: string; instructions: string;
  category: string; favorite: boolean; prepTime: string; servings: string;
  link?: string;
};

/** O que o formulário edita. `favorite` fica de fora de propósito: o coração
 *  mora no card, e editar uma receita não pode desfavoritar sem querer. */
type RecipeDraft = {
  name: string; ingredients: string; instructions: string;
  category: string; prepTime: string; servings: string; link: string;
};
const EMPTY_RECIPE_DRAFT: RecipeDraft = {
  name: "", ingredients: "", instructions: "", category: "Almoço",
  prepTime: "", servings: "", link: "",
};

/**
 * Colar link no celular quase sempre vem sem "https://" ("youtube.com/…", o
 * que o Instagram compartilha etc). Sem esquema, o href vira caminho RELATIVO
 * e o toque abriria o PRÓPRIO app numa rota que não existe. Prefixar também
 * neutraliza "javascript:" colado à mão — vira uma URL https inofensiva.
 * Vazio devolve undefined pra receita sem link não carregar campo à toa.
 */
const normalizeLink = (raw: string): string | undefined => {
  const v = raw.trim();
  if (!v) return undefined;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

const NOVA_CATEGORIA = "__nova_categoria__";

/**
 * Campos da receita — os MESMOS no "nova receita" e na edição inline (uma
 * tela só pra manter, e o que muda num muda no outro).
 *
 * Declarado FORA do componente da página de propósito: lá dentro, o React
 * criaria uma identidade nova a cada tecla digitada, remontaria o formulário
 * e o teclado do celular fecharia sozinho a cada letra.
 */
const RecipeFields = ({ draft, setDraft, cats, onSave, onCancel, saveLabel, className = "" }: {
  draft: RecipeDraft;
  setDraft: (updater: (prev: RecipeDraft) => RecipeDraft) => void;
  cats: CategoryCatalog;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  className?: string;
}) => {
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const estilo = cats.styleOf(draft.category);
  // Se a receita está numa categoria que não está mais na lista (o usuário
  // apagou a categoria dele), ela entra como opção mesmo assim: sem isso o
  // <Select> abriria em branco e salvar trocaria a categoria sem a pessoa ver.
  const opcoes = draft.category && !cats.selectable.includes(draft.category)
    ? [draft.category, ...cats.selectable]
    : cats.selectable;

  const criarCategoria = () => {
    const { name, error } = cats.add(novoNome);
    if (error || !name) { setErro(error ?? "Não consegui criar a categoria."); return; }
    setDraft(p => ({ ...p, category: name }));
    setCriando(false); setNovoNome(""); setErro(null);
  };

  return (
    <div className={`bg-muted/30 rounded-xl p-3 border border-border border-l-4 ${estilo.border} space-y-2 ${className}`}>
      <Input value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="Nome da receita" className="text-xs h-9 font-bold" />
      <div className="grid grid-cols-3 gap-2">
        <Select
          value={draft.category}
          onValueChange={v => {
            if (v === NOVA_CATEGORIA) { setNovoNome(""); setErro(null); setCriando(true); return; }
            setDraft(p => ({ ...p, category: v }));
          }}
        >
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {opcoes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            <SelectSeparator />
            <SelectItem value={NOVA_CATEGORIA} className="text-primary font-semibold">+ Nova categoria…</SelectItem>
          </SelectContent>
        </Select>
        <Input value={draft.prepTime} onChange={e => setDraft(p => ({ ...p, prepTime: e.target.value }))} placeholder="⏱ Tempo (20min)" className="text-xs h-9" />
        <Input value={draft.servings} onChange={e => setDraft(p => ({ ...p, servings: e.target.value }))} placeholder="🍽 Porções" className="text-xs h-9" />
      </div>
      {/* Link (pedido de cliente): muita receita boa já tem o modo de preparo
          pronto na internet — em vez de obrigar a redigitar tudo, guarda-se o
          endereço e o card abre direto lá. */}
      <Input
        value={draft.link}
        onChange={e => setDraft(p => ({ ...p, link: e.target.value }))}
        placeholder="🔗 Link da receita (opcional)"
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        className="text-xs h-9"
      />
      <Textarea value={draft.ingredients} onChange={e => setDraft(p => ({ ...p, ingredients: e.target.value }))} placeholder={"1 banana madura\n2 ovos\n3 col sopa de aveia\n1 scoop whey"} className="text-xs min-h-[80px]" />
      <Textarea value={draft.instructions} onChange={e => setDraft(p => ({ ...p, instructions: e.target.value }))} placeholder={"Bata tudo no liquidificador\nDespeje na frigideira\nCozinhe 3min de cada lado"} className="text-xs min-h-[80px]" />
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 h-9" onClick={onSave}>{saveLabel}</Button>
        <Button size="sm" variant="outline" className="h-9" onClick={onCancel}>Cancelar</Button>
      </div>

      <Dialog open={criando} onOpenChange={setCriando}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Tag className="w-4 h-4" /> Nova categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={novoNome}
              onChange={e => { setNovoNome(e.target.value); setErro(null); }}
              placeholder="Ex: Air Fryer, Marmita, Low carb…"
              maxLength={20}
              autoFocus
              className="h-9"
              onKeyDown={e => e.key === "Enter" && criarCategoria()}
            />
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
              <span className="text-[11px] text-muted-foreground">Vai aparecer assim:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cats.nextStyle.bg} ${cats.nextStyle.text}`}>
                {novoNome.trim() || "Sua categoria"}
              </span>
            </div>
            {erro && <p className="text-[11px] text-destructive">{erro}</p>}

            {/* Apagar categoria própria: some do seletor, mas a receita já
                salva nela NÃO muda — o nome continua no card e vira um chip
                de filtro "órfão". Nada do usuário se perde. */}
            {cats.custom.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground">SUAS CATEGORIAS</p>
                <div className="flex flex-wrap gap-1.5">
                  {cats.custom.map(c => (
                    <span key={c.name} className={`flex items-center gap-1 pl-2 rounded-full border text-[10px] font-bold ${paletteStyle(c.palette).bg} ${paletteStyle(c.palette).text}`}>
                      {c.name}
                      <button
                        onClick={() => cats.remove(c.name)}
                        aria-label={`Remover categoria ${c.name}`}
                        className="w-8 h-9 flex items-center justify-center rounded-full hover:opacity-70"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setCriando(false)}>Cancelar</Button>
              <Button className="flex-1 h-9" onClick={criarCategoria} disabled={novoNome.trim().length < 2}>Criar categoria</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Dieta = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("cardapio");
  const { onModuleComplete: onDietaComplete, CompletionDialog: DietaCompletionDialog } = useModuleCompletionFlow("dieta");
  useScrollActiveTabIntoView(activeTab);
  const reportTab = useTabReporter();
  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  // `today` é ESTADO (não const de render): o app fica vivo em memória no
  // celular e, sem isso, "hoje" congelava no dia em que a aba abriu — cliente
  // via sexta 17 no sábado (18/07). localDayKey = dia LOCAL (toISOString virava
  // amanhã depois das 21h BRT). Reavaliado ao montar e quando o app volta ao foco.
  const [today, setToday] = useState(localDayKey());

  // Configurable meals
  const [meals, setMeals] = usePersistedState<string[]>("dieta-meals-config", defaultMeals);
  const [showMealConfig, setShowMealConfig] = useState(false);
  const [newMealNameConfig, setNewMealNameConfig] = useState("");
  const [copyFromDay, setCopyFromDay] = useState<string | null>(null);
  const [copyTargetDays, setCopyTargetDays] = useState<string[]>([]);

  const mealEmojis = defaultMealEmojis;
  const mealColors = defaultMealColors;

  const presetMealPlan: Record<string, Record<string, string>> = Object.fromEntries(
    weekDays.map(day => [day, Object.fromEntries(meals.map(m => [m, ""]))])
  );

  // DIETA
  const [mealPlan, setMealPlan] = usePersistedState("saude-meals", presetMealPlan);
  const [editingMeal, setEditingMeal] = useState<string | null>(null);
  const [editMealValue, setEditMealValue] = useState("");

  // FASTING
  const [fastingGoal, setFastingGoal] = usePersistedState("saude-fast-goal", 16);
  const [fastingStart, setFastingStart] = usePersistedState<string | null>("saude-fast-start", null);
  const [fastingElapsed, setFastingElapsed] = useState(0);

  // RECIPES
  const [recipes, setRecipes] = usePersistedState<Recipe[]>("dieta-recipes-v2", []);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeForm, setRecipeForm] = useState<RecipeDraft>(EMPTY_RECIPE_DRAFT);
  const [recipeFilter, setRecipeFilter] = useState("Todas");
  const [checkedIngredients, setCheckedIngredients] = usePersistedState<Record<string, string[]>>("dieta-recipe-checked", {});
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  // Categorias criadas pelo usuário (pedido de cliente: "não só as
  // pré-definidas"). Chave NOVA — as chaves antigas seguem intocadas.
  const [customCategories, setCustomCategories] = usePersistedState<CustomRecipeCategory[]>("dieta-custom-categories", []);
  // Edição inline da receita (mesmo padrão de IncomeTable/ExpenseTable)
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>(EMPTY_RECIPE_DRAFT);

  // DIÁRIO v2
  const [diaryDate, setDiaryDate] = useState(localDayKey());

  // Vira o dia quando o app reabre/volta ao foco (celular mantém a aba viva).
  // Se a pessoa estava vendo "Hoje", arrasta o diário pro novo hoje; se ela
  // tinha navegado pra um dia passado de propósito, respeita a escolha dela.
  useEffect(() => {
    const sync = () => {
      const hoje = localDayKey();
      setToday(prevHoje => {
        if (prevHoje !== hoje) setDiaryDate(d => (d === prevHoje ? hoje : d));
        return hoje;
      });
    };
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    const id = window.setInterval(sync, 60_000); // pega a virada de meia-noite com app aberto
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
      window.clearInterval(id);
    };
  }, []);
  const [diaryData, setDiaryData] = usePersistedState<Record<string, { meals: Record<string, { followed: boolean; note: string }>; extraFood: { had: boolean; description: string } }>>("dieta-diary-v2", {});

  /* SÉRIE DA DIETA (01/09) — refeições SEGUIDAS por dia.
   *
   * O diário guarda por refeição se foi seguida ou não, mas só mostrava um
   * dia por vez: pra comparar a semana era preciso tocar a setinha sete
   * vezes e guardar de cabeça. Contar o que foi seguido dá um número por dia
   * — e número por dia é o que o SerieHistorico sabe desenhar.
   *
   * Conta só `followed === true`. Refeição marcada como NÃO seguida é
   * informação registrada, não é adesão: somá-la inflaria o gráfico
   * justamente nos dias em que a pessoa saiu da linha e foi honesta. */
  const serieDieta = useMemo(() => {
    const fora: Record<string, number> = {};
    for (const [dia, reg] of Object.entries(diaryData || {})) {
      const seguidas = Object.values(reg?.meals || {}).filter((m) => m?.followed).length;
      if (seguidas > 0) fora[dia] = seguidas;
    }
    return fora;
  }, [diaryData]);

  // LISTA INTELIGENTE
  const [smartList, setSmartList] = usePersistedState<{ id: string; text: string; done: boolean }[]>("dieta-smart-list", []);
  const [newSmartItem, setNewSmartItem] = useState("");

  // Casa grocery sync
  const [casaGrocery, setCasaGrocery] = usePersistedState<any[]>("casa-grocery-categories", []);

  useEffect(() => {
    if (!fastingStart) { setFastingElapsed(0); return; }
    const interval = setInterval(() => {
      setFastingElapsed(Math.floor((Date.now() - new Date(fastingStart).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [fastingStart]);

  const startEditMeal = (day: string, meal: string) => { setEditingMeal(`${day}-${meal}`); setEditMealValue(mealPlan[day]?.[meal] || ""); };
  const saveMeal = (day: string, meal: string) => { setMealPlan({ ...mealPlan, [day]: { ...mealPlan[day], [meal]: editMealValue } }); setEditingMeal(null); };

  const formatTime = (secs: number) => { const h = Math.floor(secs / 3600); const m = Math.floor((secs % 3600) / 60); const s = secs % 60; return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`; };

  // Diary helpers
  const getDiaryDayName = (dateStr: string) => {
    const d = parseLocalDay(dateStr);
    const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
    return weekDays[dayIndex];
  };

  const normalizeDiary = (d: any) => ({
    meals: (d && typeof d.meals === "object" && d.meals) ? d.meals : {},
    extraFood: {
      had: !!d?.extraFood?.had,
      description: d?.extraFood?.description ?? "",
    },
  });
  const getDayDiary = (dateStr: string) => normalizeDiary(diaryData[dateStr]);

  const updateDayDiary = (dateStr: string, updater: (prev: { meals: Record<string, { followed: boolean; note: string }>; extraFood: { had: boolean; description: string } }) => typeof prev extends never ? never : any) => {
    setDiaryData(prev => ({
      ...prev,
      [dateStr]: updater(normalizeDiary(prev[dateStr]))
    }));
  };

  const navigateDiaryDate = (offset: number) => {
    const d = parseLocalDay(diaryDate);
    d.setDate(d.getDate() + offset);
    setDiaryDate(localDayKey(d));
  };

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === today) return "Hoje";
    const d = parseLocalDay(dateStr);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === localDayKey(yesterday)) return "Ontem";
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
  };

  // Smart list: generate from meal plan
  const generateFromMealPlan = () => {
    const items: string[] = [];
    weekDays.forEach(day => {
      const dayMeals = mealPlan[day];
      if (!dayMeals) return;
      Object.values(dayMeals).forEach(desc => {
        if (desc && desc.trim()) {
          desc.split(/[,\n+]/).forEach(item => {
            const clean = item.trim().toLowerCase();
            if (clean && !items.includes(clean)) items.push(clean);
          });
        }
      });
    });
    const newItems = items.filter(item => !smartList.some(s => s.text.toLowerCase() === item));
    if (newItems.length > 0) {
      setSmartList(prev => [...prev, ...newItems.map(text => ({ id: Date.now().toString() + Math.random(), text, done: false }))]);
    }
  };

  const generateFromRecipes = () => {
    const items: string[] = [];
    recipes.filter(r => r.favorite).forEach(r => {
      if (r.ingredients) {
        r.ingredients.split("\n").forEach(line => {
          const clean = line.trim().toLowerCase();
          if (clean && !items.includes(clean)) items.push(clean);
        });
      }
    });
    const newItems = items.filter(item => !smartList.some(s => s.text.toLowerCase() === item));
    if (newItems.length > 0) {
      setSmartList(prev => [...prev, ...newItems.map(text => ({ id: Date.now().toString() + Math.random(), text, done: false }))]);
    }
  };

  const sendToCasa = () => {
    const pendingItems = smartList.filter(i => !i.done);
    if (pendingItems.length === 0) return;
    setCasaGrocery((prev: any[]) => {
      const updated = [...prev];
      // Find or create "Dieta" category
      let dietaCat = updated.find(c => c.name === "Dieta");
      if (!dietaCat) {
        dietaCat = { id: "dieta-auto", name: "Dieta", emoji: "🥗", color: "bg-green-500", items: [] };
        updated.push(dietaCat);
      }
      const existingTexts = dietaCat.items.map((i: any) => i.text.toLowerCase());
      const newItems = pendingItems.filter(i => !existingTexts.includes(i.text.toLowerCase()));
      dietaCat.items = [...dietaCat.items, ...newItems.map(i => ({ id: Date.now().toString() + Math.random(), text: i.text, done: false }))];
      return updated.map(c => c.id === dietaCat!.id ? dietaCat! : c);
    });
  };

  // ---------------------- RECEITAS: categorias e edição ----------------------
  // Defensivo como no resto da casa: a chave é nova, mas um valor fora do
  // formato não pode derrubar a aba inteira do cliente.
  const minhasCategorias = Array.isArray(customCategories) ? customCategories : [];

  const estiloDaCategoria = (nome: string): RecipeCatStyle => {
    const padrao = RECIPE_CATEGORIES.find(c => c.name === nome);
    if (padrao) return padrao;
    const propria = minhasCategorias.find(c => c.name === nome);
    return propria ? paletteStyle(propria.palette) : DEFAULT_RECIPE_STYLE;
  };

  const categoriasSelecionaveis = [...RECIPE_CATEGORIES.map(c => c.name), ...minhasCategorias.map(c => c.name)];

  // Chips de filtro = selecionáveis + as ÓRFÃS (receita salva numa categoria
  // que o usuário depois apagou, ou vinda de versão antiga). Sem isso a
  // receita continuava existindo mas não havia como filtrar até ela.
  const nomesDeCategoria = [...categoriasSelecionaveis];
  recipes.forEach(r => { if (r.category && !nomesDeCategoria.includes(r.category)) nomesDeCategoria.push(r.category); });

  // Próximo índice de cor: MAIOR já usado + 1, não a quantidade — usar o
  // tamanho da lista fazia a categoria criada depois de uma exclusão nascer
  // com a mesma cor de uma que já existia.
  const proximaPaleta = minhasCategorias.length ? Math.max(...minhasCategorias.map(c => c.palette)) + 1 : 0;

  const catalogoCategorias: CategoryCatalog = {
    selectable: categoriasSelecionaveis,
    custom: minhasCategorias,
    styleOf: estiloDaCategoria,
    nextStyle: paletteStyle(proximaPaleta),
    add: (raw: string) => {
      const nome = raw.trim().replace(/\s+/g, " ");
      if (nome.length < 2 || nome.length > 20) return { error: "O nome precisa ter de 2 a 20 caracteres." };
      if (categoriasSelecionaveis.some(n => n.toLowerCase() === nome.toLowerCase())) return { error: "Já existe uma categoria com esse nome." };
      if (minhasCategorias.length >= MAX_CUSTOM_RECIPE_CATS) return { error: `Limite de ${MAX_CUSTOM_RECIPE_CATS} categorias suas.` };
      setCustomCategories([...minhasCategorias, { name: nome, palette: proximaPaleta }]);
      // `{ name }` (sem o valor) pegava o `window.name` do navegador — string
      // vazia — e a categoria recém-criada não vinha selecionada.
      return { name: nome };
    },
    remove: (nome: string) => {
      setCustomCategories(minhasCategorias.filter(c => c.name !== nome));
      // se o filtro estava nela, a lista ficaria vazia sem explicação
      setRecipeFilter(f => (f === nome ? "Todas" : f));
    },
  };

  const salvarNovaReceita = () => {
    const nome = recipeForm.name.trim();
    if (!nome) return; // igual às tabelas de finanças: melhor o botão não responder do que gravar receita sem nome
    setRecipes(prev => [...prev, {
      id: Date.now().toString(),
      ...recipeForm,
      name: nome,
      link: normalizeLink(recipeForm.link),
      favorite: false,
    }]);
    setRecipeForm(EMPTY_RECIPE_DRAFT);
    setShowRecipeForm(false);
  };

  const comecarEdicaoReceita = (r: Recipe) => {
    setShowRecipeForm(false); // dois formulários abertos ao mesmo tempo confunde
    setEditingRecipeId(r.id);
    setRecipeDraft({
      name: r.name, ingredients: r.ingredients, instructions: r.instructions,
      category: r.category, prepTime: r.prepTime, servings: r.servings, link: r.link ?? "",
    });
  };

  const salvarEdicaoReceita = () => {
    const nome = recipeDraft.name.trim();
    if (!nome || !editingRecipeId) return;
    const id = editingRecipeId;
    setRecipes(prev => prev.map(r => r.id !== id ? r : {
      ...r, // favorite e id preservados: o coração é do card, não do formulário
      name: nome,
      ingredients: recipeDraft.ingredients,
      instructions: recipeDraft.instructions,
      category: recipeDraft.category,
      prepTime: recipeDraft.prepTime,
      servings: recipeDraft.servings,
      link: normalizeLink(recipeDraft.link),
    }));
    // Os ingredientes marcados são guardados pelo TEXTO da linha. Se a edição
    // apagou ou reescreveu uma linha marcada, o contador do card passava a
    // mostrar coisa impossível ("3/2 ✓") — aqui some quem não existe mais.
    setCheckedIngredients(prev => {
      const marcados = prev[id];
      if (!marcados?.length) return prev;
      const atuais = new Set(recipeDraft.ingredients.split("\n").map(l => l.trim()).filter(Boolean));
      return { ...prev, [id]: marcados.filter(x => atuais.has(x)) };
    });
    setEditingRecipeId(null);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {DietaCompletionDialog}
      <SpotlightOverlay
        moduleKey="dieta"
        onComplete={onDietaComplete}
        steps={[
          { selector: '[data-spotlight="first-day"]', label: "Toque num dia e adicione uma refeição.", advanceOnAction: "first_meal", checkKey: "saude-meals" },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/home")}><ArrowLeft className="w-5 h-5" /></Button>
          <Apple className="w-5 h-5 text-green-600" />
          <h1 className="text-base font-bold tracking-tight">DIETA</h1>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-muted-foreground text-xs capitalize">{currentMonth}</span>
            <ThemeToggle />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {[
            { id: "cardapio", label: "CARDÁPIO", icon: "🍽️" },
            { id: "jejum", label: "JEJUM", icon: "⏱️" },
            { id: "receitas", label: "RECEITAS", icon: "👩‍🍳" },
            { id: "lista", label: "LISTA", icon: "🛒" },
            { id: "diario", label: "DIÁRIO", icon: "📊" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); reportTab?.(tab.id); }}
              className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 ${activeTab === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        <ModuleTip
          moduleId="dieta"
          tips={[
            "Configure suas refeições clicando em ⚙️ no cardápio (adicione ou remova refeições)",
            "No cardápio semanal, clique em cada refeição para adicionar o que vai comer",
            "Use o 📊 DIÁRIO para registrar o que você comeu de verdade e compare com o plano"
          ]}
        />
          {activeTab === "cardapio" && <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Cardápio semanal — clique para editar:</p>
              <Button size="sm" variant={showMealConfig ? "default" : "outline"} className="text-xs h-7" onClick={() => setShowMealConfig(!showMealConfig)}>
                <Settings className="w-3 h-3 mr-1" /> Refeições ({meals.length})
              </Button>
            </div>

            {showMealConfig && (
              <div className="bg-muted/30 rounded-xl border border-border p-3 space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground">CONFIGURAR REFEIÇÕES (arraste a ordem)</p>
                <div className="space-y-1.5">
                  {meals.map((meal, i) => (
                    <div key={meal} className="flex items-center gap-1.5 bg-card rounded-lg border border-border px-2 py-1.5">
                      <div className="flex flex-col gap-0.5">
                        <button
                          disabled={i === 0}
                          onClick={() => setMeals(prev => { const n = [...prev]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          disabled={i === meals.length - 1}
                          onClick={() => setMeals(prev => { const n = [...prev]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n; })}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs flex-1">{mealEmojis[meal] || "🍽️"} {meal}</span>
                      {meals.length > 2 && (
                        <button onClick={() => setMeals(prev => prev.filter(m => m !== meal))} className="text-muted-foreground hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {/* Quick add from presets */}
                <div className="flex gap-1.5">
                  <Select value="" onValueChange={v => {
                    if (v && !meals.includes(v)) { setMeals(prev => [...prev, v]); }
                  }}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Sugestões rápidas..." /></SelectTrigger>
                    <SelectContent>
                      {availableMeals.filter(m => !meals.includes(m)).map(m => (
                        <SelectItem key={m} value={m}>{defaultMealEmojis[m]} {m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Custom name */}
                <div className="flex gap-1.5">
                  <Input
                    value={newMealNameConfig}
                    onChange={e => setNewMealNameConfig(e.target.value)}
                    placeholder="Nome personalizado (ex: Pré-Treino Leve)"
                    className="text-xs h-7 flex-1"
                    onKeyDown={e => {
                      if (e.key === "Enter" && newMealNameConfig.trim() && !meals.includes(newMealNameConfig.trim())) {
                        setMeals(prev => [...prev, newMealNameConfig.trim()]);
                        setNewMealNameConfig("");
                      }
                    }}
                  />
                  <Button size="sm" className="h-7 px-2" onClick={() => {
                    if (newMealNameConfig.trim() && !meals.includes(newMealNameConfig.trim())) {
                      setMeals(prev => [...prev, newMealNameConfig.trim()]);
                      setNewMealNameConfig("");
                    }
                  }}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {weekDays.map((day, dayIdx) => (
                <div key={day} data-spotlight={dayIdx === 0 ? "first-day" : undefined} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className={`${dayColors[day]} text-white p-3 font-bold text-sm text-center flex items-center justify-between`}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          if (copyFromDay === day) { setCopyFromDay(null); setCopyTargetDays([]); }
                          else { setCopyFromDay(day); setCopyTargetDays([]); }
                        }}
                        className="p-1 rounded hover:bg-white/20 transition-colors flex items-center gap-0.5"
                        title="Copiar cardápio para outros dias"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-normal">Copiar</span>
                      </button>
                    </div>
                    <span className="flex-1 text-center">{day}</span>
                    <div className="flex gap-1">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="p-1 rounded hover:bg-white/20 transition-colors flex items-center gap-0.5"
                            title="Limpar cardápio deste dia"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-normal">Limpar</span>
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Limpar cardápio de {day}?</AlertDialogTitle>
                            <AlertDialogDescription>Todas as refeições deste dia serão removidas.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                              setMealPlan(prev => {
                                const updated = { ...prev };
                                delete updated[day];
                                return updated;
                              });
                            }}>Limpar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {copyFromDay === day && (
                    <div className="p-2 bg-muted/50 border-b border-border space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground">Copiar para:</p>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={copyTargetDays.length === weekDays.length - 1}
                          onCheckedChange={(checked) => {
                            setCopyTargetDays(checked ? weekDays.filter(d => d !== day) : []);
                          }}
                        />
                        Todos
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        {weekDays.filter(d => d !== day).map(d => (
                          <label key={d} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                            <Checkbox
                              checked={copyTargetDays.includes(d)}
                              onCheckedChange={(checked) => {
                                setCopyTargetDays(prev => checked ? [...prev, d] : prev.filter(x => x !== d));
                              }}
                            />
                            {d}
                          </label>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs"
                        disabled={copyTargetDays.length === 0}
                        onClick={() => {
                          setMealPlan(prev => {
                            const updated = { ...prev };
                            copyTargetDays.forEach(targetDay => {
                              updated[targetDay] = { ...(prev[day] || {}) };
                            });
                            return updated;
                          });
                          setCopyFromDay(null);
                          setCopyTargetDays([]);
                        }}
                      >
                        Copiar ({copyTargetDays.length})
                      </Button>
                    </div>
                  )}

                  <div className="p-3 space-y-3">
                    {meals.map(meal => {
                      const key = `${day}-${meal}`; const isEditing = editingMeal === key;
                      return (
                        <div key={meal} className={`rounded-lg p-2 border ${mealColors[meal] || "bg-muted/50 border-border"}`}>
                          <p className="text-xs font-bold mb-1">{meal} {mealEmojis[meal] || "🍽️"}</p>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <Textarea value={editMealValue} onChange={e => setEditMealValue(e.target.value)} className="text-[10px] min-h-[50px] flex-1 bg-white/50 dark:bg-background/50" />
                              <Button size="sm" className="h-7 self-end" onClick={() => saveMeal(day, meal)}><Check className="w-3 h-3" /></Button>
                            </div>
                          ) : (
                            <p className="text-[11px] leading-relaxed cursor-pointer hover:opacity-70" onClick={() => startEditMeal(day, meal)}>
                              {mealPlan[day]?.[meal] || <span className="italic text-muted-foreground">Clique para adicionar...</span>}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>}

          {/* ========== JEJUM ========== */}
          {activeTab === "jejum" && <div className="space-y-4">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/10 rounded-xl border border-orange-200 p-4 text-center dark:border-orange-500/20">
              <h3 className="text-xs font-bold mb-3 flex items-center justify-center gap-2"><Clock className="w-4 h-4 text-orange-500" /> JEJUM INTERMITENTE</h3>
              <div className="flex justify-center gap-2 mb-4">
                {[16, 18, 20, 24].map(h => (
                  <button key={h} onClick={() => setFastingGoal(h)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${fastingGoal === h ? "bg-orange-500 text-white border-orange-500" : "border-border"}`}>
                    {h}:{24 - h}
                  </button>
                ))}
              </div>
              <div className="w-44 h-44 mx-auto rounded-full border-8 border-orange-200 flex items-center justify-center mb-4 relative dark:border-orange-500/20">
                {fastingStart && (
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 176 176">
                    <circle cx="88" cy="88" r="80" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeDasharray={`${Math.min((fastingElapsed / (fastingGoal * 3600)) * 502, 502)} 502`} strokeLinecap="round" />
                  </svg>
                )}
                <div className="text-center z-10">
                  <p className="text-2xl font-bold font-mono">{formatTime(fastingStart ? fastingElapsed : 0)}</p>
                  <p className="text-xs text-muted-foreground">de {fastingGoal}h</p>
                  {fastingStart && fastingElapsed >= fastingGoal * 3600 && <p className="text-xs font-bold text-green-600 mt-1">✅ Completo!</p>}
                </div>
              </div>
              {!fastingStart ? (
                <Button onClick={() => setFastingStart(new Date().toISOString())} className="bg-orange-500 hover:bg-orange-600 text-white">Iniciar jejum 🍽️</Button>
              ) : (
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={() => setFastingStart(null)}>Cancelar</Button>
                  {fastingElapsed >= fastingGoal * 3600 && <Button className="bg-green-500 hover:bg-green-600 text-white" onClick={() => setFastingStart(null)}>Jejum completo! ✅</Button>}
                </div>
              )}
            </div>
          </div>}

          {/* ========== RECEITAS ========== */}
          {activeTab === "receitas" && <div className="space-y-4">
            {/* Chips de filtro — saem da MESMA fonte do formulário */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {["Todas", ...nomesDeCategoria].map(cat => (
                <button
                  key={cat}
                  onClick={() => setRecipeFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-colors ${
                    recipeFilter === cat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold flex items-center gap-2"><ChefHat className="w-4 h-4" /> MINHAS RECEITAS</h3>
              <Button size="sm" onClick={() => { setRecipeForm(EMPTY_RECIPE_DRAFT); setEditingRecipeId(null); setShowRecipeForm(true); }}><Plus className="w-3 h-3 mr-1" /> Nova</Button>
            </div>

            {showRecipeForm && (
              <RecipeFields
                draft={recipeForm}
                setDraft={setRecipeForm}
                cats={catalogoCategorias}
                saveLabel="Salvar Receita"
                onSave={salvarNovaReceita}
                onCancel={() => setShowRecipeForm(false)}
                className="mb-3"
              />
            )}

            {/* Recipe cards */}
            {(() => {
              const filtered = recipes.filter(r => recipeFilter === "Todas" || r.category === recipeFilter);
              const favorites = filtered.filter(r => r.favorite);
              const others = filtered.filter(r => !r.favorite);
              const sorted = [...favorites, ...others];

              if (sorted.length === 0) return (
                <div className="text-center py-12">
                  <ChefHat className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-xs text-muted-foreground">
                    {recipeFilter !== "Todas" ? `Nenhuma receita em "${recipeFilter}"` : "Salve suas receitas favoritas aqui 🥗"}
                  </p>
                </div>
              );

              return (
                <div className="space-y-3">
                  {sorted.map(r => {
                    // EDIÇÃO INLINE (pedido de cliente; mesmo padrão de
                    // IncomeTable/ExpenseTable): o formulário nasce NO LUGAR
                    // do card. No formulário lá do topo, tocar numa receita do
                    // fim da lista pareceria "não ter feito nada".
                    if (editingRecipeId === r.id) return (
                      <RecipeFields
                        key={r.id}
                        draft={recipeDraft}
                        setDraft={setRecipeDraft}
                        cats={catalogoCategorias}
                        saveLabel="Salvar alterações"
                        onSave={salvarEdicaoReceita}
                        onCancel={() => setEditingRecipeId(null)}
                      />
                    );

                    const colors = estiloDaCategoria(r.category);
                    const isExpanded = expandedRecipe === r.id;
                    const ingredients = r.ingredients ? r.ingredients.split("\n").filter(l => l.trim()) : [];
                    const steps = r.instructions ? r.instructions.split("\n").filter(l => l.trim()) : [];
                    const checked = checkedIngredients[r.id] || [];

                    return (
                      <div key={r.id} className={`rounded-xl border border-border border-l-4 ${colors.border} ${colors.bg} ${colors.darkBg} overflow-hidden transition-all`}>
                        {/* Header */}
                        <div className="p-3 cursor-pointer" onClick={() => setExpandedRecipe(isExpanded ? null : r.id)}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-bold leading-tight">{r.name}</h4>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className={`text-[10px] font-bold ${colors.text}`}>{r.category}</span>
                                {r.prepTime && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Clock className="w-3 h-3" /> {r.prepTime}
                                  </span>
                                )}
                                {r.servings && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Utensils className="w-3 h-3" /> {r.servings} porções
                                  </span>
                                )}
                                {ingredients.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {checked.length}/{ingredients.length} ✓
                                  </span>
                                )}
                                {/* Marca discreta de "tem link": dá pra saber
                                    que o preparo está na internet sem abrir */}
                                {r.link && (
                                  <span className="text-muted-foreground flex items-center" title="Tem link do preparo">
                                    <Link2 className="w-3 h-3" />
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Ações sempre visíveis e com alvo de 36px: no
                                celular não existe hover pra revelar botão. O
                                lápis é explícito porque o toque no card já tem
                                dono — abrir/fechar a receita. */}
                            <div className="flex items-center gap-0.5 ml-2">
                              <button
                                onClick={e => { e.stopPropagation(); comecarEdicaoReceita(r); }}
                                aria-label={`Editar ${r.name}`}
                                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setRecipes(prev => prev.map(x => x.id === r.id ? {...x, favorite: !x.favorite} : x)); }}
                                aria-label={r.favorite ? `Desfavoritar ${r.name}` : `Favoritar ${r.name}`}
                                className="w-9 h-9 flex items-center justify-center rounded-lg"
                              >
                                <Heart className={`w-4 h-4 ${r.favorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setRecipes(prev => prev.filter(x => x.id !== r.id)); }}
                                aria-label={`Apagar ${r.name}`}
                                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="border-t border-border/50 p-3 space-y-3">
                            {/* Link primeiro: quando a pessoa salvou a receita
                                POR causa do link, é ele o modo de preparo —
                                tem que estar na mão, não no fim da rolagem. */}
                            {r.link && (
                              <a
                                href={r.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-9 px-3 rounded-lg border border-border bg-card/60 flex items-center gap-2 text-xs font-bold hover:bg-muted/50 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Abrir receita no site</span>
                              </a>
                            )}

                            {/* Ingredients with checkboxes */}
                            {ingredients.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-muted-foreground mb-1.5">📝 INGREDIENTES</p>
                                <div className="space-y-1">
                                  {ingredients.map((ing, i) => {
                                    const isChecked = checked.includes(ing);
                                    return (
                                      <label key={i} className="flex items-center gap-2 cursor-pointer group">
                                        <Checkbox
                                          checked={isChecked}
                                          onCheckedChange={() => {
                                            setCheckedIngredients(prev => {
                                              const current = prev[r.id] || [];
                                              return {
                                                ...prev,
                                                [r.id]: isChecked ? current.filter(x => x !== ing) : [...current, ing]
                                              };
                                            });
                                          }}
                                        />
                                        <span className={`text-xs ${isChecked ? "line-through text-muted-foreground" : ""}`}>{ing}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Numbered steps */}
                            {steps.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-muted-foreground mb-1.5">👩‍🍳 MODO DE PREPARO</p>
                                <ol className="space-y-1.5">
                                  {steps.map((step, i) => (
                                    <li key={i} className="flex gap-2 text-xs">
                                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${colors.bg} ${colors.text} border`}>
                                        {i + 1}
                                      </span>
                                      <span className="pt-0.5">{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>}

          {/* ========== LISTA INTELIGENTE ========== */}
          {activeTab === "lista" && <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> LISTA INTELIGENTE</h3>
                <p className="text-[10px] text-muted-foreground">
                  {smartList.length > 0 ? `${smartList.filter(i => !i.done).length} itens pendentes` : "Gere a lista a partir do cardápio"}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="text-xs h-9 gap-1" onClick={generateFromMealPlan}>
                <Calendar className="w-3 h-3" /> Gerar do Cardápio
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-9 gap-1" onClick={generateFromRecipes}>
                <Heart className="w-3 h-3" /> Gerar das Favoritas
              </Button>
            </div>

            {/* Manual add */}
            <div className="flex gap-2">
              <Input
                value={newSmartItem}
                onChange={e => setNewSmartItem(e.target.value)}
                placeholder="Adicionar item manualmente..."
                className="text-xs h-9 flex-1"
                onKeyDown={e => {
                  if (e.key === "Enter" && newSmartItem.trim()) {
                    setSmartList(prev => [...prev, { id: Date.now().toString(), text: newSmartItem.trim(), done: false }]);
                    setNewSmartItem("");
                  }
                }}
              />
              <Button size="sm" className="h-9" onClick={() => {
                if (newSmartItem.trim()) {
                  setSmartList(prev => [...prev, { id: Date.now().toString(), text: newSmartItem.trim(), done: false }]);
                  setNewSmartItem("");
                }
              }}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Items list */}
            {smartList.length > 0 ? (
              <div className="bg-card rounded-xl border border-border p-3 space-y-1.5">
                {smartList.filter(i => !i.done).map(item => (
                  <div key={item.id} className="flex items-center gap-2 py-1 group">
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => setSmartList(prev => prev.map(i => i.id === item.id ? { ...i, done: true } : i))}
                    />
                    <span className="text-xs flex-1 capitalize">{item.text}</span>
                    <button onClick={() => setSmartList(prev => prev.filter(i => i.id !== item.id))} className="opacity-0 group-hover:opacity-100">
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
                {smartList.some(i => i.done) && (
                  <>
                    <div className="border-t border-border my-2" />
                    <p className="text-[10px] font-bold text-muted-foreground">COMPRADOS</p>
                    {smartList.filter(i => i.done).map(item => (
                      <div key={item.id} className="flex items-center gap-2 py-1 group">
                        <Checkbox
                          checked={true}
                          onCheckedChange={() => setSmartList(prev => prev.map(i => i.id === item.id ? { ...i, done: false } : i))}
                        />
                        <span className="text-xs flex-1 capitalize line-through text-muted-foreground">{item.text}</span>
                        <button onClick={() => setSmartList(prev => prev.filter(i => i.id !== item.id))} className="opacity-0 group-hover:opacity-100">
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShoppingCart className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Lista vazia</p>
                <p className="text-[10px] text-muted-foreground mt-1">Use os botões acima para gerar automaticamente</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-9 flex-1 gap-1" onClick={sendToCasa} disabled={smartList.filter(i => !i.done).length === 0}>
                <Send className="w-3 h-3" /> Enviar para Casa (Mercado)
              </Button>
              {smartList.length > 0 && (
                <Button variant="outline" size="sm" className="text-xs h-9 gap-1" onClick={() => setSmartList(prev => prev.filter(i => !i.done))}>
                  <Trash2 className="w-3 h-3" /> Limpar ✓
                </Button>
              )}
            </div>
          </div>}

          {/* ========== DIÁRIO v2 ========== */}
          {activeTab === "diario" && <div className="space-y-4">
            {/* Date navigation */}
            <div className="flex items-center justify-between bg-card rounded-xl border border-border p-3">
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigateDiaryDate(-1)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="text-center">
                <p className="text-sm font-bold">{formatDateLabel(diaryDate)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {parseLocalDay(diaryDate).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigateDiaryDate(1)} disabled={diaryDate >= today}>
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </Button>
            </div>

            {/* Logo abaixo da navegação por dia de propósito: quem está aqui
                veio olhar um dia, e a série responde "e nos outros?" sem
                obrigar a tocar a setinha sete vezes. */}
            <div className="bg-card rounded-xl border border-border px-4 pt-4 pb-3">
              <h3 className="text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> REFEIÇÕES QUE VOCÊ SEGUIU
              </h3>
              <SerieHistorico
                registros={serieDieta}
                cor="hsl(142 71% 45%)"
                id="dieta-seguidas"
                formatar={(n) => String(Math.round(n * 10) / 10).replace(".", ",")}
              />
            </div>

            {/* Meal checklist from plan */}
            {(() => {
              const dayName = getDiaryDayName(diaryDate);
              const dayMeals = mealPlan[dayName];
              const diary = getDayDiary(diaryDate);
              // ordem = a do CARDÁPIO (dieta-meals-config, reordenável pelo
              // usuário) — a ordem interna do objeto salvo embaralha (edições
              // fora de ordem/merge do normalizador) e jogava a janta pro topo
              const posMeal = (m: string) => { const i = meals.indexOf(m); return i === -1 ? meals.length : i; };
              const plannedMeals = dayMeals
                ? Object.entries(dayMeals).filter(([, v]) => v && v.trim()).sort((a, b) => posMeal(a[0]) - posMeal(b[0]))
                : [];
              const allFollowed = plannedMeals.length > 0 && plannedMeals.every(([meal]) => diary.meals[meal]?.followed);

              return (
                <>
                  {plannedMeals.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-muted-foreground">REFEIÇÕES PLANEJADAS ({dayName})</p>
                        {allFollowed && <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-300 dark:border-green-500/20">100% ✅</Badge>}
                      </div>
                      {plannedMeals.map(([meal, desc]) => {
                        const mealDiary = diary.meals[meal] || { followed: false, note: "" };
                        const seguiu = !!diary.meals[meal] && mealDiary.followed;
                        const naoSeguiu = !!diary.meals[meal] && !mealDiary.followed;
                        // clicar no estado já ativo DESMARCA (remove o registro
                        // do dia — pedido de cliente 18/07): volta ao neutro
                        const marcar = (followed: boolean, jaAtivo: boolean) =>
                          updateDayDiary(diaryDate, prev => {
                            const meals = { ...prev.meals };
                            if (jaAtivo) delete meals[meal];
                            else meals[meal] = { ...mealDiary, followed, ...(followed ? { note: "" } : {}) };
                            return { ...prev, meals };
                          });
                        return (
                          <div key={meal} className={`bg-card rounded-xl border p-3 space-y-2 ${seguiu ? "border-green-300 dark:border-green-500/30" : "border-border"}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-xs font-bold">{mealEmojis[meal] || "🍽️"} {meal}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => marcar(true, seguiu)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors ${
                                    seguiu
                                      ? "bg-green-100 dark:bg-green-500/20 border-green-400 text-green-600"
                                      : "bg-muted/30 border-border text-muted-foreground hover:border-green-300 dark:border-green-500/20"
                                  }`}
                                >✅</button>
                                <button
                                  onClick={() => marcar(false, naoSeguiu)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors ${
                                    naoSeguiu
                                      ? "bg-red-100 dark:bg-red-500/20 border-red-400 text-red-600"
                                      : "bg-muted/30 border-border text-muted-foreground hover:border-red-300 dark:border-red-500/20"
                                  }`}
                                >❌</button>
                              </div>
                            </div>
                            {naoSeguiu && (
                              <Input
                                value={mealDiary.note}
                                onChange={e => updateDayDiary(diaryDate, prev => ({
                                  ...prev,
                                  meals: { ...prev.meals, [meal]: { ...mealDiary, note: e.target.value } }
                                }))}
                                placeholder="Por que não comeu?"
                                className="text-xs h-8"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-xl border border-border p-4 text-center">
                      <UtensilsCrossed className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-xs text-muted-foreground">Nenhuma refeição planejada para {dayName}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Adicione refeições na aba Cardápio</p>
                    </div>
                  )}

                  {/* Extra food section */}
                  <div className="bg-card rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold">Comeu algo fora da dieta?</p>
                        <p className="text-[10px] text-muted-foreground">Registre qualquer "furo" sem culpa 😊</p>
                      </div>
                      <Switch
                        checked={diary.extraFood.had}
                        onCheckedChange={checked => updateDayDiary(diaryDate, prev => ({
                          ...prev,
                          extraFood: { ...prev.extraFood, had: checked, description: checked ? prev.extraFood.description : "" }
                        }))}
                      />
                    </div>
                    {diary.extraFood.had && (
                      <Input
                        value={diary.extraFood.description}
                        onChange={e => updateDayDiary(diaryDate, prev => ({
                          ...prev,
                          extraFood: { ...prev.extraFood, description: e.target.value }
                        }))}
                        placeholder="O que comeu? (ex: bolo na festa)"
                        className="text-xs h-8"
                      />
                    )}
                  </div>

                  {/* 7-day adherence */}
                  <div className="bg-card rounded-xl border border-border p-3">
                    <p className="text-[10px] font-bold text-muted-foreground mb-2">ADERÊNCIA — ÚLTIMOS 7 DIAS</p>
                    <div className="flex gap-1.5">
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(); d.setDate(d.getDate() - (6 - i));
                        const dateStr = localDayKey(d);
                        const dayDiary = getDayDiary(dateStr);
                        const dayNameCheck = getDiaryDayName(dateStr);
                        const dayMealsCheck = mealPlan[dayNameCheck];
                        const planned = dayMealsCheck ? Object.entries(dayMealsCheck).filter(([, v]) => v && v.trim()) : [];
                        const allGood = planned.length > 0 && planned.every(([m]) => dayDiary.meals[m]?.followed);
                        const anyMarked = planned.some(([m]) => dayDiary.meals[m]);
                        return (
                          <div key={i} className="flex-1 text-center">
                            <div className={`w-full aspect-square rounded-lg flex items-center justify-center text-sm border ${
                              allGood ? "bg-green-100 dark:bg-green-500/20 border-green-300 text-green-600 dark:border-green-500/20" :
                              anyMarked ? "bg-red-100 dark:bg-red-500/20 border-red-300 text-red-600 dark:border-red-500/20" :
                              "bg-muted/30 border-border text-muted-foreground"
                            }`}>
                              {allGood ? "✅" : anyMarked ? "❌" : "—"}
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-0.5">
                              {d.toLocaleDateString("pt-BR", { weekday: "narrow" })}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>}
        
      </main>
    </div>
  );
};

export default Dieta;
