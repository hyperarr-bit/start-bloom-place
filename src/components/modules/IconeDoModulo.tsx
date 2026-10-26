import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useHomeNova } from "@/hooks/use-home-nova";
import { MODULOS } from "@/lib/modulos";
import { SUAVIDADE_HOME_NOVA } from "@/lib/home-nova";
import { TRACO, corDoModulo } from "@/components/home-nova/e/paleta";
import "@/components/home-nova/home-nova.css";
import "@/components/home-nova/e/home-e.css";

/**
 * A IDENTIDADE DO MÓDULO DENTRO DO MÓDULO (rodada 3, 26/10 — dono: "Dieta dentro do módulo está VERDE, mas na Home nova
 * é LARANJA; Relações usa uma CARTA, mas na Home é DUAS PESSOAS"). Uma fonte de verdade só: o ÍCONE da grade da Home
 * (lib/modulos: MODULOS[].Icon) e a COR da paleta nova (home-nova/e/paleta: corDoModulo) — usada no cabeçalho dos
 * módulos. Com a chave `home_nova` DESLIGADA, o cabeçalho rende `antes` (o ícone e a cor de hoje), sem mudar nada.
 * O Pet fica como está (o dono pediu) — ele nem chama isto.
 * A cor é uma expressão oklch que lê as variáveis da E (--he-*): o invólucro `hn he he-so-vars` (display: contents)
 * só leva as variáveis até o ícone, sem fundo nem tipografia.
 */
export const IconeDoModulo = ({ id, className = "w-5 h-5", antes }: { id: string; className?: string; antes: ReactNode }) => {
  const { user } = useAuth();
  const nova = useHomeNova(user).ligada;
  const m = MODULOS.find((x) => x.id === id);
  if (!nova || !m) return <>{antes}</>;
  return (
    <span className="hn he he-so-vars" data-suave={SUAVIDADE_HOME_NOVA} style={{ display: "contents" }} data-testid={`icone-modulo-${id}`} data-identidade="home-nova" data-cor={corDoModulo(id)}>
      <m.Icon className={`${className} shrink-0`} strokeWidth={TRACO} style={{ color: corDoModulo(id) }} aria-hidden />
    </span>
  );
};
