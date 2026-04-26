Plano para corrigir a roleta que não aparece

1. Fazer o GlobalWinback reagir à troca de rota
- Ajustar `use-winback-trigger.ts` para observar também a rota atual (`useLocation`).
- Quando o usuário sair de `/planos` e voltar para a tela anterior, o hook vai re-checar o `sessionStorage` e abrir a roleta imediatamente.
- Remover a trava que hoje faz a verificação acontecer só uma vez no ciclo do app.

2. Garantir que a roleta apareça por cima da tela de trial expirado
- Aumentar a prioridade visual do modal da roleta para ficar acima do bloqueio de trial expirado.
- Se necessário, reduzir o `z-index` da tela de trial expirado ou elevar o `DialogContent/overlay` do WinbackFlow.

3. Corrigir acessibilidade do Dialog
- Adicionar `DialogTitle` e `DialogDescription` escondidos visualmente no `WinbackFlow`.
- Isso remove os erros atuais do console: `DialogContent requires a DialogTitle` e `Missing Description`.

4. Preservar o fluxo desejado
```text
Trial expirado -> Ver planos -> /planos
Usuário clica voltar -> volta para Trial expirado
Roleta aparece por cima imediatamente
Roleta gira automática
Mostra oferta 80%
Usuário fecha no X -> fica na tela de trial expirado
Usuário clica Ver planos de novo -> pode repetir
```

Arquivos a alterar
- `src/hooks/use-winback-trigger.ts`
- `src/components/retention/WinbackFlow.tsx`
- Possivelmente `src/components/TrialBanner.tsx` se precisar ajustar o `z-index` do bloqueio de trial expirado

Critério de sucesso
- Ao clicar em voltar na tela de planos, a roleta aparece automaticamente por cima da tela de trial expirado.
- A roleta gira sozinha.
- A oferta de 80% aparece.
- O X fecha a oferta e deixa o usuário na tela de trial expirado.
- O fluxo pode ser repetido ao clicar em “Ver planos” novamente.