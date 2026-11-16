# Próxima versão: iPhone 1.0.28 (build 60) e Android 140 (1.0.140)

Montada em 16/11. **Nada foi enviado**: não teve push, deploy, upload pra App Store Connect ou Play, nem versão criada nas lojas.

- **Ramo:** `v1028`, worktree `/Users/joao/core/wt-v1028`, a partir do `app-consertos-16-11`.
- **Artefatos e evidências:** `/Users/joao/core/novidades-guardadas/2026-11-16/build-1028/`.

## Atenção: a base mudou

O `origin/main` não tinha nada novo depois de 680f3515. Só que o main **não tem** o que está nas lojas hoje:

- 1.0.26/1.0.27: paywall sem teste, mensal 34,90 e Purchase pelo SDK da Meta;
- Android 139: X visível no paywall.

Se a versão saísse só do ramo de consertos, ia **voltar o app pra trás** e reabrir a recusa da Play. Por isso juntei:

- `v1027` (ponta 5182a1da, de onde saiu a build 59). Teve 2 conflitos, resolvidos juntando os dois lados:
  - `analytics.ts`;
  - `ComecarW.tsx`: o checkout Stripe da web, que veio do main, mais o paywall sem teste do iPhone.
- `android-139` (e440227d), sem conflito.

## O que entra

1. **Finanças** (ramo `app-consertos-16-11`, revisado 2× por crítico de fora):
   - compra no dia do fechamento vai pra fatura seguinte. Só vale pra compra anotada a partir de `CORTE_FECHAMENTO_NO_DIA`;
   - 1ª parcela respeita o fechamento;
   - a virada do mês não move mais lançamento atrasado (era o "sumiram");
   - total por cartão bate com as despesas;
   - receitas ordenam por data;
   - categoria padrão da outra lista;
   - vírgula dos centavos em todos os campos de valor;
   - aviso "Fica em <mês>…".
2. **Abas dos módulos não "mexem" ao deslizar** (App Store 4★, 06/11). Commit 3f065570.
   - Antes, segurar 500 ms numa aba entrava no modo de editar (abas balançando, com ×).
   - Deslizar a fileira de abas, ou a página, é rolagem nativa do iPhone, e o "segurar" não era cancelado. Agora a rolagem e o touchcancel cancelam.
   - Os widgets da Home já tinham esse conserto desde 28/10.
   - Teste: `abas-deslizar-16-11` (4 casos; 3 falham com o código antigo).
3. **Baixas dos críticos.** Commit c5ea66a3.
   - O aviso agora diz "dezembro de 2025" quando a data é de outro ano.
   - A regra do corte descarta id "do futuro" (relógio adiantado), igual à virada.
4. **Achado do revisor-de-bugs.** Commit 1f0cd03d.
   - Editar um valor salvo com ponto em Investimentos, Desejos ou Reserva e digitar uma vírgula multiplicava o valor por 10 ("1234.5," → 12345).
   - O rascunho agora mostra vírgula.
5. **Peso morto fora do binário.** Commits 66f0fc98 e cdfd62f3.
   - As páginas do site `/completo`, `/pra-sempre` e `/pra-sempre-67` (vitalício com Stripe, entraram no main 14–15/11) iam de carona pro IPA e pro AAB: +20 MB e checkout de fora dentro do app.
   - O `preparar-loja` passou a tirá-las, e a trava confere.
   - IPA 32,8 MB (a b59 tinha 32,7). AAB 28 MB (a 139 tinha 26).
6. **Tudo da 1.0.27 e do Android 139**, sem mudança.

**Versões:** iPhone `MARKETING_VERSION 1.0.28`, `CURRENT_PROJECT_VERSION 60`. Android `versionCode 140`, `versionName 1.0.140`.

## Bugs das avaliações: o que encontrei

- **Patrick (3★, 12/11)**
  - **(a) Despesa de dezembro lançada em novembro.** O conserto ccea408d (07/11) já estava na 1.0.25 (b57, ramo build-1025), na 1.0.26 e na 1.0.27 (b59 saiu de 5182a1da, que contém ccea408d). Também está nesta versão.
    - Ele avaliou em 12/11, quando o público tinha a 1.0.25. Ou seja, o conserto já estava lá, então provavelmente ele lançou de outro jeito.
    - O "+ Gasto" da Home não tem campo de data: sempre anota hoje. Só a tabela de Finanças, com data de mês futuro, manda o gasto pra planilha do mês.
    - Resposta sugerida: "lance pela tabela de Custos variáveis com a data de dezembro".
  - **(b) Receitas por data.** Feito.
  - **(c) Filtro por período específico.** NÃO construí. Anotado como funcionalidade nova.
- **2★ (01/11): e-mail com 1 letra errada.** O app JÁ deixa trocar: Você → Minha conta → "Trocar e-mail" (`/conta/email`, desde 29/10, commit 1bc9f4e7). Ela já estava na 1.0.25.
  - O risco é a troca exigir confirmação. Ela vai pro e-mail novo, e se o "Secure email change" do Supabase estiver ligado, vai também pro antigo, que tem letra errada e ninguém recebe. Aí a pessoa fica presa.
  - **Plano, sem construir:**
    1. O dono confere no painel do Supabase (Auth → Email → "Secure email change"). Se estiver ligado, desligar faz o link ir só pro e-mail novo, que a pessoa consegue abrir.
    2. Enquanto isso, o suporte resolve pelo /admin → "Trocar email" (PR #10, já no ar).
    3. Mudar o texto da tela pra explicar isso não precisa de fluxo novo.

## Checagens (com evidência)

| Checagem | Resultado | Onde |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | limpo (depois de todos os commits) | — |
| Suíte inteira (vitest) | 539/540 arquivos, 7557 testes ok. 1 falha só sob carga (`sino-paywall-1018`), que passa sozinha 12/12 | `suite.log` |
| Testes tocados depois da suíte | consertos-financas (+3 casos), abas (49), textoBR, landing-hotmart (33), 8 de Finanças (135), todos ok | — |
| revisor-de-bugs (subagente) | Nenhuma ALTA. Travas de reabrir/vassoura 21/21, partes novas 93/93. Conflitos do merge conferidos. O X do Android não regrediu | resumo abaixo |
| 1º uso gravado no Simulador, conta VAZIA, teclado de software e toque real | paywall → compra (StoreKit local) → cadastro digitado → "Pronto, bia" → missão → post-it com **12,50** → figurinha → Home → Finanças: custo fixo **89,90** e gasto **7,35** digitados com a vírgula do teclado decimal → deslizar as abas não balança | `videos/1-primeiro-uso-leve.mp4` (2 MB), original 192 MB, `prints/` |
| Fechar e reabrir 3× | Home direto, nada de tour, festa ou boas-vindas de novo. Lançamentos continuam lá | `prints/40-reaberto-1..3.png`, `43-dados-reaberto.png` |
| Quadro a quadro (`quadros.py`) | Só o branco já conhecido de 0,5 s entre as boas-vindas e a 1ª pergunta (existe desde a 1.0.26). Preto/branco ~1 s ao abrir a frio, normal. Nada novo | `prints/quadros/brancos-antes-depois.png` |
| IPA (`ipa60.sh`) | ARCHIVE e EXPORT ok, assinatura Apple Distribution (perfil manual). Travas do binário ok: versão 1.0.28/60, token Meta, IDFA, permissões, modo 1012, strings da 1.0.25→1.0.28, sem página de venda, sem pixel | `ipa60.log` |
| AAB (`aab140.sh` + `scripts/confere-aab.mjs`) | `npm run loja` → gradle direto, sem cap sync. Assinado com a chave de upload SHA-256 6F:47…CA:55. 28 MB. Sem pixel, sem modo 1012, X do paywall e linha do plano no JS. Conferidor: "pode subir" | `aab140.log` |

**Compras de teste no Simulador:** o script de zerar agora grava `meta-compra-sdk-force=off`. A compra de teste NÃO mandou Purchase pra Meta, ao contrário da 1.0.27. O cadastro criou 1 conta de QA real, `teste.qavinteoito.ftmzyf@…`. A senha está em `scratchpad/v1028/sim-conta.env`.

**Simulador:** criei um iPhone 17 Pro novo, "QA 1.0.28" (51F77DAB…). O antigo (727D…) reabria "Pagamento confirmado" pelo cache da loja de teste, e apagar ele foi bloqueado.

## Artefatos

- **IPA:** `/Users/joao/core/novidades-guardadas/2026-11-16/build-1028/core-ios-1.0.28-build60.ipa`
- **AAB:** `/Users/joao/core/novidades-guardadas/2026-11-16/build-1028/core-android-140.aab`
- **Novidades das lojas:** `novidades-loja.txt` (mesmo texto nas duas).
- **Scripts:**
  - `ipa60.sh` (com `VALIDAR=1` só valida na Apple, não sobe);
  - `aab140.sh`;
  - `build-sim.sh`;
  - `zerar-simulador.sh`;
  - `funil.sh`;
  - `t.sh`.

## O que ficou de fora

- Filtro por período (Patrick).
- Fixo com "parar a partir de tal mês".
- Fatura que vence no mês seguinte ao fechamento.
- "Pagar fatura adiantado".
- Memória de "não sugerir de novo" na carteirinha do Pet.
- As 2 piscadas brancas da 1.0.26: boas-vindas → 1ª pergunta, e "Pronto, X" → "Seu CORE tá pronto". Nesta gravação a 2ª não apareceu.
- Do revisor (BAIXA):
  - a data mostrada da 1ª parcela fica 1 mês adiantada quando o vencimento é antes do fechamento (ex.: fecha 25, vence 5). O mês em que soma está certo;
  - com relógio adiantado, a compra pode trocar de fatura num reabrir. É raro.

## Riscos

1. **`CORTE_FECHAMENTO_NO_DIA = "2026-11-17"`** (`src/lib/finance-fatura.ts:86`). Não mudei.
   - **Tem que ser a data em que o SITE subir com este código.** Se o site subir depois, troque a data antes e refaça os binários.
   - Até tudo estar no ar, app novo e site/app antigo podem mostrar faturas diferentes pra compra feita no dia do fechamento.
2. **O conserto do "lançamentos sumiram" só fecha com o site junto.** O site e os apps antigos ainda separam o mês só pela data. Se a pessoa abrir o site antigo, o item ainda pode pular de mês e sincronizar. Publicar o site com este código perto das lojas.
3. **Android não foi testado no emulador nem em aparelho.** O X e a linha do plano estão no JS e no teste (12/12), e o código nativo é igual ao da 139.
4. A 139 ainda está em análise na Play. Enviar a 140 em cima dela substitui o envio. Se a 139 for aprovada antes, a 140 entra normal por cima.

## O que falta pro dono

1. **QA no iPhone real:** teclado de verdade com vírgula (gasto, custo fixo, receita, parcela), Modo Pouca Energia ligado, deslizar as abas de Finanças pro lado.
2. **Ok pra subir o site** com este código de Finanças, e confirmar a data do corte (item 1 dos riscos).
3. **Ok pra enviar às lojas.** A 1.0.28 vai com liberação automática como as anteriores, com notas da 1.0.27. O AAB 140 vai na produção da Play.
4. Conferir no Supabase o "Secure email change" (caso do e-mail errado).
