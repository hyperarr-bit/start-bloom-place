## Diagnóstico

Hoje, depois do cadastro pela landing:

1. `src/pages/Auth.tsx` (linha 105) faz `navigate("/inicio")` após signup.
2. `/inicio` renderiza `WelcomeScreen` — uma página de slides de marketing (Finanças, Categorias, Previsão…). **São esses slides que estão aparecendo "sem você pedir"**.
3. O tutorial em passos (selecionar módulos) está em `QuickStartOnboarding`, montado dentro de `Home` (`/home`). Como o redirect vai pra `/inicio`, esse tutorial nunca dispara.
4. Além disso, `QuickStartOnboarding` só lista **4 módulos** (Finanças, Hábitos, Dieta, Metas). Você quer **16**.

## O que vou mudar

### 1. Redirect pós-signup
`src/pages/Auth.tsx`: trocar `navigate("/inicio")` por `navigate("/home")`. A flag `force-new-user-tutorial=true` continua sendo gravada, então `Home` já abre o `QuickStartOnboarding` automaticamente (lógica que já existe em `Home.tsx`).

Login (usuário existente) continua indo pra `/financas` como hoje. `/inicio` continua existindo (não removo nada), só não é mais o destino do cadastro.

### 2. Expandir o tutorial pra 16 módulos
`src/components/onboarding/QuickStartOnboarding.tsx`:

- Ampliar o tipo `ModuleKey` e a constante `OPTIONS` para os 16 módulos do app, cada um com label curto, frase de benefício, ícone Lucide e tom de cor via tokens `--chart-*`:

  1. Finanças → `/financas`
  2. Hábitos (rotina) → `/rotina`
  3. Dieta → `/dieta`
  4. Treino → `/treino`
  5. Saúde → `/saude`
  6. Metas (desenvolvimento) → `/desenvolvimento`
  7. Hiperfoco → `/hiperfoco`
  8. Estudos → `/estudos`
  9. Carreira → `/carreira`
  10. Biblioteca → `/biblioteca`
  11. Casa → `/casa`
  12. Beleza → `/beleza`
  13. Viagens → `/viagens`
  14. Relacionamentos → `/relacionamentos`
  15. Pet → `/pet`
  16. Detox → `/detox`

- Lista da etapa de seleção vira rolável (`max-h` + `overflow-y-auto`) pra caber 16 cards no mobile sem quebrar o layout.
- Regra de **mínimo 1** já existe (`if (prev.length === 1) return prev`) — mantida. Botão "Continuar" continua desabilitado se nenhum estiver marcado.
- Default inicial: todos os 16 marcados (usuário desmarca o que não quer).

### 3. Sincronizar `Home.tsx` com os 16 módulos
`src/pages/Home.tsx`: ampliar `ALL_MODULES` pra os mesmos 16 keys, pra que `computePending` e a marcação de "spotlight-done-*" funcionem com a nova lista. Sem isso, módulos não-Finanças/Rotina/Dieta/Metas nunca seriam considerados pendentes.

## O que NÃO vou mexer

- Layout/copy/CTA da landing page.
- Vídeos, imagens, depoimentos.
- WelcomeScreen / `/inicio` (página continua existindo, só deixa de ser o destino do signup).
- Lógica de QuickSignupModal pra convidados.
- Spotlights / tooltips internos de cada módulo.
- Nenhuma alteração de banco / RLS / edge function.

## Arquivos editados

- `src/pages/Auth.tsx` — 1 linha (redirect)
- `src/components/onboarding/QuickStartOnboarding.tsx` — array `OPTIONS` + tipo `ModuleKey` + scroll na lista
- `src/pages/Home.tsx` — array `ALL_MODULES`
