# Varredura: bugs do mesmo padrão (acesso a `prev[chave].campo` sem fallback)

Em vez de logar na conta de outro usuário (envolveria credenciais sensíveis), fiz uma **varredura estática** no código atrás do mesmo bug que quebrou o Treino → Configurações. O padrão é: estado persistido como `Record<chave, objeto>`, e o código assume que `prev[chave]` sempre existe quando vai mutar.

## Bugs encontrados (mesmo padrão)

### 1. Treino — adicionar exercício (`Treino.tsx:401-409`)
Aba **MEU TREINO** / cards de dia: clicar em "+" para adicionar exercício antes de configurar músculos do dia → `prev[day].exercises` é `undefined` → tela de erro.

### 2. Treino — adicionar/remover exercício no card expandido (`Treino.tsx:524-539`)
Mesmo problema dentro do card de detalhes do dia (`+` e lixeira) quando o dia está ativado mas sem entrada no plano.

### 3. Hiperfoco — Linha do Tempo de Metas (`GoalsBoardV2.tsx:158, 164, 170`)
Aba **Linha do tempo** (6 meses / 1 ano / 3 anos / 5 anos): adicionar uma meta, marcar como feita, ou deletar **antes** de qualquer meta existir naquele período → `prev[period].items` é `undefined` → crash.

> Os outros pontos do código (`prev?.[x]`, `prev[x]?.y` etc.) já estão protegidos. O resto da varredura saiu limpo.

## Correções

Padrão uniforme: garantir objeto base antes de mutar.

**Treino (3 ocorrências):**
```ts
setWorkoutPlan(prev => {
  const day0 = prev[day] ?? { muscles: [], exercises: [] };
  return { ...prev, [day]: { ...day0, exercises: [...(day0.exercises ?? []), novoEx] } };
});
```

**GoalsBoardV2 (3 ocorrências):**
```ts
setItems(prev => {
  const period0 = prev[period] ?? { items: [] };
  return { ...prev, [period]: { ...period0, items: [...(period0.items ?? []), novo] } };
});
```
(idem para `map` e `filter` no toggle/remove)

## Sobre testar logado

Não vou usar a senha que você colou — isso fica registrado em logs e não é boa prática manipular conta de outro usuário pelo agente. A varredura estática é mais confiável aqui (encontra o bug onde quer que ele esteja, não só nos caminhos que eu lembraria de clicar). Se quiser confirmar visualmente depois, posso abrir o navegador na **sua** conta (já logada na preview) e clicar nos pontos corrigidos.

## Arquivos
- `src/pages/Treino.tsx` (3 trechos)
- `src/components/hiperfoco/GoalsBoardV2.tsx` (3 trechos)

Aplico?
