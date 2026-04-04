

# Plano: Confirmação no "Limpar dia" + Remover aba Água e widget de hidratação

## Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dieta.tsx` | **(1)** Envolver o botão "Limpar" em um `AlertDialog` (já existe em `@/components/ui/alert-dialog`) com título "Limpar cardápio de {dia}?" e descrição "Todas as refeições deste dia serão removidas." com botões "Cancelar" / "Limpar". **(2)** Remover a aba `💧 ÁGUA` do `TabsList` e o `TabsContent value="agua"` inteiro (linhas ~189 e ~485-502). **(3)** Remover o widget de hidratação do header (linhas ~161-164, o badge azul com `waterToday/waterGoal`). **(4)** Remover a dica "Use a aba 💧 ÁGUA para contar seus copos diários" do `ModuleTip`. **(5)** Limpar estados/imports não usados: `waterGoal`, `waterToday`, `waterDate`, `setWaterToday`, `setWaterDate`, e `Droplets` (se não usado em outro lugar). |

Nenhum arquivo novo. A funcionalidade de água já existe no módulo Saúde (`HydrationTracker`), então não se perde nada.

