

# Plano: Redesenhar Beleza com design de planilha viva (estilo Casa)

## Problema
Os cards de Rotina Manha/Noite aparecem vazios sem nenhuma indicacao do que adicionar. O input so aparece ao clicar no icone de engrenagem (Settings2) — nao e intuitivo. O usuario quer ver a estrutura de planilha sempre visivel com campos claros para preencher, como nos modulos Comodos/Mercado/Rotina do Casa.

## Mudancas

### 1. SkincareRoutine.tsx — Cards Manha e Noite sempre com input inline visivel

**Problema atual**: Input escondido atras do botao Settings2. Quando vazio, so mostra progress bar e nada mais.

**Solucao**:
- Remover o toggle `editingPeriod` / Settings2 — o input inline fica **sempre visivel** dentro do card (como CleaningRoutine no Casa)
- Adicionar placeholder descritivo: "Ex: Gel de limpeza, Tônico, Vitamina C..."
- Quando vazio, mostrar texto guia dentro do body: "Adicione seus passos de skincare abaixo"
- Input com estilo `border-dashed border-border/60 bg-background/50` (padrao ja usado em Viagens/Carreira)
- Adicionar checkboxes para marcar `isSunscreen` e `isAcid` ao adicionar (2 pequenos toggles ao lado do input)
- Botao de remover aparece no hover do item (sem precisar de modo edicao)

### 2. ProductShelf.tsx — Tabela sempre visivel com input inline

**Problema atual**: Tabela de produtos some quando vazia, so tem botao "Adicionar Produto" que abre form separado.

**Solucao**:
- Manter a tabela Notion (header com colunas) sempre visivel mesmo sem produtos
- Quando vazia: mostrar linha com texto "Nenhum produto ainda" em italico
- Adicionar **linha de input inline** no final da tabela (como nos comodos do Casa): campos Nome, Marca, Categoria lado a lado com botao +
- Manter o form completo (Dialog) para editar detalhes avancados (preco, PAO, tamanho) — abre ao clicar no produto OU em "Mais detalhes" no input inline

### 3. SkinDiary.tsx — Tabela timeline sempre visivel

**Problema atual**: Quando sem registros, mostra icone grande de camera e texto. A tabela com colunas desaparece.

**Solucao**:
- Manter a tabela Notion (header Foto/Data/Pele/Notas) sempre visivel
- Quando vazia: linha com "Nenhum registro ainda — registre sua primeira foto!"
- Botao "Registrar Hoje" como linha de acao dentro do card (nao como botao separado)

## Arquivos alterados (3)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/beleza/SkincareRoutine.tsx` | Remover editingPeriod/Settings2, input inline sempre visivel, botao remover no hover, textos guia nos cards vazios |
| `src/components/beleza/ProductShelf.tsx` | Tabela sempre visivel com empty row, input inline na tabela para quick-add |
| `src/components/beleza/SkinDiary.tsx` | Tabela sempre visivel com empty row, botao registrar dentro do card |

