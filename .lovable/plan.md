

# Plano: Upload de foto da galeria + Acoes rapidas integradas

## Parte 1: Trocar "URL da foto" por upload da galeria

**Problema**: 5 componentes pedem URL da foto manualmente — ninguem cola URL no celular. Precisa de `<input type="file" accept="image/*">` que abre a galeria do celular.

**Solucao**: Criar um componente reutilizavel `PhotoPicker` que:
- Usa `<input type="file" accept="image/*" capture="environment">` invisivel
- Converte a imagem para base64 (data URL) para armazenar no localStorage/Supabase via useUserData
- Mostra preview da foto selecionada com botao de remover
- Botao com icone Camera + texto "Adicionar foto"

**Limitacao**: Como o app usa localStorage/useUserData (sem storage bucket), as fotos serao armazenadas como base64 data URLs. Isso funciona mas ocupa mais espaco. Para uso basico (fotos de pets, pele, etc) e aceitavel.

**Arquivos alterados:**

| Arquivo | Mudanca |
|---------|---------|
| `src/components/ui/PhotoPicker.tsx` | **NOVO** — componente reutilizavel com input file + preview + base64 |
| `src/components/pet/PetDiary.tsx` | Trocar Input URL por PhotoPicker |
| `src/components/pet/PetList.tsx` | Trocar Input URL por PhotoPicker |
| `src/components/beleza/SkinAnalysis.tsx` | Trocar Input URL por PhotoPicker |
| `src/components/beleza/ProductInventory.tsx` | Trocar Input URL por PhotoPicker |
| `src/components/travel/TripCountdown.tsx` | Trocar Input URL por PhotoPicker |

---

## Parte 2: Corrigir Acoes Rapidas para integrar com modulos

**Problema**: Os dados salvos pelas acoes rapidas usam keys diferentes dos modulos reais:
- "Registrar Gasto" salva em `core-expenses` mas financas usa `finance-expenses` — dado se perde
- "Nova Tarefa" salva em `core-quick-tasks` — nenhum modulo le isso
- "Capturar Ideia" salva em `core-ideas` — nenhum modulo le isso  
- "Gratidao do Dia" salva em `core-gratitude-log` — nenhum modulo le isso
- "Check de Humor" salva em `core-mood-log` — nenhum modulo le isso
- Agua e Peso funcionam corretamente (keys corretas)

**Solucao**: 
1. **Gasto**: Mudar key para `finance-expenses` e usar o mesmo formato do ExpenseTable (`description`, `category`, `value`, `date`, `paymentMethod`)
2. **Tarefa**: Salvar em `core-rotina-habits` ou redirecionar para o modulo Rotina — mas melhor: trocar por acao que abre o modulo Rotina diretamente
3. **Ideia**: Integrar com Hiperfoco — salvar em key que ThoughtCapture le
4. **Gratidao e Humor**: Manter as keys atuais mas adicionar leitura desses dados na Home (mini-resumo no toast ou no DayScore)
5. Melhorar **feedback visual**: alem do toast, mostrar animacao de confirmacao no proprio botao (checkmark verde por 1.5s)

Vou verificar as keys corretas dos modulos Rotina e Hiperfoco:

| Acao | Key atual (quebrada) | Key correta (modulo) | Formato necessario |
|------|---------------------|---------------------|-------------------|
| Gasto | `core-expenses` | `finance-expenses` | `{id, description, category, value, date, paymentMethod}` |
| Tarefa | `core-quick-tasks` | `core-rotina-habits` | Precisa verificar formato |
| Ideia | `core-ideas` | Precisa verificar ThoughtCapture | Precisa verificar |
| Humor | `core-mood-log` | Manter — adicionar leitura | OK |
| Gratidao | `core-gratitude-log` | Manter — adicionar leitura | OK |

**Alternativa mais pragmatica para Tarefa/Ideia/Gratidao**: Em vez de forcar integracao com modulos que tem estruturas complexas, transformar essas 3 acoes em acoes que **navegam para o modulo correto** (useNavigate) com um toast avisando. Ou manter os dados locais e mostrar um mini-widget na Home que exibe tarefas/ideias/gratidoes do dia.

**Feedback visual melhorado**: Apos cada acao, o botao pisca verde com checkmark por 1.5s antes de voltar ao normal.

| Arquivo | Mudanca |
|---------|---------|
| `src/components/home/QuickActions.tsx` | (1) Corrigir key de gasto para `finance-expenses` com formato correto (2) Adicionar animacao de sucesso nos botoes (3) Para Ideia/Tarefa/Gratidao: manter dados e mostrar contagem no botao |

