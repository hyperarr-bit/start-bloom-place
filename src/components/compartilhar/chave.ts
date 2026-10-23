/**
 * A CHAVE DOS CARDS NOVOS DE COMPARTILHAR (29/09). DESLIGADA: com "off",
 * tudo que existe hoje fica byte a byte igual — a "Minha conquista do mês"
 * continua o pin de esmalte, o Treino concluído continua só com "Fechar".
 *
 * Ligar = trocar "off" por "on" aqui (e subir). Pra olhar antes, no
 * navegador/aparelho de quem testa: localStorage `compartilhar-v2-force` =
 * "on" (ou "off" pra forçar desligado). A rota /dev/compartilhar mostra
 * tudo sem precisar da chave.
 */
export type ModoCompartilharV2 = "off" | "on";

export const COMPARTILHAR_V2: ModoCompartilharV2 = "off";

export const CHAVE_FORCA = "compartilhar-v2-force";

export const forcaDoCompartilharV2 = (): ModoCompartilharV2 | null => {
  try {
    const f = typeof localStorage === "undefined" ? null : localStorage.getItem(CHAVE_FORCA);
    return f === "on" || f === "off" ? f : null;
  } catch {
    return null;
  }
};

/** Os cards novos estão valendo pra esta pessoa? */
export const compartilharV2Ligado = (): boolean => (forcaDoCompartilharV2() ?? COMPARTILHAR_V2) === "on";
