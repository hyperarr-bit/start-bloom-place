/**
 * RETOMADA DO FUNIL W (02/09) — o progresso sobrevive ao app morrer.
 *
 * Autópsia de 3 dias: 13–31% das tentativas de compra terminavam com o app
 * REINICIANDO 15–60s depois do toque (Android mata a activity enquanto a
 * folha do Google está na frente, sobretudo Samsung A0x/A1x, Xiaomi e
 * dobráveis). Quando voltava, a pessoa caía na WELCOME — instalação nova,
 * quiz de novo — porque passo/área/respostas viviam em sessionStorage, que
 * morre com o processo. 0 de 19 compraram depois disso hoje; 3 de 83 no dia 28.
 *
 * Aqui o progresso vai pro localStorage com carimbo de hora e validade
 * curta. Só o SHELL retoma (na web o /w continua nascendo na welcome).
 */
export const CHAVES_FUNIL_W = {
  area: "core-funil-w-area",
  respostas: "core-funil-w-respostas",
  passo: "core-funil-w-passo",
  posCompra: "core-funil-w-pos-compra",
  /** Coluna de preço escolhida no paywall (04/09): quem volta pousa com ela marcada. */
  plano: "core-funil-w-plano",
} as const;

/* 04/09 — RETOMADA LONGA. Nasceu com 6h porque a hipótese era "o app morreu
 * na folha e voltou em minutos". Medido em 27/08→04/09 (6.458 aparelhos):
 * 32% das vendas acontecem FORA da sessão de instalação e 18% em OUTRO dia;
 * quem volta e RETOMA chega ao paywall 91–100% e compra 3–9%; quem volta e
 * cai na welcome chega 18–35% e compra 1,5–1,8%. Com 6h, 117 de 137 retornos
 * caíam na welcome e 36 refaziam o quiz inteiro. Trinta dias: a pessoa que
 * instalou, montou o plano e voltou na semana seguinte encontra o plano. O
 * limite existe pra um aparelho de segunda mão não abrir num funil alheio. */
export const VALIDADE_PROGRESSO_MS = 30 * 24 * 60 * 60 * 1000;
/** Acima disto a retomada é "volta" (a pessoa saiu e voltou), não "reinício". */
export const REINICIO_ATE_MS = 6 * 60 * 60 * 1000;

/** Há quanto tempo a chave foi gravada (ms), ou null se não existe/venceu. */
export const idadeDaChave = (chave: string): number | null => {
  try {
    const cru = localStorage.getItem(chave);
    if (!cru) return null;
    const j = JSON.parse(cru) as { t?: number } | null;
    if (!j || typeof j !== "object" || typeof j.t !== "number") return null;
    const idade = Date.now() - j.t;
    return idade < VALIDADE_PROGRESSO_MS ? idade : null;
  } catch { return null; }
};

export const guardarChave = (chave: string, valor: unknown): void => {
  try { localStorage.setItem(chave, JSON.stringify({ v: valor, t: Date.now() })); } catch { /* modo privado */ }
};

/** Devolve o valor guardado, ou null se não existe, venceu ou está corrompido. */
export const lerChave = <T,>(chave: string): T | null => {
  try {
    const cru = localStorage.getItem(chave);
    if (!cru) return null;
    const j = JSON.parse(cru) as { v?: T; t?: number } | null;
    if (!j || typeof j !== "object" || typeof j.t !== "number") return null;
    return Date.now() - j.t < VALIDADE_PROGRESSO_MS ? (j.v as T) : null;
  } catch { return null; }
};

export const limparProgresso = (): void => {
  try { for (const k of Object.values(CHAVES_FUNIL_W)) localStorage.removeItem(k); } catch { /* noop */ }
};

/**
 * Onde retomar a partir do passo salvo. Quem já tinha PLANO montado (prova,
 * carregando, diagnóstico) pousa na CENTRAL — "seu plano está pronto" — e
 * não no diagnóstico de novo (04/09); os pós-cadastro viram o cadastro (a
 * conta ainda não existe, senão o RootGate nem teria trazido a pessoa pra cá);
 * welcome/promessas/porta não valem retomada — é o começo mesmo.
 */
const RETOMAVEIS: Record<string, string> = {
  quiz: "quiz", prova: "central", progress: "central", result: "central", central: "central",
  compromissos: "compromissos", contrato: "contrato", notif: "notif", offer: "offer",
  signup: "signup", confirm: "signup", liberando: "signup",
};
export const passoDeRetomada = (salvo: string | null, noShell: boolean): string | null =>
  noShell && salvo ? (RETOMAVEIS[salvo] ?? null) : null;

/**
 * ANÚNCIO NA WEB COMEÇA NA PORTA (02/09).
 *
 * Medido em 01–02/09 com 2.567 cliques pagos: 69% viam a welcome do app
 * ("Um app pra vida inteira", grade azul, Começar) e iam embora sem tocar
 * em nada — quem toca, toca em 3,5s, então não é o botão, é a tela. Um
 * clique frio do Instagram não instalou nada; duas telas de splash antes da
 * primeira pergunta é onde R$ 1.000 dos R$ 1.467 dos dois dias morreram.
 * No app a welcome fica (a pessoa acabou de instalar, 70% seguem).
 */
export const veioDeAnuncio = (search: string, atribuicao: Record<string, string>): boolean => {
  try {
    const p = new URLSearchParams(search);
    if (p.get("utm_campaign") || p.get("fbclid") || p.get("ttclid") || p.get("gclid")) return true;
  } catch { /* noop */ }
  return !!(atribuicao?.utm_campaign || atribuicao?.fbclid || atribuicao?.ttclid || atribuicao?.gclid);
};
export const comecaNaPorta = (noShell: boolean, deAnuncio: boolean): boolean => !noShell && deAnuncio;

/**
 * BOTÃO VOLTAR DO ANDROID (02/09).
 *
 * Medido em 3 dias: das 524 sessões novas que viram o paywall e não tocaram
 * em comprar, 328 (63%) "voltaram" — e era o Voltar físico. Sem listener, o
 * Capacitor faz goBack() no history, e a única página no history antes do
 * paywall é a DEMO (/preview). A pessoa caía na demo, fugia, refazia os
 * compromissos, pulava o contrato e só 29% chegava de novo ao paywall.
 * Os passos do funil W são ESTADO, não history: o Voltar tem que voltar de
 * passo. No paywall e no pós-compra ele fica (1º toque) e minimiza (2º).
 */
const PASSO_ANTERIOR: Record<string, string> = {
  promessas: "welcome", porta: "welcome", quiz: "porta", prova: "quiz", progress: "prova", result: "quiz",
  central: "result", compromissos: "central", contrato: "compromissos", notif: "contrato",
};
export const passoAnteriorDe = (passo: string): string | null => PASSO_ANTERIOR[passo] ?? null;

/**
 * Pra onde o 2º Voltar leva quem está NO PAYWALL (03/09).
 *
 * Medido no 1º dia inteiro da v100: dos 112 aparelhos que viram o paywall, 69
 * apertaram Voltar nele e 53 apertaram de novo — e o `minimizeApp()` entregou
 * os 53 pro launcher. Antes da v100 o Voltar caía na demo e 29% voltavam ao
 * offer; agora volta 0% na mesma sessão. E a 2ª exibição do offer é o que
 * converte: 33 aparelhos viram o paywall duas vezes hoje e 19 tocaram em
 * pagar (58%), contra 29% de quem viu uma vez só.
 *
 * O destino é o CONTRATO, não a demo e não a central: é o pico de compromisso
 * ("eu assinei") e o caminho de volta é curto — contrato → notif → offer.
 * Uma vez por sessão; no 2º recuo o app minimiza, porque insistir com quem
 * quer sair vira cárcere e nota 1 na loja.
 */
export const RECUO_DO_PAYWALL = "contrato";

/** Quem pediu "Topo, se for bem simples" no quiz (24% de quem vê o paywall)
 *  toca 23,5% contra 39,7% de quem pediu "Sim, topo" — e some em <10s. O
 *  paywall fala diferente com essa pessoa (04/09). */
export const ehPerfilSimples = (answers: Record<string, string> | null | undefined): boolean =>
  (answers?.compromisso ?? "") === "Topo, se for bem simples";
export const ficaNoVoltar = (passo: string): boolean => passo === "offer" || passo === "signup" || passo === "confirm" || passo === "liberando";
/** Passos que um deep link (notificação, retomada) pode abrir direto. */
export const PASSOS_DE_DEEP_LINK = new Set(["compromissos", "offer", "signup"]);

/**
 * Para onde um ?step= que chega DEPOIS de montado deve levar (02/09, revisão).
 * A volta do Google pós-compra (caminho quente, singleTask) chega como
 * navigate("/app?step=offer") com a flag de OAuth pós-compra ligada — isso é
 * "liberando", nunca paywall. E quem está no pós-compra (signup/confirm/
 * liberando) não volta pro paywall por deep link nenhum.
 */
export const alvoDoDeepLink = (pedido: string | null, atual: string, oauthPosCompra: boolean): string | null => {
  if (oauthPosCompra) return "liberando";
  if (!pedido || !PASSOS_DE_DEEP_LINK.has(pedido) || pedido === atual) return null;
  if (ficaNoVoltar(atual)) return null;
  return pedido;
};
