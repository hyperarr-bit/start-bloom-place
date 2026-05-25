## Objetivo
Dar mais destaque à mensagem final do tutorial de finanças que orienta o usuário a tocar na seta ← para explorar outros módulos. Atualmente ela aparece como um toast padrão embaixo e passa despercebida.

## Alterações propostas

1. **Posicionar o toast no topo** — usar `position: "top-center"` para ficar na área de maior atenção visual, próximo ao header onde a seta ← está localizada.
2. **Aumentar a duração** — estender de 6s para 10s para dar mais tempo de leitura.
3. **Adicionar ícone de seta no corpo do toast** — incluir um ícone `ArrowLeft` colorido dentro da descrição para criar associação visual imediata com o botão de voltar.
4. **Estilo mais chamativo** — usar classes do sistema de design para dar destaque (ex: texto em cor de destaque, leve fundo de acento).

## Arquivo
- `src/components/onboarding/SpotlightOverlay.tsx` — ajustar o bloco `toast.success` dentro da função `finish` (linhas ~72-76).

## Nota técnica
O toast do Sonner (`sonner`) aceita props como `position`, `duration` e suporta JSX na descrição, então não é necessário instalar nada novo.