## Problemas

1. **Slide 4 (Defina limites)** — o card extra "Alertas ajudam você a corrigir antes de gastar demais" aumenta a altura do slide. O auto-fit (`mockScale`) encolhe tudo, incluindo o botão "Continuar", deixando ele pequeno comparado aos outros slides.
2. **Slide 6 (Comece pela sua primeira receita)** — o clique em "Adicionar primeira receita" chama `window.location.href = "/financas"`, que faz reload completo (slow). Trocar por SPA navigation deixa instantâneo.

## Mudanças

### `src/components/WelcomeScreen.tsx`

1. Remover o bloco `tip card` "Alertas ajudam..." (linhas ~612-629, o `motion.div` com `<Bell />` e o texto).
2. Importar `useNavigate` do `react-router-dom` (linha 2) e usar dentro do componente: `const navigate = useNavigate();`. Em `finish` (linha 1224), trocar `window.location.href = "/financas"` por `navigate("/financas")`.

Nenhum outro arquivo é tocado.
