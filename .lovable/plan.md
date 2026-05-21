# Garantir que os 4 módulos apareçam no "Onde os usuários abandonam o tutorial"

## Problema
O card só mostra `dieta` e `rotina` porque, desde o último reset de analytics, ninguém ainda chegou a abrir o tutorial de `financas` e `treino`. A função `admin_tutorial_dropoff` monta a lista de módulos a partir dos eventos existentes (`spotlight_step_view`), então módulos sem eventos simplesmente somem.

A captação de eventos em si (clicar em "Quero começar" → escolher módulo → cada passo do spotlight) já está correta no código:
- `QuickStartOnboarding` dispara `start_clicked` e `quickstart_module_chosen`
- `SpotlightOverlay` dispara `spotlight_shown` ao montar e `spotlight_step_view` em cada passo, e `quickstart_completed` no fim
Todos já carregam `module: "<key>"`. Não há bug de tracking — o problema é só de apresentação no SQL.

## Mudança

Atualizar a função `admin_tutorial_dropoff` para sempre retornar os 4 módulos fixos (`financas`, `rotina`, `dieta`, `treino`), mesmo com 0 iniciados/0 completados/sem passos ainda capturados. Módulos sem dados aparecem com `started: 0`, `completed: 0`, `steps: []`.

### Detalhes técnicos
- Adicionar CTE `all_modules` com lista fixa dos 4 keys.
- Trocar o `FROM (SELECT DISTINCT module_id FROM steps_agg…)` por `FROM all_modules` + `LEFT JOIN` em `starts_agg`, `completes` e `steps_agg`.
- Manter o filtro pelo `analytics_reset_at` (contagens só a partir do reset).
- Sem mudança de tracking no frontend — os eventos já cobrem cada passo de cada módulo.

### Validação
Após aplicar a migração, o card "Onde os usuários abandonam o tutorial" passa a listar os 4 módulos. `financas` e `treino` aparecem com `0 iniciados` até alguém abrir o tutorial deles, e a partir daí cada passo é contado corretamente.
