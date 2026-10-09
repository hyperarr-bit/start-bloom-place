/**
 * /afiliado/:token — o PAINEL DA AFILIADA (09/10/2026).
 *
 * O link é secreto e é só dela. Não tem login: o token (32 bytes aleatórios)
 * é a senha. Tudo que aparece vem da função `afiliados` (action "painel"),
 * que lê o banco e devolve SÓ agregados — quantas pessoas usaram o código,
 * quantas pagaram, quanto ela tem a receber, quando cai o próximo Pix — e
 * uma lista "venda de 05/10 · R$ 40,15 · Pix previsto pra 13/10". Nenhum
 * nome, e-mail ou id de cliente passa por aqui.
 *
 * Por que existe: a afiliada não precisa confiar na palavra do dono. Os
 * números são do banco, e o Pix sai sozinho toda segunda.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { type LinhaPainel, type PainelAfiliada, diaComSemana, diaCurto, reais, textoSituacao } from "@/lib/afiliados";

const MAGENTA = "hsl(330 65% 50%)";

function Tile({ label, value, sub, destaque }: { label: string; value: string; sub?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${destaque ? "border-transparent text-white" : "border-border bg-card"}`} style={destaque ? { background: MAGENTA } : undefined}>
      <div className={`text-[12px] font-medium ${destaque ? "text-white/80" : "text-muted-foreground"}`}>{label}</div>
      <div className="text-[26px] font-bold tracking-tight mt-1 leading-none tabular-nums">{value}</div>
      {sub && <div className={`text-[11.5px] mt-1.5 ${destaque ? "text-white/80" : "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}

const COR_SITUACAO: Record<LinhaPainel["situacao"], string> = {
  paga: "text-emerald-700 dark:text-emerald-400",
  prevista: "text-foreground",
  segurada: "text-amber-700 dark:text-amber-400",
  em_teste: "text-muted-foreground",
  nao_pagou: "text-muted-foreground",
  reembolsada: "text-destructive",
};

/** A tela, pura: recebe o que a função devolveu. O /dev/afiliados e os testes a usam com dados de exemplo. */
export function PainelAfiliadaVista({ p }: { p: PainelAfiliada }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(p.link); setCopiado(true); } catch { /* o link está na tela */ }
    window.setTimeout(() => setCopiado(false), 2500);
  };
  const comissaoPorVenda = p.linhas.find((l) => l.comissao_cents > 0)?.comissao_cents ?? 4015;

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="painel-afiliada">
      <main className="mx-auto w-full max-w-[440px] md:max-w-[960px] px-4 pt-7 pb-14">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center text-[14px] font-extrabold tracking-tight">C</div>
            <div className="leading-none">
              <div className="text-[13px] font-bold tracking-tight">CORE</div>
              <div className="text-[10.5px] text-muted-foreground mt-0.5">Programa de afiliadas</div>
            </div>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-[12px] font-semibold tracking-wide" data-testid="codigo">{p.codigo}</span>
        </header>

        {/* PC: números e regras à esquerda, vendas à direita ocupando as duas linhas; celular: números → link → vendas → regras */}
        <div className="md:grid md:grid-cols-[1fr_1.1fr] md:grid-rows-[auto_1fr] md:gap-x-8 md:gap-y-4 md:items-start mt-6">
          <section className="space-y-4 md:col-start-1 md:row-start-1">
            <div>
              <h1 className="text-[26px] md:text-[30px] font-black tracking-tight leading-tight">Oi, {p.nome}!</h1>
              <p className="text-[14px] text-muted-foreground mt-1">Seus números, direto do banco do CORE. Atualiza sozinho.</p>
            </div>

            {p.pausado && (
              <p className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2.5 text-[13px] text-amber-900 dark:text-amber-200" data-testid="aviso-pausado">
                Seus pagamentos estão pausados no momento. As comissões continuam sendo contadas e ficam guardadas aqui.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Tile label="A receber" value={reais(p.a_receber_cents)} sub={p.segurado_cents > 0 ? `${reais(p.segurado_cents)} em conferência` : "comissões confirmadas"} destaque />
              <Tile label="Próximo Pix" value={reais(p.proximo_pagamento.valor_cents)} sub={diaComSemana(p.proximo_pagamento.dia)} />
              <Tile label="Usaram seu código" value={String(p.usaram)} sub={`${p.em_teste} em teste grátis`} />
              <Tile label="Pagaram" value={String(p.pagaram)} sub={p.reembolsadas ? `${p.reembolsadas} reembolso` : "assinaturas confirmadas"} />
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-[12px] font-medium text-muted-foreground">Já recebido</div>
              <div className="text-[22px] font-bold tracking-tight mt-0.5 tabular-nums">{reais(p.ja_recebido_cents)}</div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: MAGENTA }} aria-hidden />
                <h2 className="text-[15px] font-bold">Seu link</h2>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Quem abrir no iPhone ganha <b className="text-foreground">7 dias grátis</b> do CORE Anual (em vez dos 3 de sempre). Você recebe <b className="text-foreground">{reais(comissaoPorVenda)}</b> por cada pessoa que pagar o primeiro ano.
              </p>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 min-w-0 truncate rounded-xl bg-muted px-3 py-2.5 text-[12px]" data-testid="link">{p.link}</code>
                <button onClick={copiar} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold text-white" style={{ background: MAGENTA }} aria-label="Copiar link">
                  {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiado ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
          </section>

          <section className="mt-6 md:mt-0 md:col-start-2 md:row-start-1 md:row-span-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-[15px] font-bold">Suas vendas</h2>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">O Pix sai toda segunda com as vendas confirmadas há {p.dias_carencia} dias ou mais.</p>
              {p.linhas.length === 0 ? (
                <p className="text-[13px] text-muted-foreground/80 text-center py-10">Ninguém usou seu código ainda. Quando usar, aparece aqui na hora.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border" data-testid="linhas">
                  {p.linhas.map((l, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                      <span className="text-muted-foreground tabular-nums whitespace-nowrap">{l.situacao === "em_teste" ? "teste" : "venda"} de {diaCurto(l.dia)}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className={`tabular-nums font-semibold ${l.comissao_cents ? "" : "text-muted-foreground/60"}`}>{l.comissao_cents ? reais(l.comissao_cents) : "—"}</span>
                        <span className={`text-[12px] w-[128px] text-right ${COR_SITUACAO[l.situacao]}`}>{textoSituacao(l)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="mt-4 md:mt-0 md:col-start-1 md:row-start-2">
            <div className="rounded-2xl border border-border bg-card p-4 text-[13px] leading-relaxed text-muted-foreground space-y-2">
              <h2 className="text-[15px] font-bold text-foreground">Como funciona</h2>
              <p><b className="text-foreground">Comissão:</b> 50% do primeiro pagamento, sobre o valor líquido que a Apple repassa (R$ 97,90 → R$ 80,30 → <b className="text-foreground">R$ 40,15</b> pra você). Renovação não gera comissão.</p>
              <p><b className="text-foreground">Pagamento:</b> Pix automático toda segunda, ~9h, pra chave que você cadastrou. Entram as vendas confirmadas há {p.dias_carencia}+ dias — é a janela de reembolso da Apple; venda reembolsada nesse prazo não conta.</p>
              <p><b className="text-foreground">Em teste:</b> a pessoa ainda está nos 7 dias grátis. Vira comissão quando a Apple cobra o primeiro ano.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function Afiliado() {
  const { token = "" } = useParams();
  const [p, setP] = useState<PainelAfiliada | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) { setErro("link"); return; }
      const { data, error } = await supabase.functions.invoke("afiliados", { body: { action: "painel", token } });
      if (!vivo) return;
      if (error || !data || (typeof data === "object" && "error" in data)) { setErro((data as { error?: string } | null)?.error === "nao_encontrado" ? "link" : "rede"); return; }
      setP(data as PainelAfiliada);
    })();
    return () => { vivo = false; };
  }, [token]);

  if (erro) {
    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center px-6">
        <div className="max-w-[360px] text-center space-y-2">
          <h1 className="text-[20px] font-bold">{erro === "link" ? "Este link não existe" : "Não deu pra carregar"}</h1>
          <p className="text-[14px] text-muted-foreground">{erro === "link" ? "Confira se copiou o link inteiro. Se continuar assim, fale com o João." : "Tente de novo em instantes."}</p>
        </div>
      </div>
    );
  }
  if (!p) return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  return <PainelAfiliadaVista p={p} />;
}
