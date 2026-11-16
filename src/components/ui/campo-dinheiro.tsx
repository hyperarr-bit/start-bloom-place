import { useEffect, useState } from "react";
import { numeroBR } from "@/lib/data-normalizers";
import { Input } from "@/components/ui/input";

/**
 * CAMPO DE NÚMERO QUE ACEITA VÍRGULA (revisão 16/11 — chamado do iPhone: "o botão da vírgula do teclado não
 * funciona / não deixa pôr centavos"). Pra quem guarda o NÚMERO no estado a cada tecla: `type="number"` com a
 * vírgula do teclado brasileiro devolve "" e `parseFloat("12,5")` dá 12. Aqui o que se digita fica num
 * rascunho em texto, o número sai do `numeroBR` ("12,50" e "1.234,56"), e o rascunho acompanha quando o
 * valor muda por fora (formulário limpo). Mesmo desenho do CampoDecimal da Beleza (26/09).
 */
export const CampoDinheiro = ({ valor, onValor, placeholder, className, rotulo }: {
  valor: number | undefined;
  onValor: (n: number | undefined) => void;
  placeholder?: string;
  className?: string;
  rotulo?: string;
}) => {
  const mostra = (n: number | undefined) => (n ? String(n).replace(".", ",") : "");
  const [txt, setTxt] = useState(() => mostra(valor));
  useEffect(() => {
    const atual = numeroBR(txt);
    if ((Number.isFinite(atual) ? atual : 0) !== (valor || 0)) setTxt(mostra(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={rotulo ?? placeholder}
      value={txt}
      className={className}
      onChange={(e) => {
        setTxt(e.target.value);
        const n = numeroBR(e.target.value);
        onValor(e.target.value.trim() === "" ? undefined : Number.isFinite(n) ? n : 0);
      }}
    />
  );
};
