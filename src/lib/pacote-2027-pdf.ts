/**
 * O PLANNER 2027 PRA IMPRIMIR (bônus do "Seu 2027", 21/10). O projeto não tem biblioteca de PDF (nem jspdf nem
 * html2canvas): o planner é uma página HTML A4 na cara do CORE e o PDF sai do "Imprimir → Salvar como PDF" do
 * navegador — o mesmo jeito da planilha de dívidas do kit (PlanilhaDividas `imprimir`). No app das lojas, onde não há
 * janela de impressão, o arquivo .html vai pela folha nativa de compartilhar (abre, imprime ou salva).
 *
 * Páginas: capa · calendário 2027 · as 3 metas por trimestre · dinheiro mês a mês (o planejado do pacote + colunas em
 * branco) · as datas que importam · o cofrinho das 52 semanas · a revisão do mês (12 quadros) · as 16 áreas (2 por folha).
 */
import {
  ANO_2027, MESES_2027, SEMANAS_COFRINHO, TOTAL_COFRINHO, metasPreenchidas, valorDaSemana,
  type Cofrinho2027, type Plano2027,
} from "@/lib/pacote-2027";

export const AREAS_DO_PLANNER: { emoji: string; nome: string; pergunta: string }[] = [
  { emoji: "💰", nome: "Finanças", pergunta: "Quanto quero ter guardado no fim do ano?" },
  { emoji: "⏰", nome: "Rotina", pergunta: "Como quero que sejam as minhas manhãs?" },
  { emoji: "🏋️", nome: "Treino", pergunta: "Quantas vezes por semana eu me mexo?" },
  { emoji: "🥗", nome: "Dieta", pergunta: "O que quero comer mais (e menos)?" },
  { emoji: "🩺", nome: "Saúde", pergunta: "Quais exames e consultas não posso pular?" },
  { emoji: "🏡", nome: "Casa", pergunta: "Que canto da casa quero arrumar?" },
  { emoji: "🌱", nome: "Dev. Pessoal", pergunta: "Quem eu quero ser no fim de 2027?" },
  { emoji: "📚", nome: "Estudos", pergunta: "O que quero aprender?" },
  { emoji: "📖", nome: "Biblioteca", pergunta: "Quais livros quero ler?" },
  { emoji: "💄", nome: "Beleza", pergunta: "Que cuidado quero manter?" },
  { emoji: "✈️", nome: "Viagens", pergunta: "Pra onde quero ir?" },
  { emoji: "💼", nome: "Carreira", pergunta: "Qual o próximo passo no trabalho?" },
  { emoji: "🧠", nome: "Mente", pergunta: "O que me deixa em paz?" },
  { emoji: "💛", nome: "Relações", pergunta: "Com quem quero passar mais tempo?" },
  { emoji: "🐾", nome: "Pet", pergunta: "O que meu pet precisa este ano?" },
  { emoji: "📵", nome: "Detox", pergunta: "De que tela quero me afastar?" },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const brl = (v: number) => (v > 0 ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}` : "");
const linhas = (n: number) => Array.from({ length: n }, () => `<div class="ln"></div>`).join("");

/** Mini-calendário de um mês de 2027 (semana começando na segunda, como o app). */
function mesDoCalendario(mes: number): string {
  const primeiro = new Date(ANO_2027, mes - 1, 1);
  const dias = new Date(ANO_2027, mes, 0).getDate();
  const vazio = (primeiro.getDay() + 6) % 7;
  const cel = [...Array.from({ length: vazio }, () => "<i></i>"), ...Array.from({ length: dias }, (_, d) => `<i>${d + 1}</i>`)].join("");
  return `<div class="cal"><b>${MESES_2027[mes - 1]}</b><div class="sem"><i>S</i><i>T</i><i>Q</i><i>Q</i><i>S</i><i>S</i><i>D</i></div><div class="dias">${cel}</div></div>`;
}

export function htmlDoPlanner2027(p: Plano2027, c: Cofrinho2027, hoje: Date = new Date()): string {
  const metas = metasPreenchidas(p);
  const tresMetas = [0, 1, 2].map((i) => metas[i] ?? "");
  const datas = [...p.datas].sort((a, b) => a.dia.localeCompare(b.dia));
  const pgMetas = tresMetas.map((m, i) => `<div class="meta"><div class="meta-t"><span>${i + 1}</span>${m ? esc(m) : '<em class="vazio">Minha meta</em>'}</div>
    <div class="tri">${["Jan–Mar", "Abr–Jun", "Jul–Set", "Out–Dez"].map((t) => `<div><small>${t}</small>${linhas(3)}</div>`).join("")}</div></div>`).join("");
  const pgDinheiro = `<table><thead><tr><th>Mês</th><th>Posso gastar</th><th>Gastei</th><th>Quero guardar</th><th>Guardei</th></tr></thead><tbody>${
    MESES_2027.map((m) => `<tr><td>${m}</td><td>${brl(p.gastarMes)}</td><td></td><td>${brl(p.guardarMes)}</td><td></td></tr>`).join("")
  }</tbody></table>`;
  const pgDatas = `<div class="datas">${datas.map((d) => `<div class="data"><b>${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}</b><span>${d.tipo === "aniversario" ? "🎂" : d.tipo === "checkup" ? "🩺" : "📌"} ${esc(d.titulo)}</span></div>`).join("")}
    ${Array.from({ length: Math.max(6, 16 - datas.length) }, () => `<div class="data"><b>__/__</b><span class="ln"></span></div>`).join("")}</div>`;
  const pgCofrinho = `<div class="cof">${Array.from({ length: SEMANAS_COFRINHO }, (_, i) => {
    const s = i + 1;
    const feito = c.marcadas.includes(s);
    return `<div class="${feito ? "ok" : ""}"><small>sem ${s}</small><b>R$ ${valorDaSemana(s, c.invertido)}</b></div>`;
  }).join("")}</div><p class="nota">Marque cada semana quando guardar. Total no fim do ano: <b>R$ ${TOTAL_COFRINHO.toLocaleString("pt-BR")}</b>.</p>`;
  const pgRevisao = `<div class="rev">${MESES_2027.map((m) => `<div><b>${m}</b><small>Funcionou</small><div class="ln"></div><small>Vou mudar</small><div class="ln"></div></div>`).join("")}</div>`;
  const areas = AREAS_DO_PLANNER.map((a) => `<div class="area"><h3>${a.emoji} ${a.nome}</h3><p class="q">${esc(a.pergunta)}</p>${linhas(7)}
    <small>Primeiro passo</small>${linhas(2)}<div class="chk"><span>☐ revisei em junho</span><span>☐ revisei em dezembro</span></div></div>`);
  const pgAreas: string[] = [];
  for (let i = 0; i < areas.length; i += 2) pgAreas.push(`<section class="pg"><h2>As 16 áreas · ${i / 2 + 1} de 8</h2>${areas[i]}${areas[i + 1] ?? ""}</section>`);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Planner 2027 · CORE</title><style>
  @page{size:A4;margin:14mm}
  *{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,Helvetica,sans-serif;color:#16121c;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pg{page-break-after:always;padding:4mm 0}
  .pg:last-child{page-break-after:auto}
  h1{font-size:64px;letter-spacing:-.04em;margin:0;line-height:1}h1 em{font-style:normal;color:#d6338a}
  h2{font-size:22px;letter-spacing:-.02em;margin:0 0 6mm;padding-bottom:3mm;border-bottom:2px solid #16121c}
  h3{font-size:17px;margin:0 0 2mm}
  .capa{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:6mm;min-height:250mm;padding:0 10mm;border-left:6mm solid #d6338a}
  .capa p{font-size:16px;color:#6b6575;margin:0}.marca{font-weight:900;letter-spacing:.2em;font-size:13px}
  .cals{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}
  .cal b{display:block;font-size:13px;margin-bottom:2mm;color:#b8206f}.cal .sem,.cal .dias{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center;font-size:10px}
  .cal .sem i{font-style:normal;font-weight:700;color:#6b6575}.cal .dias i{font-style:normal;padding:1.2mm 0;border-radius:2px}
  .meta{border:1.5px solid #e6e1ea;border-radius:4mm;padding:4mm;margin-bottom:5mm}
  .meta-t{font-size:16px;font-weight:800;display:flex;gap:3mm;align-items:center;margin-bottom:3mm}
  .meta-t span{width:8mm;height:8mm;border-radius:50%;background:#fde8f2;color:#b8206f;display:grid;place-items:center;font-size:13px}
  .vazio{color:#b9b3c0;font-weight:600}
  .tri{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}.tri small,.area small,.rev small{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6b6575}
  .ln{border-bottom:1px solid #d9d3df;height:7mm}
  table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #e6e1ea;padding:2.6mm 2mm;text-align:left}th{background:#fde8f2;font-size:11px}
  .datas{display:grid;grid-template-columns:1fr 1fr;gap:2mm 8mm}.data{display:flex;gap:3mm;align-items:flex-end;font-size:12.5px;min-height:8mm}.data b{width:14mm}.data .ln{flex:1;height:5mm}
  .cof{display:grid;grid-template-columns:repeat(8,1fr);gap:2mm}.cof div{border:1.5px solid #e6e1ea;border-radius:2.5mm;padding:2mm;text-align:center}
  .cof div.ok{background:#d6338a;color:#fff;border-color:#d6338a}.cof small{display:block;font-size:9px}.cof b{font-size:12px}
  .nota{font-size:12px;color:#6b6575;margin-top:5mm}
  .rev{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}.rev>div{border:1.5px solid #e6e1ea;border-radius:3mm;padding:3mm}.rev b{display:block;color:#b8206f;font-size:13px;margin-bottom:1mm}
  .area{border:1.5px solid #e6e1ea;border-radius:4mm;padding:5mm;margin-bottom:6mm}.area .q{margin:0 0 2mm;font-size:12.5px;color:#6b6575}
  .chk{display:flex;gap:8mm;margin-top:3mm;font-size:11.5px;color:#6b6575}
  .rodape{font-size:10px;color:#9a93a3;margin-top:4mm}
  </style></head><body>
  <section class="pg"><div class="capa"><span class="marca">● CORE</span><h1>Planner <em>2027</em></h1><p>Metas, dinheiro, datas e as 16 áreas da sua vida.</p>
    <p class="rodape">Gerado em ${hoje.toLocaleDateString("pt-BR")} · o mesmo plano do seu CORE (Dev. Pessoal → Seu 2027)</p></div></section>
  <section class="pg"><h2>2027</h2><div class="cals">${MESES_2027.map((_, i) => mesDoCalendario(i + 1)).join("")}</div></section>
  <section class="pg"><h2>Minhas 3 metas de 2027</h2>${pgMetas}</section>
  <section class="pg"><h2>Meu dinheiro em 2027</h2>${pgDinheiro}<p class="nota">No ano: guardar ${brl(p.guardarMes * 12) || "R$ ____"} + o cofrinho das 52 semanas (R$ ${TOTAL_COFRINHO.toLocaleString("pt-BR")}).</p></section>
  <section class="pg"><h2>As datas que importam</h2>${pgDatas}</section>
  <section class="pg"><h2>Cofrinho das 52 semanas</h2>${pgCofrinho}</section>
  <section class="pg"><h2>Revisão do mês</h2>${pgRevisao}</section>
  ${pgAreas.join("")}
  </body></html>`;
}

/** true = abriu a impressão (web) ou a folha de compartilhar (app). */
export async function imprimirPlanner2027(html: string, nativo: boolean): Promise<boolean> {
  if (nativo) {
    const { compartilharHtml } = await import("@/lib/compartilhar");
    const r = await compartilharHtml(html, "planner-2027-core.html", "Planner 2027", "pacote_2027_pdf");
    return r === "shared" || r === "downloaded";
  }
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  window.setTimeout(() => { try { w.focus(); w.print(); } catch { /* a pessoa imprime pelo menu */ } }, 350);
  return true;
}
