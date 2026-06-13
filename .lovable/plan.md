## Objetivo
Refazer o painel **Admin → Funil LP** pra refletir o funil novo (a partir de ~2 dias atrás):

```
LP view → CTA click → Cadastro → Tutorial (módulo escolhido + concluído) → Trial
```

O fluxo antigo (tutorial antes do cadastro) é descartado: a função só considera eventos a partir de uma data de corte (default = 2 dias atrás), então sessões anônimas que rodaram o tutorial sem ter passado pelo CTA somem do funil.

## Mudanças

### 1. `admin_lp_funnel` (migration — substitui a versão atual)
Recriar a função com:

- **Parâmetros:** `_from` (default `now() - 2 days`), `_to` (default `now()`).  
- **Sessões válidas:** somente `session_id` que tem pelo menos 1 `landing_view` ou `landing_cta_click` no intervalo. Tudo o resto é filtrado por esse set — assim eventos órfãos do fluxo antigo não contam.
- **Estágios (contagem por sessão única):**
  1. `visits` — `landing_view`
  2. `cta_clicks` — `landing_cta_click`
  3. `signups` — `signup_completed` **ou** `quicksignup_completed`
  4. `tutorial_started` — `pre_signup_tutorial_started` **ou** `quickstart_module_chosen` ocorrendo depois do signup da sessão
  5. `module_chosen` — `quickstart_module_chosen`
  6. `tutorial_completed` — `pre_signup_tutorial_completed` **ou** `quickstart_completed`
  7. `trials` — `trial_started` **ou** `trial_accepted`
- **Breakdowns:** CTA (`cta` + clicks + sessões), módulos escolhidos, fontes (`utm_source`), daily (visits, cta, signups, tutorial_completed, trials).
- Mantém `SECURITY DEFINER` + `has_role(auth.uid(),'admin')`; `GRANT EXECUTE TO authenticated`.

### 2. `src/pages/admin/AdminFunilLP.tsx` (reescrita)
- **Range default:** “Desde o novo funil” (a partir do corte; ~2 dias) + opções 7d / 30d.
- **Lista de estágios reordenada** pra nova sequência (`Visitas → CTA → Cadastro → Tutorial iniciado → Módulo escolhido → Tutorial concluído → Trial`), com drop-off entre cada step (já existe).
- **Novo bloco “Comparador de conversão” no final:**
  - Visual de funil em camadas (divs com largura proporcional, cor de fundo via tokens, label + % à direita).
  - Seletor “De → Para” com 2 dropdowns dos estágios → mostra a % calculada (`to / from`) em destaque grande.
  - Atalhos: Visita→Trial, Visita→Cadastro, CTA→Cadastro, Cadastro→Trial.
- **Daily** continua como tabela + adiciona mini sparkline simples (svg inline) de visitas vs cadastros vs trials por dia.
- Sem mudanças em qualquer outra página/app — só admin.

### Detalhes técnicos
- Migration: `DROP FUNCTION public.admin_lp_funnel(timestamptz, timestamptz);` e recriar.
- Tipos: regenerados automaticamente após a migration; o componente usa `(supabase as any).rpc(...)` então não trava antes disso.
- Sem deletar dados do banco — só ignorados no agregado via filtro por data + sessão válida.
