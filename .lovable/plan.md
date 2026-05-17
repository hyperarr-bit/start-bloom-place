## Objetivo
Replicar o padrão de header da Finanças em todos os 16 módulos: mostrar **mês/ano** + **ThemeToggle** alinhados à direita. Em módulos que têm um subtítulo cinza embaixo do título (ex: Dieta — "Cardápio, jejum, receitas e diário"), remover esse subtítulo.

## Padrão final do header
```tsx
<div className="... flex items-center gap-3">
  <button back />
  <Icon />
  <h1>TÍTULO</h1>
  <div className="flex items-center gap-2 ml-auto">
    <span className="text-muted-foreground text-xs capitalize">{currentMonth}</span>
    <ThemeToggle />
  </div>
</div>
```

`currentMonth` = `new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })`.

## Arquivos a alterar (16 módulos)
Em cada um:
1. Importar `ThemeToggle` de `@/components/ThemeToggle` (se ainda não importado).
2. Adicionar `const currentMonth = ...` no corpo do componente.
3. Inserir o bloco `<div className="flex items-center gap-2 ml-auto">…</div>` na primeira linha do header.
4. Se houver `<p className="text-[11px] text-muted-foreground">…subtítulo…</p>` embaixo do `<h1>`, remover esse `<p>` e desfazer o `<div>` wrapper (deixar só o `<h1>` direto).

Páginas:
- `src/pages/Rotina.tsx`
- `src/pages/DesenvolvimentoPessoal.tsx`
- `src/pages/Saude.tsx`
- `src/pages/Casa.tsx`
- `src/pages/Estudos.tsx`
- `src/pages/Biblioteca.tsx`
- `src/pages/Beleza.tsx`
- `src/pages/Viagens.tsx`
- `src/pages/Carreira.tsx`
- `src/pages/Treino.tsx`
- `src/pages/Dieta.tsx` *(tem subtítulo — remover)*
- `src/pages/Hiperfoco.tsx`
- `src/pages/Relacionamentos.tsx`
- `src/pages/Pet.tsx`
- `src/pages/Detox.tsx`
- `src/pages/Conquistas.tsx` (se aplicável)

> Vou verificar cada arquivo durante a execução e remover qualquer `<p>` subtítulo encontrado (não só o de Dieta).

## Não mexer
- `Home.tsx` (já tem seu próprio header de saudação).
- `Index.tsx` (Finanças — já é a referência).
- Páginas auxiliares (Auth, Planos, AuthCallback, Reset/UpdatePassword, admin/*).
- Lógica/dados de cada módulo; só header.