import { useState, useEffect, useRef } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate } from "react-router-dom";
import { ModuleTip } from "@/components/ModuleTip";
import {
  ArrowLeft, Plus, X, Trash2, Star, Target, Heart, Shield, Brain,
  Lightbulb, BookOpen, Award, Eye, Sparkles, Edit3, Check, ChevronRight,
  Flame, TrendingUp, Users, Compass, Zap, MessageCircle, Wind, Calendar,
  Headphones, PenTool, BarChart3, Timer, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";


const defaultAffirmations: string[] = [];
const defaultMotivations: string[] = [];

const lifeAreas = [
  { id: "saude", name: "Saúde", icon: Heart, color: "text-red-400" },
  { id: "financas", name: "Finanças", icon: TrendingUp, color: "text-green-400" },
  { id: "relacionamentos", name: "Relacionamentos", icon: Users, color: "text-pink-400" },
  { id: "carreira", name: "Carreira", icon: Award, color: "text-blue-400" },
  { id: "espiritualidade", name: "Espiritualidade", icon: Sparkles, color: "text-purple-400" },
  { id: "lazer", name: "Lazer", icon: Star, color: "text-yellow-400" },
  { id: "intelectual", name: "Intelectual", icon: BookOpen, color: "text-cyan-400" },
  { id: "emocional", name: "Emocional", icon: Brain, color: "text-orange-400" },
];

const motivationalQuotes = [
  "A disciplina é a ponte entre metas e conquistas.", "Você não precisa ser perfeito, precisa ser consistente.",
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.", "Acredite em você. Você é mais forte do que imagina.",
  "Grandes coisas nunca vieram de zonas de conforto.", "Sua única limitação é a sua mente.",
  "Não espere por oportunidades. Crie-as.", "O melhor investimento é em você mesmo.",
  "Foco no progresso, não na perfeição.", "Cada dia é uma nova chance de mudar sua vida.",
];

const moodOptions = [
  { emoji: "😄", label: "Ótimo", value: 5, color: "bg-green-400" },
  { emoji: "🙂", label: "Bem", value: 4, color: "bg-green-300" },
  { emoji: "😐", label: "Neutro", value: 3, color: "bg-yellow-300" },
  { emoji: "😕", label: "Meh", value: 2, color: "bg-orange-300" },
  { emoji: "😞", label: "Ruim", value: 1, color: "bg-red-300" },
];

const DesenvolvimentoPessoal = () => {
  const navigate = useNavigate();

  // SOBRE MIM
  const [motivations, setMotivations] = usePersistedState<string[]>("dp-motivations", defaultMotivations);
  const [newMotivation, setNewMotivation] = useState("");
  const [affirmations, setAffirmations] = usePersistedState<string[]>("dp-affirmations", defaultAffirmations);
  const [newAffirmation, setNewAffirmation] = useState("");
  const [strengths, setStrengths] = usePersistedState<string[]>("dp-strengths", []);
  const [newStrength, setNewStrength] = useState("");
  const [weaknesses, setWeaknesses] = usePersistedState<string[]>("dp-weaknesses", []);
  const [newWeakness, setNewWeakness] = useState("");
  const [skills, setSkills] = usePersistedState<string[]>("dp-skills", []);
  const [newSkill, setNewSkill] = useState("");
  const [skillsToLearn, setSkillsToLearn] = usePersistedState<string[]>("dp-skills-learn", []);
  const [newSkillToLearn, setNewSkillToLearn] = useState("");
  const [values, setValues] = usePersistedState<string[]>("dp-values", []);
  const [newValue, setNewValue] = useState("");
  const [canControl, setCanControl] = usePersistedState<string[]>("dp-can-control", []);
  const [newCanControl, setNewCanControl] = useState("");
  const [cantControl, setCantControl] = usePersistedState<string[]>("dp-cant-control", []);
  const [newCantControl, setNewCantControl] = useState("");

  // METAS
  const [lifeGoals, setLifeGoals] = usePersistedState<{id: string; text: string; deadline: string; done: boolean}[]>("dp-life-goals", []);
  const [newGoalText, setNewGoalText] = useState("");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");

  // RODA DA VIDA
  const [wheelScores, setWheelScores] = usePersistedState<Record<string, number>>("dp-wheel",
    Object.fromEntries(lifeAreas.map(a => [a.id, 5]))
  );

  // BUCKET LIST
  const [bucketList, setBucketList] = usePersistedState<{id: string; text: string; done: boolean}[]>("dp-bucket", []);
  const [newBucket, setNewBucket] = useState("");

  // GRATIDÃO
  const [gratitudeEntries, setGratitudeEntries] = usePersistedState<Record<string, string[]>>("dp-gratitude", {});
  const today = new Date().toISOString().split("T")[0];
  const [todayGratitude, setTodayGratitude] = useState<string[]>(() => gratitudeEntries[today] || ["", "", ""]);

  // LEITURAS
  const [books, setBooks] = usePersistedState<{id: string; title: string; author: string; status: string; rating: number; notes: string}[]>("dp-books", []);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookAuthor, setNewBookAuthor] = useState("");

  // VISÃO
  const [visionItems, setVisionItems] = usePersistedState<{id: string; category: string; text: string}[]>("dp-vision", []);
  const [newVisionText, setNewVisionText] = useState("");
  const [newVisionCategory, setNewVisionCategory] = useState("carreira");

  // === NEW: JOURNALING ===
  const [journalEntries, setJournalEntries] = usePersistedState<Record<string, { text: string; prompt: string }>> ("dp-journal", {});
  const journalPrompts = [
    "O que aprendi hoje?", "O que me incomodou hoje e por quê?", "O que me fez sorrir hoje?",
    "Se eu pudesse mudar uma coisa no meu dia, o que seria?", "O que estou evitando enfrentar?",
    "Qual foi minha maior vitória recente?", "Como me sinto agora e por quê?",
  ];
  const [todayJournal, setTodayJournal] = useState(journalEntries[today]?.text || "");
  const [todayPrompt] = useState(() => journalEntries[today]?.prompt || journalPrompts[Math.floor(Math.random() * journalPrompts.length)]);

  // === NEW: MOOD TRACKER ===
  const [moodLog, setMoodLog] = usePersistedState<Record<string, number>>("dp-mood-log", {});

  // === NEW: BREATHING TIMER ===
  const [breathPhase, setBreathPhase] = useState<"idle" | "in" | "hold" | "out">("idle");
  const [breathCount, setBreathCount] = useState(0);
  const [breathTimer, setBreathTimer] = useState(0);
  const breathRef = useRef<NodeJS.Timeout | null>(null);

  const startBreathing = () => {
    setBreathPhase("in"); setBreathCount(0); setBreathTimer(4);
    let phase: "in" | "hold" | "out" = "in";
    let count = 0;
    const cycle = () => {
      if (phase === "in") { phase = "hold"; setBreathPhase("hold"); setBreathTimer(7); }
      else if (phase === "hold") { phase = "out"; setBreathPhase("out"); setBreathTimer(8); }
      else { count++; setBreathCount(count); if (count >= 4) { stopBreathing(); return; } phase = "in"; setBreathPhase("in"); setBreathTimer(4); }
    };
    const tick = () => {
      setBreathTimer(prev => {
        if (prev <= 1) { cycle(); return phase === "in" ? 4 : phase === "hold" ? 7 : 8; }
        return prev - 1;
      });
    };
    breathRef.current = setInterval(tick, 1000);
  };
  const stopBreathing = () => { if (breathRef.current) clearInterval(breathRef.current); setBreathPhase("idle"); };
  useEffect(() => () => { if (breathRef.current) clearInterval(breathRef.current); }, []);

  // === NEW: LETTER TO FUTURE SELF ===
  const [futureLetter, setFutureLetter] = usePersistedState<{text: string; openDate: string; written: string}>("dp-future-letter", { text: "", openDate: "", written: "" });
  const [letterDraft, setLetterDraft] = useState(futureLetter.text);
  const [letterDate, setLetterDate] = useState(futureLetter.openDate);
  const canOpenLetter = futureLetter.openDate && new Date() >= new Date(futureLetter.openDate);

  // === NEW: 30-DAY CHALLENGE ===
  const [challenges, setChallenges] = usePersistedState<{name: string; days: boolean[]}[]>("dp-challenges", []);
  const [newChallengeName, setNewChallengeName] = useState("");

  // === NEW: SCORECARD SEMANAL ===
  const [weeklyScores, setWeeklyScores] = usePersistedState<Record<string, Record<string, number>>>("dp-weekly-scores", {});
  const currentWeek = (() => { const d = new Date(); const start = new Date(d.getFullYear(), 0, 1); return `${d.getFullYear()}-W${Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)}`; })();
  const thisWeekScores = weeklyScores[currentWeek] || Object.fromEntries(lifeAreas.map(a => [a.id, 5]));

  // === NEW: COURSES/PODCASTS TRACKER ===
  const [courses, setCourses] = usePersistedState<{id: string; title: string; platform: string; status: string; progress: number; notes: string}[]>("dp-courses", []);
  const [newCourseTitle, setNewCourseTitle] = useState("");

  // === NEW: DAILY QUOTE ===
  const [dailyQuote] = useState(() => motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]);

  const addToList = (list: string[], setList: (v: string[]) => void, value: string, setValue: (v: string) => void) => {
    if (value.trim()) { setList([...list, value.trim()]); setValue(""); }
  };
  const removeFromList = (list: string[], setList: (v: string[]) => void, idx: number) => {
    setList(list.filter((_, i) => i !== idx));
  };
  const saveGratitude = () => { setGratitudeEntries({ ...gratitudeEntries, [today]: todayGratitude }); };

  const ListEditor = ({ items, setItems, newItem, setNewItem, placeholder, colorClass }: {
    items: string[]; setItems: (v: string[]) => void; newItem: string; setNewItem: (v: string) => void; placeholder: string; colorClass: string;
  }) => (
    <div>
      <div className="flex gap-2 mb-2">
        <Input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder={placeholder}
          className="text-xs h-8" onKeyDown={e => e.key === "Enter" && addToList(items, setItems, newItem, setNewItem)} />
        <Button size="sm" className="h-8 px-2" onClick={() => addToList(items, setItems, newItem, setNewItem)}><Plus className="w-3 h-3" /></Button>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs ${colorClass}`}>
            <span>{item}</span>
            <button onClick={() => removeFromList(items, setItems, i)} className="opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" /> DEV. PESSOAL
            </h1>
            <p className="text-xs text-muted-foreground">Conheça-se, evolua, conquiste</p>
          </div>
        </div>
      </header>

      {/* Daily Quote Banner */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">💡 Frase do dia</p>
          <p className="text-sm font-bold italic">"{dailyQuote}"</p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-4">
        <ModuleTip
          moduleId="desenvolvimento"
          tips={[
            "Preencha a Roda da Vida para visualizar áreas que precisam de atenção",
            "Escreva 3 coisas pelas quais é grato no diário de gratidão",
            "Defina seus valores e forças pessoais na aba 🧠 Sobre Mim",
            "Crie afirmações positivas e leia-as diariamente"
          ]}
        />
        <Tabs defaultValue="sobre" className="w-full">
          <TabsList className="w-full flex overflow-x-auto gap-1 bg-muted/50 p-1 mb-4 h-auto flex-wrap">
            {[
              { v: "sobre", l: "SOBRE MIM" }, { v: "metas", l: "METAS" }, { v: "roda", l: "RODA DA VIDA" },
              { v: "diario", l: "DIÁRIO" }, { v: "humor", l: "HUMOR" }, { v: "respiracao", l: "RESPIRAÇÃO" },
              { v: "leituras", l: "LEITURAS" }, { v: "cursos", l: "CURSOS" }, { v: "bucket", l: "BUCKET LIST" },
              { v: "visao", l: "VISÃO" }, { v: "gratidao", l: "GRATIDÃO" }, { v: "carta", l: "CARTA" },
              { v: "desafios", l: "30 DIAS" }, { v: "scorecard", l: "SCORECARD" },
            ].map(t => (
              <TabsTrigger key={t.v} value={t.v} className="text-xs px-3 py-1.5">{t.l}</TabsTrigger>
            ))}
          </TabsList>

          {/* ========== SOBRE MIM ========== */}
          <TabsContent value="sobre" className="space-y-4">
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-500/10 dark:to-amber-500/10 rounded-xl border border-yellow-200 dark:border-yellow-500/30 p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /> O QUE ME MOTIVA A ACORDAR TODOS OS DIAS?</h3>
              <ListEditor items={motivations} setItems={setMotivations} newItem={newMotivation} setNewItem={setNewMotivation}
                placeholder="Adicionar motivação..." colorClass="bg-yellow-100/80 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-500/10 dark:to-rose-500/10 rounded-xl border border-pink-200 dark:border-pink-500/30 p-4">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-pink-500" /> AFIRMAÇÕES</h3>
                <ListEditor items={affirmations} setItems={setAffirmations} newItem={newAffirmation} setNewItem={setNewAffirmation}
                  placeholder="Nova afirmação..." colorClass="bg-pink-100/80 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-500/20" />
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 rounded-xl border border-green-200 dark:border-green-500/30 p-4">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-green-500" /> MINHAS FORÇAS</h3>
                <ListEditor items={strengths} setItems={setStrengths} newItem={newStrength} setNewItem={setNewStrength}
                  placeholder="Nova força..." colorClass="bg-green-100/80 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20" />
              </div>
              <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-500/10 dark:to-orange-500/10 rounded-xl border border-red-200 dark:border-red-500/30 p-4">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-red-400" /> MINHAS FRAQUEZAS</h3>
                <ListEditor items={weaknesses} setItems={setWeaknesses} newItem={newWeakness} setNewItem={setNewWeakness}
                  placeholder="Nova fraqueza..." colorClass="bg-red-100/80 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20" />
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-500/10 dark:to-sky-500/10 rounded-xl border border-blue-200 dark:border-blue-500/30 p-4">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-blue-500" /> MINHAS HABILIDADES</h3>
                <ListEditor items={skills} setItems={setSkills} newItem={newSkill} setNewItem={setNewSkill}
                  placeholder="Nova habilidade..." colorClass="bg-blue-100/80 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20" />
              </div>
              <div className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-500/10 dark:to-teal-500/10 rounded-xl border border-cyan-200 dark:border-cyan-500/30 p-4">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-cyan-500" /> QUERO DESENVOLVER</h3>
                <ListEditor items={skillsToLearn} setItems={setSkillsToLearn} newItem={newSkillToLearn} setNewItem={setNewSkillToLearn}
                  placeholder="Nova habilidade..." colorClass="bg-cyan-100/80 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20" />
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-500/10 dark:to-violet-500/10 rounded-xl border border-purple-200 dark:border-purple-500/30 p-4">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Compass className="w-4 h-4 text-purple-500" /> VALORES INEGOCIÁVEIS</h3>
                <ListEditor items={values} setItems={setValues} newItem={newValue} setNewItem={setNewValue}
                  placeholder="Novo valor..." colorClass="bg-purple-100/80 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/30 p-4">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> O QUE EU POSSO CONTROLAR</h3>
                <ListEditor items={canControl} setItems={setCanControl} newItem={newCanControl} setNewItem={setNewCanControl}
                  placeholder="Adicionar..." colorClass="bg-emerald-100/80 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20" />
              </div>
              <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-500/10 dark:to-gray-500/10 rounded-xl border border-slate-200 dark:border-slate-500/30 p-4">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Eye className="w-4 h-4 text-slate-500" /> NÃO POSSO CONTROLAR, MAS INFLUENCIO</h3>
                <ListEditor items={cantControl} setItems={setCantControl} newItem={newCantControl} setNewItem={setNewCantControl}
                  placeholder="Adicionar..." colorClass="bg-slate-100/80 dark:bg-slate-500/10 border border-slate-200 dark:border-slate-500/20" />
              </div>
            </div>
          </TabsContent>

          {/* ========== METAS ========== */}
          <TabsContent value="metas" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Target className="w-4 h-4" /> METAS DE VIDA</h3>
              <div className="flex gap-2 mb-3">
                <Input value={newGoalText} onChange={e => setNewGoalText(e.target.value)} placeholder="Ex: Comprar minha casa" className="text-xs h-8 flex-1" />
                <Input type="date" value={newGoalDeadline} onChange={e => setNewGoalDeadline(e.target.value)} className="text-xs h-8 w-36" />
                <Button size="sm" className="h-8" onClick={() => {
                  if (newGoalText.trim()) { setLifeGoals([...lifeGoals, { id: Date.now().toString(), text: newGoalText.trim(), deadline: newGoalDeadline, done: false }]); setNewGoalText(""); setNewGoalDeadline(""); }
                }}><Plus className="w-3 h-3" /></Button>
              </div>
              <div className="space-y-2">
                {lifeGoals.map((g, i) => (
                  <div key={g.id} className={`flex items-center gap-3 rounded-lg p-3 border ${g.done ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30" : "bg-muted/30 border-border"}`}>
                    <button onClick={() => { const u = [...lifeGoals]; u[i] = { ...g, done: !g.done }; setLifeGoals(u); }}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${g.done ? "bg-green-500 border-green-500" : "border-muted-foreground/30"}`}>
                      {g.done && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${g.done ? "line-through text-muted-foreground" : ""}`}>{g.text}</p>
                      {g.deadline && <p className="text-xs text-muted-foreground">Prazo: {new Date(g.deadline).toLocaleDateString("pt-BR")}</p>}
                    </div>
                    <button onClick={() => setLifeGoals(lifeGoals.filter(x => x.id !== g.id))}><Trash2 className="w-3 h-3 text-muted-foreground" /></button>
                  </div>
                ))}
                {lifeGoals.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Adicione suas metas de vida ✨</p>}
              </div>
            </div>
          </TabsContent>

          {/* ========== RODA DA VIDA ========== */}
          <TabsContent value="roda" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-2 flex items-center gap-2"><Compass className="w-4 h-4" /> RODA DA VIDA</h3>
              <p className="text-xs text-muted-foreground mb-4">Avalie de 0 a 10 sua satisfação em cada área:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lifeAreas.map(area => {
                  const Icon = area.icon; const score = wheelScores[area.id];
                  return (
                    <div key={area.id} className="bg-muted/30 rounded-lg p-3 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${area.color}`} /><span className="text-xs font-bold">{area.name}</span>
                        <span className="ml-auto text-lg font-bold">{score}</span>
                      </div>
                      <input type="range" min={0} max={10} value={score}
                        onChange={e => setWheelScores({ ...wheelScores, [area.id]: Number(e.target.value) })}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary" />
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-3 border border-purple-500/20">
                <p className="text-xs font-bold">📈 Média: {(Object.values(wheelScores).reduce((a, b) => a + b, 0) / lifeAreas.length).toFixed(1)}/10</p>
              </div>
            </div>
          </TabsContent>

          {/* ========== DIÁRIO / JOURNALING ========== */}
          <TabsContent value="diario" className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-xl border border-indigo-200 dark:border-indigo-500/30 p-4">
              <h3 className="text-xs font-bold mb-2 flex items-center gap-2"><PenTool className="w-4 h-4 text-indigo-500" /> DIÁRIO DE REFLEXÃO — {new Date().toLocaleDateString("pt-BR")}</h3>
              <div className="bg-indigo-100/50 dark:bg-indigo-500/5 rounded-lg p-3 mb-3 border border-indigo-200/50">
                <p className="text-xs text-muted-foreground mb-1">💭 Prompt do dia:</p>
                <p className="text-sm font-medium italic">{todayPrompt}</p>
              </div>
              <Textarea value={todayJournal} onChange={e => setTodayJournal(e.target.value)}
                placeholder="Escreva livremente seus pensamentos..." className="text-xs min-h-[150px] mb-3" />
              <Button size="sm" className="w-full" onClick={() => {
                setJournalEntries({ ...journalEntries, [today]: { text: todayJournal, prompt: todayPrompt } });
              }}>Salvar reflexão 📝</Button>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3">📅 REFLEXÕES ANTERIORES</h3>
              <div className="space-y-2">
                {Object.entries(journalEntries).filter(([d]) => d !== today).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10).map(([date, entry]) => (
                  <div key={date} className="bg-muted/30 rounded-lg p-3 border border-border">
                    <p className="text-xs font-bold mb-1">{new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
                    <p className="text-[10px] text-muted-foreground italic mb-1">Prompt: {entry.prompt}</p>
                    <p className="text-xs">{entry.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ========== MOOD TRACKER ========== */}
          <TabsContent value="humor" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Brain className="w-4 h-4" /> COMO VOCÊ ESTÁ HOJE?</h3>
              <div className="flex justify-center gap-3 mb-4">
                {moodOptions.map(m => (
                  <button key={m.value} onClick={() => setMoodLog({ ...moodLog, [today]: m.value })}
                    className={`text-3xl p-3 rounded-xl border-2 transition-all ${moodLog[today] === m.value ? `${m.color} border-primary scale-110` : "border-border hover:scale-105"}`}>
                    {m.emoji}
                  </button>
                ))}
              </div>
              {moodLog[today] && <p className="text-xs text-center text-muted-foreground">Hoje: {moodOptions.find(m => m.value === moodLog[today])?.label} {moodOptions.find(m => m.value === moodLog[today])?.emoji}</p>}
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3">📊 HUMOR DOS ÚLTIMOS 14 DIAS</h3>
              <div className="flex items-end gap-1 h-32">
                {Array.from({ length: 14 }, (_, i) => {
                  const d = new Date(); d.setDate(d.getDate() - (13 - i));
                  const key = d.toISOString().split("T")[0];
                  const val = moodLog[key] || 0;
                  const colors = ["", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-300", "bg-green-500"];
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-full rounded-t ${val ? colors[val] : "bg-muted/30"}`} style={{ height: `${val ? val * 20 : 5}%` }} />
                      <span className="text-[8px] text-muted-foreground">{d.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ========== BREATHING ========== */}
          <TabsContent value="respiracao" className="space-y-4">
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-500/10 dark:to-cyan-500/10 rounded-xl border border-teal-200 dark:border-teal-500/30 p-6 text-center">
              <h3 className="text-xs font-bold mb-4 flex items-center justify-center gap-2"><Wind className="w-4 h-4 text-teal-500" /> RESPIRAÇÃO 4-7-8</h3>
              <div className={`w-32 h-32 mx-auto rounded-full border-4 flex items-center justify-center mb-4 transition-all duration-1000 ${
                breathPhase === "in" ? "scale-125 border-teal-400 bg-teal-100 dark:bg-teal-500/20" :
                breathPhase === "hold" ? "scale-125 border-amber-400 bg-amber-100 dark:bg-amber-500/20" :
                breathPhase === "out" ? "scale-75 border-blue-400 bg-blue-100 dark:bg-blue-500/20" :
                "border-border bg-muted/30"
              }`}>
                <div className="text-center">
                  <p className="text-2xl font-bold">{breathPhase === "idle" ? "🧘" : breathTimer}</p>
                  <p className="text-xs font-medium">{breathPhase === "in" ? "INSPIRE" : breathPhase === "hold" ? "SEGURE" : breathPhase === "out" ? "EXPIRE" : "Pronto?"}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Ciclo {breathCount}/4</p>
              {breathPhase === "idle" ? (
                <Button onClick={startBreathing} className="bg-teal-500 hover:bg-teal-600 text-white">Iniciar respiração</Button>
              ) : (
                <Button onClick={stopBreathing} variant="outline">Parar</Button>
              )}
              <p className="text-xs text-muted-foreground mt-4">Inspire por 4s → Segure por 7s → Expire por 8s. Reduz ansiedade e estresse.</p>
            </div>
          </TabsContent>

          {/* ========== LEITURAS ========== */}
          <TabsContent value="leituras" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" /> MEUS LIVROS</h3>
              <div className="flex gap-2 mb-3">
                <Input value={newBookTitle} onChange={e => setNewBookTitle(e.target.value)} placeholder="Título" className="text-xs h-8 flex-1" />
                <Input value={newBookAuthor} onChange={e => setNewBookAuthor(e.target.value)} placeholder="Autor" className="text-xs h-8 w-32" />
                <Button size="sm" className="h-8" onClick={() => {
                  if (newBookTitle.trim()) { setBooks([...books, { id: Date.now().toString(), title: newBookTitle.trim(), author: newBookAuthor.trim(), status: "lendo", rating: 0, notes: "" }]); setNewBookTitle(""); setNewBookAuthor(""); }
                }}><Plus className="w-3 h-3" /></Button>
              </div>
              {books.map((book, i) => (
                <div key={book.id} className="bg-muted/30 rounded-lg p-3 border border-border mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div><p className="text-sm font-bold">{book.title}</p><p className="text-xs text-muted-foreground">{book.author}</p></div>
                    <div className="flex items-center gap-2">
                      <select value={book.status} onChange={e => { const u = [...books]; u[i] = { ...book, status: e.target.value }; setBooks(u); }} className="text-xs bg-background border border-border rounded px-2 py-1">
                        <option value="quero-ler">Quero ler</option><option value="lendo">Lendo</option><option value="lido">Lido</option>
                      </select>
                      <button onClick={() => setBooks(books.filter(b => b.id !== book.id))}><Trash2 className="w-3 h-3 text-muted-foreground" /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => { const u = [...books]; u[i] = { ...book, rating: s }; setBooks(u); }}>
                        <Star className={`w-4 h-4 ${s <= book.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
                      </button>
                    ))}
                  </div>
                  <Textarea value={book.notes} onChange={e => { const u = [...books]; u[i] = { ...book, notes: e.target.value }; setBooks(u); }} placeholder="Anotações..." className="text-xs min-h-[50px]" />
                </div>
              ))}
              {books.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Adicione livros 📚</p>}
            </div>
          </TabsContent>

          {/* ========== CURSOS/PODCASTS ========== */}
          <TabsContent value="cursos" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Headphones className="w-4 h-4" /> CURSOS E PODCASTS</h3>
              <div className="flex gap-2 mb-3">
                <Input value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} placeholder="Nome do curso/podcast" className="text-xs h-8 flex-1" />
                <Button size="sm" className="h-8" onClick={() => {
                  if (newCourseTitle.trim()) { setCourses([...courses, { id: Date.now().toString(), title: newCourseTitle.trim(), platform: "", status: "em-andamento", progress: 0, notes: "" }]); setNewCourseTitle(""); }
                }}><Plus className="w-3 h-3" /></Button>
              </div>
              {courses.map((c, i) => (
                <div key={c.id} className="bg-muted/30 rounded-lg p-3 border border-border mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold">{c.title}</p>
                    <div className="flex items-center gap-2">
                      <select value={c.status} onChange={e => { const u = [...courses]; u[i] = { ...c, status: e.target.value }; setCourses(u); }} className="text-xs bg-background border border-border rounded px-2 py-1">
                        <option value="quero-fazer">Quero fazer</option><option value="em-andamento">Em andamento</option><option value="concluido">Concluído</option>
                      </select>
                      <button onClick={() => setCourses(courses.filter(x => x.id !== c.id))}><Trash2 className="w-3 h-3 text-muted-foreground" /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground">Progresso:</span>
                    <input type="range" min={0} max={100} value={c.progress} onChange={e => { const u = [...courses]; u[i] = { ...c, progress: Number(e.target.value) }; setCourses(u); }} className="flex-1 h-2 accent-primary" />
                    <span className="text-xs font-bold">{c.progress}%</span>
                  </div>
                  <Textarea value={c.notes} onChange={e => { const u = [...courses]; u[i] = { ...c, notes: e.target.value }; setCourses(u); }} placeholder="Anotações..." className="text-xs min-h-[40px]" />
                </div>
              ))}
              {courses.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Adicione cursos ou podcasts 🎧</p>}
            </div>
          </TabsContent>

          {/* ========== BUCKET LIST ========== */}
          <TabsContent value="bucket" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" /> BUCKET LIST</h3>
              <div className="flex gap-2 mb-3">
                <Input value={newBucket} onChange={e => setNewBucket(e.target.value)} placeholder="Ex: Conhecer a Aurora Boreal" className="text-xs h-8 flex-1"
                  onKeyDown={e => { if (e.key === "Enter" && newBucket.trim()) { setBucketList([...bucketList, { id: Date.now().toString(), text: newBucket.trim(), done: false }]); setNewBucket(""); }}} />
                <Button size="sm" className="h-8" onClick={() => { if (newBucket.trim()) { setBucketList([...bucketList, { id: Date.now().toString(), text: newBucket.trim(), done: false }]); setNewBucket(""); }}}><Plus className="w-3 h-3" /></Button>
              </div>
              {bucketList.map((item, i) => (
                <div key={item.id} className={`flex items-center gap-3 rounded-lg p-3 border mb-1 ${item.done ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30" : "bg-muted/30 border-border"}`}>
                  <button onClick={() => { const u = [...bucketList]; u[i] = { ...item, done: !item.done }; setBucketList(u); }}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.done ? "bg-green-500 border-green-500" : "border-muted-foreground/30"}`}>
                    {item.done && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                  <button onClick={() => setBucketList(bucketList.filter(x => x.id !== item.id))}><Trash2 className="w-3 h-3 text-muted-foreground" /></button>
                </div>
              ))}
              {bucketList.length > 0 && <p className="text-xs text-muted-foreground mt-2">✅ {bucketList.filter(b => b.done).length}/{bucketList.length} realizados</p>}
              {bucketList.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">O que você quer fazer na vida? 🌍</p>}
            </div>
          </TabsContent>

          {/* ========== VISÃO ========== */}
          <TabsContent value="visao" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Eye className="w-4 h-4" /> QUADRO DE VISÃO</h3>
              <div className="flex gap-2 mb-3">
                <select value={newVisionCategory} onChange={e => setNewVisionCategory(e.target.value)} className="text-xs bg-background border border-border rounded px-2 py-1 h-8">
                  {lifeAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <Input value={newVisionText} onChange={e => setNewVisionText(e.target.value)} placeholder="Ex: Morar na praia" className="text-xs h-8 flex-1" />
                <Button size="sm" className="h-8" onClick={() => { if (newVisionText.trim()) { setVisionItems([...visionItems, { id: Date.now().toString(), category: newVisionCategory, text: newVisionText.trim() }]); setNewVisionText(""); }}}><Plus className="w-3 h-3" /></Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lifeAreas.filter(a => visionItems.some(v => v.category === a.id)).map(area => {
                  const Icon = area.icon;
                  return (
                    <div key={area.id} className="bg-muted/30 rounded-lg p-3 border border-border">
                      <h4 className="text-xs font-bold flex items-center gap-2 mb-2"><Icon className={`w-3 h-3 ${area.color}`} />{area.name}</h4>
                      {visionItems.filter(v => v.category === area.id).map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs mb-1">
                          <span>✨ {item.text}</span>
                          <button onClick={() => setVisionItems(visionItems.filter(v => v.id !== item.id))}><X className="w-3 h-3 text-muted-foreground" /></button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {visionItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Adicione seus sonhos 🎯</p>}
            </div>
          </TabsContent>

          {/* ========== GRATIDÃO ========== */}
          <TabsContent value="gratidao" className="space-y-4">
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10 rounded-xl border border-amber-200 dark:border-amber-500/30 p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-amber-500" /> GRATIDÃO — {new Date().toLocaleDateString("pt-BR")}</h3>
              {[0,1,2].map(i => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{i + 1}.</span>
                  <Input value={todayGratitude[i] || ""} onChange={e => { const u = [...todayGratitude]; u[i] = e.target.value; setTodayGratitude(u); }} placeholder="Sou grato(a) por..." className="text-xs h-8" />
                </div>
              ))}
              <Button size="sm" className="mt-2 w-full" onClick={saveGratitude}>Salvar 🙏</Button>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3">📅 HISTÓRICO</h3>
              {Object.entries(gratitudeEntries).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14).map(([date, items]) => (
                <div key={date} className="bg-muted/30 rounded-lg p-3 border border-border mb-2">
                  <p className="text-xs font-bold mb-1">{new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
                  {items.filter(Boolean).map((item, i) => <p key={i} className="text-xs text-muted-foreground">• {item}</p>)}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ========== CARTA PARA O FUTURO ========== */}
          <TabsContent value="carta" className="space-y-4">
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-500/10 dark:to-pink-500/10 rounded-xl border border-rose-200 dark:border-rose-500/30 p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Mail className="w-4 h-4 text-rose-500" /> CARTA PARA O EU DO FUTURO</h3>
              {futureLetter.written && !canOpenLetter ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">📩</p>
                  <p className="text-sm font-bold">Carta selada!</p>
                  <p className="text-xs text-muted-foreground">Será aberta em: {new Date(futureLetter.openDate).toLocaleDateString("pt-BR")}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setFutureLetter({ text: "", openDate: "", written: "" })}>Escrever nova carta</Button>
                </div>
              ) : canOpenLetter ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">📬 Sua carta está pronta para ser aberta!</p>
                  <div className="bg-white dark:bg-background rounded-lg p-4 border border-rose-200">
                    <p className="text-xs italic whitespace-pre-wrap">{futureLetter.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">Escrita em: {new Date(futureLetter.written).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setFutureLetter({ text: "", openDate: "", written: "" })}>Escrever nova carta</Button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground mb-3">Escreva uma carta para você mesmo no futuro. Só poderá ler na data escolhida:</p>
                  <Textarea value={letterDraft} onChange={e => setLetterDraft(e.target.value)}
                    placeholder="Querido(a) eu do futuro..." className="text-xs min-h-[120px] mb-3" />
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs">Abrir em:</span>
                    <Input type="date" value={letterDate} onChange={e => setLetterDate(e.target.value)} className="text-xs h-8 w-40" />
                  </div>
                  <Button size="sm" className="w-full" onClick={() => {
                    if (letterDraft.trim() && letterDate) {
                      setFutureLetter({ text: letterDraft, openDate: letterDate, written: today });
                      setLetterDraft(""); setLetterDate("");
                    }
                  }}>Selar carta ✉️</Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ========== 30-DAY CHALLENGES ========== */}
          <TabsContent value="desafios" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" /> DESAFIOS DE 30 DIAS</h3>
              <div className="flex gap-2 mb-3">
                <Input value={newChallengeName} onChange={e => setNewChallengeName(e.target.value)} placeholder="Ex: 30 dias de leitura" className="text-xs h-8 flex-1" />
                <Button size="sm" className="h-8" onClick={() => {
                  if (newChallengeName.trim()) { setChallenges([...challenges, { name: newChallengeName.trim(), days: Array(30).fill(false) }]); setNewChallengeName(""); }
                }}><Plus className="w-3 h-3" /></Button>
              </div>
              {challenges.map((ch, ci) => (
                <div key={ci} className="bg-muted/30 rounded-lg p-3 border border-border mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold">{ch.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{ch.days.filter(Boolean).length}/30</span>
                      <button onClick={() => setChallenges(challenges.filter((_, i) => i !== ci))}><Trash2 className="w-3 h-3 text-muted-foreground" /></button>
                    </div>
                  </div>
                  <Progress value={(ch.days.filter(Boolean).length / 30) * 100} className="h-2 mb-2" />
                  <div className="grid grid-cols-10 gap-1">
                    {ch.days.map((done, di) => (
                      <button key={di} onClick={() => {
                        const u = [...challenges]; u[ci] = { ...ch, days: ch.days.map((d, j) => j === di ? !d : d) }; setChallenges(u);
                      }} className={`aspect-square rounded text-[8px] font-medium ${done ? "bg-green-500 text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                        {di + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {challenges.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Crie um desafio de 30 dias! 🔥</p>}
            </div>
          </TabsContent>

          {/* ========== SCORECARD SEMANAL ========== */}
          <TabsContent value="scorecard" className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> SCORECARD SEMANAL — {currentWeek}</h3>
              <p className="text-xs text-muted-foreground mb-4">Dê uma nota de 1 a 10 para cada área nesta semana:</p>
              <div className="space-y-3">
                {lifeAreas.map(area => {
                  const Icon = area.icon; const score = thisWeekScores[area.id] || 5;
                  return (
                    <div key={area.id} className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${area.color}`} />
                      <span className="text-xs font-medium w-28">{area.name}</span>
                      <input type="range" min={1} max={10} value={score}
                        onChange={e => {
                          const updated = { ...thisWeekScores, [area.id]: Number(e.target.value) };
                          setWeeklyScores({ ...weeklyScores, [currentWeek]: updated });
                        }} className="flex-1 h-2 accent-primary" />
                      <span className="text-xs font-bold w-8 text-right">{score}/10</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-3 border border-blue-500/20">
                <p className="text-xs font-bold">📊 Média da semana: {(Object.values(thisWeekScores).reduce((a, b) => a + b, 0) / lifeAreas.length).toFixed(1)}/10</p>
              </div>
            </div>
            {Object.keys(weeklyScores).length > 1 && (
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-xs font-bold mb-3">📈 EVOLUÇÃO SEMANAL</h3>
                <div className="space-y-2">
                  {Object.entries(weeklyScores).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8).map(([week, scores]) => (
                    <div key={week} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-20">{week}</span>
                      <Progress value={(Object.values(scores).reduce((a, b) => a + b, 0) / lifeAreas.length) * 10} className="h-2 flex-1" />
                      <span className="text-xs font-bold">{(Object.values(scores).reduce((a, b) => a + b, 0) / lifeAreas.length).toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default DesenvolvimentoPessoal;
