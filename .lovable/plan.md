Plano para resolver os 4 tutoriais travando e melhorar a UI do overlay:

1. Corrigir o avanço dos passos
- Ajustar o `SpotlightOverlay` para não depender de listener recriado por passo, evitando perder o evento `core:activation` quando o usuário salva rápido.
- Usar refs para sempre comparar a ação atual com o passo atual mais recente.
- Adicionar um fallback de verificação após cada mudança de passo: se o usuário já completou a ação antes do overlay avançar, ele avança automaticamente.
- Garantir que os passos com ação avancem só quando a ação correta acontecer e que o último passo marque o módulo como concluído.

2. Corrigir as regras de ativação dos 4 módulos
- Revisar as chaves salvas por Finanças, Rotina, Dieta e Treino contra as regras em `use-user-data.tsx`.
- Ajustar regex/regras que possam estar genéricas demais ou não batendo com a chave real.
- Evitar que valores padrão/preset disparem tutorial sem ação real do usuário quando isso for possível.

3. Melhorar a experiência visual do tutorial
- Trocar o balão atual por um painel inferior fixo no mobile, com contador de passos, texto curto e botão discreto para “ver alvo” quando o alvo estiver fora da tela.
- Remover o destaque quadrado pesado em volta do botão `+`; usar contorno mais leve, arredondado e com respiro.
- Posicionar o painel para não cobrir campos importantes como receita/valor/data.
- Em passos que exigem preenchimento, manter a tela interativa e sem escurecimento pesado.

4. Melhorar textos do tutorial
- Trocar “tua” por “sua/seu/você” nos textos restantes.
- Deixar instruções mais diretas e sem ocupar tanto espaço.

5. Validar no fluxo real
- Testar o onboarding convidado nos módulos Finanças, Rotina, Dieta e Treino.
- Confirmar que cada ação avança o passo correto, que não trava no passo 1, e que ao concluir volta para o próximo módulo/celebração sem mostrar tutorial para usuário logado.