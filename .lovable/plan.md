Plano para corrigir o clique em “Ver planos”

O problema é que o `TrialBanner` agora fica global no app. Quando o trial está expirado, ele renderiza uma tela bloqueante `fixed inset-0 z-50` em qualquer rota, inclusive em `/planos`. Então o clique até tenta navegar, mas a própria tela de trial expirada continua por cima e impede a página de planos de aparecer.

O que vou alterar:

1. Ajustar `TrialBanner`
   - Detectar a rota atual com `useLocation`.
   - Não renderizar a tela/banners do trial dentro de `/planos`, para permitir que a página de planos fique acessível.
   - Manter a tela bloqueante nas demais rotas quando o trial estiver expirado.

2. Melhorar a navegação do botão
   - Trocar `navigate("/planos")` por navegação com `replace` quando já estiver no fluxo de paywall, evitando histórico duplicado/travado.
   - Preservar o tracking do clique em “Ver planos”.

3. Revisar conflitos com a roleta win-back
   - Garantir que `GlobalWinback` continue podendo aparecer acima do trial expirado quando necessário.
   - Manter `/planos` sem bloqueio do `TrialBanner`, mas sem remover a proteção de login (`ProtectedRoute`).

Resultado esperado:

```text
Trial expirado em / ou módulos
  -> mostra tela bloqueante
  -> clicar “Ver planos”
  -> navega para /planos
  -> TrialBanner não cobre /planos
  -> usuário vê a página de planos normalmente
```

Arquivos previstos:
- `src/components/TrialBanner.tsx`
- possivelmente `src/App.tsx` apenas se for necessário ajustar a ordem dos overlays.