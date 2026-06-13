## Mudanças no Hero da Landing (`src/pages/lp/LandingPage.tsx`)

### 1. Novo H1
Substituir o título atual por:

> Chega de perder tempo com mil cadernos, aplicativos, post-its e anotações espalhadas.
>
> Agora, **tudo em um só lugar.**

O "tudo em um só lugar." vira `<strong>` (negrito), o resto fica no peso/cor padrão do H1 (já é bold) — pra dar contraste, a primeira parte fica em `font-medium text-black/80` e a segunda em `font-bold text-black`.

### 2. Novo subtítulo
Substituir o `<p>` atual por:

> Finanças, rotina, metas, estudos, treino, dieta, desenvolvimento pessoal e muito mais em um app simples — feito pra organizar sua vida sem virar mais uma tarefa.

### 3. Espaçamento iPhones ↔ CTA
- Reduzir `mb-8` do bloco do CTA pra `mb-4` (menos espaço entre CTA e os iPhones logo abaixo no mobile).
- Reduzir o `gap-10` do grid do hero pra `gap-6 md:gap-10` (menos respiro entre coluna de texto e coluna dos iPhones no mobile).

Nenhuma outra alteração.
