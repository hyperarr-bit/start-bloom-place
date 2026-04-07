

# Plano: Icones Lucide nos headers + inputs mais claros em Viagens e Carreira

## 1. Trocar emojis por icones Lucide nos headers de todos os modulos

Atualmente todos os 16 modulos usam emojis no header (ex: `<span className="text-teal-600 text-lg">✈️</span>`). O correto e usar o mesmo icone Lucide da Home (`ModuleDrawer.tsx`) com a mesma cor.

| Modulo | Emoji atual | Icone Lucide (da Home) | Cor |
|--------|-------------|----------------------|-----|
| Financas | 💰 | `DollarSign` | `text-amber-600` |
| Treino | 💪 | `Dumbbell` | `text-blue-600` |
| Dieta | 🍎 | `Apple` | `text-green-600` |
| Rotina | 📋 | `CalendarCheck` | `text-emerald-600` |
| Dev. Pessoal | ✨ | `Sparkles` | `text-purple-600` |
| Saude | ❤️ | `Heart` | `text-red-600` |
| Casa | 🏠 | `Home` | `text-cyan-600` |
| Estudos | 🎓 | `GraduationCap` | `text-indigo-600` |
| Biblioteca | 📚 | `BookOpen` | `text-orange-600` |
| Beleza | 💧 | `Droplets` | `text-pink-600` |
| Viagens | ✈️ | `Plane` | `text-teal-600` |
| Carreira | 💼 | `Briefcase` | `text-slate-600` |
| Mente | 🧠 | `Brain` | `text-violet-600` |
| Relacoes | 👥 | `Users` | `text-rose-600` |
| Pet | 🐾 | `PawPrint` | `text-amber-500` |
| Detox | 🌿 | `Leaf` | `text-lime-600` |

Cada `<span className="text-X-600 text-lg">EMOJI</span>` vira `<Plane className="w-5 h-5 text-teal-600" />` (exemplo Viagens).

## 2. Inputs inline mais visiveis em Viagens e Carreira

Atualmente os inputs inline tem `border-none bg-transparent` — ficam invisiveis. Mudar para um estilo com borda tracejada e fundo suave para indicar claramente "digite aqui":

**De:**
```
className="h-7 text-[10px] border-none bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
```

**Para:**
```
className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60"
```

O botao `+ Add` tambem ganha destaque visual — fundo suave com cor do card:
```
className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
```

Aplicar em todos os componentes de Viagens (BucketList, PlacesBoard, TravelDiary, BillSplitter, TripCountdown, PackingChecklist, DailyTimeline) e Carreira (JobTracker, Portfolio, Networking, SkillsTracker, InterviewPrep).

## Arquivos alterados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Index.tsx` | `DollarSign` icon no header |
| `src/pages/Treino.tsx` | `Dumbbell` icon |
| `src/pages/Dieta.tsx` | `Apple` icon |
| `src/pages/Rotina.tsx` | `CalendarCheck` icon |
| `src/pages/DesenvolvimentoPessoal.tsx` | `Sparkles` icon |
| `src/pages/Saude.tsx` | `Heart` icon |
| `src/pages/Casa.tsx` | `Home` icon |
| `src/pages/Estudos.tsx` | `GraduationCap` icon |
| `src/pages/Biblioteca.tsx` | `BookOpen` icon |
| `src/pages/Beleza.tsx` | `Droplets` icon |
| `src/pages/Viagens.tsx` | `Plane` icon |
| `src/pages/Carreira.tsx` | `Briefcase` icon + inputs visiveis |
| `src/pages/Hiperfoco.tsx` | `Brain` icon |
| `src/pages/Relacionamentos.tsx` | `Users` icon |
| `src/pages/Pet.tsx` | `PawPrint` icon |
| `src/pages/Detox.tsx` | `Leaf` icon |
| `src/components/travel/BucketList.tsx` | Inputs visiveis |
| `src/components/travel/PlacesBoard.tsx` | Inputs visiveis |
| `src/components/travel/TravelDiary.tsx` | Inputs visiveis |
| `src/components/travel/BillSplitter.tsx` | Inputs visiveis |
| `src/components/travel/TripCountdown.tsx` | Inputs visiveis |
| `src/components/travel/PackingChecklist.tsx` | Inputs visiveis |
| `src/components/travel/DailyTimeline.tsx` | Inputs visiveis |

