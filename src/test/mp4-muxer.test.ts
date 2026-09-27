/**
 * O muxer MP4 mínimo do vídeo dos Stories (27/09): ftyp + moov + mdat, uma
 * trilha avc1 com a avcC do codificador, tabelas certas e o stco apontando
 * pro começo dos dados. (A validade de verdade é conferida com o ffmpeg num
 * MP4 gerado pelo app no Chromium; aqui é a estrutura.)
 */
import { describe, it, expect } from "vitest";
import { ESCALA_DE_TEMPO, lerCaixas, montarMp4 } from "@/components/conquistas/video/mp4";

// uma avcC plausível (configurationVersion 1, Main 4.0, 1 SPS + 1 PPS)
const avcC = new Uint8Array([1, 0x4d, 0x40, 0x28, 0xff, 0xe1, 0x00, 0x04, 0x67, 0x4d, 0x40, 0x28, 0x01, 0x00, 0x04, 0x68, 0xee, 0x3c, 0x80]);
const dentroDe = (bytes: Uint8Array, c: { inicio: number; tamanho: number }) => lerCaixas(bytes, c.inicio + 8, c.inicio + c.tamanho);

describe("montarMp4", () => {
  it("escreve ftyp + moov + mdat; stsz/stss/stts/stco batem com as amostras; a avcC vai dentro do avc1", () => {
    const amostras = Array.from({ length: 5 }, (_, i) => ({ dados: new Uint8Array([0, 0, 0, 2, 0x65 + i, i]), chave: i === 0 || i === 3 }));
    const bytes = montarMp4({ largura: 720, altura: 1280, fps: 30, avcC, amostras });
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    const topo = lerCaixas(bytes);
    expect(topo.map((c) => c.tipo)).toEqual(["ftyp", "moov", "mdat"]);
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("isom");
    const [, moov, mdat] = topo;
    expect(mdat.tamanho).toBe(8 + 5 * 6);
    expect(mdat.inicio + mdat.tamanho).toBe(bytes.length);

    const trak = dentroDe(bytes, moov).find((c) => c.tipo === "trak")!;
    const mdia = dentroDe(bytes, trak).find((c) => c.tipo === "mdia")!;
    const mdhd = dentroDe(bytes, mdia).find((c) => c.tipo === "mdhd")!;
    expect(dv.getUint32(mdhd.inicio + 8 + 4 + 8)).toBe(ESCALA_DE_TEMPO); // timescale
    expect(dv.getUint32(mdhd.inicio + 8 + 4 + 12)).toBe(5 * 3000); // duração
    const minf = dentroDe(bytes, mdia).find((c) => c.tipo === "minf")!;
    const stbl = dentroDe(bytes, minf).find((c) => c.tipo === "stbl")!;
    const tabelas = dentroDe(bytes, stbl);
    expect(tabelas.map((c) => c.tipo)).toEqual(["stsd", "stts", "stss", "stsc", "stsz", "stco"]);
    const por = Object.fromEntries(tabelas.map((c) => [c.tipo, c]));

    // stsd › avc1 › avcC
    const avc1 = lerCaixas(bytes, por.stsd.inicio + 16, por.stsd.inicio + por.stsd.tamanho)[0];
    expect(avc1.tipo).toBe("avc1");
    expect(dv.getUint16(avc1.inicio + 8 + 24)).toBe(720);
    expect(dv.getUint16(avc1.inicio + 8 + 26)).toBe(1280);
    const caixaAvcC = lerCaixas(bytes, avc1.inicio + 8 + 78, avc1.inicio + avc1.tamanho)[0];
    expect(caixaAvcC.tipo).toBe("avcC");
    expect(bytes.slice(caixaAvcC.inicio + 8, caixaAvcC.inicio + caixaAvcC.tamanho)).toEqual(avcC);

    // stts: 1 entrada, 5 amostras de 3.000
    expect(dv.getUint32(por.stts.inicio + 12)).toBe(1);
    expect(dv.getUint32(por.stts.inicio + 16)).toBe(5);
    expect(dv.getUint32(por.stts.inicio + 20)).toBe(3000);
    // stss: quadros-chave 1 e 4
    expect(dv.getUint32(por.stss.inicio + 12)).toBe(2);
    expect(dv.getUint32(por.stss.inicio + 16)).toBe(1);
    expect(dv.getUint32(por.stss.inicio + 20)).toBe(4);
    // stsz: tamanho variável, 5 amostras de 6 bytes
    expect(dv.getUint32(por.stsz.inicio + 12)).toBe(0);
    expect(dv.getUint32(por.stsz.inicio + 16)).toBe(5);
    expect(dv.getUint32(por.stsz.inicio + 20)).toBe(6);
    // stco: um chunk, no começo dos dados do mdat — e os bytes lá são a 1ª amostra
    expect(dv.getUint32(por.stco.inicio + 12)).toBe(1);
    const deslocamento = dv.getUint32(por.stco.inicio + 16);
    expect(deslocamento).toBe(mdat.inicio + 8);
    expect(bytes.slice(deslocamento, deslocamento + 6)).toEqual(amostras[0].dados);
    expect(bytes.slice(deslocamento + 24, deslocamento + 30)).toEqual(amostras[4].dados);
  });

  it("recusa lista vazia e avcC que não é avcC", () => {
    expect(() => montarMp4({ largura: 720, altura: 1280, fps: 30, avcC, amostras: [] })).toThrow(/sem amostras/);
    expect(() => montarMp4({ largura: 720, altura: 1280, fps: 30, avcC: new Uint8Array([0, 1, 2]), amostras: [{ dados: new Uint8Array(4), chave: true }] })).toThrow(/avcC/);
  });
});
