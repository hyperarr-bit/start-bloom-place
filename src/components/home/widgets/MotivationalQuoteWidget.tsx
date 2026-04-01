import { motion } from "framer-motion";
import { Quote } from "lucide-react";

const quotes = [
  { text: "Disciplina é liberdade.", author: "Jocko Willink" },
  { text: "Pequenos passos, grandes mudanças.", author: "James Clear" },
  { text: "Consistência supera intensidade.", author: "Provérbio" },
  { text: "Hoje é o dia que importa.", author: "Marcus Aurelius" },
  { text: "Invista em você todos os dias.", author: "Warren Buffett" },
  { text: "Progresso, não perfeição.", author: "Provérbio" },
  { text: "Cada dia é uma nova chance.", author: "Provérbio" },
  { text: "O melhor projeto é você.", author: "Provérbio" },
  { text: "Foco no que importa.", author: "Greg McKeown" },
  { text: "Sua rotina define seu futuro.", author: "Hal Elrod" },
  { text: "Seja a mudança que quer ver.", author: "Gandhi" },
  { text: "A excelência é um hábito.", author: "Aristóteles" },
  { text: "Comece antes de estar pronto.", author: "Steven Pressfield" },
  { text: "O segredo é começar.", author: "Mark Twain" },
];

export const MotivationalQuoteWidget = () => {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const quote = quotes[dayOfYear % quotes.length];

  return (
    <motion.div
      className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex gap-3">
        <Quote className="w-5 h-5 text-primary/30 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium italic leading-relaxed">"{quote.text}"</p>
          <p className="text-[10px] text-muted-foreground mt-1">— {quote.author}</p>
        </div>
      </div>
    </motion.div>
  );
};
