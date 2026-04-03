

# Correções: Score Ring, Nome, Check-in Automático + Fix Runtime Error

## 4 Problemas

### 1. Runtime Error: `LogOut` not found in GreetingHeader
O erro aponta para `GreetingHeader.tsx:230` mas o arquivo tem 145 linhas — provável cache stale. Porém, precisa garantir que não há referência residual. O arquivo atual está limpo, mas o `ModuleDrawer.tsx` importa `LogOut` e precisa verificar se está correto.

### 2. Cor do Score Ring não muda com tema/paleta
O `DayScoreRing` usa `hsl(var(--success))`, `hsl(var(--warning))`, `hsl(var(--accent))`. Esses tokens mudam entre light/dark, mas as palettes em `use-theme.tsx` NÃO incluem overrides para `--success` e `--warning`. Quando o usuário muda de paleta (ex: Midnight, Rose), as cores success/warning ficam sempre verde/âmbar em vez de se adaptar.

**Solução**: Adicionar `--success` e `--warning` nos overrides de cada palette em `use-theme.tsx`, com tons que combinem com cada tema (ex: no Rose, warning fica rosado; no Forest, success fica mais verde vibrante).

### 3. Nome não salva
O `GreetingHeader.handleNameSave` só escreve no `localStorage` diretamente — NÃO chama `useUserData.set()`. E o `Home.tsx handleNameChange` apenas incrementa um counter para re-render, sem persistir o nome.

**Solução**: Passar `useUserData.set` para o `GreetingHeader` (ou dar acesso ao hook lá dentro) e chamar `set("core-user-name", name)` no `handleNameSave`.

### 4. Check-in automático ao abrir o app
O check-in hoje exige clicar um botão na página de Conquistas. O usuário quer que abrir o app já conte como check-in.

**Solução**: Mover a lógica de check-in para o `Home.tsx` (ou `useLifeHubData`) — ao montar a Home, verificar se `gamification-lastCheckIn !== today` e, se sim, registrar automaticamente. Remover o botão manual da `AchievementsPage` e substituir por um indicador de status ("Check-in feito hoje ✓").

---

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/use-theme.tsx` | Adicionar `--success` e `--warning` em cada palette (light+dark) para que as cores do ring acompanhem o tema |
| `src/components/home/GreetingHeader.tsx` | Usar `useUserData().set` para persistir o nome em vez de só localStorage |
| `src/pages/Home.tsx` | Adicionar lógica de auto check-in ao montar (verificar lastCheckIn, atualizar streak) |
| `src/components/gamification/AchievementsPage.tsx` | Remover botão de check-in manual, trocar por indicador de status; remover lógica de handleCheckIn (movida para Home) |
| `src/components/home/ModuleDrawer.tsx` | Verificar import de `LogOut` está correto (já está, mas confirmar que não há conflito) |

## Adição útil (obrigatória)
Adicionar na `AchievementsPage` um **resumo de progresso por categoria** — mini barras mostrando quantos badges de cada categoria (Finanças, Saúde, Hábitos, Geral) foram desbloqueados, dando ao usuário uma visão clara de onde está mais forte e onde precisa melhorar.

