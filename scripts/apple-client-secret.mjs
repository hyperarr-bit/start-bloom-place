/**
 * Gera o "client secret" do Sign in with Apple: `node scripts/apple-client-secret.mjs`
 *
 * POR QUE ISSO EXISTE, e não é conveniência:
 *
 * O campo "Secret Key (for OAuth)" do Supabase NÃO aceita o arquivo .p8. Ele
 * quer um JWT assinado com aquela chave — por isso o painel avisa que o
 * segredo "expira a cada 6 meses" (arquivo não expira; JWT sim). Quem não
 * sabe disso cola o conteúdo do .p8, salva, e o login falha sem mensagem útil.
 *
 * E a segunda razão, que é a séria: os geradores online desse JWT pedem que
 * você suba a CHAVE PRIVADA da conta de desenvolvedor num site de terceiro.
 * Com ela, qualquer um assina "Sign in with Apple" em nome da empresa até a
 * chave ser revogada. Este script faz o mesmo cálculo sem a chave sair da
 * máquina — só node:crypto, zero dependência, zero rede.
 *
 * O QUE VOCÊ PRECISA TER EM MÃOS:
 *   - o arquivo .p8 baixado em developer.apple.com → Keys (baixa UMA vez só)
 *   - Key ID     — aparece na tela da chave, 10 caracteres
 *   - Team ID    — S8XN8A472G (canto superior direito do portal)
 *   - Services ID — br.com.coreaplicativo.signin  (NÃO é o bundle do app)
 *
 * USO:
 *   node scripts/apple-client-secret.mjs \
 *     --p8 ~/caminho/AuthKey_XXXXXXXXXX.p8 \
 *     --key-id XXXXXXXXXX \
 *     --team-id S8XN8A472G \
 *     --services-id br.com.coreaplicativo.signin
 *
 * ⚠️ ANOTE A DATA DE VALIDADE que ele imprime. A Apple limita o segredo a 6
 * meses. Quando vencer, o login com Apple para de funcionar **em silêncio** —
 * ninguém é avisado, e o sintoma é "o botão não faz nada". Rodar este script
 * de novo e recolar no Supabase resolve, mas só se alguém lembrar.
 */
import { createSign, createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";

const arg = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const p8 = arg("p8");
const keyId = arg("key-id");
const teamId = arg("team-id");
const servicesId = arg("services-id");

if (!p8 || !keyId || !teamId || !servicesId) {
  console.error(`
✗ Faltou argumento.

  node scripts/apple-client-secret.mjs \\
    --p8 ~/Downloads/AuthKey_ABCDE12345.p8 \\
    --key-id ABCDE12345 \\
    --team-id S8XN8A472G \\
    --services-id br.com.coreaplicativo.signin
`);
  process.exit(1);
}

// base64url: o JWT não usa base64 comum (+ / = quebram a URL).
const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let chave;
try {
  chave = createPrivateKey(readFileSync(p8, "utf8"));
} catch (e) {
  console.error(`\n✗ Não consegui ler a chave em ${p8}\n  ${e.message}\n`);
  console.error("  É o arquivo AuthKey_XXXXXXXXXX.p8 baixado em developer.apple.com → Keys.\n");
  process.exit(1);
}

const agora = Math.floor(Date.now() / 1000);
// 6 meses menos um dia: o máximo que a Apple aceita é 15777000s (~182,5 dias);
// pedir o teto exato às vezes é recusado por diferença de relógio.
const exp = agora + 15777000 - 86400;

const header = { alg: "ES256", kid: keyId };
const payload = {
  iss: teamId,
  iat: agora,
  exp,
  aud: "https://appleid.apple.com",
  sub: servicesId,
};

const corpo = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

// dsaEncoding "ieee-p1363" é obrigatório: o padrão do Node é DER, e um JWT
// ES256 com assinatura DER é recusado pela Apple sem explicar o motivo.
const assinatura = createSign("SHA256").update(corpo).sign({ key: chave, dsaEncoding: "ieee-p1363" });

const jwt = `${corpo}.${b64url(assinatura)}`;

console.log("\n=== Secret Key (for OAuth) — cole isto no Supabase ===\n");
console.log(jwt);
console.log(`\n  Services ID : ${servicesId}`);
console.log(`  Team ID     : ${teamId}`);
console.log(`  Key ID      : ${keyId}`);
console.log(`\n  ⚠️  VENCE EM ${new Date(exp * 1000).toLocaleDateString("pt-BR")} — depois disso o`);
console.log("     login com Apple para de funcionar sem avisar ninguém.");
console.log("     Rode este script de novo e recole no Supabase antes da data.\n");
