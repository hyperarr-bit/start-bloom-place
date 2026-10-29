import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * SEM REPETIÇÃO (1.0.22, dono 28/10: "bora botar logo"). Onde um módulo tinha uma CÓPIA do que mora em outro
 * (Finanças › Viagem = Viagens › Budget), a cópia vira este cartão: diz onde a coisa mora agora e leva pra lá.
 * Só aparece pra quem ainda chega na aba antiga (link `?aba=`, aba que estava aberta) — a fileira não mostra mais.
 * Nenhum dado é tocado: a chave é a mesma dos dois lados.
 */
export function AtalhoParaOutroModulo({ emoji, titulo, texto, rotulo, para }: {
  emoji: string;
  titulo: string;
  texto: string;
  rotulo: string;
  /** rota com `?aba=` do destino, ex.: "/viagens?aba=budget" */
  para: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center space-y-3" data-testid="atalho-outro-modulo">
      <div className="text-3xl" aria-hidden="true">{emoji}</div>
      <h3 className="text-sm font-bold">{titulo}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{texto}</p>
      <Button size="sm" className="gap-1.5" onClick={() => navigate(para)}>
        {rotulo} <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
