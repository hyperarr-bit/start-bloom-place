## Nova etapa: escolher módulos do tutorial

### Fluxo final
```
Welcome ("Quero começar")  ← só guest, igual hoje
   ↓
[NOVA] Seleção de módulos do tutorial
   ↓
Picker "Por onde você quer começar?" (só com os escolhidos)
   ↓
Spotlight em cada módulo até zerar
   ↓
Popup de parabéns / QuickSignup
```

Vale pros DOIS fluxos (guest e novo usuário logado).

### 1. Nova etapa em `QuickStartOnboarding.tsx`
- Adicionar um novo `step` intermediário (vira `0 | 1 | 2`, onde `1` = nova seleção e `2` = picker atual).
- Para guest: `welcome → seleção → picker`.
- Para `forNewUser`: pula welcome, começa direto na seleção.
- Estado novo `selectedModules: ModuleKey[]` (default: todos os 4 marcados, usuário pode desmarcar).
- Mínimo 1 selecionado pra liberar o botão "Continuar".
- Persistir em `useUserData` com chave `tutorial-selected-modules` (sobrevive a reload).

### 2. Tela de seleção (copy melhorada)
- Título: **"Vamos começar seu tutorial"**
- Subtítulo: **"Escolha os módulos que você quer aprender a usar com calma. A gente te guia passo a passo em cada um."**
- 4 cards (mesma estética dos cards do picker: ícone colorido + label + benefit), cada um com um checkbox/estado selecionado.
- Todos vêm pré-marcados.
- Tap alterna seleção; visual de borda + check quando marcado.
- Botão "Continuar" no rodapé (desabilitado se 0 selecionados).
- Contador discreto: "X de 4 selecionados".

### 3. Picker (etapa seguinte) — sem mudança visual
- Continua igual: "Por onde você quer começar? / Escolhe 1. Os outros ficam aqui esperando."
- Mudança única: `visibleOptions` passa a respeitar a interseção entre `pendingModules` (passado pelo `Home`) e `tutorial-selected-modules` (escolhidos na nova etapa).

### 4. Conclusão antecipada
- Quando todos os módulos **selecionados** forem completados, o tutorial encerra normalmente (popup de parabéns pro novo usuário / QuickSignup pro guest), mesmo que existam módulos não-selecionados ainda "pendentes".
- A lógica `allDone` em `Home.tsx` passa a comparar contra a lista selecionada, não contra os 4 fixos.

### Pontos técnicos
- Chave nova em `useUserData`: `tutorial-selected-modules` (`ModuleKey[]`).
- `QuickStartOnboarding` ganha lógica de step `0 | 1 | 2` e renderização condicional da nova tela.
- `Home.tsx`: ao calcular `pendingModules`, considerar somente os que estão em `tutorial-selected-modules` (se a chave existir).
- Nenhum módulo novo, nenhuma rota nova. Só uma tela a mais no wizard.
