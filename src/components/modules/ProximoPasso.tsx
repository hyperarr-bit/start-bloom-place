import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/**
 * "Próximo passo" — o rodapé dos módulos que ainda não têm dado (26/07).
 *
 * A varredura das 19 telas mediu o espaço morto no fim de cada uma: treino
 * 501px, pet 495, detox 357, relações 227. Nesses módulos a pessoa abre, vê
 * três linhas e meia tela de branco. Não é bug — a tela simplesmente acaba —
 * mas lê como app inacabado, que foi a reclamação do dono ("tem um espaço em
 * branco", "design pobre").
 *
 * A resposta não é esticar o conteúdo: é dizer o que fazer a seguir. Aparece
 * SÓ quando o módulo está vazio (quem tem dado não precisa de instrução), e
 * some sozinho no momento em que o primeiro registro existe.
 */
export const ProximoPasso = ({
  emoji,
  titulo,
  passos,
  acao,
}: {
  emoji: string;
  titulo: string;
  passos: string[];
  acao?: ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className="rounded-2xl border border-dashed border-border/70 bg-muted/25 px-5 py-6 text-center"
  >
    <span className="text-3xl leading-none" aria-hidden="true">{emoji}</span>
    <h3 className="mt-2.5 text-[15px] font-bold tracking-tight">{titulo}</h3>

    <ol className="mt-4 space-y-2 text-left max-w-[300px] mx-auto">
      {passos.map((p, i) => (
        <li key={p} className="flex items-start gap-2.5 text-[13px] leading-snug">
          <span className="mt-[1px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-background text-[11px] font-bold text-muted-foreground">
            {i + 1}
          </span>
          <span className="text-muted-foreground">{p}</span>
        </li>
      ))}
    </ol>

    {acao && <div className="mt-5 flex justify-center">{acao}</div>}
    {!acao && (
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        Comece pela primeira aba <ArrowRight className="h-3 w-3" />
      </p>
    )}
  </motion.div>
);
