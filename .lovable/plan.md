## Mudanças

### 1. `src/pages/Index.tsx` (linha 134)
Trocar `setTimeout(..., 5000)` por `setTimeout(..., 3000)` — modal de cadastro aparece após 3s ao chegar no score do dia.

### 2. `src/components/TrialBanner.tsx` — simplificar para mini barrinha única
- Manter intacta a tela cheia de **trial expirado** (sem alteração).
- Remover as 3 fases (discovery/engagement/conversion) e substituir por **uma mini barrinha única** durante todo o trial ativo, com:
  - Texto curto: `Trial • {daysLeft}d` (singular/plural)
  - Mini botão `Assinar` que leva pra `/planos`
  - Altura compacta (~28px), tipografia `text-[11px]`, padding mínimo, cor sutil via tokens (`bg-primary/5`, `border-primary/20`)
- **Gate novo**: só renderiza quando `get("spotlight-done-financas") === "true"` (tutorial concluído). Usar `useUserData` pra ler a flag.
- Manter `trackEvent` de view/click.

### 3. `src/pages/Planos.tsx` — reescrever copy para o módulo único de Finanças
- Header: manter "Escolha seu plano".
- Card do plano:
  - Subtítulo: trocar `"Acesso completo"` por `"Módulo Finanças completo"`.
  - Substituir o array `features` por bullets focados em Finanças:
    - `Receitas, despesas e contas fixas`
    - `Dívidas e parcelamentos no controle`
    - `Investimentos e patrimônio`
    - `Desejos e metas financeiras`
    - `Atualizações e suporte prioritário`
  - Adicionar 1 parágrafo curto acima da lista: *"Organize receitas, despesas, dívidas, investimentos e desejos em um só lugar — com clareza pra saber exatamente pra onde seu dinheiro está indo."*
- Mensagem de assinante: trocar `"Você já é assinante CORE PRO!"` por `"Você já é assinante!"` (manter o resto).
- Botão CTA: trocar `"Assinar CORE PRO"` por `"Assinar agora"`.
- Nome do plano no card: trocar `"CORE PRO"` por `"Finanças PRO"`.

Nenhuma lógica de checkout, billing, retenção ou auth é alterada.
