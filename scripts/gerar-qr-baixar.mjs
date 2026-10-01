/**
 * QR CODE DA LANDING (01/10): `node scripts/gerar-qr-baixar.mjs`
 *
 * Gera public/selos/qr-baixar.svg apontando pra
 *   https://coreaplicativo.com.br/baixar?origem=site_qr
 * — o link único de download, que manda pra loja do celular que escaneou e
 * grava o clique com origem "site_qr". Gerado LOCALMENTE (qrcode.react, já
 * no bundle) e commitado como SVG estático: zero JavaScript na página, zero
 * serviço externo, e o arquivo só muda se este script rodar de novo.
 */
import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

const LINK = "https://coreaplicativo.com.br/baixar?origem=site_qr";
const svg = renderToStaticMarkup(
  createElement(QRCodeSVG, { value: LINK, size: 512, level: "M", marginSize: 0, fgColor: "#1a1a1a", bgColor: "#ffffff" }),
);
// o componente sai sem o namespace xmlns — necessário pra abrir como arquivo
const arquivo = svg.replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" aria-label="QR code para baixar o CORE" `);
writeFileSync(new URL("../public/selos/qr-baixar.svg", import.meta.url), arquivo);
console.log("ok →", LINK, `(${arquivo.length} bytes)`);
