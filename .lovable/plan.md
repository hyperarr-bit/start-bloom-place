## Compactar `AccessGateUI` para caber em uma tela só

Reduzir tamanhos e espaçamentos para que todo o conteúdo (título → CTA + microcopy) caiba na primeira dobra de qualquer celular (Android pequeno incluso), sem scroll.

### Ajustes em `src/components/AccessGateUI.tsx`

- Container: `pt-20` → `pt-14`, `pb-8` → `pb-4`, `gap-5` → `gap-3`.
- Título "CORE": `text-5xl` → `text-4xl`.
- Headline: `text-[26px]` → `text-xl`, `space-y-3` → `space-y-1.5`.
- Subheadline: `text-base` → `text-sm`.
- Cards (3): padding `p-4` → `p-2.5`, ícone `w-12 h-12` → `w-10 h-10`, valor `text-lg` → `text-base`, label `text-sm` → `text-xs`, spacing `space-y-3` → `space-y-2`, `mt-2` removido.
- Bloco "Para acessar agora": `p-4` → `p-3`, `space-y-3` → `space-y-2`, círculos numerados `w-7 h-7` → `w-6 h-6`, texto `text-base`/`text-sm` reduzidos um nível, divisor mantido fininho.
- Botão CTA: `py-4` → `py-3`, `text-base` → `text-sm`.
- Halo/botão verde do canto: halo `-top-14 -right-14 w-40 h-40` → `-top-10 -right-10 w-28 h-28`, botão `w-14 h-14` → `w-12 h-12`, `top-3 right-4` → `top-2 right-3`, ícone `w-7 h-7` → `w-6 h-6`.

Nenhum texto, ícone, ordem ou outra estrutura muda — só tamanhos/spacings.