

# Plano: Atualizar onboarding para 16 modulos + PWA instalavel

## 1. Atualizar OnboardingWizard.tsx

**Problema**: O step "modules" diz "12 Modulos" e so mostra 12 icones. O app tem 16 modulos.

**Solucao**: 
- Mudar titulo para "16 Modulos para sua vida"
- Adicionar os 4 modulos faltantes na grid: Brain/Mente (violet), Users/Relacoes (rose), PawPrint/Pet (amber), Leaf/Detox (lime)
- Importar os icones `Brain, Users, PawPrint, Leaf` do Lucide

## 2. Tornar o app instalavel no celular (PWA simples)

O Supabase client ja persiste a sessao em localStorage. O problema e que sem PWA o usuario acessa pelo browser e pode perder a sessao. Com PWA instalado, o app fica no home screen e mantem a sessao.

**Solucao** (sem service worker, apenas manifest para instalabilidade):
- O `manifest.json` ja existe em `public/manifest.json` com `display: standalone`
- Verificar e adicionar meta tags PWA no `index.html` (apple-mobile-web-app-capable, theme-color, link rel=manifest)
- Nao instalar vite-plugin-pwa nem service worker (desnecessario para apenas instalabilidade)

## Arquivos alterados (2)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/OnboardingWizard.tsx` | Titulo "16 Modulos", adicionar 4 icones faltantes, imports |
| `index.html` | Adicionar meta tags PWA (apple-mobile-web-app-capable, manifest link, theme-color) |

