## Plano

O zoom que você vê não é do app — é o Safari iOS que dá zoom automático em qualquer `<input>`, `<textarea>` ou `<select>` cuja fonte seja menor que 16px. O fix padrão é garantir `font-size: 16px` nesses campos em telas pequenas.

### Mudança

Adicionar no `src/index.css` uma regra dentro de `@media (max-width: 768px)`:

```css
@media (max-width: 768px) {
  input, textarea, select {
    font-size: 16px;
  }
}
```

Isso elimina o auto-zoom do Safari ao focar campos, sem alterar o tamanho visual no desktop e sem mexer em layout, cores ou componentes.

### Não vou mexer

- Tamanho dos inputs no desktop.
- Componentes shadcn, estilos de cards, fluxo.
- Nada além dessa regra CSS.