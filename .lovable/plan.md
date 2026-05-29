## Refinar slide 4 do onboarding (Planeje seus desejos e objetivos)

Único arquivo editado: `src/components/WelcomeScreen.tsx` (apenas o componente `SlideFourMock`). Nenhum outro slide, nenhuma outra tela, nenhuma rota, nenhuma lógica de navegação/analytics será tocada.

### O que muda

1. **Imagem do iPad real**: copiar `user-uploads://IMG_7560.jpeg` para `src/assets/ipad-10.jpg` e importar no componente. Substituir o retângulo gradiente atual pela imagem real, centralizada no card de imagem (altura ~96px, `object-contain`).

2. **Card "Meu desejo"** — ajustes de fidelidade:
   - Título "Meu desejo" no topo, alinhado à esquerda.
   - Coração rosa (`Heart` preenchido em `--chart-5`) no canto superior direito do card inteiro (não dentro da área de imagem).
   - Área da imagem com fundo branco/muted bem claro, sem gradiente, apenas a foto do iPad.
   - Nome "iPad 10ª geração 64GB" em peso semibold.
   - Chip "Tecnologia" abaixo do nome — fundo lilás suave `--chart-2/0.15`, texto `--chart-2`, pill arredondado.
   - Linha "Guardado / Falta" com labels em cinza e valores: Guardado em rosa `--chart-5`, Falta em vermelho/laranja `--chart-4`; "35%" alinhado à direita ao lado de "Falta".
   - Barra de progresso rosa→vermelho em 35%, fina e arredondada.
   - Dois mini-cards lado a lado: "Tempo estimado / 5 meses" e "Faltam / 5 meses" com ícone `Calendar` cinza, fundo `muted/40`.
   - Caixa de feedback verde suave: fundo `--chart-1/0.12`, ícone `CheckCircle2` verde, "Você está no caminho certo!" em semibold + subtítulo cinza.
   - Sombra muito leve (`shadow-sm`), borda sutil, `rounded-2xl`.

3. **Tipografia e cores**: somente tokens semânticos (`--chart-1..5`, `--muted`, `--card`, `--foreground`, `--muted-foreground`). Sem hex hardcoded.

4. **Rodapé**: já existe e está correto (Voltar / dots / Continuar). Não muda.

### Não muda

- Slides 1, 2, 3, 5 permanecem intocados.
- Lógica de `step`, `goNext`, `goBack`, `skip`, `finish`, analytics e redirecionamento `/financas` — tudo preservado.
- Tutorial `QuickStartOnboarding`, `Index.tsx`, rotas — nada alterado.
- Props `onComplete` / `onLogin` — sem mudanças.

### Arquivos

- `src/assets/ipad-10.jpg` (novo — copiado do upload)
- `src/components/WelcomeScreen.tsx` (apenas `SlideFourMock` + import da imagem)
