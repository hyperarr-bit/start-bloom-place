/**
 * PAYWALL DO iPHONE — arquivo próprio (31/08, decisão do dono: "no fundo são
 * produtos diferentes").
 *
 * POR QUE ISTO NÃO É UMA CÓPIA DO PaywallW, E SIM UM ARQUIVO SEPARADO.
 *
 * Até aqui o iPhone vivia dentro do paywall do Android, atrás de `ehApple()`.
 * Funcionava — e um teste provou que funcionava —, mas a fronteira era um
 * `if`, e um `if` depende de todo mundo lembrar dele. A prova disso aconteceu
 * no mesmo dia: a sessão do Android desligou o A/B (`AB_LIGADO = false`), e o
 * iPhone só não perdeu a coluna do mensal — contrariando a spec — porque a
 * linha estava escrita como `ehApple() ? "b" : sortearBraco()`. Se estivesse
 * escrita do jeito óbvio, a vitrine do iPhone teria mudado sozinha, em
 * silêncio, por uma mudança que não era sobre o iPhone.
 *
 * Agora a fronteira é o sistema de arquivos: o Android mexe no PaywallW e não
 * alcança este arquivo. Não tem como esquecer de uma fronteira que é física.
 *
 * O QUE É DIFERENTE AQUI, e cada item tem custo se for esquecido:
 *
 *  · SEM A/B. O iPhone nasce sem campanha (não há SDK da Meta nem ATT), então
 *    o volume não sustenta teste — dividir um fluxo pequeno ao meio produz
 *    dois números sem significância. Uma versão só.
 *  · DOIS PREÇOS SEMPRE. O dado que fez o Android escolher "vitalício
 *    sozinho" veio de público Pix-first e sensível a preço. Na App Store não
 *    existe Pix, some o atrito que empurrava pro pagamento único, e assinar
 *    é um Face ID. A física da decisão é outra.
 *  · SEM ESCADA DE PIX. Nada de reabrir a folha em 4s, "seu código vence em
 *    5 minutos" ou "Já paguei". A folha da Apple é instantânea e cancelar é
 *    cancelar; reabrir sozinho seria perseguir com pop-up quem disse não, e a
 *    Apple trata isso como padrão abusivo.
 *  · RODAPÉ LEGAL OBRIGATÓRIO. "Restaurar compras" (regra 3.1.1) e links de
 *    Termos e Privacidade na própria tela de compra (3.1.2). Sem eles, este
 *    paywall reprova — e ele é a PRIMEIRA tela que um iPhone novo vê, então
 *    quem reinstala cai aqui sem jeito de recuperar o que pagou.
 *  · O LEGAL DIZ QUE RENOVA. Na Apple o mensal é auto-renovável obrigatório;
 *    "cancele quando quiser" fala do direito de sair, não do fato de que vai
 *    cobrar de novo. A 3.1.2 exige o aviso, e é o que evita reembolso.
 *  · NENHUMA MENÇÃO A PIX/GOOGLE/PLAY. Regra 3.1.1: citar pagamento de fora
 *    da App Store dentro do app é motivo de recusa direto.
 *
 * O que continua vindo do arquivo compartilhado (`PaywallDia14`) é só
 * apresentação sem semântica de loja: gráfico de transformação, pilha de
 * valor, depoimentos, âncora do topo. Nenhum deles sabe o que é Pix. Se um
 * dia a identidade visual das duas lojas divergir, esses também se separam.
 *
 * Coberto por `paywall-ios.test.tsx`.
 *
 * OFERTAS DE SAÍDA (10/10, pra 1.0.14) — TODAS atrás de chave DESLIGADA
 * (lib/ofertas-saida: constante local, metadata da offering no RevenueCat ou
 * `?ofertas-saida=on` neste aparelho). Com tudo off esta tela é a de hoje,
 * byte a byte (src/test/ofertas-saida.test.tsx prova):
 *  · OFERTA_X_PAYWALL — o Voltar do funil (evento `core:voltar`, do ComecarW) sem
 *    ter iniciado o teste abre a caixa de presente (Presente69, lugar "x_paywall"):
 *    anual 69,90 COM os 3 dias grátis. 1x por aparelho; "Agora não" fecha de vez.
 *  · OFERTA_MENSAL_19 — escolheu o mensal e cancelou a folha da Apple → mensal
 *    19,90 (OfertaMensal19, lugar "mensal_paywall"), se a offering `mensal_19` existir.
 *  · PAYWALL_TEXTOS — "A Apple vai pedir confirmação. Nada é cobrado hoje." acima
 *    do botão e selo "economize N%" no anual (N dos preços REAIS: 12×mensal × anual).
 * A 2ª chance da folha da Apple (28/09): os eventos ganham o campo `segunda_chance`
 * ("imediata" aqui; "saida"/"proxima_abertura" nas ofertas). 16/10 (SEM chave): a 1ª folha
 * do anual 97,90 fechada abre o presente 69,90 COM 3 dias grátis (Presente69, lugar
 * "folha_cancelada") no lugar do cartão de mesmo preço; o cartão fica de reserva (presente
 * `off` na offering, loja calada, sem direito ao teste). Um presente por sessão do paywall:
 * quem viu aqui não vê no Voltar, e vice-versa.
 *
 * SAÍDA SEM COMPRAR (1.0.14): `paywall_saiu {motivo: voltar|outro, segundos_na_tela,
 * viu_oferta}` — uma vez por paywall aberto, quando a tela desmonta sem compra ou
 * quando o app vai pro fundo (o 2º Voltar do iPhone MINIMIZA sem desmontar nada);
 * "voltar" quando houve `core:voltar` nos últimos 10 s. Com RECUPERACAO_PAYWALL
 * ligada, o 1º Voltar (e o app no fundo) armam os 2 avisos locais da recuperação
 * (lib/notificacoes, faixa 950000) — cancelados ao abrir o paywall de novo e em
 * qualquer compra que dê certo.
 *
 * PAYWALL CURTO (10/10, chave PAYWALL_CURTO em lib/ofertas-saida, desligada; dono:
 * "na tora, testa tudo" — SEM A/B). Hoje: ~12 blocos, planos abaixo da dobra, botão
 * pulsando sem parar, folha da Apple sem preparação (76% fecham). Ligada, a tela é a
 * ESTRUTURA do paywall do Cal AI (dono 10/10, depois de ver a 1ª versão no Simulador:
 * "muito espaço não preenchido; segue o estilo do Cal AI"), cheia de cima a baixo, SEM
 * ROLAR (390×844 e 375×667 — na pequena a imagem encolhe, ela é o flex-1):
 *   1. imagem grande sangrando até as bordas (public/paywall-hero.jpg: o Finanças
 *      real com o mês somado), fade pra branco embaixo, botão Voltar redondo branco
 *      por cima (emite `core:voltar` — é o "X" do paywall: abre o presente 69,90 com
 *      OFERTA_X_PAYWALL — e chama `onVoltar`, se o funil passar um);
 *   2. título grande centralizado "Comece seus 3 dias grátis pra continuar";
 *   3. card do anual com cabeçalho preto "3 DIAS GRÁTIS": ✓ "Comece grátis e
 *      economize 67%" (calcularEconomia dos preços reais) + "R$ 97,90 cobrado por ano"
 *      e "R$ 8,16/mês" à direita; borda preta grossa quando selecionado;
 *   4. card do mensal embaixo, cinza claro, "Mensal" + "R$ 24,90/mês";
 *   5. UMA linha pequena "✓ Sem cobrança hoje · a gente te avisa dia DD/MM" + botão
 *      preto "Continuar" (1 pulso só) + legal em 2 linhas + "Termos · Privacidade ·
 *      Restaurar" (3.1.1/3.1.2) e "Tenho um código · Já paguei pelo site" discretos.
 * No TOQUE, antes da folha, a pílula de ~1,2 s "A Apple vai mostrar R$ 97,90/ano: é o
 * valor depois dos 3 dias. Hoje: R$ 0,00." (ela SUBSTITUI a pílula do PAYWALL_TEXTOS —
 * nunca as duas). Preços SEMPRE da loja (priceString) — até o "R$ 0,00" é o da oferta
 * introdutória. 2ª chance da folha, presente 69,90 no Voltar, paywall_saiu, recuperação:
 * iguais. `paywall_oferta_vista` ganha `paywall_curto: true`. Com a chave off esta tela
 * é a de hoje, byte a byte.
 *
 * 1.0.16 (16/10, definitiva/2-oferta + 3-onboarding; escada em definitiva/escada-oferta.md):
 *  · EXPLICAÇÃO NA 2ª VEZ (ExplicaFolha): quem JÁ fechou a folha da Apple do anual nesta sessão e
 *    toca de novo (Continuar ou "Tentar de novo") vê a meia-folha calma antes da folha — os dias do
 *    teste com datas, "Nada é cobrado hoje", o lembrete (só se a permissão permitir) e como a folha
 *    é. 1x por produto por sessão; o presente de 69,90 que vem depois da folha fechada faz o mesmo
 *    (prop `explicar`). Na 1ª vez nada muda (pílula do curto; folha direto no layout longo).
 *  · UM PRESENTE POR SESSÃO vale também pro mensal 19,90 (antes ele podia vir depois do 69,90).
 *  · Voltar redondo: depois de ver (e fechar) um presente, ele não recuava nunca mais — agora só
 *    não recua quando uma oferta ABRE por cima com este toque.
 *
 * PAYWALL MINIMALISTA (17/10, chave `paywall_minimalista` em lib/paywall-minimalista, LIGADA; dono:
 * "minimalismo é melhor, tanto na estrutura do paywall quanto na copy"). Vale onde o curto vale (funil e
 * gate); desligada, o curto de hoje byte a byte. De cima pra baixo, sem rolar em 390×844 e 375×667:
 *   · Voltar redondo (só funil): o MESMO `core:voltar` (presente 69,90 / recuo do funil);
 *   · "Experimente 3 dias grátis" + "Veja exatamente como funciona sua assinatura." (copy do dono);
 *   · a linha do tempo do teste (components/paywall/LinhaDoTempoDoTeste, a mesma da ExplicaFolha):
 *     Hoje — R$ 0,00 · Amanhã — Lembrete · Dia 3 — R$ 97,90/ano, preços da loja; o lembrete só aparece se a
 *     permissão deixa o 920001 sair (e cai no dia que o aviso cai: diaDoAviso);
 *   · UM cartão do plano (anual: "3 dias grátis · R$ 8,16/mês" e o valor do ano como o preço mais visível,
 *     como a Apple quer) + "Começar teste grátis" + "Ver plano mensal" (troca cartão, título e linha do
 *     tempo pro mensal, que cobra hoje) + "Renova automaticamente até você cancelar." + o rodapé de sempre.
 *   O que SAIU, e por quê (o que tinha número ficou, no menor tamanho):
 *   · a imagem grande, o cabeçalho "3 DIAS GRÁTIS" e o "economize 67%" do cartão (o dono: "deixar
 *     minimalista TUDO"; título e linha do tempo já dizem os dias);
 *   · o cartão do mensal à vista → link "Ver plano mensal" (o anual pré-selecionado é o medido em 15–18/09);
 *     a CONTA contra o mensal (29/08: sem ela o barato levou 92%) fica no "R$ 8,16/mês" do cartão e no link
 *     de volta "Ver plano anual · R$ 8,16/mês";
 *   · "Sem cobrança hoje · a gente te avisa dia DD/MM" → são os passos Hoje e Amanhã da linha;
 *   · a pílula de 1,2 s "A Apple vai mostrar…" → a linha mostra Hoje R$ 0,00 e Dia 3 o preço ANTES do toque,
 *     e a folha abre direto; na 2ª vez a ExplicaFolha (enxuta) continua;
 *   · o legal em 2 linhas → 1 (preço e período estão no cartão, colado no botão).
 *   Ficaram: a 2ª chance (32% das compras vêm de quem fechou a folha uma vez), o presente 69,90 (folha
 *   fechada e Voltar), a ExplicaFolha da 2ª vez, o lembrete armado na compra (01/10: sem a promessa a
 *   renovação ligada caiu de 56% pra 44%), Termos · Privacidade · Restaurar (3.1.1/3.1.2), "Tenho um código"
 *   (Offer Codes, afiliados), "Já é cliente?" (compra do site), paywall_saiu e a recuperação.
 *   Sempre CLARO (LIGHT_VARS + tema-claro — "paywall sempre claro"), também no gate com o app no escuro.
 *   Eventos: os de sempre + `minimalista: true` (paywall_oferta_vista, os funnel_click da tela) e
 *   `paywall_linha_tempo_view` 1x por paywall aberto, com a linha do teste à vista (dias, preço, braço,
 *   aviso, passos).
 */
/** Dias grátis de RESERVA enquanto a loja não respondeu — o número de verdade é o da oferta
 *  introdutória (rc.diasTrialIos()). 17/10: mora em lib/teste-da-loja (as boas-vindas da missão também
 *  leem); daqui continua exportado pra quem já lia deste arquivo. */
export { DIAS_DE_TESTE_PADRAO };
/** Quanto a pílula "A Apple vai mostrar…" fica na tela antes de a folha abrir. */
export const PREPARACAO_DA_FOLHA_MS = 1200;

/* "a gente te avisa dia DD/MM" (o dia N−1 do teste, Dia 1 = hoje): 17/10 a conta mora com a linha do
 * tempo (components/paywall/LinhaDoTempoDoTeste), a MESMA do aviso 920001 (lib/notificacoes); daqui ela
 * continua exportada pra quem já lia deste arquivo. A linha do tempo antiga daqui (linhaDoTempoDoTeste,
 * sem uso na tela desde o curto do Cal AI) saiu — a de verdade é o passosDoTeste de lá. */
export { diaDoAviso };
/** Um `core:voltar` nos últimos N ms faz a saída contar como "voltar". */
export const JANELA_DO_VOLTAR_MS = 10_000;
import { erroJaAtivo, erroNaoPermitido, erroFolhaNaoConcluiu } from "@/lib/loja";
import { DIAS_DE_TESTE_PADRAO } from "@/lib/teste-da-loja";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { APP_PRECOS } from "@/lib/native-shell";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { isNativeShell } from "@/lib/native-shell";
import { AppLegalFooter } from "@/components/paywall/PaywallFlow";
import { JaPagouPeloSite } from "@/components/app/JaPagouPeloSite";
import { useAuth } from "@/hooks/use-auth";
import { agendarRecuperacaoDoPaywall, agendarResgateDoPlano, cancelarRecuperacaoDoPaywall, cancelarResgateDoPlano, cancelarReguaDoTeste, pedirLembreteDoTeste } from "@/lib/notificacoes";
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";
import { guardarForcaDasOfertas, ofertaLigada } from "@/lib/ofertas-saida";
import { Presente69Folha, prepararPresente, type OfertaDoPresente } from "@/components/app/Presente69";
import { Mensal19Folha, prepararMensal19, type OfertaDoMensal19 } from "@/components/paywall/OfertaMensal19";
import { ExplicaFolha } from "@/components/paywall/ExplicaFolha";
import { LinhaDoTempoDoTeste, diaDoAviso, lerAvisoDoTeste, passosDoTeste, passosSemTeste, type AvisoDoTeste } from "@/components/paywall/LinhaDoTempoDoTeste";
import { guardarForcaDoMinimalista, paywallMinimalistaLigado } from "@/lib/paywall-minimalista";
import {
  TransformChart, ValueStack, ModulesIncludedCard, AnchorCard, AreaAnchorCard,
  MuralDepoimentos, CompareTable, CHART_LABEL,
} from "@/pages/funis/dia14/PaywallDia14";

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.4, delay: Math.min(i * 0.05, 0.3) },
});

/**
 * Qual coluna nasce selecionada. Constante de uma linha de propósito: é a
 * única alavanca de posicionamento desta tela, e trocar tem que ser trocar
 * uma linha, não refazer o paywall.
 */
/* 18/09: o vitalício SAI do iPhone e entra o ANUAL de R$ 97,90 com 3 dias
 * grátis (oferta introdutória da App Store). Motivo, medido 15–18/09: 381
 * pessoas abriram a folha da Apple e 40 pagaram — 6% no vitalício, 11% no
 * mensal. A folha com "3 dias grátis, depois R$ 97,90/ano" é o que derruba
 * o susto do preço; e o anual renova, o vitalício não. Trial só no plano
 * longo (regra dos grandes): o mensal segue sem trial, como âncora. */
const PLANO_INICIAL: "anual" | "mensal" = "anual";

/**
 * SELOS DE CONFIANÇA do iPhone. Os do Android ("🇧🇷 Pix na hora",
 * "🛡️ Garantia de 7 dias") não podem aparecer aqui: o primeiro é reprovação
 * na 3.1.1, e o segundo é promessa que não é nossa pra fazer — na Apple quem
 * reembolsa é a Apple, pelo formulário dela. Prometer garantia própria vira
 * dívida de suporte com quem cobra a promessa depois.
 * Estes três são fatos verificáveis.
 */
/* 20/09: o "♾️ Sem mensalidade" saiu — a assinatura RENOVA, e o selo
 * contradizia a linha legal logo abaixo (a Apple lê isso como promessa). Com
 * teste grátis os selos falam do que tira o medo de quem hesita (Blinkist):
 * aviso antes de cobrar e cancelar em um toque. Sem teste, ou no mensal,
 * falam da assinatura como ela é.
 * 24/09 (ordem do dono): o aviso antes de cobrar SAIU — os 6 primeiros testes
 * que venceram cancelaram, 5 deles com o aviso armado.
 * 01/10 (dado das turmas seguintes): VOLTOU. Sem a promessa, renovação ligada
 * caiu de 56% pra 44% e o cancelamento foi a 84% (turma 26/09) — a promessa
 * tira o medo de "vão me cobrar sem eu ver". O aviso é armado de verdade
 * (lib/notificacoes, pedirLembreteDoTeste) — tela só promete o que cumpre. */
const selosPara = (teste: boolean) => teste
  ? [
      { emoji: "", label: "Compra pela App Store" },
      { emoji: "🔔", label: "Aviso 1 dia antes de cobrar" },
      { emoji: "✕", label: "Cancele em 1 toque" },
    ]
  : [
      { emoji: "", label: "Compra pela App Store" },
      { emoji: "⚡", label: "Acesso na hora" },
      { emoji: "✕", label: "Cancele quando quiser" },
    ];

/* 17/10 (minimalista): paywall sempre claro, mesmo com o app no escuro — no gate o TrialBanner não força o
 * claro como o funil força (era o "R$ 97,90 por ano" branco no branco do legal do gate escuro). As mesmas
 * variáveis claras do funil (ComecarW/PaywallFlow). */
const TEMA_CLARO = {
  "--background": "0 0% 100%", "--foreground": "0 0% 15%", "--card": "0 0% 100%", "--card-foreground": "0 0% 15%",
  "--primary": "0 0% 20%", "--primary-foreground": "0 0% 100%", "--secondary": "40 20% 96%", "--secondary-foreground": "0 0% 15%",
  "--muted": "40 15% 95%", "--muted-foreground": "0 0% 45%", "--accent": "330 65% 50%", "--accent-foreground": "0 0% 100%",
  "--border": "0 0% 90%", "--input": "0 0% 90%", "--ring": "0 0% 20%",
} as CSSProperties;

/* 17/10 (minimalista): os tamanhos do meio crescem com a altura da tela, em linha reta entre o iPhone SE
 * (667 de altura: tudo no mínimo, cabe sem rolar) e o iPhone 14 (844: sem o buraco que o dono não quer —
 * "muito espaço não preenchido", 10/10). As `--passo-*` são da LinhaDoTempoDoTeste. */
const ESCALA_DA_TELA = {
  "--mini-respiro": "clamp(4px, 10.2vh - 62px, 28px)",
  "--mini-titulo": "clamp(26px, 4vh, 34px)",
  "--mini-sub": "clamp(14px, 0.56vh + 10.3px, 15px)",
  "--mini-antes-da-linha": "clamp(12px, 11.3vh - 61.4px, 36px)",
  "--passo-gap": "clamp(10px, 8.5vh - 45.5px, 28px)",
  "--passo-icone": "clamp(30px, 4.5vh, 38px)",
  "--passo-titulo": "clamp(15px, 1.41vh + 5.6px, 17.5px)",
  "--passo-texto": "clamp(12.5px, 1vh + 6.1px, 14.5px)",
} as CSSProperties;

/* 01/10 (teste de preço 97,90 × 69,90): NENHUM preço chumbado. Enquanto a loja
 * não responde, o lugar do preço mostra um traço — um "R$ 97,90" de reserva
 * seria o preço ERRADO pra metade das pessoas (o braço 69,90) por 1–2 s, e a
 * troca na frente dela pareceria desconto de mentira. */
const SEM_PRECO = "R$ —";

/* 10/10: leituras NOVAS do revenuecat (economia, preço do mensal) protegidas — testes
 * antigos mockam o módulo inteiro sem elas, e o mock do vitest LANÇA no acesso. */
const seguro = <T,>(f: () => T, reserva: T): T => { try { return f(); } catch { return reserva; } };

/* (B) CRONOGRAMA DO TESTE — o bloco que deu +23% no Blinkist e que a Apple
 * recomenda na sessão sobre testes: a pessoa sabe exatamente quando (e se)
 * vai pagar. O dia do aviso e o da cobrança vêm da duração lida da loja
 * (trocar 3 por 7 dias no App Store Connect muda o texto sozinho). 01/10: o
 * passo "a gente te avisa" voltou junto com o aviso (ver selosPara). */
function ComoFuncionaOTeste({ dias, precoAnual }: { dias: number; precoAnual: string }) {
  const passos = [
    { cheio: true, t: "Hoje · acesso a tudo", s: "Sem cobrança nenhuma agora." },
    { cheio: false, t: `Dia ${Math.max(1, dias - 1)} · a gente te avisa`, s: "Notificação 1 dia antes do teste acabar. Nada é cobrado sem aviso." },
    { cheio: false, t: `Dia ${dias} · só se você continuar`, s: `${precoAnual} pelo ano inteiro. Cancelou antes, não paga nada.` },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-left" data-testid="ios-cronograma">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Como funciona o teste</div>
      {passos.map((p) => (
        <div key={p.t} className="grid grid-cols-[18px_1fr] gap-2.5 items-start py-1.5">
          <span className={`mt-[3px] w-[14px] h-[14px] rounded-full border-2 border-accent ${p.cheio ? "bg-accent" : "bg-accent/15"}`} aria-hidden />
          <span>
            <b className="block text-[13px] leading-tight">{p.t}</b>
            <span className="text-[11.5px] text-muted-foreground leading-tight">{p.s}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * As duas colunas, de PESO IGUAL — mesma largura, mesma altura, preço no
 * mesmo corpo. Quem faz o trabalho de venda não é a hierarquia visual, é a
 * CONTA: 12 meses de mensal custam R$ 298,80 contra R$ 97,90 uma vez. Foi a
 * lição do sábado 29/08 no Android — quando as colunas mostravam só os
 * números "24,90 × 97,90" sem a matemática, o barato levou 92% do mix e o
 * tíquete caiu pra R$ 43. A linha "4 meses de mensal = CORE pra sempre" é o
 * que faz a comparação sem precisar de tabela.
 */
function DuasColunas({
  plano, onSelect, precoAnual, precoMes, comTrial, dias, mesesDeMensal, precoMensal = APP_PRECOS.mensal.preco, economia = null,
}: { plano: "anual" | "mensal"; onSelect: (p: "anual" | "mensal") => void; precoAnual: string; precoMes: string; comTrial: boolean; dias: number; mesesDeMensal: number | null; precoMensal?: string; economia?: number | null }) {
  const moldura = (ativo: boolean) =>
    `rounded-3xl p-[2px] transition-all ${ativo
      ? "bg-gradient-to-br from-accent via-accent/45 to-accent/15 shadow-[0_14px_40px_-16px_hsl(var(--accent)/0.5)]"
      : "bg-black/10"}`;
  return (
    <div className="grid grid-cols-2 gap-2.5 items-stretch">
      <div onClick={() => onSelect("mensal")} role="button" className={moldura(plano === "mensal")}>
        <div className="rounded-[calc(1.5rem-2px)] bg-white h-full px-3 pt-2.5 pb-3.5 text-center text-[#16121c] flex flex-col">
          {/* espaçador que alinha o topo com o selo da coluna irmã */}
          <span className="h-[19px]" aria-hidden />
          <span className="text-[30px] font-black leading-none mt-1.5">1</span>
          <span className="text-[12.5px] font-bold text-black/45">mês</span>
          <span className="text-[17px] font-extrabold mt-2">{precoMensal}</span>
          <span className="text-[10px] font-semibold text-black/40">por mês</span>
          <span className="mx-3 my-2 border-t border-black/10" aria-hidden />
          {/* "renova sozinho" e não "cancele quando quiser": na Apple a
              renovação é automática e obrigatória, e a 3.1.2 quer isso dito. */}
          <span className="text-[10.5px] font-semibold text-black/45 pb-1 px-1 leading-tight mt-auto">
            renova sozinho<br />cancele quando quiser
          </span>
        </div>
      </div>

      <div onClick={() => onSelect("anual")} role="button" className={moldura(plano === "anual")} data-testid="ios-coluna-anual">
        <div className="rounded-[calc(1.5rem-2px)] bg-white h-full px-3 pt-0 pb-3.5 text-center text-[#16121c] flex flex-col overflow-hidden">
          <span className={`-mx-3 text-[10px] font-extrabold tracking-[0.08em] py-[5px] ${plano === "anual" ? "bg-accent text-accent-foreground" : "bg-accent/10 text-accent"}`}>
            {comTrial ? `${dias} DIAS GRÁTIS` : "MELHOR ESCOLHA"}
          </span>
          <span className="text-[30px] font-black leading-none mt-1.5">12</span>
          <span className="text-[12.5px] font-bold text-black/45">meses</span>
          {/* (A) 20/09: o número que a pessoa compara com o mensal é o POR MÊS;
              o valor cheio do ano fica logo abaixo, como a Apple exige. */}
          <span className="text-[17px] font-extrabold mt-2">{precoMes}</span>
          <span className="text-[10px] font-semibold text-black/40 leading-tight px-1">
            por mês · {precoAnual}/ano{comTrial ? `, depois dos ${dias} dias` : ""}
          </span>
          {/* 10/10 (chave PAYWALL_TEXTOS): a economia contra 12 meses de mensal, dos preços REAIS */}
          {economia !== null && (
            <span className="mx-auto mt-1.5 rounded-full bg-accent/10 text-accent text-[10px] font-extrabold px-2 py-[2px]" data-testid="ios-economize">
              economize {economia}%
            </span>
          )}
          <span className="mx-3 my-2 border-t border-black/10" aria-hidden />
          {/* 01/10: a conta vem do preço REAL (97,90 → 4 meses; 69,90 → 3) — nunca chumbada */}
          <span className="text-[10.5px] font-semibold text-black/45 pb-1 px-1 leading-tight mt-auto">
            {mesesDeMensal ?? "…"} meses de mensal =<br /><b className="text-black/60">1 ano inteiro</b>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * MODO GATE (10/10, build 38 — dono: "quem entra logado sem assinatura no iPhone tem que ver o MESMO
 * paywall novo do funil"). O TrialBanner monta este paywall, no layout CURTO, como a tela cheia do gate
 * pra conta logada sem acesso (a Porta: conta criada no site; ou qualquer conta sem assinatura), no lugar
 * do PaywallAssinatura contexto="gate". Diferenças do funil, todas por ter conta e não ter funil atrás:
 *   · sempre o layout curto (o TrialBanner só escolhe este modo com a chave "curto" ligada; se a
 *     metadata do RevenueCat desligar a chave depois, `onChaveDesligada` devolve o gate antigo);
 *   · SEM o Voltar redondo (não há passo anterior) — logo, sem o presente 69,90 do "X"; o presente do
 *     BLOQUEIO (quem já testou) continua no TrialBanner, por cima, como sempre;
 *   · RevenueCat identificado com o uid da conta ANTES da folha (a compra fica na conta);
 *   · rodapé com "Entrar com outra conta" (signOut → /entrar) e "Excluir conta" (5.1.1), além de
 *     Termos · Privacidade · Restaurar compras;
 *   · a régua do gate de hoje: arma o "resgate do plano" (2 h / 24 h) ao abrir e cancela na compra; a
 *     recuperação do paywall do funil NÃO arma aqui (seriam dois avisos pro mesmo paywall);
 *   · eventos com `funil: "gate_ios"` (não somam no funil do iPhone);
 *   · compra/restaurar que dá certo → `onPagoSemConta` (o TrialBanner recarrega pra "/" = Home/missão,
 *     o mesmo pós-compra do gate de hoje).
 */
export function PaywallIOS({
  area, answers, onPagoSemConta, onVoltar, modo = "funil", onChaveDesligada,
}: { area: AreaKey; answers: Record<string, string>; onPagoSemConta: () => void; onVoltar?: () => void; modo?: "funil" | "gate"; onChaveDesligada?: () => void }) {
  const gate = modo === "gate";
  const FUNIL = gate ? "gate_ios" : "ios";
  /* 1.0.18 (análise do paywall 21/10): no gate o pós-compra RECARREGA o app (`onPagoSemConta` → "/") logo depois
   * do `app_sheet_success` — o insert do trackEvent morria na recarga (124 folhas, 0 app_sheet_success; o banco
   * mostrava 18 % das contas comprando). O sucesso do gate vai por beacon (fetch keepalive, o mesmo do paywall_saiu). */
  const registrarSucesso = gate ? trackEventBeacon : trackEvent;
  const { user: usuarioLogado } = useAuth();
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const vivoRef = useRef(true);
  // Disponibilidade real do vitalício: otimista até resposta NEGATIVA da loja.
  const [anualNaLoja, setAnualNaLoja] = useState<boolean | null>(null);
  const [precoAnual, setPrecoAnual] = useState<string | null>(null);
  const [comTrial, setComTrial] = useState(true);
  const [dias, setDias] = useState(DIAS_DE_TESTE_PADRAO);
  const [precoMes, setPrecoMes] = useState<string | null>(null);
  const [mesesDeMensal, setMesesDeMensal] = useState<number | null>(null);
  const [plano, setPlano] = useState<"anual" | "mensal">(PLANO_INICIAL);
  // O que a loja serviu pra ESTA pessoa (braço do experimento): vai em todo evento.
  const [oferta, setOferta] = useState<{ oferta: string; produto: string; offering: string | null; preco: string | null; pacote: boolean }>({
    oferta: "anual_97", produto: "core_anual_97", offering: null, preco: null, pacote: false,
  });
  const precoAnualTxt = precoAnual ?? SEM_PRECO;
  const precoMesTxt = precoMes ?? SEM_PRECO;
  /* 10/10 — ofertas de saída (lib/ofertas-saida). `textos` e `economia` só entram
   * com a chave PAYWALL_TEXTOS lida DEPOIS de a loja responder (a metadata vem
   * nas offerings); as folhas de presente/mensal 19 nascem de eventos. */
  const [textos, setTextos] = useState(false);
  const [economia, setEconomia] = useState<number | null>(null);
  const [precoMensalLoja, setPrecoMensalLoja] = useState<string | null>(null);
  /* 10/10 — PAYWALL_CURTO: a chave responde na hora (força/QA/constante) e de novo quando a
   * loja traz a metadata; o preço do teste ("R$ 0,00") é o da oferta introdutória da loja. */
  const [curto, setCurto] = useState(() => gate || ofertaLigada("curto"));
  /* 17/10 — PAYWALL MINIMALISTA (lib/paywall-minimalista): só muda o layout curto. Responde na hora
   * (força de QA `?paywall-minimalista=` / constante) e de novo quando a loja traz a metadata. */
  const [minimalista, setMinimalista] = useState(() => { guardarForcaDoMinimalista(); return paywallMinimalistaLigado(); });
  /* o passo do lembrete na linha do tempo: só se o 920001 vai mesmo sair (null = lendo a permissão) */
  const [aviso, setAviso] = useState<AvisoDoTeste | null>(null);
  /* 16/10 — a explicação antes da folha, na 2ª vez (ExplicaFolha) */
  const folhasCanceladasRef = useRef(0);
  const explicadosRef = useRef<Set<string>>(new Set());
  const [explica, setExplica] = useState<{ produto: string; preco: string; precoTeste: string | null; dias: number; continuar: () => void } | null>(null);
  const [precoTeste, setPrecoTeste] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const preparandoRef = useRef<number | null>(null);
  useEffect(() => () => { if (preparandoRef.current) window.clearTimeout(preparandoRef.current); }, []);
  /* o presente de 69,90 por cima do paywall: no Voltar ("x_paywall") ou depois de fechar a
   * folha do 97,90 ("folha_cancelada", 16/10). UM presente por sessão do paywall. */
  const [presente, setPresente] = useState<{ lugar: "x_paywall" | "folha_cancelada"; oferta: OfertaDoPresente } | null>(null);
  const [mensal19, setMensal19] = useState<OfertaDoMensal19 | null>(null);
  const presenteXTentadoRef = useRef(false);
  const presenteMostradoRef = useRef(false);
  const folhaCanceladaTratadaRef = useRef(false);
  const comprandoRef = useRef(false);
  comprandoRef.current = comprando;
  /* 1.0.14 — a saída sem compra (paywall_saiu) e a recuperação */
  const abertoEmRef = useRef(Date.now());
  const ultimoVoltarRef = useRef<number | null>(null);
  const saiuRegistradoRef = useRef(false);
  const compraFeitaRef = useRef(false);
  const viuOfertaRef = useRef(false);
  const recuperacaoArmadaRef = useRef(false);
  if (presente || mensal19) viuOfertaRef.current = true;
  const registrarSaida = (motivoForcado?: "voltar" | "outro", beacon = false) => {
    if (saiuRegistradoRef.current || compraFeitaRef.current) return;
    saiuRegistradoRef.current = true;
    const voltou = ultimoVoltarRef.current != null && Date.now() - ultimoVoltarRef.current < JANELA_DO_VOLTAR_MS;
    const dados = { funil: FUNIL, loja: "ios", area, motivo: motivoForcado ?? (voltou ? "voltar" : "outro"), segundos_na_tela: Math.round((Date.now() - abertoEmRef.current) / 1000), viu_oferta: viuOfertaRef.current };
    (beacon ? trackEventBeacon : trackEvent)("paywall_saiu", dados);
  };
  const armarRecuperacao = () => {
    if (gate || recuperacaoArmadaRef.current || compraFeitaRef.current || !isNativeShell() || !ofertaLigada("recuperacao")) return;
    recuperacaoArmadaRef.current = true;
    void agendarRecuperacaoDoPaywall(AREAS[area]?.nome ?? null).catch(() => { /* nunca derruba o paywall */ });
  };
  /** Toda compra que dá certo passa aqui: cancela a recuperação e segue pro cadastro. */
  const concluir = () => {
    compraFeitaRef.current = true;
    void cancelarRecuperacaoDoPaywall().catch(() => { /* noop */ });
    if (gate) {
      void cancelarResgateDoPlano().catch(() => { /* noop */ });
      void cancelarReguaDoTeste().catch(() => { /* noop */ });
    }
    onPagoSemConta();
  };
  /** gate: a saída que o gate antigo já tinha — sai desta conta e vai pro login. */
  const trocarConta = async () => {
    trackEvent("gate_trocar_conta", { funil: FUNIL });
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.signOut();
    } catch { /* sem rede: o /entrar resolve */ }
    window.location.href = "/entrar";
  };
  // o mensal do paywall: com PAYWALL_TEXTOS, o preço real da loja (reserva: a constante de hoje)
  const precoMensalTxt = textos ? (precoMensalLoja ?? APP_PRECOS.mensal.preco) : APP_PRECOS.mensal.preco;

  useEffect(() => {
    vivoRef.current = true;
    guardarForcaDasOfertas(); // `?ofertas-saida=on|off|auto|lista` — QA neste aparelho
    // `loja: "ios"` em todo evento: sem isso o iPhone entraria somando nos
    // números do funil do Android e as duas leituras virariam uma média de
    // dois públicos, duas lojas e duas mecânicas de pagamento.
    trackEvent("funnel_view", { step: "offer", funil: FUNIL, area, loja: "ios" });
    // gate: a mesma régua do gate antigo ("seu plano ficou salvo", 2 h / 24 h), cancelada na compra
    if (gate) { try { void agendarResgateDoPlano(null)?.catch?.(() => { /* noop */ }); } catch { /* noop */ } }
    /* Aquecimento do RevenueCat no mount (lição da v91 do Android): sem
     * init aqui, o primeiro toque paga init + catálogo inteiro e a folha
     * demora em aparelho popular. Só cache — o caminho do toque não muda. */
    let retry: number | null = null;
    void (async () => {
      const rc = await import("@/lib/revenuecat");
      await rc.initRevenueCat();
      await rc.prefetchAnualIos();
      if (!vivoRef.current) return;
      const lido = () => {
        if (rc.estadoRevenueCat() === "pronto") setAnualNaLoja(rc.temAnualIos());
        if (rc.temAnualIos()) {
          setPrecoAnual(rc.precoAnualIos());
          setComTrial(rc.anualIosTemTrial());
          setDias(rc.diasTrialIos() || DIAS_DE_TESTE_PADRAO);
          setPrecoMes(rc.precoMensalDoAnualIos());
          setMesesDeMensal(rc.mesesDeMensalQuePagamOAno());
          const d = rc.dadosDaOfertaIos();
          setOferta(d);
          // 10/10: a chave remota chegou junto com as offerings; os preços do selo são os da loja
          const ligou = ofertaLigada("textos");
          const curtoLigou = ofertaLigada("curto");
          const economiaLida = ligou || curtoLigou || gate ? seguro(() => rc.economiaDoAnualIos() ?? null, null) : null;
          setTextos(ligou);
          // gate: a metadata desligou o curto (interruptor de emergência) → o TrialBanner volta pro gate antigo
          if (gate && !curtoLigou) onChaveDesligada?.();
          setCurto(gate || curtoLigou);
          // 17/10: a metadata `paywall_minimalista` chegou junto (desligar sem versão nova)
          const miniLigou = paywallMinimalistaLigado();
          setMinimalista(miniLigou);
          setEconomia(economiaLida);
          setPrecoMensalLoja(seguro(() => rc.precoMensalIos() ?? null, null));
          // 16/10: sempre (a explicação da 2ª folha também mostra o "R$ 0,00" da loja)
          setPrecoTeste(seguro(() => rc.precoDoTesteIos() ?? null, null));
          // o braço que a pessoa VIU (o funnel_view do mount sai antes da loja responder)
          trackEvent("paywall_oferta_vista", { funil: FUNIL, loja: "ios", area, ...d, dias: rc.diasTrialIos() || DIAS_DE_TESTE_PADRAO, trial: rc.anualIosTemTrial(), ...(ligou ? { textos: true, economia: economiaLida } : {}), ...(curtoLigou || gate ? { paywall_curto: true, economia: economiaLida } : {}), ...((curtoLigou || gate) && miniLigou ? { minimalista: true } : {}) });
        }
      };
      lido();
      if (!rc.temAnualIos()) {
        retry = window.setTimeout(async () => {
          await rc.prefetchAnualIos();
          if (vivoRef.current) lido();
        }, 2500);
      }
    })();
    return () => {
      vivoRef.current = false;
      if (retry) window.clearTimeout(retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* OFERTA NO "X" (10/10, chave OFERTA_X_PAYWALL). O paywall do funil não tem X: a
   * saída é o Voltar (físico no app, do navegador na web), que o ComecarW traduz
   * no evento `core:voltar` ANTES de recuar (o 1º Voltar fica na tela; o 2º em 3 s
   * recua um passo). Aqui o 1º Voltar abre a caixa de presente — 1x por sessão
   * do paywall e 1x por aparelho (marca no desfecho, dentro do Presente69). Com a
   * folha da Apple aberta não faz nada; com a chave off, nada muda. */
  useEffect(() => {
    const aoVoltar = () => {
      if (presenteXTentadoRef.current || presenteMostradoRef.current || comprandoRef.current) return;
      if (!ofertaLigada("x_paywall")) return;
      presenteXTentadoRef.current = true;
      void prepararPresente("x_paywall")
        .then((o) => {
          if (!vivoRef.current || !o || presenteMostradoRef.current) return;
          presenteMostradoRef.current = true;
          setPresente({ lugar: "x_paywall", oferta: o });
        })
        .catch(() => { /* paywall de sempre */ });
    };
    window.addEventListener("core:voltar", aoVoltar);
    return () => window.removeEventListener("core:voltar", aoVoltar);
  }, []);

  /* 1.0.14 — paywall_saiu + recuperação: o Voltar marca a hora (e arma a recuperação);
   * o app no fundo registra a saída por beacon; o desmonte sem compra registra também.
   * Abrir o paywall de novo cancela a recuperação pendente (ela voltou). */
  useEffect(() => {
    void cancelarRecuperacaoDoPaywall().catch(() => { /* noop */ });
    const aoVoltar = () => { ultimoVoltarRef.current = Date.now(); armarRecuperacao(); };
    const aoEsconder = () => {
      if (document.visibilityState !== "hidden" || comprandoRef.current) return;
      armarRecuperacao();
      registrarSaida(undefined, true);
    };
    window.addEventListener("core:voltar", aoVoltar);
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      window.removeEventListener("core:voltar", aoVoltar);
      document.removeEventListener("visibilitychange", aoEsconder);
      registrarSaida();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [resgatouCodigo, setResgatouCodigo] = useState(false);
  /* SEGUNDA CHANCE (28/09): fechar a folha da Apple não gerava resposta
   * nenhuma — e 32% das compras vêm de quem fechou uma primeira vez. Só na
   * desistência da própria pessoa (não em erro), só no anual com teste
   * grátis, 1 vez por sessão do paywall; some quando a compra dá certo.
   * 16/10: a 1ª folha do anual fechada abre o PRESENTE 69,90 com 3 dias grátis
   * (Presente69, lugar "folha_cancelada") — este cartão de mesmo preço vira a reserva:
   * presente desligado (`presente: "off"`), loja calada, sem direito ao teste no 69,90,
   * ou o presente já apareceu nesta sessão (pelo Voltar). */
  const [segundaChance, setSegundaChance] = useState<"nunca" | "visivel" | "usada">("nunca");
  useEffect(() => {
    if (segundaChance === "visivel") trackEvent("folha_segunda_chance_view", { funil: FUNIL, loja: "ios", produto: oferta.produto, oferta: oferta.oferta, preco: precoAnual, dias, segunda_chance: "imediata" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundaChance]);

  const confirmarPagamento = async () => {
    setConferindo(true);
    try {
      const rc = await import("@/lib/revenuecat");
      const ok = (await rc.restaurar()) || (await rc.compraVitaliciaLocal()) || (await rc.compraAssinaturaLocal());
      if (ok) { trackEvent("funnel_click", { cta: "ios_ja_paguei_ok", funil: FUNIL }); concluir(); return; }
      setErro("Ainda não achei a compra. Espera uns segundos e toca de novo.");
    } catch { /* conferência nunca derruba o paywall */ }
    setConferindo(false);
  };

  const cartaoDeSempre = () => setSegundaChance((s) => (s === "nunca" ? "visivel" : s));
  /* 16/10 — fechou a folha do anual com teste. Na 1ª vez da sessão (e se nenhum presente
   * apareceu ainda), o presente 69,90; senão, ou se ele não vier, o cartão de sempre. A folha
   * do PRÓPRIO 69,90 fechada fica dentro do Presente69 (erro/"Agora não") e nunca volta aqui. */
  const depoisDaFolhaCancelada = () => {
    if (folhaCanceladaTratadaRef.current || presenteMostradoRef.current) { cartaoDeSempre(); return; }
    folhaCanceladaTratadaRef.current = true;
    void prepararPresente("folha_cancelada")
      .then((o) => {
        if (!vivoRef.current) return;
        if (!o || presenteMostradoRef.current || comprandoRef.current) { cartaoDeSempre(); return; }
        presenteMostradoRef.current = true;
        setSegundaChance("usada"); // o downsell substitui o cartão de mesmo preço nesta sessão
        setPresente({ lugar: "folha_cancelada", oferta: o });
      })
      .catch(() => { if (vivoRef.current) cartaoDeSempre(); });
  };

  const comprar = async (produto: "anual" | "mensal") => {
    if (comprando) return;
    setErro(null);
    setComprando(true);
    comprandoRef.current = true; // já (o render vem depois): o presente da folha fechada confere isto
    try {
      const rc = await import("@/lib/revenuecat");
      // gate: a compra fica na CONTA logada — RevenueCat com o uid antes da folha (no-op se já está)
      if (gate && usuarioLogado?.id) { try { await rc.identificarRevenueCat(usuarioLogado.id); } catch { /* segue: o init já usa a sessão */ } }
      const idProduto = produto === "mensal" ? "core_mensal" : rc.idProdutoAnualIos();
      const ok = produto === "mensal"
        ? await rc.comprar("core_mensal", { semTrial: true })
        : await rc.comprarAnualIos();
      if (ok) {
        registrarSucesso("app_sheet_success", { produto: idProduto, funil: FUNIL, loja: "ios", ...(produto === "anual" ? rc.dadosDaOfertaIos() : { oferta: "mensal" }) });
        /* (D) LEMBRETE DO TESTE (01/10, de volta): a Apple não avisa antes de
         * cobrar. Compra que entrou em teste guarda o pedido do aviso "acaba
         * amanhã" e arma na hora se a permissão já existe. SEM diálogo aqui —
         * segue direto pro cadastro (24/09: o pedido entre a folha e o cadastro
         * foi o que o dono mandou tirar); quem pede a permissão é a Missão
         * B1, e ela arma o que ficou pendente. Nunca segura quem acabou de pagar. */
        if (produto === "anual" && rc.ultimaCompraAnualFoiTrial()) {
          void pedirLembreteDoTeste({ fimMs: rc.fimDaUltimaCompraTrial() ?? Date.now() + dias * 86400e3, precoAno: rc.precoAnualIos() ?? precoAnualTxt }).catch(() => { /* noop */ });
        }
        setSegundaChance("usada");
        concluir();
        return;
      }
      /* RECUSA NA APPLE — e aqui acaba. Não existe escada: a folha é
       * instantânea, autentica no Face ID, e um cancelamento é uma decisão,
       * não uma tela que não carregou. A pessoa continua no paywall com o
       * botão vivo — no anual com teste, mais o cartão da segunda chance
       * (28/09, abaixo), que também não abre nada sozinho. */
      const motivo = rc.motivoUltimaCompra();
      if (motivo === "pendente") {
        setPendente(true);
      } else if (motivo === "produto_ausente") {
        setErro("A loja ainda tá carregando este plano. Espera uns segundos e toca de novo.");
      } else if (motivo === "ja_ativo") {
        setErro(erroJaAtivo());
      } else if (motivo === "nao_permitido") {
        setErro(erroNaoPermitido());
      } else if (motivo && motivo !== "cancelou") {
        /* 04/09: a StoreKit recusou ("not available for purchase") e o
         * paywall ficava MUDO — botão voltava ao normal sem dizer nada. Foi o
         * que o revisor viu. Cancelar continua silencioso (foi decisão dela). */
        setErro(erroFolhaNaoConcluiu());
      }
      // "cancelou" = PURCHASE_CANCELLED do RevenueCat (código 1): foi ela que
      // fechou a folha. Não reabre nada sozinho — só deixa o cartão perto do
      // botão. Sem direito ao teste, "não paga nada" seria mentira: sem cartão.
      // 16/10: a folha do anual já foi fechada nesta sessão → o próximo toque passa pela explicação
      if (motivo === "cancelou" && produto === "anual") folhasCanceladasRef.current += 1;
      if (motivo === "cancelou" && produto === "anual" && comTrial && rc.anualIosTemTrial()) {
        depoisDaFolhaCancelada();
      }
      /* 10/10 (chave OFERTA_MENSAL_19): fechou a folha do MENSAL → o mensal de 19,90,
       * se a offering `mensal_19` existir na loja. 1x por aparelho (marca no desfecho). */
      // 16/10: UM presente por sessão do paywall — quem já viu o 69,90 não ganha o 19,90 por cima
      if (motivo === "cancelou" && produto === "mensal" && ofertaLigada("mensal_19") && !presenteMostradoRef.current) {
        void prepararMensal19("mensal_paywall")
          .then((m) => {
            if (!vivoRef.current || !m || presenteMostradoRef.current) return;
            presenteMostradoRef.current = true;
            setMensal19(m);
          })
          .catch(() => { /* paywall de sempre */ });
      }
    } catch {
      setErro("A Apple não concluiu o pagamento. Tenta de novo em instantes.");
    }
    comprandoRef.current = false;
    setComprando(false);
  };

  const chartLabel = CHART_LABEL[area] ?? CHART_LABEL.dinheiro;
  const vitoria: Record<AreaKey, string> = {
    dinheiro: "ver pra onde seu dinheiro vai",
    rotina: "organizar sua rotina",
    corpo: "cuidar do seu corpo com constância",
    saude: "cuidar da sua saúde todo dia",
    metas: "tirar suas metas do papel",
  };

  const mostraMensal = plano === "mensal";
  /** Tem oferta (presente, mensal 19 ou explicação) por cima AGORA? (o Voltar redondo confere) */
  const ofertaAbertaRef = useRef(false);
  ofertaAbertaRef.current = !!(presente || mensal19 || explica);
  // O cartão fala do anual com teste: some com o mensal selecionado e durante
  // a folha aberta; volta com o anual (a mesma exibição — sem novo evento).
  const mostraSegundaChance = segundaChance === "visivel" && !mostraMensal && !comprando;
  /* 17/10 — o paywall minimalista: o layout curto com a chave `paywall_minimalista` */
  const mini = curto && minimalista;
  // o lembrete da linha do tempo só aparece se o 920001 vai mesmo sair (permissão), lida 1x
  useEffect(() => {
    if (!mini || aviso !== null) return;
    let vivo = true;
    void lerAvisoDoTeste().then((a) => { if (vivo) setAviso(a); }).catch(() => { if (vivo) setAviso("nao"); });
    return () => { vivo = false; };
  }, [mini, aviso]);
  // `paywall_linha_tempo_view`: 1x por paywall aberto, com a linha do TESTE à vista e os dados da loja
  const linhaVistaRef = useRef(false);
  const mostraLinhaDoTeste = mini && comTrial && !mostraMensal;
  useEffect(() => {
    if (!mostraLinhaDoTeste || linhaVistaRef.current || precoAnual === null || aviso === null) return;
    linhaVistaRef.current = true;
    const passos = passosDoTeste({ dias, precoAnual, precoTeste, aviso });
    trackEvent("paywall_linha_tempo_view", { funil: FUNIL, loja: "ios", area, oferta: oferta.oferta, produto: oferta.produto, preco: precoAnual, dias, aviso, passos: passos.length, minimalista: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostraLinhaDoTeste, precoAnual, aviso, dias, precoTeste]);

  /* o que aparece POR CIMA do paywall, igual nos dois layouts (de hoje e curto) */
  const sobreposicoes = (
    <>
    {comprando && (
      <div className="fixed inset-0 z-[80] grid place-items-end pointer-events-none pb-28">
        <div className="mx-auto max-w-[92%] rounded-2xl bg-[#16121c] text-white dark:bg-white dark:text-[#16121c] text-[12.5px] font-bold px-4 py-2.5 shadow-lg flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> Abrindo o pagamento…
        </div>
      </div>
    )}

    {/* 10/10 — as ofertas de saída, por cima do paywall (z-320). Sucesso = a mesma
        saída da compra normal: app_sheet_success (com oferta/lugar), lembrete do
        teste quando a folha deu dias grátis, e o cadastro. "Agora não" devolve o
        paywall de sempre, intacto. */}
    {presente && (
      <Presente69Folha
        key={presente.lugar}
        lugar={presente.lugar}
        oferta={presente.oferta}
        explicar={presente.lugar === "folha_cancelada" || folhasCanceladasRef.current > 0}
        {...(mini ? { enxuto: true } : {})}
        onFechar={() => setPresente(null)}
        onSucesso={async () => {
          const { lugar, oferta: p } = presente;
          registrarSucesso("app_sheet_success", { produto: p.produto, funil: FUNIL, loja: "ios", oferta: "presente69", lugar, offering: "anual_69", preco: p.preco, segunda_chance: lugar === "folha_cancelada" ? "imediata" : "saida" });
          try {
            const rc = await import("@/lib/revenuecat");
            if (seguro(() => rc.ultimaCompraAnualFoiTrial(), p.comTrial)) {
              void pedirLembreteDoTeste({ fimMs: seguro(() => rc.fimDaUltimaCompraTrial(), null) ?? Date.now() + (p.dias || dias) * 86400e3, precoAno: p.preco }).catch(() => { /* noop */ });
            }
          } catch { /* noop */ }
          setPresente(null);
          concluir();
        }}
      />
    )}
    {mensal19 && (
      <Mensal19Folha
        lugar="mensal_paywall"
        oferta={mensal19}
        onFechar={() => setMensal19(null)}
        onSucesso={() => {
          registrarSucesso("app_sheet_success", { produto: mensal19.produto, funil: FUNIL, loja: "ios", oferta: "mensal19", lugar: "mensal_paywall", offering: "mensal_19", preco: mensal19.preco, segunda_chance: "imediata" });
          setMensal19(null);
          concluir();
        }}
      />
    )}
    {/* 16/10 — a explicação antes da 2ª folha do anual (ExplicaFolha) */}
    {explica && (
      <ExplicaFolha
        lugar="paywall"
        produto={explica.produto}
        preco={explica.preco}
        precoTeste={explica.precoTeste}
        dias={explica.dias}
        {...(mini ? { enxuto: true, ...(aviso ? { aviso } : {}) } : {})}
        onContinuar={() => { const seguir = explica.continuar; setExplica(null); seguir(); }}
        onFechar={() => setExplica(null)}
      />
    )}
    </>
  );

  /* o toque no botão principal: o MESMO evento de hoje; no curto (anual com teste) a pílula
   * de preparação da folha fica ~1,2 s na tela e só então a compra abre */
  /* 16/10 — a folha do anual já foi fechada nesta sessão e este produto ainda não foi explicado:
   * a meia-folha ExplicaFolha vem antes (1x por produto por sessão). true = abriu a explicação. */
  const explicarAntesDaFolha = (): boolean => {
    if (!comTrial || folhasCanceladasRef.current < 1 || explicadosRef.current.has(oferta.produto)) return false;
    explicadosRef.current.add(oferta.produto);
    setExplica({ produto: oferta.produto, preco: precoAnualTxt, precoTeste, dias, continuar: () => { void comprar("anual"); } });
    return true;
  };
  /** "Tentar de novo" do cartão da 2ª chance (os dois layouts). */
  const tentarDeNovo = () => {
    trackEvent("folha_segunda_chance_click", { funil: FUNIL, loja: "ios", produto: oferta.produto, oferta: oferta.oferta, preco: precoAnual, dias, segunda_chance: "imediata" });
    setSegundaChance("usada");
    if (explicarAntesDaFolha()) return;
    void comprar("anual");
  };

  const tocarNoBotao = () => {
    trackEvent("funnel_click", {
      cta: "app_paywall_cta", funil: FUNIL, loja: "ios",
      produto: mostraMensal ? "core_mensal" : oferta.produto,
      oferta: mostraMensal ? "mensal" : oferta.oferta,
      offering: oferta.offering, preco: mostraMensal ? precoMensalTxt : precoAnual,
      ...(curto ? { paywall_curto: true } : {}),
      ...(mini ? { minimalista: true } : {}),
    });
    // 16/10: na 2ª vez (folha já fechada) a explicação substitui a pílula
    if (!mostraMensal && !comprando && !preparando && explicarAntesDaFolha()) return;
    // 17/10: no minimalista a linha do tempo já disse "Hoje R$ 0,00 · Dia 3 R$ 97,90/ano" ANTES do toque — sem pílula
    if (curto && !mini && comTrial && !mostraMensal && !comprando) {
      if (preparando) return;
      setPreparando(true);
      preparandoRef.current = window.setTimeout(() => {
        preparandoRef.current = null;
        if (!vivoRef.current) return;
        setPreparando(false);
        void comprar("anual");
      }, PREPARACAO_DA_FOLHA_MS);
      return;
    }
    void comprar(plano);
  };

  /* o Voltar redondo = o "X" do paywall: o MESMO `core:voltar` do funil (presente 69,90 com
   * OFERTA_X_PAYWALL, recuperação); o recuo de passo é do funil (`onVoltar`), se ele passar —
   * e só quando nenhuma folha de oferta abriu por cima. (Os dois layouts curtos: o de hoje e o minimalista.) */
  const escolher = (p: "anual" | "mensal") => { setPlano(p); trackEvent("funnel_click", { cta: "ios_plano", plano: p, funil: FUNIL, oferta: oferta.oferta, preco: precoAnual, paywall_curto: true, ...(mini ? { minimalista: true } : {}) }); };
  const voltar = () => {
    trackEvent("funnel_click", { cta: "ios_paywall_voltar", funil: FUNIL, loja: "ios", paywall_curto: true, ...(mini ? { minimalista: true } : {}) });
    window.dispatchEvent(new CustomEvent("core:voltar"));
    // 16/10: "oferta aberta AGORA" (não "já viu alguma"): depois de um presente fechado, o Voltar recua
    if (onVoltar) window.setTimeout(() => { if (vivoRef.current && !ofertaAbertaRef.current) onVoltar(); }, 400);
  };
  /* compra pendente, erro e o cartão da 2ª chance — os mesmos nos dois layouts curtos */
  const avisosDaCompra = (
    <>
      {pendente && (
        <div className="mt-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12px] leading-snug p-2.5">
          <b>Compra em processamento.</b> A App Store ainda está confirmando — o acesso libera sozinho aqui.
          <button className="block w-full text-center font-bold underline underline-offset-2 mt-1 disabled:opacity-50" disabled={conferindo} onClick={() => void confirmarPagamento()}>
            {conferindo ? "Conferindo…" : "Já comprei — atualizar"}
          </button>
        </div>
      )}
      {erro && <p className="mt-2 text-[12px] text-destructive text-center">{erro}</p>}
      {mostraSegundaChance && (
        <div role="status" data-testid="ios-segunda-chance" className="mt-2.5 rounded-2xl border border-accent/30 bg-card shadow-[0_10px_28px_-14px_rgba(0,0,0,0.3)] pl-3.5 pr-2 py-2 flex items-center gap-2.5 text-left">
          {/* minimalista: a linha do tempo logo acima já diz "Hoje — R$ 0,00" — o cartão fica numa linha */}
          <p className="flex-1 text-[12.5px] font-bold leading-snug text-foreground">{mini ? "Hoje você não paga nada." : "Hoje você não paga nada · cancela em 2 toques"}</p>
          <button
            type="button"
            className="shrink-0 rounded-full bg-accent/10 text-accent text-[12.5px] font-bold px-3.5 py-2 active:scale-[0.97] transition-transform"
            onClick={tentarDeNovo}
          >
            Tentar de novo
          </button>
        </div>
      )}
    </>
  );
  /* Termos · Privacidade · Restaurar (3.1.1/3.1.2), a conta no gate e o código — os mesmos nos dois layouts curtos */
  const rodapeDaLoja = (
    <>
      {/* 3.1.1 / 3.1.2 numa linha discreta, como no Cal AI; o Offer Code e o "já paguei pelo site" na de baixo */}
      <p className="mt-1.5 text-center text-[11.5px] text-muted-foreground">
        <a href="/termos" className="underline underline-offset-2">Termos</a>
        {" · "}
        <a href="/privacidade" className="underline underline-offset-2">Privacidade</a>
        {" · "}
        <button
          type="button" className="underline underline-offset-2"
          onClick={async () => {
            trackEvent("app_restore_paywall", {});
            const rc = await import("@/lib/revenuecat");
            const ok = await rc.restaurar();
            if (ok) { if (gate) concluir(); else window.location.href = "/"; }
          }}
        >
          Restaurar compras
        </button>
      </p>
      {gate && (
        <p className="mt-0.5 text-center text-[11px] text-muted-foreground" data-testid="gate-ios-conta">
          <button type="button" className="underline underline-offset-2" onClick={() => void trocarConta()} data-testid="gate-trocar-conta">Entrar com outra conta</button>
          {usuarioLogado && (
            <>
              {" · "}
              <button type="button" className="underline underline-offset-2" onClick={() => setExcluirAberto(true)} data-testid="gate-excluir-conta">Excluir conta</button>
              <DeleteAccountDialog open={excluirAberto} onOpenChange={setExcluirAberto} />
            </>
          )}
        </p>
      )}
      <p className="mt-0.5 text-center text-[11px] text-muted-foreground">
        <button
          type="button" className="underline underline-offset-2" data-testid="ios-tenho-codigo"
          onClick={async () => {
            trackEvent("funnel_click", { cta: "ios_codigo_abrir", funil: FUNIL });
            const rc = await import("@/lib/revenuecat");
            const abriu = await rc.abrirResgateApple();
            if (abriu) setResgatouCodigo(true);
            else setErro("Não consegui abrir o resgate. Tenta de novo em alguns segundos.");
          }}
        >
          Tenho um código
        </button>
        {/* gate: a conta já está logada e não há venda no site — sem o "Já paguei pelo site" (e sem o "·" sobrando) */}
        {/* o " · " vai DENTRO da linha: no site a linha não existe e o ponto ficava sobrando (polimento 17/10) */}
        {!gate && <JaPagouPeloSite origem="rodape_legal" logado={!!usuarioLogado} className="inline" separador=" · " />}
      </p>
      {resgatouCodigo && (
        <button
          type="button"
          className="block w-full text-center text-[12.5px] font-bold underline underline-offset-2 disabled:opacity-50 mt-1"
          disabled={conferindo}
          onClick={() => void confirmarPagamento()}
        >
          {conferindo ? "Conferindo…" : "Já resgatei — continuar"}
        </button>
      )}
    </>
  );

  /* 17/10 — o PAYWALL MINIMALISTA (ver o cabeçalho): título + linha do tempo + um cartão do plano + botão */
  if (mini) {
    const precoMensalMini = precoMensalLoja ?? SEM_PRECO;
    const passos = mostraMensal
      ? passosSemTeste({ preco: precoMensalMini, periodo: "mes" })
      : comTrial
        ? passosDoTeste({ dias, precoAnual: precoAnualTxt, precoTeste, aviso })
        : passosSemTeste({ preco: precoAnualTxt, periodo: "ano" });
    return (
      <div style={TEMA_CLARO} className="tema-claro relative w-full flex-1 flex flex-col bg-background text-foreground" data-testid="ios-minimalista" data-plano={plano}>
        {!gate && (
          <button
            type="button" aria-label="Voltar" data-testid="ios-mini-voltar" onClick={voltar}
            className="self-start -ml-1 w-10 h-10 rounded-full bg-secondary text-[#16121c] grid place-items-center shrink-0 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>
        )}

        {/* o título e a linha do tempo no meio do espaço que sobra: tudo cresce com a altura da tela
            (sem buraco no 390×844) e aperta no 375×667 — ver ESCALA_DA_TELA */}
        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto py-[var(--mini-respiro)]" style={ESCALA_DA_TELA}>
          <h1 className="text-[length:var(--mini-titulo)] font-black tracking-[-0.03em] leading-[1.06] text-[#16121c]" data-testid="ios-mini-titulo">
            {mostraMensal
              ? <>Assine o{" "}<br />plano mensal</>
              : comTrial
                ? <>Experimente{" "}<br />{dias} dias grátis</>
                : <>Assine o{" "}<br />plano anual</>}
          </h1>
          <p className="mt-2 text-[length:var(--mini-sub)] leading-snug text-muted-foreground">Veja exatamente como funciona sua assinatura.</p>
          <div className="mt-[var(--mini-antes-da-linha)]">
            <LinhaDoTempoDoTeste passos={passos} testid="ios-mini-linha" />
          </div>
        </div>

        {/* o plano (preço e período colados no botão, o valor cobrado como o preço mais visível), o botão e o legal */}
        <div className="shrink-0 max-w-sm w-full mx-auto flex flex-col">
          {avisosDaCompra}
          <div data-testid="ios-mini-plano" className="mt-3 rounded-2xl border-2 border-[#16121c] px-4 py-3 flex items-center gap-3 text-[#16121c]">
            <span className="w-6 h-6 rounded-full grid place-items-center shrink-0 bg-[#16121c] text-white" aria-hidden>
              <Check className="w-3.5 h-3.5" strokeWidth={3.5} />
            </span>
            <span className="flex-1 min-w-0">
              <b className="block text-[15.5px] font-bold leading-tight">{mostraMensal ? "Plano mensal" : "Plano anual"}</b>
              {(mostraMensal || comTrial) && (
                <span className="block text-[12.5px] text-muted-foreground mt-0.5 whitespace-nowrap">{mostraMensal ? "Cancele quando quiser" : `${dias} dias grátis`}</span>
              )}
            </span>
            {/* o valor cobrado é o preço mais visível (3.1.2); o por mês do anual é a CONTA contra o mensal */}
            <span className="shrink-0 text-right">
              <span className="block text-[17px] font-extrabold tracking-tight leading-tight">
                {mostraMensal ? precoMensalMini : precoAnualTxt}
                <span className="text-[13px] font-semibold text-muted-foreground">{mostraMensal ? "/mês" : "/ano"}</span>
              </span>
              {!mostraMensal && <span className="block text-[12.5px] text-muted-foreground mt-0.5">{precoMesTxt}/mês</span>}
            </span>
          </div>
          <motion.div className="mt-3" animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 0.9, delay: 0.5, ease: "easeInOut" }}>
            <Button
              size="lg" data-testid="ios-mini-cta"
              className="w-full h-14 rounded-full bg-[#16121c] hover:bg-[#16121c]/90 text-white text-[17px] font-bold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)]"
              disabled={comprando}
              onClick={tocarNoBotao}
            >
              {comprando
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : mostraMensal ? `Assinar por ${precoMensalMini}/mês` : comTrial ? "Começar teste grátis" : `Assinar por ${precoAnualTxt}/ano`}
            </Button>
          </motion.div>
          {/* o mensal fica a um toque (cobra hoje, sem teste); a volta mostra a conta do anual */}
          <button
            type="button" data-testid="ios-mini-trocar-plano" onClick={() => escolher(mostraMensal ? "anual" : "mensal")}
            className="self-center mt-1 px-3 py-2 text-[13.5px] font-semibold text-muted-foreground underline underline-offset-4 decoration-black/20"
          >
            {mostraMensal ? (precoMes ? `Ver plano anual · ${precoMesTxt}/mês` : "Ver plano anual") : "Ver plano mensal"}
          </button>
          <p className="text-[11px] text-muted-foreground text-center leading-snug" data-testid="ios-mini-legal">Renova automaticamente até você cancelar.</p>
          {rodapeDaLoja}
        </div>
        {sobreposicoes}
      </div>
    );
  }

  if (curto) {
    const precoMensalCurto = precoMensalLoja ?? SEM_PRECO;
    const aviso = comTrial ? diaDoAviso(dias) : null;
    const radio = (ativo: boolean) => (
      <span className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${ativo ? "bg-[#16121c] text-white" : "border-2 border-black/15 bg-white"}`} aria-hidden>
        {ativo && <Check className="w-3.5 h-3.5" strokeWidth={3.5} />}
      </span>
    );
    return (
      <div className="relative w-full flex-1 flex flex-col" data-testid="ios-curto">
        {/* 1. a imagem sangrando até as bordas (o px-5/pt-4 do funil é desfeito aqui); é ela que encolhe */}
        <div className="relative flex-1 min-h-[150px] max-h-[440px] -mx-5 -mt-4 overflow-hidden bg-[#f6f6f7] dark:bg-background" data-testid="ios-curto-hero">
          <img src="/paywall-hero.jpg" alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover object-top select-none scale-[1.07] origin-top" />
          <div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-white via-white/85 to-transparent dark:from-background dark:via-background/85" aria-hidden />
          {!gate && <button
            type="button" aria-label="Voltar" data-testid="ios-curto-voltar" onClick={voltar}
            className="absolute top-3 left-4 w-11 h-11 rounded-full bg-white text-[#16121c] shadow-[0_2px_12px_rgba(0,0,0,0.18)] grid place-items-center active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>}
        </div>

        <div className="shrink-0 max-w-sm w-full mx-auto flex flex-col">
          {/* 2. o título */}
          <h1 className="text-center text-[26px] font-black tracking-[-0.02em] leading-[1.12] text-[#16121c] dark:text-foreground -mt-1">
            {comTrial && !mostraMensal
              ? <>Comece seus {dias} dias grátis{" "}<br />pra continuar</>
              : <>Escolha seu plano{" "}<br />pra continuar</>}
          </h1>

          {/* 3. anual com o cabeçalho preto · 4. mensal cinza */}
          <div className="mt-4 space-y-2.5" role="radiogroup" aria-label="Plano">
            <div
              role="radio" aria-checked={plano === "anual"} tabIndex={0} data-testid="ios-curto-anual"
              onClick={() => escolher("anual")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") escolher("anual"); }}
              className={`rounded-2xl overflow-hidden border-[2.5px] bg-white transition-colors ${plano === "anual" ? "border-[#16121c] dark:border-white" : "border-black/10 dark:border-white/20"}`}
            >
              {comTrial && (
                <div className={`text-center text-[12px] font-extrabold tracking-[0.1em] py-[6px] ${plano === "anual" ? "bg-[#16121c] text-white" : "bg-black/10 text-[#16121c]"}`}>
                  {dias} DIAS GRÁTIS
                </div>
              )}
              <div className="flex items-center gap-3 px-3.5 py-3 text-[#16121c]">
                {radio(plano === "anual")}
                <span className="flex-1 min-w-0">
                  <b className="block text-[15.5px] font-bold leading-tight">
                    {comTrial ? "Comece grátis" : "Anual"}
                    {economia !== null && <span data-testid="ios-economize"> e economize {economia}%</span>}
                  </b>
                  <span className="block text-[12.5px] text-black/55 mt-0.5">{precoAnualTxt} cobrado por ano</span>
                </span>
                <span className="text-[14.5px] font-bold shrink-0">{precoMesTxt}<span className="font-semibold text-black/55">/mês</span></span>
              </div>
            </div>
            <div
              role="radio" aria-checked={plano === "mensal"} tabIndex={0} data-testid="ios-curto-mensal"
              onClick={() => escolher("mensal")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") escolher("mensal"); }}
              className={`rounded-2xl border-[2.5px] flex items-center gap-3 px-3.5 py-3.5 text-[#16121c] transition-colors ${plano === "mensal" ? "border-[#16121c] dark:border-white bg-white" : "border-black/10 dark:border-white/20 bg-[#f6f6f7]"}`}
            >
              {radio(plano === "mensal")}
              <b className="flex-1 text-[15.5px] font-bold">Mensal</b>
              <span className="text-[14.5px] font-bold shrink-0">{precoMensalCurto}<span className="font-semibold text-black/55">/mês</span></span>
            </div>
          </div>

          {avisosDaCompra}

          {/* 5. a linha única + o botão (1 pulso) + o legal */}
          {comTrial && !mostraMensal && (
            <p className="mt-3 text-center text-[12.5px] font-semibold text-[#16121c] dark:text-foreground" data-testid="ios-sem-cobranca">
              <span className="text-accent" aria-hidden>✓</span> Sem cobrança hoje{aviso ? <span className="text-muted-foreground"> · a gente te avisa dia {aviso}</span> : null}
            </p>
          )}
          <div className={`relative ${comTrial && !mostraMensal ? "mt-2" : "mt-4"}`}>
            {preparando && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                role="status" data-testid="ios-preparando-folha"
                className="absolute inset-x-0 -top-2 -translate-y-full z-10 rounded-2xl bg-[#16121c] text-white dark:bg-white dark:text-[#16121c] text-[12.5px] font-semibold leading-snug px-3.5 py-2.5 shadow-lg text-center"
              >
                A Apple vai mostrar <b>{precoAnualTxt}/ano</b>: é o valor depois dos {dias} dias. Hoje: <b>{precoTeste ?? "nada"}</b>.
              </motion.div>
            )}
            <motion.div animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 0.9, delay: 0.5, ease: "easeInOut" }}>
              <Button
                size="lg"
                className="w-full h-14 rounded-full bg-[#16121c] hover:bg-[#16121c]/90 text-white dark:bg-white dark:hover:bg-white/90 dark:text-[#16121c] text-[17px] font-bold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)]"
                disabled={comprando || preparando}
                onClick={tocarNoBotao}
              >
                {comprando || preparando ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continuar"}
              </Button>
            </motion.div>
          </div>
          <p className="mt-2.5 text-[11px] text-muted-foreground text-center leading-snug" data-testid="ios-curto-legal">
            {mostraMensal
              ? <>{precoMensalCurto} por mês pela App Store.{" "}<br />Renova automaticamente, a menos que cancele na App Store.</>
              : comTrial
                ? <>{dias} dias grátis, depois <strong className="text-foreground font-semibold">{precoAnualTxt} por ano</strong>.{" "}<br />Renova automaticamente, a menos que cancele na App Store.</>
                : <>{precoAnualTxt} por ano pela App Store.{" "}<br />Renova automaticamente, a menos que cancele na App Store.</>}
          </p>
          {rodapeDaLoja}
        </div>
        {sobreposicoes}
      </div>
    );
  }

  return (
    /* pb maior só com o cartão: a barra fixa cresce e cobriria o "Restaurar compras" do rodapé */
    <div className={`relative w-full max-w-sm mx-auto text-center ${mostraSegundaChance ? "pb-60" : textos && comTrial && !mostraMensal ? "pb-48" : "pb-40"} pt-8`}>
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 15 }}
        className="w-14 h-14 rounded-full bg-accent text-accent-foreground grid place-items-center mx-auto mb-4 shadow-[0_8px_28px_-6px_hsl(var(--accent)/0.55)]"
      >
        <Check className="w-7 h-7" strokeWidth={3} />
      </motion.div>
      <h1 className="text-[27px] font-bold tracking-tight leading-[1.12] mb-2">
        Seu plano pra<br /><span className="text-accent">{vitoria[area]}</span><br />está pronto
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed mb-5">
        Você já viu como funciona. Agora é com os seus números de verdade.
      </p>

      <div className="space-y-4">
        <motion.div {...stagger(0)}>
          {(() => {
            // A âncora do topo acompanha a coluna escolhida — resolve o medo
            // de "a pessoa se assusta com 97,90 antes de ver que tem mensal".
            /* 20/09 (dono viu no simulador "CORE vitalício · R$ $14.99"): o
             * título do anual é dito aqui — o padrão do cartão é o vitalício da
             * web — e o "R$" só entra quando o preço da loja vem em reais; na
             * vitrine dos EUA (revisor) a App Store manda "$14.99" e o cartão
             * mostra a string como veio. */
            /* (A) 20/09: no anual a âncora mostra o POR MÊS (R$ 8,16) — é o
             * número comparável com o mensal e com o que some por mês; o
             * valor cheio do ano vai na linha de baixo. */
            const valor = mostraMensal ? precoMensalTxt : precoMesTxt;
            const emReais = /^R\$/.test(valor);
            const preco = emReais ? valor.replace(/^R\$\s?/, "") : valor;
            const prefixo = emReais ? "R$ " : "";
            // (sub curto de propósito: cabe numa linha; o teste grátis já grita
            // no selo da coluna, no cronograma e no botão)
            const precoSub = mostraMensal ? "por mês" : `por mês · ${precoAnualTxt}/ano`;
            const precoTitulo = mostraMensal
              ? <>CORE mensal,<br />pra começar hoje</>
              : area === "dinheiro"
                ? <>CORE anual,<br />pra enxergar tudo</>
                : undefined;
            return area === "dinheiro"
              ? <AnchorCard gasto={answers?.gasto ?? ""} preco={preco} prefixo={prefixo} precoSub={precoSub} precoTitulo={precoTitulo} />
              : <AreaAnchorCard area={area as Exclude<AreaKey, "dinheiro">} preco={preco} prefixo={prefixo} precoSub={precoSub} precoTitulo={precoTitulo} />;
          })()}
        </motion.div>
        {comTrial && !mostraMensal && (
          <motion.div {...stagger(1)}><ComoFuncionaOTeste dias={dias} precoAnual={precoAnualTxt} /></motion.div>
        )}
        <motion.div {...stagger(1)}><TransformChart label={chartLabel} /></motion.div>
        <ValueStack area={area} />
        <motion.div {...stagger(2)}>{area === "dinheiro" ? <CompareTable /> : <ModulesIncludedCard />}</motion.div>
        <motion.div {...stagger(3)}>
          <DuasColunas
            plano={plano}
            precoAnual={precoAnualTxt}
            precoMes={precoMesTxt}
            dias={dias}
            comTrial={comTrial}
            mesesDeMensal={mesesDeMensal}
            precoMensal={precoMensalTxt}
            economia={textos ? economia : null}
            onSelect={(p) => { setPlano(p); trackEvent("funnel_click", { cta: "ios_plano", plano: p, funil: FUNIL, oferta: oferta.oferta, preco: precoAnual }); }}
          />
        </motion.div>
        <MuralDepoimentos area={area} semLoja soAssinatura />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card py-3.5 text-center">
            <div className="text-[13px] text-[#f0a500] tracking-wide" aria-label="5 estrelas">★★★★★</div>
            <div className="text-[17px] font-extrabold tracking-tight leading-tight mt-0.5">+1000</div>
            <div className="text-[10.5px] text-muted-foreground font-semibold">aprovaram o CORE</div>
          </div>
          <div className="rounded-2xl border border-border bg-card py-3.5 text-center">
            <div className="text-[13px]" aria-hidden>⚡</div>
            <div className="text-[17px] font-extrabold tracking-tight leading-tight mt-0.5">Na hora</div>
            <div className="text-[10.5px] text-muted-foreground font-semibold">acesso liberado</div>
          </div>
        </div>
        <motion.div {...stagger(4)}>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {selosPara(comTrial && !mostraMensal).map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11.5px] font-semibold">
                {c.emoji && <span>{c.emoji}</span>} {c.label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* "Segue e ganha 7 dias" (14/09): no iPhone o código é um Offer Code
            da própria Apple (INSTA7, 1 semana grátis no mensal) e a folha de
            resgate é do sistema — dentro da 3.1.1. A folha não avisa quando
            fecha; "Já resgatei" confere pelo restaurar (mesmo caminho do
            "Já paguei"). */}
        <div className="text-center pt-3 space-y-1.5">
          <button
            type="button"
            className="text-[12px] font-semibold text-muted-foreground underline underline-offset-2"
            data-testid="ios-tenho-codigo"
            onClick={async () => {
              trackEvent("funnel_click", { cta: "ios_codigo_abrir", funil: FUNIL });
              const rc = await import("@/lib/revenuecat");
              const abriu = await rc.abrirResgateApple();
              if (abriu) setResgatouCodigo(true);
              else setErro("Não consegui abrir o resgate. Tenta de novo em alguns segundos.");
            }}
          >
            Tenho um código
          </button>
          {resgatouCodigo && (
            <button
              type="button"
              className="block w-full text-center text-[12.5px] font-bold underline underline-offset-2 disabled:opacity-50"
              disabled={conferindo}
              onClick={() => void confirmarPagamento()}
            >
              {conferindo ? "Conferindo…" : "Já resgatei — continuar"}
            </button>
          )}
        </div>

        {/* Restaurar compras (3.1.1) + Termos e Privacidade (3.1.2). Sem isto
            este paywall reprova, e ele é a primeira tela de um iPhone novo. */}
        <AppLegalFooter />
      </div>

      {/* CTA fixo */}
      <div
        className="fixed inset-x-0 bottom-0 z-[75] bg-gradient-to-t from-white via-white/95 to-transparent dark:from-background dark:via-background/95 pt-8"
        style={{ paddingBottom: "max(0.9rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-sm mx-auto px-5">
          {pendente && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-3 mb-2.5 text-left">
              {/* "Pendente" na Apple é raro (Ask to Buy de conta de menor, ou
                  revisão antifraude) e não tem nada pra pessoa fazer no banco
                  — só esperar. Prometer ação aqui seria inventar. */}
              <b>Compra em processamento.</b> A App Store ainda está confirmando —
              o acesso libera sozinho aqui.
              <button className="block w-full text-center font-bold underline underline-offset-2 mt-1.5 disabled:opacity-50" disabled={conferindo} onClick={() => void confirmarPagamento()}>
                {conferindo ? "Conferindo…" : "Já comprei — atualizar"}
              </button>
            </div>
          )}
          {erro && <p className="text-[12.5px] text-destructive text-center mb-2">{erro}</p>}
          {mostraSegundaChance && (
            <div role="status" data-testid="ios-segunda-chance" className="rounded-2xl border border-accent/30 bg-card shadow-[0_10px_28px_-14px_rgba(0,0,0,0.3)] pl-3.5 pr-2 py-2 mb-2.5 flex items-center gap-2.5 text-left">
              <p className="flex-1 text-[12.5px] font-bold leading-snug text-foreground">Hoje você não paga nada · cancela em 2 toques</p>
              <button
                type="button"
                className="shrink-0 rounded-full bg-accent/10 text-accent text-[12.5px] font-bold px-3.5 py-2 active:scale-[0.97] transition-transform"
                onClick={tentarDeNovo}
              >
                Tentar de novo
              </button>
            </div>
          )}

          {/* 10/10 (chave PAYWALL_TEXTOS): o que a folha vai fazer, dito ANTES do toque */}
          {textos && comTrial && !mostraMensal && (
            <p className="text-center mb-2" data-testid="ios-apple-confirma">
              {/* fundo opaco: a linha fica na zona do degradê da barra e sobreporia o conteúdo */}
              <span className="inline-block rounded-full bg-white dark:bg-card px-3 py-1 text-[12px] font-semibold text-foreground shadow-[0_2px_10px_-4px_rgba(0,0,0,0.25)]">
                A Apple vai pedir confirmação. Nada é cobrado hoje.
              </span>
            </p>
          )}

          <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}>
            <Button
              size="lg"
              className="w-full h-14 rounded-full text-base font-bold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
              disabled={comprando}
              onClick={tocarNoBotao}
            >
              {comprando
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : mostraMensal
                  ? <>Começar por {precoMensalTxt}/mês <ArrowRight className="w-4 h-4" /></>
                  : comTrial
                    ? <>Começar {dias} dias grátis <ArrowRight className="w-4 h-4" /></>
                    : <>Quero o ano — {precoAnualTxt} <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </motion.div>
          {/* (C) o que a folha vai dizer, dito antes: nada é cobrado hoje e o
              app avisa antes de cobrar (Cal AI: "No payment due now"). 01/10: a
              promessa voltou — e é cumprida pelo lembrete local. */}
          {!mostraMensal && comTrial && (
            <p className="text-[11.5px] text-center mt-2 font-semibold" data-testid="ios-sem-cobranca">
              <span className="text-foreground">Sem cobrança hoje</span>
              <span className="text-muted-foreground"> · a gente te avisa 1 dia antes do teste acabar</span>
            </p>
          )}
          <p className="text-[11px] text-muted-foreground text-center mt-2 flex w-full items-start justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            <span>
              {/* Nenhuma forma de pagamento citada (3.1.1) e, no mensal, o
                  aviso de renovação automática que a 3.1.2 exige. */}
              {mostraMensal
                ? <>Assinatura de {precoMensalTxt}/mês pela App Store · renova automaticamente até você cancelar</>
                : comTrial
                  ? <>{dias} dias grátis, depois <strong className="text-foreground font-semibold">{precoAnualTxt}/ano</strong> pela App Store · renova automaticamente até você cancelar · cancele antes do fim do teste e não paga nada</>
                  : <>Assinatura de {precoAnualTxt}/ano pela App Store · renova automaticamente até você cancelar</>}
            </span>
          </p>
        </div>
      </div>

      {sobreposicoes}
    </div>
  );
}
