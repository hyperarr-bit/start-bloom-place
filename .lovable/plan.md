

# Plano: Reorganizar Treino — Stats em aba separada, Timer dentro do treino, Semana mais clara

## Problema confirmado
A screenshot mostra a versão antiga (4 cards coloridos + Volume Semanal). As mudanças anteriores não estão renderizando. Vou reescrever o arquivo completo para garantir que a nova versão substitua a antiga.

## Mudanças

### 1. Aba 🏋️ HOJE — só o treino do dia
- Remove stats bar e timer do topo
- Mostra apenas o card do treino de hoje (protagonista)
- O timer de descanso aparece **inline dentro do card** quando o usuário clica "Iniciar Sessão" ou marca um exercício como feito
- Sem ruído visual — o usuário entra e vê direto o que vai treinar

### 2. Nova aba 📊 RESUMO — stats + volume
- Move os 4 stat cards (Exercícios, Feitos, Séries/sem, Total treinos) para esta aba
- Move o card de Volume Semanal (esta semana vs semana passada) para aqui
- Adiciona distribuição muscular e heatmap de treinos

### 3. Aba 📅 SEMANA — mais óbvia
- Adicionar um mini texto explicativo no topo: "Visão geral da sua semana de treino"
- Mostrar mini resumo de cada dia com ícone de status (✅ completo, 🟡 parcial, ⚪ pendente, 😴 descanso)
- Cards dos 7 dias com visual mais diferenciado entre dia ativo e descanso

### 4. Timer de descanso — dentro do fluxo
- Remove o timer como bloco separado na aba HOJE
- Quando o usuário marca um exercício como feito, o timer aparece como mini-bar entre os exercícios
- Quando clica "Iniciar Sessão", a bottom bar mostra o cronômetro da sessão + botão timer

### 5. Tabs finais

```text
🏋️ HOJE  |  📅 SEMANA  |  ⚙️ CONFIG  |  📊 RESUMO  |  📈 PROGRESSÃO  |  🏆 RECORDES
```

(Junta stats + history na aba RESUMO em vez de ter STATS separado)

## Alterações técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Treino.tsx` | Reescrever completo: (1) Remover stats bar e timer da aba HOJE — só card do dia. (2) Criar aba RESUMO com os 4 stat cards + volume semanal + distribuição + heatmap. (3) Melhorar aba SEMANA com texto explicativo e status visual por dia. (4) Timer de descanso aparece inline quando marca exercício. (5) Bottom bar simplificada: Iniciar/Finalizar + timer da sessão. (6) Reduzir de 6 para 6 abas (STATS vira RESUMO, mais completo). |

Arquivo único. Reescrita completa para garantir que a versão nova substitua a antiga.

