

# Plano: Redesign do módulo Saúde — Limpar AGORA + Remover FERRAMENTAS

## Problemas identificados

**Aba AGORA** (poluída):
- 4 cards de resumo redundantes (hidratação, suplementos, sono, score) — info repetida nos trackers logo abaixo
- "Ações Rápidas" com 3 botões que não fazem nada útil (Postura/Dor não funciona, Humor/Sono só muda de aba)
- Calculadora IMC — já foi movida pra cá mas ocupa espaço desnecessariamente
- Health Score — métrica artificial que não agrega valor real
- Resultado: scroll enorme com muita coisa visual e pouca ação

**Aba FERRAMENTAS** (inútil):
- Dívida de Sono — duplicado do card na aba AGORA
- Inventário & Compras — lista de compras genérica que não pertence ao módulo saúde
- Ficha SOS — único item realmente útil, mas escondido atrás de uma aba que ninguém abre

## Nova estrutura

```text
ANTES:  ⚡ AGORA | ⚖️ EVOLUÇÃO | 🏥 LOG MÉDICO | 🛠️ FERRAMENTAS
DEPOIS: 💊 HOJE   | ⚖️ EVOLUÇÃO | 🏥 LOG MÉDICO
```

### Aba HOJE (ex-AGORA, limpa)
Só o que é ação diária real:
1. **HydrationTracker** — rastrear água (já tem design bom)
2. **PharmacyChecklist** — vitaminas/remédios (já tem design bom)
3. **FastingTimer** — jejum intermitente (já tem design bom)
4. **Registro de Sono** — input simples de horas dormidas (puxar o `SleepInput` que já existe)
5. **Ficha SOS** — mover do FERRAMENTAS para o final da aba HOJE (emergência sempre acessível)

**Removidos:**
- 4 cards de resumo redundantes
- Ações Rápidas (botões inúteis)
- Calculadora IMC (mover para Evolução, onde faz mais sentido junto com medidas corporais)
- Health Score
- Dívida de sono (card separado)
- Lista de compras de suplementos

### Aba EVOLUÇÃO
- Manter `BodyEvolution` como está (design aprovado)
- Adicionar calculadora IMC aqui (faz sentido junto com peso/medidas)

### Aba LOG MÉDICO
- Manter `MedicalLog` como está (design aprovado)

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Saude.tsx` | (1) Remover tab "tools" do array `tabs`. (2) Renomear "agora" → "hoje". (3) Na aba HOJE: remover os 4 summary cards, remover QuickActionCard, remover BMI calculator, remover Health Score. Manter apenas: HydrationTracker + PharmacyChecklist + FastingTimer + card simples de sono + SOS card (movido de ToolsEmergency). (4) Na aba EVOLUÇÃO: adicionar calculadora IMC. (5) Remover imports/estados órfãos (score, bmiHeight/bmiWeight do nível raiz, QuickActionCard). (6) Mover SOS inline (sem precisar do ToolsEmergency inteiro). |
| `src/components/saude/ToolsEmergency.tsx` | Pode ser deletado ou mantido — o SOS card será extraído inline no Saude.tsx. |

