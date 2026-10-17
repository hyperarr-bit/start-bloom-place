import { cn, mesAtualExtenso } from "@/lib/utils";

/**
 * O MÊS DO CABEÇALHO DOS MÓDULOS (17/10, 1.0.16) — "Outubro de 2026", como página de agenda, numa
 * linha só, em todos os módulos.
 *
 * Print do dono na 1.0.16 (iPhone, 390 px): "Outubro fica muito junto de Finanças" e o ✨ "completamente
 * achatado". O mês por extenso não cabe ao lado dos botões do cabeçalho no iPhone: Finanças já encurtava
 * pra "Out 2026" abaixo de 400 px (05/08), mas Rotina e Saúde quebravam "Outubro de 2026" em duas linhas a
 * 375 px, e o Treino simplesmente escondia o mês. Agora a regra é uma só:
 *   · celular (< 460 px): o mês curto, "Out 2026" — e o rótulo nunca quebra nem aperta os botões;
 *   · 460 px pra cima (tablet, site): por extenso, "Outubro de 2026".
 * `compacto` (Finanças, que tem 3 botões à direita — ✨, Dicas e o tema): na tela de 375 px o mês sai, como
 * o Treino já fazia — sobra espaço pros botões inteiros e pro título respirar.
 */
export function MesDoCabecalho({ data, compacto = false, className }: { data?: Date; compacto?: boolean; className?: string }) {
  const d = data ?? new Date();
  const extenso = mesAtualExtenso(d);
  // "out." → "Out" (em JS, não pela classe `capitalize`: as telas têm testes que cobram zero `.capitalize` no DOM)
  const abrev = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const curto = abrev.charAt(0).toUpperCase() + abrev.slice(1);
  return (
    <span
      className={cn("text-xs text-muted-foreground whitespace-nowrap shrink-0", compacto && "max-[389px]:hidden", className)}
      data-testid="mes-do-cabecalho"
      aria-label={extenso}
    >
      <span className="max-[459px]:hidden">{extenso}</span>
      <span className="min-[460px]:hidden">{curto} {d.getFullYear()}</span>
    </span>
  );
}
