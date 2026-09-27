/**
 * MP4 MÍNIMO (27/09): um muxer de UMA trilha de vídeo H.264 (avc1), pros
 * quadros que o WebCodecs codifica virarem um .mp4 que o Instagram aceita.
 * Nada de dependência: são ~150 linhas de caixas ISO BMFF — ftyp, moov
 * (mvhd, trak › tkhd, mdia › mdhd, hdlr, minf › vmhd, dinf, stbl › stsd
 * (avc1 + avcC), stts, stss, stsc, stsz, stco) e o mdat com as amostras
 * coladas. Um chunk só com todas as amostras; o `stco` aponta pro começo do
 * mdat, que é calculado antes (o tamanho do moov não depende do valor).
 *
 * As amostras vêm no formato "avc" (comprimento + NAL, o que
 * `avc: { format: "avc" }` pede ao VideoEncoder) e o `avcC` é a
 * `decoderConfig.description` que ele entrega no 1º quadro-chave.
 */

export interface AmostraH264 {
  dados: Uint8Array;
  chave: boolean;
}

export interface OpcoesMp4 {
  largura: number;
  altura: number;
  fps: number;
  avcC: Uint8Array;
  amostras: AmostraH264[];
}

/** Escala de tempo da trilha (90 kHz: 30 fps = 3.000 por quadro, exato). */
export const ESCALA_DE_TEMPO = 90000;

const codificador = new TextEncoder();
const u32 = (v: number) => new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
const u16 = (v: number) => new Uint8Array([(v >>> 8) & 255, v & 255]);
const u8 = (v: number) => new Uint8Array([v & 255]);
const zeros = (n: number) => new Uint8Array(n);
const texto = (s: string) => codificador.encode(s);

const juntar = (partes: Uint8Array[]): Uint8Array => {
  const n = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
};

/** Caixa: tamanho (4) + tipo (4) + conteúdo. */
const caixa = (tipo: string, ...partes: Uint8Array[]): Uint8Array => {
  const corpo = juntar(partes);
  return juntar([u32(8 + corpo.length), texto(tipo), corpo]);
};
/** Caixa "cheia": versão (1) + flags (3) antes do conteúdo. */
const caixaCheia = (tipo: string, versao: number, flags: number, ...partes: Uint8Array[]): Uint8Array =>
  caixa(tipo, u8(versao), new Uint8Array([(flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...partes);

/** Matriz de transformação identidade (16.16 / 2.30). */
const MATRIZ = juntar([u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)]);

/** Os bytes do .mp4 (pra testes; `muxarMp4` embrulha num Blob). */
export function montarMp4({ largura, altura, fps, avcC, amostras }: OpcoesMp4): Uint8Array {
  if (!amostras.length) throw new Error("mp4 sem amostras");
  if (avcC.length < 7 || avcC[0] !== 1) throw new Error("avcC inválido");
  const n = amostras.length;
  const delta = Math.round(ESCALA_DE_TEMPO / fps);
  const duracao = n * delta;
  const duracaoFilme = Math.round((duracao / ESCALA_DE_TEMPO) * 1000);

  const ftyp = caixa("ftyp", texto("isom"), u32(0x200), texto("isom"), texto("iso2"), texto("avc1"), texto("mp41"));

  const mvhd = caixaCheia("mvhd", 0, 0, u32(0), u32(0), u32(1000), u32(duracaoFilme), u32(0x10000), u16(0x100), u16(0), u32(0), u32(0), MATRIZ, zeros(24), u32(2));
  const tkhd = caixaCheia("tkhd", 0, 3, u32(0), u32(0), u32(1), u32(0), u32(duracaoFilme), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIZ, u32(largura << 16), u32(altura << 16));
  const mdhd = caixaCheia("mdhd", 0, 0, u32(0), u32(0), u32(ESCALA_DE_TEMPO), u32(duracao), u16(0x55c4), u16(0));
  const hdlr = caixaCheia("hdlr", 0, 0, u32(0), texto("vide"), zeros(12), texto("VideoHandler"), u8(0));
  const vmhd = caixaCheia("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0));
  const dinf = caixa("dinf", caixaCheia("dref", 0, 0, u32(1), caixaCheia("url ", 0, 1)));

  // a entrada de amostra avc1 (ISO 14496-15 §5.3.4) + a avcC do codificador
  const avc1 = caixa(
    "avc1",
    zeros(6), u16(1), // reserved, data_reference_index
    u16(0), u16(0), zeros(12), // pre_defined, reserved, pre_defined[3]
    u16(largura), u16(altura),
    u32(0x480000), u32(0x480000), // 72 dpi
    u32(0), u16(1), // reserved, frame_count
    zeros(32), // compressorname
    u16(0x18), u16(0xffff), // depth, pre_defined = -1
    caixa("avcC", avcC),
  );
  const stsd = caixaCheia("stsd", 0, 0, u32(1), avc1);
  const stts = caixaCheia("stts", 0, 0, u32(1), u32(n), u32(delta));
  const chaves = amostras.map((a, i) => (a.chave ? i + 1 : 0)).filter((i) => i > 0);
  const stss = caixaCheia("stss", 0, 0, u32(chaves.length), ...chaves.map(u32));
  const stsc = caixaCheia("stsc", 0, 0, u32(1), u32(1), u32(n), u32(1));
  const stsz = caixaCheia("stsz", 0, 0, u32(0), u32(n), ...amostras.map((a) => u32(a.dados.length)));
  const stco = (deslocamento: number) => caixaCheia("stco", 0, 0, u32(1), u32(deslocamento));

  const moov = (deslocamento: number) =>
    caixa("moov", mvhd, caixa("trak", tkhd, caixa("mdia", mdhd, hdlr, caixa("minf", vmhd, dinf, caixa("stbl", stsd, stts, stss, stsc, stsz, stco(deslocamento))))));

  // o moov vem ANTES do mdat (o arquivo já "começa rápido"); o tamanho dele não depende do deslocamento
  const tamanhoMoov = moov(0).length;
  const inicioDosDados = ftyp.length + tamanhoMoov + 8;
  const mdat = caixa("mdat", ...amostras.map((a) => a.dados));
  return juntar([ftyp, moov(inicioDosDados), mdat]);
}

export const muxarMp4 = (o: OpcoesMp4): Blob => new Blob([montarMp4(o)], { type: "video/mp4" });

/** Lê as caixas de 1º nível (pra testes e conferência): [{ tipo, inicio, tamanho }]. */
export function lerCaixas(bytes: Uint8Array, inicio = 0, fim = bytes.length): { tipo: string; inicio: number; tamanho: number }[] {
  const out: { tipo: string; inicio: number; tamanho: number }[] = [];
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = inicio;
  while (p + 8 <= fim) {
    const tamanho = dv.getUint32(p);
    const tipo = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    if (tamanho < 8) break;
    out.push({ tipo, inicio: p, tamanho });
    p += tamanho;
  }
  return out;
}
