const HOSTS_PRODUCAO = new Set(["coreaplicativo.com.br", "www.coreaplicativo.com.br"]);

export const funilBPermitidoNoHost = (hostname: string): boolean =>
  !HOSTS_PRODUCAO.has(hostname.trim().toLowerCase());

