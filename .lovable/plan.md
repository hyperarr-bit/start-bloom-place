## Preview público dos módulos na landing

Adicionar botão "Ver demonstração" em cada card do carrossel "Veja cada área em detalhe". Ao clicar, abre uma rota pública `/preview/:moduloKey` que renderiza a página real do módulo, populada com dados fake e em modo somente-leitura (sem login, sem persistência).

### O que muda

**1. Rota pública `/preview/:moduloKey`** (em `App.tsx`)
- Não passa por `ProtectedRoute`.
- Renderiza um `<PreviewShell>` que:
  - Envolve a página real (`Index`, `Rotina`, `Treino`, etc.) em um `PreviewUserDataProvider` que substitui o contexto de `useUserData` por uma versão **in-memory** com dados de demonstração pré-carregados. Nada vai para Supabase nem localStorage.
  - Exibe um banner fino no topo: "Você está vendo uma demonstração — Criar minha conta grátis" (CTA fixo, link para `/auth`).
  - Bloqueia navegação para outras rotas internas (qualquer link sai do preview e vai pra `/auth`).

**2. Provider de preview** (`src/hooks/use-preview-user-data.tsx`)
- Exporta um `PreviewUserDataProvider` que reusa o mesmo `UserDataContext` exportado por `use-user-data.tsx`, mas com implementação local: `Map` em memória + seeds por módulo.
- `setData`/`deleteData` viram no-op visual (atualizam o estado local mas com toast "Modo demonstração — crie sua conta para salvar"). Isso garante que clicar em qualquer ação não quebra.

**3. Seeds de demonstração** (`src/lib/preview-seeds.ts`)
- Um objeto por módulo com as chaves principais já preenchidas (despesas, hábitos, treinos, refeições, etc.). Cada módulo recebe um conjunto enxuto e realista para passar a sensação de app cheio.

**4. Botão "Ver demonstração" no card** (`LandingPage.tsx`)
- Botão secundário abaixo da descrição do módulo no `ModulesCarousel`, abrindo `/preview/${m.key}` em nova aba.
- Mapeia `dev → desenvolvimento` e `hiperfoco → hiperfoco` para casar com as rotas existentes.

**5. Suporte a todos os 16 módulos**: financas, rotina, desenvolvimento, dieta, treino, saude, hiperfoco, estudos, carreira, biblioteca, casa, viagens, relacionamentos, pet, beleza, detox.

### Detalhes técnicos

- **Sem alteração nas páginas de módulo.** Elas continuam usando `useUserData`; só muda quem fornece o contexto.
- **Para tornar isso possível**, é preciso exportar `UserDataContext` de `use-user-data.tsx` (hoje provavelmente não exportado) para o preview provider poder fornecê-lo. Mudança mínima e segura.
- **Componentes que chamam Supabase diretamente** (não via `useUserData`) ficam inertes no preview porque não há sessão — `RouteErrorBoundary` já cobre falhas. Os módulos centrais (financas/rotina/treino/dieta) usam `useUserData` para tudo, então funcionam bem.
- **`ProtectedRoute` e `TrackedModule` ficam fora** do shell de preview — a página é renderizada direta.
- **Seeds são determinísticos**, sem datas aleatórias que mudam a cada render.

### Fora de escopo

- Não alterar o design dos cards (só adicionar o botão).
- Não criar variantes mobile-only de páginas — usar as páginas reais como estão.
- Não tocar em copy, espaçamentos ou outros pontos da landing.
