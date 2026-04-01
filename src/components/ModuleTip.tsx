import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";

interface ModuleTipProps {
  moduleId: string;
  tips: string[];
  icon?: string;
}

export const ModuleTip = ({ moduleId, tips, icon = "💡" }: ModuleTipProps) => {
  const { get, set: setData } = useUserData();
  const storageKey = `core-tip-seen-${moduleId}`;
  const [visible, setVisible] = useState(() => !get<string>(storageKey, ""));

  const dismiss = () => {
    setData(storageKey, "true");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          className="mb-4 overflow-hidden"
        >
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 relative">
            <button
              onClick={dismiss}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Lightbulb className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 pr-4">
                <p className="text-xs font-bold text-primary mb-1.5">
                  {icon} Dicas para começar
                </p>
                <ul className="space-y-1">
                  {tips.map((tip, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary/60 mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
