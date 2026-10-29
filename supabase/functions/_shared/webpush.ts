/**
 * WEB PUSH sem biblioteca (29/10, aviso de venda no iPhone do dono).
 *
 * VAPID (RFC 8292, JWT ES256) + criptografia aes128gcm (RFC 8291), só com WebCrypto — roda igual no Deno do
 * Supabase e no Node do vitest (o teste decifra a mensagem com a chave do "aparelho" e confere o texto). Evita o
 * npm:web-push, que depende de crypto do Node (createECDH) e não é garantido no runtime das edge functions.
 *
 * Chaves: a pública VAPID é o ponto P-256 sem compressão (65 bytes) em base64url; a privada é o `d` (32 bytes) em
 * base64url — o formato do web-push/generate-vapid-keys.
 */

const te = new TextEncoder();

export function b64urlParaBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesParaB64url(b: Uint8Array | ArrayBuffer): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function juntar(...partes: Uint8Array[]): Uint8Array {
  const n = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

async function hmac(chave: Uint8Array, dados: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, dados));
}

/** JWT ES256 do VAPID. `aud` = origem do endpoint (https://web.push.apple.com etc). */
export async function jwtVapid(endpoint: string, publica: string, privada: string, subject: string, agoraSeg = Math.floor(Date.now() / 1000)): Promise<string> {
  const pub = b64urlParaBytes(publica);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("chave pública VAPID inválida");
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", d: privada, x: bytesParaB64url(pub.slice(1, 33)), y: bytesParaB64url(pub.slice(33, 65)), ext: true };
  const chave = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const cab = bytesParaB64url(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = bytesParaB64url(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: agoraSeg + 12 * 3600, sub: subject })));
  const assinatura = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chave, te.encode(`${cab}.${corpo}`));
  return `${cab}.${corpo}.${bytesParaB64url(assinatura)}`;
}

/** Cifra o corpo (RFC 8291, um registro só). Devolve o corpo binário pronto pro POST. */
export async function cifrarAes128gcm(texto: string, p256dh: string, auth: string, sal?: Uint8Array): Promise<Uint8Array> {
  const uaPublica = b64urlParaBytes(p256dh);
  const segredoAuth = b64urlParaBytes(auth);
  const salt = sal ?? crypto.getRandomValues(new Uint8Array(16));
  const efemera = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublica = new Uint8Array(await crypto.subtle.exportKey("raw", efemera.publicKey));
  const uaChave = await crypto.subtle.importKey("raw", uaPublica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaChave } as EcdhKeyDeriveParams, efemera.privateKey, 256));

  const prkChave = await hmac(segredoAuth, ecdh);
  const ikm = (await hmac(prkChave, juntar(te.encode("WebPush: info\0"), uaPublica, asPublica, new Uint8Array([1])))).slice(0, 32);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, juntar(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, juntar(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const chaveAes = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const claro = juntar(te.encode(texto), new Uint8Array([2])); // 0x02 = último registro, sem enchimento
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, chaveAes, claro));

  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return juntar(salt, rs, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

export type InscricaoPush = { endpoint: string; p256dh: string; auth: string };
export type ChavesVapid = { publica: string; privada: string; subject: string };
export type ResultadoEnvio = { ok: boolean; status: number; remover: boolean };

/** Manda 1 aviso. `remover` = o serviço disse que a inscrição morreu (404/410) — apagar do banco. */
export async function enviarPush(insc: InscricaoPush, dados: unknown, chaves: ChavesVapid, f: typeof fetch = fetch): Promise<ResultadoEnvio> {
  const corpo = await cifrarAes128gcm(JSON.stringify(dados), insc.p256dh, insc.auth);
  const jwt = await jwtVapid(insc.endpoint, chaves.publica, chaves.privada, chaves.subject);
  const r = await f(insc.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${chaves.publica}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: corpo,
  });
  return { ok: r.ok, status: r.status, remover: r.status === 404 || r.status === 410 };
}
