# Consertos dos relatos de clientes (09–16/11)

Ramo `app-consertos-16-11`, criado a partir de origin/main 680f3515. **Nada subiu**: não teve push, deploy, build de loja nem migração. Também não li dados de clientes. Tudo foi feito pelo código e testado com lojas vazias.

- Typecheck limpo: `npx tsc --noEmit -p tsconfig.app.json`.
- Teste novo, `src/test/consertos-financas-16-11.test.tsx`: 21 casos. Com o código antigo, 17 deles falham.
- Rodei de novo, um arquivo por vez, os 45 arquivos de teste que tocam Finanças, a virada do mês, os cartões e as tabelas: todos passam.
- 4 testes antigos foram ajustados porque afirmavam a regra velha do fechamento ou a ausência do total que agora aparece.

Prints em 390×844, só das telas que mudaram, em `prints-consertos/`.

---

## Prioridade 1: cartão de crédito e mês das despesas

### 1. "Coloquei fechamento dia 2… as compras depois disso deveriam ir pro mês seguinte, mas ele cobra neste mesmo mês"
- **Causa:** `src/lib/finance-fatura.ts`, em `mesDaFatura`. A regra era `dia > fechamento`, então a compra feita NO dia do fechamento ficava na fatura atual. Nos bancos (Nubank, Itaú e outros), a compra feita no dia do fechamento já entra na fatura seguinte.
- **Conserto:**
  - A regra passou a ser `dia >= fechamento` (finance-fatura.ts:92).
  - Se precisar voltar atrás, é só mudar `FECHAMENTO_CONTA_NO_DIA` para `false` (finance-fatura.ts:77).
  - A mensagem do cartão agora diz "compras a partir do dia X".
- **Observação:** para compra *depois* do fechamento, a regra já funcionava. Se ela continuar vendo a compra no mês, as causas prováveis são:
  - a compra foi lançada como Pix ou débito, ou sem cartão;
  - foi lançada num cartão diferente daquele em que ela cadastrou o fechamento;
  - foi a compra do próprio dia 2.
  O texto de suporte abaixo pede para ela conferir isso.
- **Teste:** "compra no dia do fechamento ou depois → fatura seguinte". Para o mesmo valor, novembro soma 100, a compra vai para dezembro e dezembro soma 100.
- **Risco para clientes antigos:** nenhum no histórico, depois da revisão. A regra nova só vale para compras anotadas a partir de `CORTE_FECHAMENTO_NO_DIA`; ver "Consertos da revisão".

### 2. Play 4★: "fecha dia 4 e vence dia 10; lanço um parcelado no dia 8 e ele entra na fatura atual, já com vencimento dia 10"
- **Causa:** a parcela não olhava o fechamento. A 1ª parcela contava no mês em que foi lançada:
  - `ExpenseTable.tsx`, em `lancarParcelamento`, gravava `date` = data da compra;
  - `InstallmentTracker.tsx`, em `addInstallment`, gravava hoje.
- **Conserto:**
  - Função nova `dataDaPrimeiraParcela` (finance-fatura.ts:123). Compra antes do fechamento mantém a própria data. Compra no dia do fechamento ou depois ganha como data da 1ª parcela o vencimento do mês seguinte (exemplo: 10/12).
  - O campo `date` já é o que a tela chama de "1ª parcela". O mecanismo de "parcela que ainda não começou" (`mesDeInicio`, 07/11) já faz ela contar só a partir de dezembro, então o formato do dado não muda.
  - Onde aplica:
    - "+ Novo gasto → Parcelar" (ExpenseTable.tsx:224);
    - card de parcelamentos com o campo "1ª parcela" vazio (InstallmentTracker.tsx:148). Se a pessoa digitar a data da 1ª parcela, ela é respeitada.
  - A prévia do formulário agora diz "Em dezembro: parcela 1 de 3".
- **Teste:** 4 casos. No dia 8, a parcela é gravada com 1ª em 10/12, não soma em novembro e soma 100 ao reabrir em dezembro. Data digitada fica como está. Compra no dia 3 continua no mês.
- **Risco:** nenhum para parcelas já gravadas. Só vale para parcela nova.

### 3. "Quando coloco a data de uma compra no cartão, ele joga pro mês anterior, mas o pagamento é no mês atual… pra permanecer somando no mês que eu anotar"
### e Prioridade 2: "Alguns lançamentos do custo variável sumiram" (site, build 136)
- **Causa, um defeito real:**
  - A virada do mês (`src/hooks/use-virada-do-mes.ts:290`, que chama `separarPorMes` em `src/lib/virada-do-mes.ts`) roda **a cada abertura do app**: a trava é um `useRef` por sessão.
  - Ela separava o balde só pela data. A compra de 28/10 anotada em 05/11 aparecia e somava em novembro. Ao fechar e REABRIR o app, ela ia sozinha para a planilha de outubro e sumia da lista de novembro, sem nenhum aviso.
  - Isso vale para gastos e receitas. É exatamente "joga pro mês anterior" e "alguns lançamentos sumiram".
- **Conserto:**
  - O mês do lançamento passa a ser o mais recente entre o mês da data e o mês em que ele foi anotado (virada-do-mes.ts:129-130).
  - O "anotado em" vem do `id` que as tabelas sempre gravaram (`Date.now()`, 13 dígitos). Ids de outro formato (extrato importado, lançamentos de fora) seguem a regra antiga.
  - O defeito de 01/08 (gasto de maio esquecido no balde de agosto) continua resolvido, porque aquele gasto foi anotado em maio.
  - Se precisar voltar atrás: `VIRADA_PELO_MES_ANOTADO = false` (virada-do-mes.ts:95).
- **Teste:**
  - Lançar a compra de 28/10 em 05/11, sair e REABRIR em 16/11: ela continua em novembro.
  - No dia 1º/12, ela vai para o arquivo de novembro.
  - Maio continua em maio.
  - Id de importação ou do futuro segue pela data.
  - Receita, idem.
  - No cartão com fechamento, a compra continua somando em novembro.
- **Risco:** médio. Nada que já foi arquivado volta: o que sumiu antes continua na planilha do mês da data, no ORÇAMENTO MENSAL, e o suporte pode orientar a cliente a procurar lá. Daqui para frente, quem anotar no mês atual algo com data de mês passado verá o item ficar no mês atual. Antes ele ia para o mês da data quando o app era reaberto.
- **Outros caminhos de "sumir" que encontrei (por desenho, não são defeito):**
  - Editar a data de um gasto para um mês futuro manda o gasto para a planilha daquele mês, com aviso (ExpenseTable.tsx, `salvarEdicao` + `guardarEmOutroMes`).
  - Lançamento feito com outro perfil (Empresa × Pessoal) não aparece no perfil da tela (`usarListaDoPerfil`).
  - O filtro por conta (chips) esconde o resto enquanto está ligado.

### 4. "O valor total de cartões não corresponde aos lançamentos… uns 300 a menos"
- **Causa:** `src/components/finance/TotalPorCartao.tsx`, na linha antiga 58, e `src/lib/finance-faturas.ts:93`. O total por cartão só contava compras com fatura **igual** ao mês. Uma compra antiga anotada atrasada (exemplo: compra de 01/10 lançada em novembro, com fechamento dia 2) contava nas despesas de novembro (`variaveisDoMes` usa "fatura deste mês ou anterior") e em **nenhum** total de cartão. Isso cria exatamente a diferença.
  - O efeito somava com o item 3: depois de reabrir, essas compras ainda iam para outro mês.
  - As compras feitas depois do fechamento (fatura do mês que vem) também saíam do total sem nenhuma explicação na tela.
- **Conserto:**
  - Função `contaNaFaturaDoMes` (finance-fatura.ts:104) com a mesma régua de `variaveisDoMes`, usada no TOTAL POR CARTÃO e na linha "Fatura X" de CONTAS DO MÊS.
  - No card, uma linha nova, discreta e no mesmo estilo da dica que já existia: "Compras deste mês que vão pra fatura de dezembro · R$ X". Assim a soma da lista bate com a conta.
- **Teste:** com compra atrasada de 312,50 + 100 + 50 depois do fechamento:
  - antes, a compra atrasada não entrava em total nenhum;
  - agora, total de cartões = 412,50 = despesas, e a linha "fatura de dezembro" mostra R$ 50;
  - a linha da fatura dá 412,50.
- **Risco:** baixo. Quem tem compra atrasada vê o total do cartão e a "Fatura X · R$" do mês subirem para bater com as despesas. O "paga" da fatura não muda.
- **Print:** `prints-consertos/1-total-por-cartao-fatura-seguinte.png`.

### 5. App Store 3★: "lanço despesa com data de dezembro em novembro e ele lança em novembro; não organiza os rendimentos por data"
- **Data futura:** já existe caminho desde 07/11 (commit ccea408d, `src/lib/finance-receita-futura.ts`, `guardarGastoNoMes`). O gasto vai para a planilha do mês da data, com aviso. O teste `gasto-futuro-07-11` passa. A avaliação é de uma versão anterior, então a resposta é "atualize".
- **Ordenar receitas:** os gastos já tinham as pílulas "Ordenar" (Lançamento / Data / Nome). As receitas não tinham. Coloquei as mesmas pílulas, com o mesmo componente, na tabela de receitas (IncomeTable.tsx:197).
  - É só exibição: a lista gravada não muda de ordem.
  - A preferência fica na chave nova `finance-ordem-receitas`, um texto simples.
  - O padrão continua "Lançamento", então ninguém vê a tela mudar sozinha.
- **"Filtro por período específico"** ficou de fora: é uma funcionalidade nova, não um conserto.
- **Teste:** "receitas: ordenar por data".
- **Print:** `prints-consertos/2-receitas-ordenar-por-data.png`.

### 6. "Em qual campo coloco dívidas de cartão não parceladas? Dá pra ver o gasto mensal no cartão?"
Já existe caminho, sem código. Ver o texto de suporte abaixo.

### 7. "Como antecipar um pagamento? Vence 01/12, paguei 25/11, não tem caixa pra marcar"
- **O que existe hoje:** com o vencimento cadastrado no cartão, a linha "Fatura X · R$" aparece em CONTAS DO MÊS **no mês do vencimento** (`faturasAVencer`, finance-faturas.ts), com ✓ de paga.
- Em novembro não dá para marcar a fatura que vence em 01/12. Ela aparece em dezembro, e aí basta marcar o ✓.
- Marcar antes ou depois não muda nenhum número: os gastos já contam nas despesas do mês.
- Não construí "pagar adiantado", porque seria funcionalidade nova. As parcelas já têm "adiantar parcela" (05/11).

---

## Prioridade 3: o que a pessoa não consegue apagar ou mudar

| Relato | Existe caminho? | O que fiz |
|---|---|---|
| Excluir hábito no Detox | **Sim.** Aba RASTREADOR → tocar no hábito → "🗑 Excluir hábito" no fim do card aberto, com confirmação (`src/components/detox/DetoxTracker.tsx:254-259`, `removeHabit` :76). O botão é pequeno e só aparece com o card aberto. | Só a resposta de suporte. |
| Rotina sugerida do Pet sem botão de remover | **Sim.** Aba HOJE → "✏ Editar rotina" no rodapé do card do dia → lixeira em cada tarefa → **"Salvar rotina"** (`src/components/pet/pet-de-hoje.tsx:45-47`, :97, :111). Uma lista vazia é respeitada, então a tarefa padrão não volta (`src/lib/pet.ts:323-333`). | Só a resposta. **Ressalva:** se ela falava da carteirinha (vacinas sugeridas), o aviso "o básico também tem: X" volta a sugerir o que foi tirado (`carteirinha.tsx:116-146`, sem memória do que foi dispensado). Isso pede uma chave nova e ficou de fora. |
| Apagar a recorrência das contas fixas "previstas" | **Parcial.** "Previsto" é uma projeção só de leitura dos fixos do mês atual nos meses futuros (`FixedExpensesTable.tsx:77-88`, `projetarFixos`). Não existe "parar a partir de tal mês": `FixedExpense` não tem campo de fim, e a linha prevista não tem lixeira. O jeito hoje: apagar o fixo no mês em que ele deixa de valer, porque o mês passado já está arquivado; ou, se ele foi cadastrado na planilha de um mês futuro, apagar lá. | **Ficou de fora, é grande.** Precisaria de um campo opcional `ateMes` no fixo, respeitado por `projetarFixos`, `juntarFixosEmCadeia`, a virada e `syncFixedExpensesToBills`, mais um botão "Parar a partir deste mês". O app antigo ignoraria o campo e continuaria mostrando o fixo. |
| Usar "Financiamento" (custo fixo) num gasto variável: "já tem essa categoria" | **Não existia.** As listas padrão do fixo e do variável são separadas, e criar uma categoria com o nome de uma padrão dá erro (`finance-categories.ts`, `nomeColide`/`addCustom`). | **Consertado.** Em "+ Criar categoria…", digitar o nome de uma padrão (de qualquer lista) **escolhe a padrão**, com o mesmo value `financiamento`. Não cria uma personalizada duplicada, que partiria os relatórios por categoria. O seletor também passa a mostrar a categoria gravada quando ela é da outra lista (antes ficava em branco). Arquivos: `CategorySelect.tsx:32`, :44 e `categoriaPadraoComNome` em finance-categories.ts. Teste: "categoria padrão da outra lista". Print: `4-categoria-financiamento-no-variavel.png`. Risco: nenhum, o formato é igual. |

---

## Prioridade 4: vírgula dos centavos no iPhone (1.0.23 / 1.0.24)
- **Não estava resolvido na 1.0.27.** Os consertos de teclado da 1.0.17 eram de layout. A Home ("+ Gasto") já usava `type="text"`, mas **as tabelas de Finanças continuavam com `type="number"`**: valor do gasto variável, receita, custo fixo, contas do mês, edição de parcela, dívidas e empréstimos.
- Com o teclado brasileiro do iPhone, a vírgula num `type="number"` deixa o campo vazio para o app ("12,50" vira ""). O próprio código já registrou esse defeito em 26/09 (`ProductShelf.tsx:44`).
- **Conserto:** 13 campos passaram para `type="text" inputMode="decimal"`. O teclado continua o numérico, com vírgula. O valor sai do `numeroBR`, que entende "12,50" e "1.234,56". A conta do MEU MÊS e a edição de parcela passaram a usar `numeroBR` também.
- **Teste:** "vírgula dos centavos": "12,50" → 12,5; "1.234,56" → 1234,56. Com o código antigo, o campo fica vazio e o gasto não entra.
- **Prints:** `3a-valor-com-virgula-digitado.png`, `3b-gasto-12-50-salvo.png`.
- **Risco:** baixo. No PC somem as setinhas de subir e descer do campo de valor. Os dados não mudam.
- **Atenção:** isso só chega ao iPhone numa build nova. A resposta de suporte é "consertado na próxima versão", não "atualize".

---

## O que ficou de fora e por quê
- **Fatura que vence no mês seguinte ao fechamento** (fecha 25, vence 5): o app conta a compra no mês em que a fatura FECHA, não no mês em que vence. Mudar isso desloca um mês inteiro para quem já usa e esbarra na trava de "no máximo 1 mês à frente". É redesenho: precisa de decisão do dono e de uma chave.
- Fixo com "parar a partir de tal mês" (acima).
- Memória de "não sugerir de novo" na carteirinha do Pet (acima).
- Filtro por período nas listas, e "pagar fatura adiantada" como botão: são funcionalidades novas.
- Os itens que já sumiram para o mês passado antes deste conserto não voltam sozinhos: estão na planilha do mês da data (ORÇAMENTO MENSAL).

## Arquivos
Lógica:
- `src/lib/finance-fatura.ts`
- `src/lib/finance-faturas.ts`
- `src/lib/virada-do-mes.ts`
- `src/lib/finance-categories.ts`

Telas:
- `src/components/finance/TotalPorCartao.tsx`
- `ExpenseTable.tsx`
- `InstallmentTracker.tsx`
- `IncomeTable.tsx`
- `FixedExpensesTable.tsx`
- `finance/MonthCalendar.tsx`
- `finance/DividasEntrePessoas.tsx`
- `finance/CategorySelect.tsx`
- `finance/CartaoConfig.tsx`
- `finance/ordenar.tsx`

Testes:
- novo: `src/test/consertos-financas-16-11.test.tsx`
- ajustados: `financas-parcelas-cartao`, `virada-mes-auditoria`, `credito-sem-data-07-11`, `financas-chamados-07-10`

---

## Respostas de suporte (rascunhos, para o dono ver ANTES de enviar)

**Fechamento dia 2, compra contando no mês:**
> Oi! Obrigado por avisar. Encontramos e corrigimos: a compra feita no próprio dia do fechamento ainda ficava na fatura atual, e agora vai para a seguinte, como no banco. Confere também se a compra está lançada como "Cartão de crédito" e no mesmo cartão em que você colocou o fechamento: só esse cartão segue a regra. A correção chega na próxima atualização do app.

**Parcelado entrando na fatura fechada (Play 4★):**
> Obrigado pela avaliação! Você tinha razão: o parcelado não olhava o fechamento do cartão. Corrigimos: se você lançar no dia do fechamento ou depois, a 1ª parcela já cai na fatura do mês seguinte, com o vencimento certo. Chega na próxima atualização.

**Compra no cartão indo pro mês anterior:**
> Oi! Corrigimos isso: quando você anotava uma compra com data do mês passado, o app a levava sozinho pro mês da data assim que você abria de novo. Agora ela fica e soma no mês em que você anotou. As que já tinham ido estão na planilha do mês da data (Finanças › ORÇAMENTO MENSAL › o mês). Chega na próxima atualização.

**Total de cartões com R$ 300 a menos:**
> Obrigado pelo detalhe, ajudou muito! Achamos a causa: compras com data de antes do último fechamento entravam nas despesas, mas não no "Total por cartão". Corrigimos, e o card agora mostra numa linha separada quanto já vai para a fatura do mês que vem, pra conta bater com a lista. Chega na próxima atualização.

**Despesa de dezembro lançada em novembro / ordenar rendimentos (App Store 3★):**
> Obrigado! A despesa com data de um mês futuro já vai pra planilha daquele mês nas versões novas, é só atualizar o app. E na próxima atualização as receitas também ganham o "Ordenar: Lançamento · Data · Nome", igual aos gastos.

**Dívida de cartão não parcelada / ver o gasto do mês no cartão:**
> Oi! Pra cada compra no cartão, lança em Custos Variáveis com o pagamento "Cartão de crédito" e escolha o cartão. O card "TOTAL POR CARTÃO NO MÊS" mostra quanto você gastou em cada cartão; toque em "fechamento" no cartão pra informar o fechamento e o vencimento, e as compras caem na fatura certa. Se for uma dívida antiga de cartão (fatura atrasada, acordo), use "Dívidas e empréstimos" › "Eu devo": ela fica registrada sem bagunçar os gastos do mês.

**Antecipar o pagamento da fatura:**
> Oi! Com o vencimento cadastrado no cartão, a "Fatura [cartão]" aparece em Contas do mês no mês em que vence: a de 01/12 aparece em dezembro, e aí é só marcar o ✓. Marcar antes ou depois não muda os seus números, porque as compras já contam nas despesas. Anotamos o pedido de poder marcar antes.

**Excluir hábito do Detox:**
> Oi! Na aba Rastreador, toca no hábito pra abrir; no fim, embaixo do calendário, tem "🗑 Excluir hábito". Ele pede confirmação e apaga.

**Rotina sugerida do Pet:**
> Oi! Na aba Hoje do Pet, no fim do card do dia, toca em "✏ Editar rotina". Cada tarefa tem uma lixeira; tira a que você não faz e toca em "Salvar rotina". Ela não volta mais.

**Recorrência das contas fixas previstas:**
> Oi! Hoje o custo fixo vale todo mês até você apagá-lo: os meses futuros mostram o "previsto" a partir dele. Pra parar, apaga o fixo no mês em que ele deixa de existir (os meses que já passaram ficam guardados como estavam). Se você cadastrou o fixo direto na planilha de um mês futuro, dá pra apagar lá. Anotamos o pedido de "parar a partir de tal mês" sem precisar apagar.

**Categoria Financiamento no custo variável:**
> Oi! Corrigimos: na próxima atualização, ao criar a categoria "Financiamento" num gasto variável, o app usa a mesma categoria do custo fixo, em vez de dizer que já existe, e os relatórios somam tudo junto.

**Vírgula dos centavos (iPhone):**
> Oi! Obrigado por insistir nisso. Achamos o problema: nos campos de valor do Finanças, a vírgula do teclado do iPhone apagava o número. Já corrigimos, e a correção chega na próxima versão do app. Até lá, dá pra lançar pelo "+" da tela inicial (Gasto), que aceita a vírgula.

---

## Consertos da revisão (16/11)

**MÉDIA 1: a retrospectiva, as insígnias e o card de compartilhar contavam o lançamento atrasado em dois meses.**
- **Causa:** `lerFinancasDoMes` (`src/lib/retrospectiva.ts`, função `doBalde`) pegava da lista do mês atual os itens com *data* do mês passado. O gasto de R$ 300 com data 28/10, anotado em 05/11, entrava em outubro (400) e em novembro (350).
- **Conserto:** `virada-do-mes.ts` passou a exportar `mesDoLancamento`, que faz a mesma conta da virada (o mês mais recente entre a data e o dia em que foi anotado). O `doBalde` agora só pega o item cujo mês, por essa regra, é o mês pedido (retrospectiva.ts:431).
- As insígnias (`insignias.ts:409-411`) e o card de outubro (`retro-outubro-dados.ts:134`) leem por `lerFinancasDoMes`, então ficam certos junto.
- **Teste:** "revisão M1". Gasto: outubro 100, novembro 350. Receita: outubro 3000, novembro 400. Com o código antigo dá 400 e 3400.

**MÉDIA 2: a regra "no dia do fechamento vai pra fatura seguinte" mudava o histórico.**
- **Conserto:** a regra nova só vale para compras **anotadas a partir de** `CORTE_FECHAMENTO_NO_DIA = "2026-11-17"` (finance-fatura.ts:86).
  - **Ajuste esse valor para o dia em que o ramo for publicado.**
  - O "anotado em" vem do id de 13 dígitos (`anotadoEmMs`, virada-do-mes.ts:108).
  - Compra anotada antes do corte, ou sem id de 13 dígitos (extrato importado, dado antigo), segue a regra antiga, dia > fechamento (`regraDoDiaDoFechamentoVale`, finance-fatura.ts:94, usada em `mesDoGasto`, :182). Retrospectiva, comparação e balanço de meses passados não mudam.
  - A 1ª parcela do parcelado (`dataDaPrimeiraParcela`) usa sempre a regra nova, porque só vale para parcela criada agora e não mexe no histórico.
- **Teste:** "revisão M2".
  - 25/10 anotada antes do corte continua em outubro.
  - Sem id de 13 dígitos, regra antiga.
  - Anotada depois do corte, vai para a fatura seguinte.
  - Depois do fechamento, é a seguinte para os dois lados.
  - Voltei ao valor original a afirmação do `credito-sem-data-07-11` (id "t" = regra antiga).

**BAIXA: a vírgula no resto dos campos de dinheiro.**
- Componente novo, `src/components/ui/campo-dinheiro.tsx` (`CampoDinheiro`): guarda o que foi digitado como texto e converte com `numeroBR`, no mesmo desenho do campo da Beleza. Ele vale para os campos que guardam o número a cada tecla.
- Onde aplica:
  - Reserva de emergência, "Já guardei": `type="text"` + `numeroBR`. Antes podia salvar 0 em silêncio.
  - Gasto rápido do widget da Home (`FinancesWidget.tsx`): `numeroBR` e recusa valor vazio ou zero. Antes `parseFloat("12,50")` dava 12.
  - Investimentos: o formulário novo (valor investido, valor atual, aporte, rentabilidade) usa o `CampoDinheiro`. A edição e o aporte passam a `type="text"` + `numeroBR`.
  - Desejos: o formulário novo (preço, já guardei) usa o `CampoDinheiro`. A edição e o "+ Valor" passam a `type="text"` + `numeroBR`.
- **Teste:** "revisão: vírgula no resto".
  - No `CampoDinheiro`, "12,50" vira 12,5, "1.234,56" vira 1234,56 e campo vazio fica sem valor.
  - Uma trava confere que nesses quatro arquivos não sobra `parseFloat` nem `type="number"` em campo de dinheiro. O `type="number"` que ficou na Reserva é o de "Quantos meses", que é inteiro.

**OPCIONAL, feito: aviso de 1 linha.** Ao salvar gasto ou receita com data de mês passado na tela do mês atual, aparece: "Fica em novembro, o mês em que você anotou. Pra lançar em outubro, use a planilha de outubro (Orçamento mensal)."
- O texto vem de `avisoDeMesPassado` (`src/lib/finance-receita-futura.ts`), chamado no ExpenseTable e no IncomeTable só quando a tabela é a do mês atual.
- **Teste:** "revisão: aviso de data do mês passado".
