## Objetivo

Eliminar os 6 slides do `WelcomeScreen` e fazer o usuário cair direto em `/financas` com o tutorial spotlight já rodando no Passo 1 ("Adicione sua receita").

## Mudanças

1. **`src/App.tsx` — `RootGate`**
   - Remover renderização do `<WelcomeScreen />`.
   - Quando não houver usuário logado OU `spotlight-done-financas` for falso, redirecionar direto para `/financas` (`<Navigate to="/financas" replace />`).
   - O `SpotlightOverlay` no módulo Finanças já cuida de iniciar o tutorial no Passo 1 automaticamente para quem ainda não terminou.

2. **Import cleanup**
   - Remover `import { WelcomeScreen }` do `App.tsx` (não usado em mais nenhum lugar).

## O que NÃO muda

- Arquivo `src/components/WelcomeScreen.tsx` permanece no projeto (não deletado, só não referenciado) — caso queira reativar depois.
- Fluxo de auth, `ProtectedRoute` com `allowGuest` em `/financas` continua igual.
- Spotlight/tutorial in-app em Finanças não é tocado.

## Verificação

- Abrir `/` como usuário novo → deve cair em `/financas` com o tooltip "PASSO 1 DE 11 — Adicione sua receita" visível, igual à screenshot enviada.
