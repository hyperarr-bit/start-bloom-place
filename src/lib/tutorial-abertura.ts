/**
 * O "VER TUTORIAL" VALE SÓ NESTA ABERTURA DO APP (27/10, QA do tutorial antigo — regra do dono: fechar e reabrir no
 * meio, nada pode voltar sozinho nem ficar preso).
 *
 * A fila `tutorial-replay-modules` mora na conta (user_data). Até aqui ela sozinha decidia tudo: fechar o app no meio
 * do tutorial e abrir de novo caía DIRETO no seletor "Qual módulo quer ver?" no lugar da Home, e entrar num módulo da
 * fila por conta própria (dias depois) ligava o holofote sem ninguém pedir.
 *
 * Agora a fila só vale junto com esta marca, que vive na MEMÓRIA do app (some ao fechar/recarregar): o seletor marca
 * ao confirmar os módulos, o Encerrar desmarca. Fila viva sem a marca = sobra de uma abertura anterior — a Home
 * apaga e segue normal (pages/Home), e o holofote não liga (SpotlightOverlay).
 */
let ativoNestaAbertura = false;

export const marcarTutorialNestaAbertura = (): void => { ativoNestaAbertura = true; };
export const desmarcarTutorialNestaAbertura = (): void => { ativoNestaAbertura = false; };
export const tutorialNestaAbertura = (): boolean => ativoNestaAbertura;
