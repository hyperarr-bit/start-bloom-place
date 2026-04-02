

# Substituir Tendência Mensal por Card Estilo "Você gastou"

Substituir o card `📈 TENDÊNCIA MENSAL` (linhas 748-763 do Dashboard) por um card hero azul inspirado na imagem de referência.

---

## Design

Card com fundo gradiente azul (`bg-gradient-to-br from-blue-600 to-blue-700`), ocupando largura total:

```text
┌──────────────────────────────────────┐
│  Você gastou                         │
│  R$ X.XXX  a menos/mais este mês    │
│  [↓ -XX%]  vs R$ X.XXX mês anterior │
│                                      │
│     ~~~ linha tracejada (gráfico) ~~~│
│  ●                                   │
│  ┌──────────────────────────────┐    │
│  │ ✨ Defina um limite em       │    │
│  │ Categorias e descubra...  →  │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

## Lógica

- Usa dados já existentes: `trendData` (gastos acumulados mês atual) e `prevMonthTotal` (total mês anterior)
- Calcula diferença: `currentTotal - prevTotal`
- Se gastou menos → texto "a menos este mês", badge verde com % negativa
- Se gastou mais → texto "a mais este mês", badge vermelha com % positiva
- Gráfico: SVG com path tracejado usando os pontos de `trendData` (campo `Atual`), ponto verde no início
- CTA inferior: caixa `bg-white/10 backdrop-blur` com texto "Defina um limite em Categorias..." e link "Ir →" que navega para a aba de categorias

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/components/Dashboard.tsx` | Substituir bloco do card Tendência Mensal (linhas 748-763) pelo novo card hero azul. Extrair `prevMonthTotal` para fora do `useMemo` do trendData para reutilizar. Adicionar SVG path tracejado inline. |

Nenhum arquivo novo. A prop `onNavigate` já existe no Dashboard para navegação entre abas.

