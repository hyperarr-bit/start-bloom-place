

# Plano: Corrigir redirecionamento do checkout Stripe

## Problema
A edge function `create-checkout` funciona e retorna a URL do Stripe (confirmado nos network logs). Porém, `window.open(url, "_blank")` é bloqueado pelo navegador (popup blocker) no mobile e no preview do Lovable.

## Solucao
Trocar `window.open(data.url, "_blank")` por `window.location.href = data.url` em ambos os handlers (checkout e customer-portal) no `src/pages/Planos.tsx`.

## Mudancas

No `src/pages/Planos.tsx`:
- Linha 50: `window.open(data.url, "_blank")` → `window.location.href = data.url`
- Linha 65 (customer-portal): `window.open(data.url, "_blank")` → `window.location.href = data.url`

## Arquivo alterado (1)

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Planos.tsx` | Trocar `window.open` por `window.location.href` |

