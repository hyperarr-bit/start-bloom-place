## Refino visual da primeira dobra — `src/pages/lp/LandingPage.tsx`

Sem alterar nenhuma copy. Mudanças apenas em classes/estilo no `<header>` e na `<section>` HERO (linhas ~706–759).

### 1. Header (linhas 706–726)
- `h-14` → `h-12 md:h-14` (altura mais refinada no mobile).
- `bg-white/80 backdrop-blur` → `bg-white/70 backdrop-blur-md` (blur mais sofisticado).
- `border-b border-black/5` mantém (já é sutil) — manter.
- Botão "Entrar": `px-4 py-1.5 rounded-md` → `px-4 py-2 rounded-lg shadow-sm` (mais premium, mesma cor preta).

### 2. Hero section wrapper (linha 729)
- `pt-8 md:pt-16 pb-12 md:pb-20` → `pt-4 md:pt-10 pb-8 md:pb-16` (menos espaço entre header e headline; aproxima mockups).
- Adicionar fundo degradê sutil atrás dos mockups via `relative` no `<section>` + uma `<div>` absoluta com `bg-gradient-to-b from-transparent via-black/[0.02] to-black/[0.04]` posicionada na metade inferior, `pointer-events-none`.

### 3. Headline (linhas 732–737)
- Trocar `text-[30px] md:text-[48px] leading-[1.1] tracking-tight mb-4 mt-2` por:
  `text-[clamp(26px,7.5vw,52px)] leading-[1.05] tracking-[-0.02em] mb-5 mt-0 max-w-[18ch] md:max-w-[20ch] mx-auto md:mx-0`
- Mantém todos os `<span>` e textos exatamente iguais.

### 4. Subtítulo (linha 738)
- `text-[15px] md:text-lg text-black/60 mb-6 max-w-md` → 
  `text-[15px] md:text-[17px] text-neutral-500 leading-[1.55] mb-7 max-w-[34ch] md:max-w-md mx-auto md:mx-0`

### 5. CTA (linhas 741–749)
- Wrapper `mb-4` → `mb-6 w-full sm:w-auto`.
- Botão classes →
  `btn-shine inline-flex w-full sm:w-auto items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-black hover:bg-black/90 text-white font-semibold text-[15px] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] transition`
- Texto e ícone permanecem idênticos.

### 6. Coluna dos mockups (linha 754)
- `-mx-2 md:mx-0` → `-mx-2 md:mx-0 -mt-2 md:mt-0 relative` para aproximar do CTA no mobile.
- O degradê do item 2 fica atrás dessa coluna.

### 7. Grid (linha 730)
- `gap-6 md:gap-10` → `gap-4 md:gap-10` (reduz respiro no mobile).

Nenhuma outra parte da página é alterada. Nenhum texto é modificado.
