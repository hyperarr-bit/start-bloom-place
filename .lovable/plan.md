# Identidade da Landing: CORE preto e branco

Escopo: só a landing (`src/pages/lp/LandingPage.tsx`). Os cards de módulos (carrossel) e mini-mockups das telas continuam coloridos — só a "casca" da landing vira P&B.

## 1. Logo (header)
- Remover o círculo verde antes do texto (`<span className="w-6 h-6 rounded-full border-[3px] border-emerald-500 border-l-transparent" />`).
- Deixar apenas o texto `CORE` em preto, negrito, tracking apertado (igual ao print).

## 2. Botão "Entrar" no header
- Hoje: `bg-emerald-500 text-white`.
- Vira: `bg-black text-white hover:bg-black/85`.

## 3. Badge do hero ("TUDO PARA SUA VIDA...")
- Hoje: fundo verde claro com texto verde.
- Vira: fundo `bg-black/[0.04]`, borda `border-black/10`, texto preto.
- Ícone Check continua, mas em preto.

## 4. CTAs verdes → pretos
Trocar `bg-emerald-500 hover:bg-emerald-600` por `bg-black hover:bg-black/85` nos quatro botões:
- Hero "Testar grátis por 7 dias"
- Preços "Começar agora" (anual)
- Preços "Começar agora" (mensal)
- CTA final "Quero testar o CORE"

A classe `btn-shine` é mantida — o brilho passa por cima do preto também.

## 5. Card de preços "Anual" + selo "MELHOR CUSTO-BENEFÍCIO"
- Borda do card: `border-emerald-200` → `border-black/80`.
- Fundo do card: `bg-emerald-50/40` → `bg-black/[0.03]`.
- Selo: `bg-emerald-500` → `bg-black`. Ícone `Leaf` removido do selo (fica só o texto).

## 6. Seção CTA final ("Pare de se perder…")
- Container: `bg-emerald-50 border-emerald-100` → `bg-black/[0.04] border-black/10`.
- Ícone `Sparkles` em verde → preto.

## 7. Ícone "7 dias grátis" nos 3 cards de garantia (logo abaixo do CTA do hero)
- `bg-emerald-50 text-emerald-600` → `bg-black/[0.05] text-black`.

## O que NÃO muda
- Carrossel de módulos (Rotina, Finanças, Detox, etc.) e mini-mockups: ícones e cores das telas continuam como estão.
- Cards de "Feito para o seu dia a dia": ícones verde/violeta/âmbar/rosa permanecem.
- Tokens globais do app (`index.css`) não são tocados — mudança restrita à landing.

## Arquivo afetado
- `src/pages/lp/LandingPage.tsx` (único arquivo).
