

# Plano: Metas pré-montadas como planilha (template pronto)

## Problema
Atualmente quando o usuário cria uma meta, ela vem **vazia**. O conceito do app é ser uma planilha pronta — o usuário só preenche. As imagens de referência mostram metas já com toda a estrutura montada: grupos de ação, campos de visão, seções de problemas/soluções, tudo pronto pra preencher.

## Solução
Quando o usuário cria uma nova meta, ela já vem **pré-preenchida com template completo**, exatamente como nas fotos:

### Template padrão de cada meta criada:
1. **Imagem hero** — placeholder com texto "Toque para adicionar imagem de capa"
2. **PLANO DE AÇÃO** — já vem com 2 grupos de exemplo:
   - "Definir as bases:" com tarefas placeholder (ex: "Data: Escolher uma data ideal", "Orçamento: Determinar valor disponível", "Pesquisa: Buscar referências")
   - "Estruturar o plano:" com tarefas (ex: "Listar prioridades", "Definir etapas principais", "Criar cronograma")
3. **LINKS DE REFERÊNCIA** — seção vazia mas já visível com botões prontos
4. **VISÃO** — campos já com labels claros e placeholders descritivos
5. **PROBLEMAS E SOLUÇÕES** — já vem com 1 par vazio pronto pra preencher

### Estilo visual mais fiel às fotos:
- Cards com **headers maiores** (py-5, bg com gradiente sutil)
- Emoji **maior** (text-3xl) no header
- Título do header em **uppercase tracking-wider**
- Tasks com visual mais clean, espaçamento maior
- Labels rosa com **border-l-4** mais grosso e bg mais marcante

## Alteração

| Arquivo | Mudança |
|---------|---------|
| `src/components/hiperfoco/GoalsBoardV2.tsx` | (1) Alterar `emptyGoal()` para retornar template pré-preenchido com 2 grupos de tarefas, 1 par problema/solução vazio, e campos de visão com placeholder text. (2) Ajustar visual dos headers de seção (maior, emoji maior, uppercase). (3) Garantir que todas as seções aparecem sempre (não condicional), como uma planilha pronta. |

