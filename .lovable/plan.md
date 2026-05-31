## Slide 6 — "Comece pela sua primeira receita"

Hoje o step===5 cai no fallback genérico (mock escalado + título pequeno + nav). Vou trazê-lo para o mesmo formato dos slides 4 e 5.

### Estrutura (igual aos slides 3/4/5 mobile)
1. Dots no topo (6 dots, 6º ativo).
2. `CORE` em black gigante (mesmo tamanho/tracking dos outros).
3. Título: "Comece pela sua<br />primeira receita".
4. Subtítulo: "Adicione sua fonte de renda para montar a base da sua organização financeira."
5. Hero card (`SlideSixHero`) reaproveitando o conteúdo já existente do `SlideFiveMock`:
   - Card branco arredondado com sombra suave (mesmo shadow token usado nos outros heros).
   - "Nova receita" como header com ícone Lucide (DollarSign) em pill rosa, igual padrão dos outros heros.
   - Campo "Fonte da receita" com valor "Salário" + chevron.
   - Campo "Valor" com "R$ 6.400,00".
   - Bloco destaque "Ótimo começo!" com ícone Star, no padrão dos cards de dica dos outros slides.
6. Botão `Continuar` preto com seta (mesmo estilo dos slides 3/4/5). No último slide ele dispara `onComplete` (avança pro app), não `goNext`.
7. Microcopy "Leva menos de 2 minutos para configurar." com ícone Clock.

### Mudanças no arquivo `src/components/WelcomeScreen.tsx`
- Criar componente `SlideSixHero` espelhando o estilo de `SlideFiveDesejosHero` (mesmo radius, padding, shadow, tipografia).
- Atualizar entrada do slide 6 em `slides[]` para usar `<SlideSixHero />` como mock.
- Adicionar branch `step === 5 ?` no render mobile, igual aos branches `step === 3` e `step === 4`, com CTA chamando `onComplete?.()` em vez de `goNext`.
- Manter o fallback intacto (não há mais steps que caiam nele depois dessa mudança, mas fica seguro).

### Fora de escopo
- Não mexer no desktop layout, nos outros slides, nem em copy/cores.
- Não trocar ícones por aproximação — usar Lucide já importado (DollarSign, ChevronDown, Star, Clock, ArrowRight).
