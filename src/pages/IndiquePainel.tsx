/**
 * /indique/:token — o PAINEL de quem indica pela web (23/11/2026, indique e ganhe da /oferta).
 *
 * Direção "B — seu CORE sai de graça" (prints-indique/): a meta é recuperar os R$ 67,90 que a pessoa pagou (2 vendas). Abaixo:
 * liberando / liberado / recebido, o link (Copiar, WhatsApp, story), o extrato venda a venda, a chave Pix (pedida aqui, uma vez
 * só, dizendo QUEM paga) e as regras em linguagem simples. Os números vêm da função `afiliados` (action "painel"), que só devolve
 * agregados — nunca nome, e-mail ou id de quem comprou.
 * Revisão de design 23/11 (compradora): números que fecham entre si, "quem paga", sem "lucro", regra da loja (não conta).
 */
import { useState } from "react";
import { Check, Copy, Download, Smartphone } from "lucide-react";
import { type LinhaPainel, type PainelIndique, diaComSemana, diaCurto, reais } from "@/lib/afiliados";
import { compartilharStory, textoStory } from "@/lib/indique-story";
import { ESTILO_INDIQUE, type EstiloIndique } from "@/lib/indique-estilo";
import { CaminhoNoApp } from "@/components/indique/CaminhoNoApp";

const MAGENTA = "#d02c7d";
const META_CENTS = 6790;
const TIPOS_PIX: Array<{ v: string; rotulo: string; dica: string; teclado: "numeric" | "email" | "tel" | "text" }> = [
  { v: "PHONE", rotulo: "Celular", dica: "(11) 98765-4321", teclado: "tel" },
  { v: "CPF", rotulo: "CPF", dica: "000.000.000-00", teclado: "numeric" },
  { v: "EMAIL", rotulo: "E-mail", dica: "voce@email.com", teclado: "email" },
  { v: "EVP", rotulo: "Aleatória", dica: "chave aleatória do banco", teclado: "text" },
];
const ROTULO_TIPO: Record<string, string> = { CPF: "CPF", CNPJ: "CNPJ", PHONE: "celular", EMAIL: "e-mail", EVP: "chave aleatória" };
const ERRO_PIX: Record<string, string> = {
  chave_invalida: "Essa chave não parece certa. Confira o tipo e os números.",
  chave_em_uso: "Essa chave já recebe por outro link. Use outra chave.",
  chave_de_cliente: "Essa chave é de alguém que comprou pelo seu link. Use a sua.",
  ja_tem: "Você já cadastrou uma chave. Pra trocar, fale com a gente.",
};
const SUPORTE = "contato@coreaplicativo.com.br";

export const mensagemWhatsapp = (link: string) =>
  `Tô usando o CORE pra organizar minha vida (finanças, rotina, treino, tudo num app só). Tá valendo muito. Se quiser, é por aqui: ${link}`;

/** "YYYY-MM-DD" do relógio UTC do instante (as datas do painel vêm do servidor já no dia de Brasília; aqui só se soma dia) */
const ymd = (ms: number) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; };
const somaDias = (dia: string, n: number) => ymd(Date.parse(`${dia.slice(0, 10)}T12:00:00Z`) + n * 86400e3);
const liberaDe = (l: LinhaPainel, carencia: number) => l.libera_dia ?? somaDias(l.dia, carencia);

/** o selo de cada venda do extrato */
function selo(l: LinhaPainel, hoje: string, carencia: number): { texto: string; tom: "ok" | "am" | "cz" } {
  switch (l.situacao) {
    case "paga": return { texto: `Pago ${diaCurto(l.pagamento_dia)}`, tom: "ok" };
    case "prevista": {
      const libera = liberaDe(l, carencia);
      return libera > hoje ? { texto: `libera ${diaCurto(libera)}`, tom: "am" } : { texto: `no Pix de ${diaCurto(l.pagamento_dia)}`, tom: "am" };
    }
    case "segurada": return { texto: "em conferência", tom: "am" };
    case "reembolsada": return { texto: "reembolsada", tom: "cz" };
    default: return { texto: "não contou", tom: "cz" };
  }
}
const COR_SELO = { ok: "bg-emerald-100 text-emerald-800", am: "bg-amber-100 text-amber-900", cz: "bg-[#ecebee] text-[#4a4550]" } as const;

/** a frase da meta (as 2 caras usam a mesma) */
const fraseMeta = (ganho: number, deGraca: boolean, faltam: number, recebidoCobre: boolean) =>
  ganho === 0 ? "Seu CORE de graça"
    : deGraca ? (recebidoCobre ? "Seu CORE já saiu de graça 🎉" : "Quando esses Pix caírem, seu CORE terá saído de graça")
    : `Falta${faltam > 1 ? "m" : ""} ${faltam} amiga${faltam > 1 ? "s" : ""} pro seu CORE sair de graça`;

export function PainelIndiqueVista({ p, salvarPix, agora = new Date(), estilo = ESTILO_INDIQUE }: {
  p: PainelIndique;
  salvarPix: (tipo: string, chave: string) => Promise<{ ok: true; pix: PainelIndique["pix"] } | { ok: false; motivo: string }>;
  agora?: Date;
  /** a cara do topo (src/lib/indique-estilo.ts): "bitepal" (padrão) ou "site" */
  estilo?: EstiloIndique;
}) {
  const [copiado, setCopiado] = useState(false);
  const [story, setStory] = useState(false);
  const [tipo, setTipo] = useState("PHONE");
  const [chave, setChave] = useState("");
  const [pix, setPix] = useState(p.pix);
  const [salvando, setSalvando] = useState(false);
  const [erroPix, setErroPix] = useState<string | null>(null);
  // revisão 17/11: sem nenhuma venda, o formulário da chave fica recolhido (pedir chave Pix de cara assusta)
  const [formPix, setFormPix] = useState(p.a_receber_cents + p.ja_recebido_cents > 0);
  const hoje = ymd(agora.getTime() - 3 * 3600e3); // o dia de Brasília (UTC−3), igual ao diaBRT do servidor
  const carencia = p.dias_carencia;
  const ganho = p.a_receber_cents + p.ja_recebido_cents;
  const deGraca = ganho >= META_CENTS;
  const pct = Math.min(100, Math.round((ganho / META_CENTS) * 100));
  const faltamAmigas = Math.max(0, Math.ceil((META_CENTS - ganho) / Math.max(1, p.comissao_cents)));
  const linkCurto = p.link.replace(/^https:\/\/(www\.)?/, "");
  // "liberando" = ainda na carência; "liberado" = já pode sair no próximo Pix (ou em conferência). Somam o a_receber do servidor.
  let liberando = 0;
  for (const l of p.linhas) if (l.situacao === "prevista" && liberaDe(l, carencia) > hoje) liberando += l.comissao_cents;
  const liberado = Math.max(0, p.a_receber_cents - liberando);
  const semPreco = estilo === "c"; // versão C (dono 17/11): nada lembra o preço que ela pagou — 50%, R$ por amiga, sem limite
  const bitepal = estilo !== "site";
  const frase = semPreco ? `Você ganha ${reais(p.comissao_cents)} por amiga · sem limite` : fraseMeta(ganho, deGraca, faltamAmigas, p.ja_recebido_cents >= META_CENTS);

  const copiar = async (texto: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); window.setTimeout(() => setCopiado(false), 2500); } catch { /* o link está na tela */ }
  };
  const enviarPix = async () => {
    if (!chave.trim()) { setErroPix(ERRO_PIX.chave_invalida); return; }
    setSalvando(true); setErroPix(null);
    const r = await salvarPix(tipo, chave).catch(() => ({ ok: false as const, motivo: "rede" }));
    setSalvando(false);
    if (r.ok === true) setPix(r.pix);
    else if (r.ok === false) setErroPix(ERRO_PIX[r.motivo] ?? "Não deu pra salvar agora. Tente de novo em instantes.");
  };
  const baixarStory = () => compartilharStory(p.link);
  const tipoAtual = TIPOS_PIX.find((t) => t.v === tipo)!;
  const barra = (
    <div className={`${bitepal ? "h-4 border-[2.5px] border-[#17111C]" : "h-3 border border-[#f2c9dd]"} rounded-full bg-white mt-3 overflow-hidden`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Quanto falta pro seu CORE sair de graça">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: bitepal ? "#E0337F" : `linear-gradient(90deg,#ff6fb0,${MAGENTA})` }} />
    </div>
  );

  return (
    <div className={`min-h-screen ${bitepal ? "bg-[#F3F2F7] text-[#17111C]" : "bg-white text-[#262626]"}`} data-testid="painel-indique" data-estilo={estilo} style={{ fontFamily: "Inter, -apple-system, sans-serif" }}>
      {bitepal ? (
        <div className="relative" style={{ background: "linear-gradient(180deg,#FBC6DF 0%,#F8DDEA 55%,rgba(243,242,247,0) 100%)" }} data-testid="meta">
          <div className="mx-auto max-w-[440px] px-5 pt-4 pb-6">
            <div className="flex items-center justify-between h-10"><span className="text-[15px] font-black tracking-[.14em]">CORE</span><span className="text-[12px] font-bold uppercase tracking-[.1em] text-[#C42A73]">Indique e ganhe</span></div>
            {p.pausado && (
              <p className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[13px] text-amber-900" data-testid="aviso-pausado">
                Seu link está pausado. As vendas continuam aparecendo aqui, mas o Pix fica parado até a gente conferir. Dúvida? <a className="underline" href={`mailto:${SUPORTE}`}>{SUPORTE}</a>
              </p>
            )}
            <div className="relative mt-3">
              <div className="absolute right-0 -top-1 flex gap-1.5" aria-hidden>
                <span className="grid place-items-center w-11 h-11 rounded-full bg-white border-[3px] border-[#17111C] shadow-[0_3px_0_#17111C] text-[22px] -rotate-6">👩🏻</span>
                <span className="grid place-items-center w-11 h-11 rounded-full bg-white border-[3px] border-[#17111C] shadow-[0_3px_0_#17111C] text-[22px] rotate-6">👩🏽‍🦱</span>
              </div>
              <div className="text-[14px] font-bold text-[#3d3545] pr-28">{frase}</div>
              {ganho === 0 ? (
                <>
                  <h1 className="text-[44px] font-black tracking-[-0.045em] leading-[.98] mt-2" data-testid="ganho">{semPreco ? "Convide e ganhe 50%" : "Faltam 2 amigas"}</h1>
                  <p className="text-[15px] leading-snug mt-3 text-[#3d3545]">Cada amiga que comprar pelo seu link = <b className="text-[#17111C]">{reais(p.comissao_cents)}</b> no seu Pix. {semPreco ? "Sem limite de amigas." : `Duas = os ${reais(p.preco_cents)} que você pagou de volta.`}</p>
                </>
              ) : (
                <>
                  <div className="text-[12px] font-bold text-[#3d3545] mt-3 uppercase tracking-[.08em]">Ganho total</div>
                  <h1 className="text-[58px] font-black tracking-[-0.045em] leading-none tabular-nums mt-1" data-testid="ganho">{reais(ganho)}</h1>
                  <div className="text-[13px] text-[#3d3545] mt-2 tabular-nums">{p.pagaram} venda{p.pagaram === 1 ? "" : "s"} pelo seu link{semPreco ? " · sem limite de amigas" : ""}</div>
                  {!semPreco && barra}
                  {!semPreco && <div className="flex justify-between text-[11.5px] font-bold text-[#3d3545] mt-1.5 tabular-nums"><span>R$ 0</span><span>{reais(META_CENTS)} · de graça{p.ja_recebido_cents >= META_CENTS ? " ✓" : ""}</span></div>}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <header className="border-b border-[#eee] px-5 h-12 flex items-center justify-between max-w-[440px] mx-auto">
          <span className="text-[15px] font-black tracking-[.14em]">CORE</span>
          <span className="text-[12px] font-semibold text-[#4a4550]">Indique e ganhe</span>
        </header>
      )}
      <main className={`mx-auto w-full max-w-[440px] px-5 ${bitepal ? "pt-1" : "pt-5"} pb-14`}>
        {!bitepal && (
          <>
            <h1 className="text-[24px] font-extrabold tracking-tight">Seu painel</h1>
            {p.pausado && (
              <p className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[13px] text-amber-900" data-testid="aviso-pausado">
                Seu link está pausado. As vendas continuam aparecendo aqui, mas o Pix fica parado até a gente conferir. Dúvida? <a className="underline" href={`mailto:${SUPORTE}`}>{SUPORTE}</a>
              </p>
            )}
            <section className="mt-4 rounded-[22px] p-5 border" style={{ background: "linear-gradient(150deg,#fff3f9,#fde6f1)", borderColor: "#f7d3e5" }} data-testid="meta">
              <div className="text-[13px] font-bold" style={{ color: "#b3206a" }}>{frase}</div>
              {ganho === 0 ? (
                <>
                  <div className="text-[30px] font-extrabold tracking-tight mt-1 leading-tight" data-testid="ganho">Faltam 2 amigas</div>
                  <p className="text-[14px] leading-snug mt-2">Cada amiga que comprar pelo seu link = <b>{reais(p.comissao_cents)}</b> no seu Pix. Duas = os {reais(p.preco_cents)} que você pagou de volta.</p>
                </>
              ) : (
                <>
                  <div className="text-[12px] font-semibold text-[#4a4550] mt-2">Ganho total</div>
                  <div className="text-[34px] font-extrabold tracking-tight leading-none tabular-nums mt-0.5" data-testid="ganho">{reais(ganho)}</div>
                  <div className="text-[12.5px] text-[#4a4550] mt-1 tabular-nums">{p.pagaram} venda{p.pagaram === 1 ? "" : "s"} pelo seu link</div>
                  {barra}
                  <div className="flex justify-between text-[11.5px] font-semibold text-[#4a4550] mt-1.5 tabular-nums"><span>R$ 0</span><span>{reais(META_CENTS)} · de graça{p.ja_recebido_cents >= META_CENTS ? " ✓" : ""}</span></div>
                </>
              )}
            </section>
          </>
        )}

        <section className={`mt-3 rounded-2xl p-4 ${bitepal ? "bg-white shadow-[0_1px_0_rgba(23,17,28,.06),0_8px_20px_-16px_rgba(23,17,28,.5)]" : "border border-[#e8e6ea]"}`} data-testid="dinheiro">
          {pix.cadastrado && p.proximo_pagamento.valor_cents > 0 ? (
            <p className="text-[15px] leading-snug" data-testid="proximo-pix"><b className="text-[18px] tabular-nums">{reais(p.proximo_pagamento.valor_cents)}</b> caem no seu Pix na {diaComSemana(p.proximo_pagamento.dia)}.</p>
          ) : !pix.cadastrado && p.a_receber_cents > 0 ? (
            <>
              <p className="text-[15px] leading-snug" data-testid="guardado"><b className="text-[18px] tabular-nums">{reais(p.a_receber_cents)}</b> guardados pra você. Cadastre sua chave Pix pra receber.</p>
              <a href="#pix" onClick={() => setFormPix(true)} className={`mt-3 inline-flex items-center justify-center h-11 px-5 text-white text-[14px] font-bold ${bitepal ? "rounded-full bg-[#17111C]" : "rounded-xl bg-[#333]"}`} data-testid="ir-pix">Cadastrar chave Pix</a>
            </>
          ) : p.a_receber_cents > 0 ? (
            <p className="text-[15px] leading-snug"><b className="text-[18px] tabular-nums">{reais(p.a_receber_cents)}</b> no prazo de reembolso. Entra no Pix de segunda depois que liberar.</p>
          ) : (
            <p className="text-[15px] leading-snug text-[#4a4550]">Nada a receber ainda. Quando uma amiga comprar, aparece aqui.</p>
          )}
          <div className="flex justify-between gap-3 mt-3 pt-3 border-t border-[#efedf1] text-[13px] text-[#4a4550] tabular-nums">
            <span>Já recebido: <b className="text-[#17111C]" data-testid="recebido">{reais(p.ja_recebido_cents)}</b></span>
            {pix.cadastrado && <span data-testid="pix-resumo">Pix: {ROTULO_TIPO[pix.tipo ?? ""] ?? ""} {pix.final} ✓</span>}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-[16px] font-extrabold mb-3">Mande seu link</h2>
          <div className="flex gap-2">
            <code className={`flex-1 min-w-0 truncate rounded-xl px-3 py-3.5 text-[14px] font-semibold font-sans ${bitepal ? "bg-white" : "bg-[#f4f2f5]"}`} data-testid="link">{linkCurto}</code>
            <button onClick={() => void copiar(p.link)} className={`shrink-0 inline-flex items-center gap-1.5 px-4 text-[14px] font-bold text-white ${bitepal ? "rounded-full bg-[#17111C]" : "rounded-xl bg-[#333]"}`} aria-label="Copiar link">
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <a href={`https://wa.me/?text=${encodeURIComponent(mensagemWhatsapp(p.link))}`} target="_blank" rel="noopener" data-testid="whatsapp"
              className={`h-12 ${bitepal ? "rounded-full" : "rounded-[14px]"} text-white font-bold text-[14.5px] inline-flex items-center justify-center gap-2`} style={{ background: "#1faa59" }}>Mandar no WhatsApp</a>
            <button onClick={() => setStory(true)} data-testid="abrir-story" className={`h-12 font-bold text-[14.5px] inline-flex items-center justify-center gap-2 ${bitepal ? "rounded-full border-2 border-[#17111C]" : "rounded-[14px] border border-[#d9d6dc]"}`}>
              <Smartphone className="w-4 h-4" />Postar no story
            </button>
          </div>
          {/* 17/11 (subida): onde o link mora depois — o caminho no app do site */}
          <CaminhoNoApp className="mt-3" />
        </section>

        {story && (
          <section className="mt-4 rounded-2xl border border-[#e8e6ea] p-4" data-testid="story">
            <h3 className="text-[15px] font-bold">Pro seu story</h3>
            <p className="text-[13px] text-[#4a4550] mt-1">Esta é a arte. Baixe, poste e coloque o adesivo de link com o seu link. Ou copie só o texto.</p>
            <div className="mt-3 mx-auto w-[150px] aspect-[9/16] rounded-xl p-3 text-white flex flex-col justify-between" style={{ background: "radial-gradient(circle at 85% 12%, rgba(208,44,125,.6), transparent 55%), linear-gradient(160deg,#2c2c2e,#141416)" }} aria-hidden>
              <span className="text-[8px] font-extrabold" style={{ color: "#ff8cc4" }}>CORE</span>
              <span className="text-[15px] font-extrabold leading-tight">Organizei minha vida num app só.</span>
              <span className="rounded-md bg-white text-[#1d1d1f] text-[7px] font-bold px-1.5 py-1 truncate">Toque no link 👇</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={() => void baixarStory()} className="h-11 rounded-xl text-white font-bold text-[13.5px] inline-flex items-center justify-center gap-1.5" style={{ background: MAGENTA }}><Download className="w-4 h-4" />Baixar arte</button>
              <button onClick={() => void copiar(textoStory(p.link))} className="h-11 rounded-xl border border-[#d9d6dc] font-bold text-[13.5px]">Copiar texto</button>
            </div>
          </section>
        )}

        <section className="mt-7">
          <h2 className="text-[16px] font-extrabold">Suas vendas</h2>
          {p.linhas.length === 0 ? (
            <p className="text-[13.5px] text-[#4a4550] mt-2 leading-relaxed">Nenhuma ainda. Quando alguém comprar pelo seu link, aparece aqui na hora, com a data em que o dinheiro libera.</p>
          ) : (
            <ul className="mt-1" data-testid="extrato">
              {p.linhas.map((l, i) => {
                const s = selo(l, hoje, carencia);
                const conta = l.comissao_cents > 0 && l.situacao !== "reembolsada" && l.situacao !== "nao_pagou";
                return (
                  <li key={i} className="flex items-center justify-between gap-3 py-3 border-b border-[#e8e6ea] text-[14px]">
                    <span>Venda {diaCurto(l.dia)}</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      <b className={conta ? "" : "text-[#6b6670] font-medium"}>{reais(conta ? l.comissao_cents : 0)}</b>
                      <span className={`text-[11.5px] font-bold px-2 py-1 rounded-full ${COR_SELO[s.tom]}`}>{s.texto}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-7 scroll-mt-4" id="pix" data-testid="pix">
          <h2 className="text-[16px] font-extrabold">Onde cai seu dinheiro</h2>
          {pix.cadastrado ? (
            <p className="text-[14px] mt-2 leading-relaxed" data-testid="pix-ok">
              Pix na chave {ROTULO_TIPO[pix.tipo ?? ""] ?? ""} <b>{pix.final}</b>, às segundas. Pra trocar a chave, é só chamar a gente: <a className="underline font-semibold" href={`mailto:${SUPORTE}`}>{SUPORTE}</a>.
            </p>
          ) : (
            <>
              <p className="text-[13.5px] text-[#4a4550] mt-1.5 leading-relaxed">
                {liberado > 0 ? <>Você tem <b className="text-[#262626]">{reais(liberado)}</b> liberados esperando. Cadastre sua chave pra receber.</> : <>Cadastre agora ou quando a 1ª venda chegar. Sem chave, o dinheiro fica guardado aqui.</>}
                {" "}O Pix sai da <b className="text-[#262626]">CORE</b> (CNPJ 55.041.112/0001-82).
              </p>
              {!formPix ? (
                <button type="button" onClick={() => setFormPix(true)} data-testid="pix-abrir" className={`mt-3 h-11 px-5 text-[14px] font-bold border-2 ${bitepal ? "rounded-full border-[#17111C]" : "rounded-xl border-[#d9d6dc]"}`}>Cadastrar agora</button>
              ) : (
              <>
              <div className="flex gap-2 mt-3" role="radiogroup" aria-label="Tipo da chave Pix">
                {TIPOS_PIX.map((t) => (
                  <button key={t.v} role="radio" aria-checked={tipo === t.v} onClick={() => { setTipo(t.v); setErroPix(null); }}
                    className={`flex-1 min-h-[44px] rounded-[10px] border text-[13px] font-semibold ${tipo === t.v ? "border-[#333] bg-[#f6f6f6]" : "border-[#e8e6ea] text-[#4a4550]"}`}>{t.rotulo}</button>
                ))}
              </div>
              <input value={chave} onChange={(e) => setChave(e.target.value)} inputMode={tipoAtual.teclado} placeholder={tipoAtual.dica} aria-label="Sua chave Pix"
                className="w-full h-[50px] mt-2.5 rounded-xl border border-[#e8e6ea] px-3.5 text-[15px]" data-testid="pix-chave" autoCapitalize="none" autoCorrect="off" />
              {erroPix && <p className="text-[13px] text-red-700 mt-2" role="alert" data-testid="pix-erro">{erroPix}</p>}
              <button onClick={() => void enviarPix()} disabled={salvando} data-testid="pix-salvar" className={`w-full mt-2.5 text-white font-bold text-[15px] disabled:opacity-70 ${bitepal ? "h-[56px] rounded-full bg-[#17111C]" : "h-[50px] rounded-[14px] bg-[#333]"}`}>
                {salvando ? "Salvando…" : "Salvar chave Pix"}
              </button>
              {/* críticas 17/11 (LGPD): pra que serve a chave, perto de onde ela é digitada */}
              <p className="text-[12px] text-[#6b6670] mt-2 leading-snug" data-testid="pix-lgpd">
                Usamos sua chave só para pagar suas comissões. <a className="underline font-semibold" href="/privacidade#indique" target="_blank" rel="noopener">Veja a política</a>.
              </p>
              </>
              )}
              <p className="text-[12px] text-[#4a4550] mt-2">Por segurança, a chave tem que estar no seu nome. Pra trocar depois, é só chamar a gente.</p>
            </>
          )}
        </section>

        <section className="mt-7" data-testid="regras">
          <h2 className="text-[16px] font-extrabold">Como funciona</h2>
          <ol className="list-decimal pl-5 mt-1 text-[13.5px] leading-relaxed text-[#4a4550] space-y-2">
            <li><b className="text-[#262626]">{reais(p.comissao_cents)} por amiga</b>: 50% de cada compra feita pelo seu link. <b className="text-[#262626]">Sem limite de amigas.</b></li>
            <li><b className="text-[#262626]">Sua amiga paga o mesmo preço.</b> Não tem desconto nem custo a mais pra ela.</li>
            <li><b className="text-[#262626]">Só conta compra no site, pelo seu link.</b> Se ela assinar direto na App Store ou no Google Play, não conta.</li>
            <li><b className="text-[#262626]">Prazo pra liberar:</b> {carencia} dias se ela pagar no Pix, 30 dias no cartão. É o prazo de reembolso e de contestação. Se ela pedir o dinheiro de volta, a venda não conta.</li>
            <li><b className="text-[#262626]">Pix toda segunda-feira</b> na sua chave, com o que já liberou. O primeiro Pix passa por uma conferência rápida. Acima de R$ 500 na semana, o Pix pode levar mais uns dias.</li>
            <li><b className="text-[#262626]">Vale o último link.</b> Se ela abrir o link de duas pessoas, ganha quem mandou por último.</li>
            <li><b className="text-[#262626]">Não vale comprar pelo próprio link</b> (mesmo e-mail, conta, cartão ou CPF). Essas vendas não contam.</li>
            <li><b className="text-[#262626]">Pode divulgar pra amigas, família e no seu Instagram.</b> Só não pode fazer anúncio pago com o nome CORE (Google, Instagram, TikTok).</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
