import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  DollarSign, CalendarCheck, Sparkles, Heart, Home, GraduationCap, 
  BookOpen, Droplets, Plane, Briefcase, Dumbbell, Apple, Brain, Users, PawPrint, Leaf, Star, Settings, Eye, EyeOff, BarChart3
} from "lucide-react";
import { useModulePreferences } from "@/hooks/use-module-preferences";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin } from "@/lib/admin";
import { useState } from "react";

const modules = [
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

export const ModuleDrawer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toggleFavorite, toggleHidden, isFavorite, isHidden } = useModulePreferences();
  const [editMode, setEditMode] = useState(false);

  const sorted = [...modules].sort((a, b) => {
    const af = isFavorite(a.id) ? 0 : 1;
    const bf = isFavorite(b.id) ? 0 : 1;
    return af - bf;
  });

  const visible = editMode ? sorted : sorted.filter(m => !isHidden(m.id));
  const hiddenCount = modules.filter(m => isHidden(m.id)).length;

  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Módulos</h2>
          <p className="text-xs text-muted-foreground">Acesse todas as áreas da sua vida</p>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`p-2 rounded-xl transition-colors ${editMode ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground"}`}
          aria-label="Editar módulos"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {visible.map((m, i) => (
          <motion.div
            key={m.id}
            className="relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: isHidden(m.id) ? 0.4 : 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
          >
            {editMode && (
              <div className="absolute -top-1 -right-1 z-10 flex gap-0.5">
                <button
                  onClick={() => toggleFavorite(m.id)}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    isFavorite(m.id) ? "bg-yellow-400 text-white" : "bg-card border border-border text-muted-foreground"
                  }`}
                >
                  <Star className={`w-2.5 h-2.5 ${isFavorite(m.id) ? "fill-current" : ""}`} />
                </button>
                <button
                  onClick={() => toggleHidden(m.id)}
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    isHidden(m.id) ? "bg-destructive text-white" : "bg-card border border-border text-muted-foreground"
                  }`}
                >
                  {isHidden(m.id) ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                </button>
              </div>
            )}
            <motion.button
              onClick={() => !editMode && navigate(m.path)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="w-full flex flex-col items-center gap-2 py-3 px-1 rounded-2xl hover:bg-muted/40 hover:shadow-sm transition-all"
            >
              <div className={`w-12 h-12 rounded-2xl ${m.color} flex items-center justify-center relative shadow-sm`}>
                <m.Icon className="w-5 h-5" />
                {isFavorite(m.id) && !editMode && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-yellow-400 flex items-center justify-center">
                    <Star className="w-2 h-2 text-white fill-white" />
                  </div>
                )}
              </div>
              <span className="text-[11px] font-medium text-center leading-tight">{m.label}</span>
            </motion.button>
          </motion.div>
        ))}
      </div>

      {hiddenCount > 0 && !editMode && (
        <button
          onClick={() => setEditMode(true)}
          className="w-full text-center mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          +{hiddenCount} oculto{hiddenCount > 1 ? "s" : ""} · Editar
        </button>
      )}

      {isAdmin(user?.id, user?.email) && (
        <button
          onClick={() => navigate("/admin/analytics")}
          className="w-full flex items-center justify-center gap-2 mt-4 pt-3 border-t border-border text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Painel Analytics
        </button>
      )}

    </div>
  );
};
