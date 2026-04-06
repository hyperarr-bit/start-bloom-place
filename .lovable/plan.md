# Plano: Traduzir textos em inglês + adicionar emojis no Detox

## 1. Textos em inglês encontrados

### Página 404 (`src/pages/NotFound.tsx`)

- "Oops! Page not found" → "Ops! Página não encontrada"
- "Return to Home" → "Voltar ao início"

### Componentes UI (`src/components/ui/`)

- **pagination.tsx**: "Previous" → "Anterior", "Next" → "Próximo", "More pages" → "Mais páginas", aria-labels traduzidos
- **carousel.tsx**: sr-only "Previous slide" → "Slide anterior", "Next slide" → "Próximo slide"
- **sheet.tsx**: sr-only "Close" → "Fechar"
- **dialog.tsx**: sr-only "Close" → "Fechar"
- **sidebar.tsx**: sr-only/title "Toggle Sidebar" → "Alternar menu lateral"
- **breadcrumb.tsx**: sr-only "More" → "Mais"

## 2. Emojis no Detox (`src/components/detox/DetoxTracker.tsx`)

Array atual: `["🚬", "🍺", "📱", "🍔", "🎮", "☕", "🍫", "💊", "🔞"]`  
Adicionar: `"🎰"`

(apostas,)

## Alterações


| Arquivo                                 | Mudança                                                    |
| --------------------------------------- | ---------------------------------------------------------- |
| `src/pages/NotFound.tsx`                | Traduzir textos para PT-BR                                 |
| `src/components/ui/pagination.tsx`      | "Previous"→"Anterior", "Next"→"Próximo", aria-labels em PT |
| `src/components/ui/carousel.tsx`        | sr-only em PT                                              |
| `src/components/ui/sheet.tsx`           | sr-only "Fechar"                                           |
| `src/components/ui/dialog.tsx`          | sr-only "Fechar"                                           |
| `src/components/ui/sidebar.tsx`         | title/sr-only em PT                                        |
| `src/components/ui/breadcrumb.tsx`      | sr-only "Mais"                                             |
| `src/components/detox/DetoxTracker.tsx` | Adicionar 🎰🍷💉🛒👃 ao `iconOptions`                      |
