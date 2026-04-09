

## Ajuste de proporções da WelcomeScreen

Analisando a imagem de referência vs. o código atual, os problemas são:

1. **Mockup muito grande** — ocupa espaço demais, empurrando o texto/botão para baixo
2. **Espaçamento entre título, botão e "Entrar"** está diferente da referência
3. **Layout vertical** precisa: mockup mais acima, com espaço generoso entre mockup → título → botão → link

### Mudanças em `src/components/WelcomeScreen.tsx`

**Container principal (linha 80)**:
- Trocar `justify-between py-12` por `justify-start pt-16 pb-10` — controle manual do espaçamento em vez de distribuir automaticamente

**Mockup do iPhone (linhas 87-121)**:
- Reduzir de `w-[240px] h-[519px]` para `w-[220px] h-[476px]`
- Reduzir border-radius proporcionalmente: `rounded-[40px]`, inner `rounded-[30px]`
- Remover `flex-1` do wrapper — não deve crescer, tamanho fixo
- Alinhar ao topo com margem inferior fixa

**Bloco de texto + CTA (linhas 124-158)**:
- Adicionar `mt-auto` para empurrar para o fundo da tela
- Título: aumentar para `text-3xl` (na referência o texto é bem grande/bold)
- Gap entre título e botão: `gap-6`
- Gap entre botão e link "Entrar": `gap-5`
- Botão: manter `py-4 rounded-2xl` mas adicionar `rounded-xl` (a referência tem cantos menos arredondados, ~12px)
- Padding horizontal do container: `px-6` (mais largo, botão quase full-width)

Resultado: mockup menor e mais acima, texto grande abaixo com espaçamento generoso, botão largo na base — matching a referência.

