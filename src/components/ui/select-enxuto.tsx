import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface OpcaoEnxuta {
  value: string;
  label: string;
}

/**
 * SELECT QUE SÓ MONTA AS OPÇÕES QUANDO ABRE (07/11, desempenho da lente "toque").
 *
 * O Select do Radix renderiza TODOS os itens mesmo fechado (num fragmento fora do DOM, pra descobrir o texto do
 * item escolhido e alimentar o <select> nativo de formulário). Com listas longas isso pesa em todo render do
 * card: a Comparação mensal de Finanças tem 2 listas de ~94 meses — 470 renders de SelectItem ao abrir o módulo
 * e 282 a cada volta pra aba Dashboard, sem ninguém ter aberto lista nenhuma (medido na conta cheia).
 *
 * Aqui o texto do gatilho vem de `rotulo` (o item escolhido), e as opções só existem enquanto a lista está
 * aberta. Mesmo Select, mesmo visual, mesma acessibilidade (aria-label no gatilho).
 */
export function SelectEnxuto({ value, onValueChange, opcoes, rotulo, ariaLabel, className, classeItem }: {
  value: string;
  onValueChange: (v: string) => void;
  opcoes: readonly OpcaoEnxuta[];
  /** O texto do item escolhido (o que aparece no gatilho fechado). */
  rotulo: string;
  ariaLabel: string;
  className?: string;
  classeItem?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <Select value={value} onValueChange={onValueChange} open={aberto} onOpenChange={setAberto}>
      <SelectTrigger className={className} aria-label={ariaLabel}>
        <SelectValue>{rotulo}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {aberto && opcoes.map((o) => (
          <SelectItem key={o.value} value={o.value} className={classeItem}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
