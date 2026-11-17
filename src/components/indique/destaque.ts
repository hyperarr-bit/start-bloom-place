/** O toque no balão "Novo: Indique e ganhe" pede o destaque da linha na página Você (consumido 1× por quem monta a linha, em até 10 s). */
let pedidoEm = 0;
export const pedirDestaqueIndique = (): void => { pedidoEm = Date.now(); };
export function consumirDestaqueIndique(agora: number = Date.now()): boolean {
  const ok = pedidoEm > 0 && agora - pedidoEm < 10_000;
  pedidoEm = 0;
  return ok;
}
