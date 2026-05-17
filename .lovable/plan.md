## Objetivo

Padronizar o cabeçalho de todos os módulos (Finanças, Rotina, Casa, Saúde, Treino, Dieta, Beleza, Detox, Pet, Estudos, Biblioteca, Carreira, Viagens, Relacionamentos, Hiperfoco, DesenvolvimentoPessoal, Conquistas) com:

1. **Safe area garantida** — fundo do header cobre o notch/status bar (`env(safe-area-inset-top)`), conteúdo nunca passa por baixo do horário/bateria.
2. **Scroll dinâmico** — ao descer, a faixa do título (ícone + nome do módulo + ações) recolhe e some; ao subir qualquer pouco, volta imediatamente.
3. **Abas pinned** — a linha de tabs nunca some, fica sempre encostada logo abaixo da safe area.
4. **Glassmorphism** — fundo do header com `backdrop-blur` + cor semi-transparente (token semântico), criando o efeito de vidro fosco sobre o conteúdo que passa por baixo.

## Componente novo

Criar `src/components/layout/ModuleHeader.tsx` reutilizável:

```text
┌─────────────────────────────┐ ← env(safe-area-inset-top) (fundo blur)
│  ← [Icon] TÍTULO    ações   │ ← Título: colapsa no scroll-down
├─────────────────────────────┤
│  [tab] [tab] [tab] [tab]    │ ← Pinned, sempre visível
└─────────────────────────────┘
```

Props:
- `title: string`
- `icon: LucideIcon`
- `iconClassName?: string` (cor por módulo, ex: `text-amber-600`)
- `onBack?: () => void` (default: `navigate("/")`)
- `rightSlot?: ReactNode` (ex: ThemeToggle, mês atual)
- `tabs: { id: string; label: string; icon?: string; spotlight?: string }[]`
- `activeTab: string`
- `onTabChange: (id: string) => void`

Comportamento interno:
- Hook `useCollapsibleHeader()` que escuta `window.scroll`:
  - guarda `lastY`; se `currentY > lastY + 4` e `currentY > 24` → `collapsed = true`
  - se `currentY < lastY - 4` → `collapsed = false`
  - sempre `collapsed = false` quando `currentY < 24`
  - usa `requestAnimationFrame` para throttle, `passive: true` listener
- Faixa do título: `transition-[max-height,opacity,transform]`, recolhe com `max-h-0 opacity-0 -translate-y-2 overflow-hidden` quando colapsado.
- Wrapper externo: `sticky top-0 z-50` com `padding-top: env(safe-area-inset-top)`, `background: hsl(var(--card) / 0.75)`, `backdrop-filter: blur(16px) saturate(180%)`, `border-b border-border/60`.
- Linha de tabs: sempre renderizada, scroll horizontal preservado, `useScrollActiveTabIntoView(activeTab)` movido pra dentro do componente.

## Ajustes globais

**`src/index.css`:**
- Remover o `padding-top: env(safe-area-inset-top)` aplicado no `body` (criado na correção anterior). Agora cada header cuida do seu próprio safe area, então o body precisa começar em `0` para o blur do header cobrir o notch corretamente.
- Manter `padding-bottom: env(safe-area-inset-bottom)` no body.
- Garantir que o token `--card` tenha versão semi-transparente utilizável pelo header (usar `hsl(var(--card) / 0.75)` direto, sem novo token).

**`index.html`:**
- Manter `apple-mobile-web-app-status-bar-style="black-translucent"` (já está) — necessário para o conteúdo poder começar atrás do notch enquanto o blur do header o cobre.

## Migração página por página

Substituir o bloco `<header>...</header>` atual de cada página por:

```tsx
<ModuleHeader
  title="FINANÇAS"
  icon={DollarSign}
  iconClassName="text-amber-600"
  rightSlot={<><span>{currentMonth}</span><ThemeToggle/></>}
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

Páginas a migrar (17): `Index.tsx` (Finanças), `Rotina.tsx`, `Casa.tsx`, `Saude.tsx`, `Treino.tsx`, `Dieta.tsx`, `Beleza.tsx`, `Detox.tsx`, `Pet.tsx`, `Estudos.tsx`, `Biblioteca.tsx`, `Carreira.tsx`, `Viagens.tsx`, `Relacionamentos.tsx`, `Hiperfoco.tsx`, `DesenvolvimentoPessoal.tsx`, `Conquistas.tsx`.

Em cada uma:
- Remover `<header className="border-b ... sticky top-0 z-50">...</header>` inteiro.
- Remover `useScrollActiveTabIntoView(activeTab)` (vai pra dentro do componente).
- Manter o `data-spotlight` no Financeiro passando via `tabs[i].spotlight`.

## Notas técnicas

- **Acessibilidade**: respeitar `prefers-reduced-motion` — desabilitar a transição de colapso (manter sempre expandido).
- **Performance**: um único listener global de scroll por página (no `ModuleHeader`), usando `rAF`.
- **Banners acima do header** (TrialBanner, OfflineBanner, GracePeriodBanner) — não tocar; eles ficam fora do `ModuleHeader` no layout pai e permanecem como estão.
- **AchievementsPage** e outros com header customizado: avaliar caso a caso, mas o padrão é migrar.

## Não inclui

- Não mexer no conteúdo/lógica das páginas.
- Não mexer na bottom nav.
- Não adicionar libs novas (sem Framer Motion específico pro header — CSS transitions bastam).
