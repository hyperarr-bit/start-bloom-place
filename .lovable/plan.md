## Fix: emojis quebrados em notebooks/PCs

**Problema:** font-family global não inclui fallback para fontes de emoji coloridas. Em Windows/navegadores sem Segoe UI Emoji ativa, emojis das tabs (📅 📝 ⭐ 🎯 💳 ❤️ ✈️ 🛒) viram quadrados ou glifos mono.

**Solução:** adicionar fallbacks de emoji no `font-family` em `src/index.css` (linhas 151 e 156).

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont,
  'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji',
  'Twemoji Mozilla', 'Segoe UI Symbol', sans-serif;
```

Cobre Windows 8.1+, macOS, iOS, Android, Linux e Firefox. Não muda conteúdo, não adiciona requests.

**Arquivo:** `src/index.css` (apenas as 2 linhas de font-family).