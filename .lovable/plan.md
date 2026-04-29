## Diagnóstico

O "bug" que você vê ao abrir/recarregar é um **FOUC (Flash of Unstyled Content)** — mais especificamente um flash do tema claro antes do dark mode ser aplicado.

### Por que acontece

1. O HTML (`index.html`) carrega com a tag `<html>` **sem** a classe `dark` e sem nenhuma cor de fundo definida.
2. O navegador renderiza um instante com o background padrão do CSS (claro).
3. Só depois o React monta, o `ThemeProvider` roda o `useEffect` lendo `localStorage.getItem("core-theme-mode")` e adiciona `classList.add("dark")` no `<html>`.
4. Resultado: um "piscar" branco/claro de ~100–300 ms antes do dark mode aparecer. Também acontece flash da paleta (rose/midnight/etc.) porque as variáveis CSS só são aplicadas via `useEffect`.

Isso é um problema clássico de SPA com tema persistido — não tem nada a ver com Supabase, dados ou o dark mode novo do Mercado/Finanças.

## Solução

Aplicar o tema **antes** do React montar, via um pequeno script inline no `<head>` do `index.html` (executa síncrono, antes do primeiro paint).

### Mudanças

**1. `index.html`** — adicionar script inline no `<head>`, antes do `<script type="module">`:

- Lê `core-theme-mode` do localStorage e adiciona a classe `dark` em `<html>` se necessário.
- Lê `core-theme-palette` e aplica as variáveis CSS da paleta correspondente direto no `documentElement.style`.
- Define um `background-color` inicial no `<html>` correspondente ao tema, para zero flash mesmo antes do CSS principal carregar.
- Adicionar também `<meta name="color-scheme" content="light dark">` para o navegador respeitar o tema do scrollbar e form controls desde o primeiro frame.

**2. `src/hooks/use-theme.tsx`** — pequeno ajuste:

- Manter a lógica atual (ela continua sincronizando), mas garantir que o estado inicial do `useState` espelhe exatamente o que o script inline já aplicou (já espelha hoje, só validar).
- Sem mudanças funcionais — apenas garantir que o `useEffect` não cause re-aplicação visível.

### Detalhes técnicos

O script inline será minificado, ~600 bytes, contendo um objeto com as paletas (mesmas chaves de `paletteVars` do hook). Para evitar duplicação, podemos extrair as paletas para um arquivo JSON consumido tanto pelo hook quanto pelo script (via build) — porém, dado o tamanho, **manter um snippet inline compacto no `index.html`** é a abordagem mais simples e zero-overhead. Documentaremos no topo do `use-theme.tsx` que qualquer mudança nas paletas precisa ser refletida no `index.html`.

```text
index.html (head)
  └── <script>aplica dark + paleta antes do React</script>
       └── <html class="dark" style="--background:...; background:hsl(...)">
            └── React monta já no tema correto → sem flash
```

## Resultado esperado

- Recarregar a página em qualquer tema/paleta: sem flash, sem piscar branco.
- Primeira visita (sem preferência salva): renderiza direto no tema claro padrão (sem flash também).
- Nenhuma mudança de comportamento, layout ou funcionalidade.
