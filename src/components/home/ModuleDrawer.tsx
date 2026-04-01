import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  DollarSign, CalendarCheck, Sparkles, Heart, Home, GraduationCap, 
  BookOpen, Droplets, Plane, Briefcase, Dumbbell, Apple, Star, Settings, Eye, EyeOff
} from "lucide-react";
import { useModulePreferences } from "@/hooks/use-module-preferences";
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
];

export const ModuleDrawer = () => {
  const navigate = useNavigate();
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Módulos</h3>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`p-1.5 rounded-lg transition-colors ${editMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
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
            <button
              onClick={() => !editMode && navigate(m.path)}
              className="w-full flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center relative`}>
                <m.Icon className="w-5 h-5" />
                {isFavorite(m.id) && !editMode && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-yellow-400 flex items-center justify-center">
                    <Star className="w-2 h-2 text-white fill-white" />
                  </div>
                )}
              </div>
              <span className="text-[10px] font-medium text-center leading-tight">{m.label}</span>
            </button>
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
    </div>
  );
};
