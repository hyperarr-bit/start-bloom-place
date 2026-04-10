

## Mover tudo para cima sem alterar proporções

O problema é que o `pt-16` (64px) no container principal empurra tudo para baixo, fazendo o link "Entrar" ficar cortado na base da tela.

### Mudança em `src/components/WelcomeScreen.tsx`

**Linha 67** — Reduzir o padding-top do container:
- `pt-16` → `pt-8` (de 64px para 32px)

Isso move o conjunto inteiro (mockup + título + botão + link) 32px para cima, sem alterar nenhuma proporção entre os elementos.

