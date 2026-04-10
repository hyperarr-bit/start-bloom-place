

## Correções na WelcomeScreen

Problemas identificados comparando com a referência:

1. **Botão e texto "Entrar" só aparecem após 2s de delay** — na referência estão sempre visíveis
2. **Animações desnecessárias** no botão (`whileTap`, `AnimatePresence` com fade-in) e no bloco de texto
3. **Espaçamento entre título → botão → "Entrar"** não corresponde à referência

### Mudanças em `src/components/WelcomeScreen.tsx`

**Remover delay/animação do botão e texto:**
- Remover `showButton` state e o `setTimeout` de 2s (linhas 13, 34-37)
- Remover `AnimatePresence` wrapper (linhas 134-157) — botão e link ficam sempre visíveis
- Trocar `motion.button` por `button` simples — sem `whileTap`
- Trocar `motion.div` do bloco CTA (linha 124) por `div` simples — sem animação de entrada

**Ajustar espaçamento (baseado na referência):**
- Gap entre título e botão: `gap-8` (mais espaço, como na imagem)
- Gap entre botão e "Entrar": `mt-4` no link (espaço menor)
- Botão: `py-4.5` ou `py-5` para ser mais alto como na referência

**Resultado:** Título, botão "Começar" e "Já tem uma conta? Entrar" aparecem imediatamente, sem animação, com espaçamento fiel à referência.

