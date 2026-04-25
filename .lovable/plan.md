# Reequilibrar proporções da WelcomeScreen

Analisando o screenshot atual no viewport mobile (430×697):

**Problemas:**
- iPhone pequeno demais (~230px num espaço com muita "sobra" em cima)
- Gap enorme entre o mockup e o título "Organize sua vida..."
- Botão "Começar" parece estourar/encostar nas margens (sem padding lateral suficiente nos elementos internos)
- Subtítulo "Já tem uma conta? Entrar" cortado na imagem (ficou na borda inferior)

## Mudanças (apenas em `src/components/WelcomeScreen.tsx`)

### 1. iPhone com tamanho fluido e maior

Trocar `w-[230px] md:w-[300px]` por largura responsiva ao viewport:

```tsx
style={{
  aspectRatio: "593 / 1080",
  width: "min(72vw, 300px)",
  maxHeight: "55vh", // impede estourar em telas baixas
}}
```

Isso faz o iPhone ocupar **~72% da largura no mobile** (cerca de 310px no viewport 430px), mantendo um teto sensato (300px) em desktop e nunca passando de 55% da altura.

### 2. Espaçamentos consistentes

Container principal: `gap-10 md:gap-16` (era `gap-8`) — distância iPhone↔texto mais respirável e proporcional.

Wrapper externo: adicionar `py-8` e usar `flex-col items-center justify-center` para garantir centralização vertical real e impedir que o texto inferior fique colado na borda.

Bloco de título+CTA: trocar `gap-8` por `gap-6` para aproximar título e botão (hoje exagerado), e reduzir `py-5` do botão para `py-4` (botão alto demais para o conteúdo).

### 3. Largura do CTA controlada

Adicionar `max-w-sm` ao bloco de título+CTA também no **mobile** (hoje só `md:max-w-sm`), assim o botão "Começar" não encosta nas bordas do viewport quando o `px-6` do wrapper não é suficiente.

### 4. Tipografia equilibrada

`text-3xl md:text-4xl` → `text-[28px] md:text-4xl` no h1 para casar melhor com a largura do botão no mobile (e evitar a quebra "Organize sua vida / em um só lugar" ficar maior que o CTA).

## Resultado esperado

- iPhone visivelmente maior, ocupando boa parte da tela
- Distâncias regulares: topo ↔ iPhone ↔ título ↔ botão ↔ link "Entrar"
- Tudo respeitando as margens laterais, sem cortes
- Mantém comportamento desktop (lado a lado) inalterado em telas md+

## Arquivos afetados

- `src/components/WelcomeScreen.tsx` — apenas ajustes de classes utilitárias e `style` inline do container do mockup
