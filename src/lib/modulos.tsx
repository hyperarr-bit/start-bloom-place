/**
 * Os 16 módulos, na ordem padrão, com rota, ícone, rótulo e cor do tile.
 * Fonte única: a grade da Home (ModuleDrawer) e o trilho lateral do
 * computador (TrilhoLateral) leem daqui. A ordem da PESSOA, favoritos e
 * ocultos vêm de use-module-preferences por cima desta lista.
 */
import {
  DollarSign, CalendarCheck, Sparkles, Heart, Home, GraduationCap,
  BookOpen, Droplets, Plane, Briefcase, Dumbbell, Apple, Brain, Users, PawPrint, Leaf,
} from "lucide-react";

export interface Modulo { id: string; path: string; Icon: typeof DollarSign; label: string; color: string }

export const MODULOS: Modulo[] = [
  { id: "financas", path: "/financas", Icon: DollarSign, label: "Finanças", color: "bg-amber-400/20 text-amber-600" },
  { id: "treino", path: "/treino", Icon: Dumbbell, label: "Treino", color: "bg-blue-400/20 text-blue-600" },
  { id: "dieta", path: "/dieta", Icon: Apple, label: "Dieta", color: "bg-green-400/20 text-green-600" },
  { id: "rotina", path: "/rotina", Icon: CalendarCheck, label: "Rotina", color: "bg-emerald-400/20 text-emerald-600" },
  { id: "desenvolvimento", path: "/desenvolvimento", Icon: Sparkles, label: "Dev. Pessoal", color: "bg-purple-400/20 text-purple-600" },
  { id: "saude", path: "/saude", Icon: Heart, label: "Saúde", color: "bg-red-400/20 text-red-600" },
  { id: "casa", path: "/casa", Icon: Home, label: "Casa", color: "bg-cyan-400/20 text-cyan-600" },
  { id: "estudos", path: "/estudos", Icon: GraduationCap, label: "Estudos", color: "bg-indigo-400/20 text-indigo-600" },
  { id: "biblioteca", path: "/biblioteca", Icon: BookOpen, label: "Biblioteca", color: "bg-orange-400/20 text-orange-600" },
  { id: "beleza", path: "/beleza", Icon: Droplets, label: "Beleza", color: "bg-pink-400/20 text-pink-600" },
  { id: "viagens", path: "/viagens", Icon: Plane, label: "Viagens", color: "bg-teal-400/20 text-teal-600" },
  { id: "carreira", path: "/carreira", Icon: Briefcase, label: "Carreira", color: "bg-slate-400/20 text-slate-600" },
  { id: "hiperfoco", path: "/hiperfoco", Icon: Brain, label: "Mente", color: "bg-violet-400/20 text-violet-600" },
  { id: "relacionamentos", path: "/relacionamentos", Icon: Users, label: "Relações", color: "bg-rose-400/20 text-rose-600" },
  { id: "pet", path: "/pet", Icon: PawPrint, label: "Pet", color: "bg-amber-400/20 text-amber-500" },
  { id: "detox", path: "/detox", Icon: Leaf, label: "Detox", color: "bg-lime-400/20 text-lime-600" },
];
