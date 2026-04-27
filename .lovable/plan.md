## Objetivo
Transformar o dark mode em um sistema visual silencioso, premium e consistente entre todos os módulos — estilo Notion / Linear. A mudança é centralizada nos tokens HSL em `src/index.css`, então propaga automaticamente para todos os componentes que já usam `bg-card`, `bg-background`, `text-foreground`, `border-border`, `tint-*`, etc.

---

## Princípios de design

**Fundo (escala em camadas)**
- Sem preto puro (#000). Base sempre num cinza-azulado muito escuro.
- Camadas por luminância (∆ 2–4%):
  - L0 background da página → mais escuro
  - L1 cards → +3%
  - L2 superfícies aninhadas (linhas alternadas, popovers, headers de tabela) → +5%

**Texto (sem branco puro)**
- Título: cinza claro (~91%)
- Texto padrão: cinza claro suave (~82%)
- Secundário / muted: cinza médio (~58%)
- Desabilitado: cinza apagado (~42%)

**Bordas**
- Hairline 1px num cinza apenas levemente mais claro que o card (~14–16%).
- Sem sombras pesadas; substituir por borda + diferença de luminância.

**Cores de destaque dessaturadas**
- Verde, azul, roxo, amarelo, rosa: saturação reduzida (~45–55%) e luminância controlada (~62–68%) — nada de neon.
- Tints (`.tint-*`) já existem; serão recalibrados para opacidades menores.

**Ícones**
- Cor padrão = `text-muted-foreground`; só recebem tinta quando carregam significado.

**Componentes interativos**
- Estado ativo = preenchimento sutil (`bg-muted`) + borda; nunca cor saturada.
- Hover = +2% de luminância, sem mudar matiz.

---

## Mudanças técnicas

### 1) `src/index.css` — tokens `.dark` recalibrados

Substituir os valores HSL atuais por uma escala consistente:

```css
.dark {
  /* Camadas de superfície (cinza-azulado neutro, sem preto puro) */
  --background: 220 10% 8%;     /* L0 página  */
  --card:       220 10% 11%;    /* L1 cards   */
  --popover:    220 10% 12%;
  --secondary:  220 9%  15%;    /* L2 nested  */
  --muted:      220 9%  15%;

  /* Texto sem branco puro */
  --foreground:        220 8% 88%;   /* títulos / texto principal */
  --card-foreground:   220 8% 88%;
  --popover-foreground:220 8% 88%;
  --muted-foreground:  220 6% 58%;   /* secundário */
  --secondary-foreground: 220 8% 88%;

  /* Bordas hairline */
  --border: 220 9% 17%;
  --input:  220 9% 17%;
  --ring:   220 8% 70%;

  /* Primary suave (botões neutros) */
  --primary: 220 8% 86%;
  --primary-foreground: 220 10% 10%;

  /* Acentos dessaturados — nada de neon */
  --accent:        330 45% 62%;
  --destructive:   0   55% 55%;
  --success:       142 40% 52%;
  --warning:       38  70% 58%;

  /* Cards financeiros (receitas/despesas/dívidas/investimentos)
     reduzir saturação e aproximar luminância do card base */
  --card-receitas:        45  18% 13%;
  --card-receitas-border: 45  20% 22%;
  --card-receitas-text:   45  45% 75%;
  --card-despesas:        250 15% 13%;
  --card-despesas-border: 250 18% 22%;
  --card-despesas-text:   250 38% 78%;
  --card-dividas:         330 15% 13%;
  --card-dividas-border:  330 18% 22%;
  --card-dividas-text:    330 38% 78%;
  --card-investimentos:   142 15% 12%;
  --card-investimentos-border: 142 18% 22%;
  --card-investimentos-text:   142 35% 72%;

  --income:  45  15% 12%;
  --income-foreground:  45  40% 75%;
  --expense: 330 15% 12%;
  --expense-foreground: 330 38% 75%;

  /* Sidebar alinhada ao mesmo padrão */
  --sidebar-background: 220 10% 9%;
  --sidebar-accent:     220 9%  15%;
  --sidebar-border:     220 9%  17%;
  --sidebar-foreground: 220 8%  88%;

  /* Charts dessaturados */
  --chart-1: 330 45% 62%;
  --chart-2: 142 40% 55%;
  --chart-3: 38  65% 60%;
  --chart-4: 250 45% 65%;
  --chart-5: 45  55% 60%;
}
```

### 2) `src/index.css` — tints mais sutis

Reduzir opacidade dos `.tint-*` no dark e suavizar texto (300 → 200/300 conforme matiz, opacidade do bg de `/10` → `/8`, borda `/20` → `/15`):

```css
.tint-blue    { @apply bg-blue-100/70 text-blue-800 border-blue-200
                       dark:bg-blue-400/8 dark:text-blue-200/90 dark:border-blue-400/15; }
/* mesmo padrão para sky/cyan/teal/green/emerald/lime/yellow/amber/orange/red/rose/pink/fuchsia/purple/violet/indigo */
.tint-slate /gray/zinc/neutral/stone permanecem já neutras, só baixar opacidade. */
```

### 3) Aba ativa (`.notion-tab-active`)
Já está usando `bg-muted`. Confirmar que com o novo `--muted` (15%) ela fica visivelmente diferente do header (11%) sem virar branco.

### 4) Módulos com tokens próprios

Alinhar ao mesmo padrão de luminância para não destoar:

- **Rotina** (`--rt-*`): manter estrutura, ajustar `--rt-surface 220 10% 8%`, `--rt-card 220 10% 11%`, `--rt-card-2 220 9% 14%`, `--rt-text 220 8% 88%`, `--rt-text-soft 220 6% 58%`. Acentos: `--rt-accent 142 45% 55%`, `--rt-warning 45 70% 60%`.
- **Saúde** (`--saude-*` no dark): trocar saturações 100% por ~50–60% e luminância para ~58–62%. `--saude-card` passa a usar a mesma escala (`220 10% 11%`).
- **Skincare** (`--sk-*` no dark): reduzir luminância (65→62) e saturação (80→55).

### 5) Limpeza de cores hardcoded conflitantes

Buscar e ajustar ocorrências em componentes principais que escapam dos tokens:

- `text-green-500`, `text-red-400`, `text-orange-400`, `text-purple-400` na barra de resumo (`src/pages/Index.tsx`) → trocar por variantes `-400/90` ou usar tokens semânticos (`text-success`, `text-destructive`) que já ficam dessaturados.
- `bg-amber-600` no ícone do header de Finanças → manter (é único acento de marca).
- Sweep com `rg` por `bg-white`, `text-white`, `bg-black`, `text-black`, `shadow-2xl`, `shadow-xl` em componentes de Finanças (`src/components/*.tsx`, `src/components/finance/*.tsx`) e substituir por `bg-card`/`text-foreground`/`shadow-sm`.

### 6) Sombras
Adicionar regra global no dark para neutralizar sombras pesadas:

```css
.dark .shadow-lg, .dark .shadow-xl, .dark .shadow-2xl {
  box-shadow: 0 0 0 1px hsl(var(--border)), 0 1px 2px rgba(0,0,0,0.4);
}
```

---

## Arquivos editados
- `src/index.css` (tokens `.dark`, tints, sombras, módulos rt/saude/sk)
- `src/pages/Index.tsx` (cores da summary bar)
- Sweep dirigido em `src/components/*.tsx` para remover `bg-white/black`, `text-white/black` e `shadow-xl/2xl` órfãos

## Resultado esperado
- Fundo preto suave uniforme com hierarquia perceptível por camadas.
- Textos confortáveis, sem branco puro nem cinza ilegível.
- Cards com bordas hairline, sem sombras pesadas.
- Acentos coloridos discretos, sem competir entre si.
- Mesma identidade visual em Finanças, Rotina, Saúde, Skincare e demais módulos.
