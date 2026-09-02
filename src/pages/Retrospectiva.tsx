import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { construirRetroMes, lerDadosDaVida, type RetroMes } from "@/lib/retrospectiva";
import { MonthlyWrapped } from "@/components/wrapped/MonthlyWrapped";

/**
 * A casa da retrospectiva (27/07).
 *
 * Antes ela só existia como um banner dentro de Finanças — quem não abria
 * aquele módulo nunca soube que existia. Agora tem endereço próprio, que é
 * pra onde a NOTIFICAÇÃO mensal e o item do menu apontam.
 *
 * E não é de um mês só: a tela lista os meses com dados, porque a graça de
 * uma retrospectiva é poder voltar nela. Quem chega pela notificação já cai
 * com o mês certo aberto (`?mes=`), sem precisar escolher nada.
 */

/** "1 livros" é o tipo de detalhe que faz o app parecer feito às pressas. */
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

const RESUMO_DE = (r: RetroMes): string => {
  const v = r.vida;
  const partes: string[] = [];
  if (v && v.diasAtivos > 0) partes.push(plural(v.diasAtivos, "dia ativo", "dias ativos"));
  if (v && v.livros.length > 0) partes.push(plural(v.livros.length, "livro", "livros"));
  if (v && v.treinos > 0) partes.push(plural(v.treinos, "treino", "treinos"));
  if (r.financas && r.financas.txCount > 0) partes.push(plural(r.financas.txCount, "lançamento", "lançamentos"));
  // fallbacks: um mês pode existir só por diário, humor ou água — sem eles a
  // linha caía num texto genérico que não dizia nada.
  if (partes.length === 0 && v && v.diasDeDiario > 0) partes.push(plural(v.diasDeDiario, "dia de diário", "dias de diário"));
  if (partes.length === 0 && v && v.humorMedio !== null) partes.push(`humor ${v.humorMedio.toFixed(1)}/5`);
  if (partes.length === 0 && v && v.copos > 0) partes.push(plural(v.copos, "copo d'água", "copos d'água"));
  if (partes.length === 0 && r.financas) partes.push("suas finanças do mês");
  return partes.slice(0, 3).join(" · ") || "seu mês em números";
};

const Retrospectiva = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mesPedido = params.get("mes");

  // Últimos 12 meses FECHADOS, do mais recente pro mais antigo. Começa em
  // `atras = 1` de propósito (02/09, bug visto pelo dono): com 0, o mês
  // CORRENTE entrava na lista e a capa dizia "Setembro fechou" no dia 2 —
  // retrospectiva de mês que mal começou é mentira com dois dias de dado.
  // O próprio rodapé da tela já prometia o contrato certo: "fica pronta no
  // dia 1º". 12 é o teto natural: é o que cabe numa "vida no app".
  const meses = useMemo(() => {
    const hoje = new Date();
    // um snapshot só pros 12 meses: as chaves de vida são globais e algumas
    // são grandes (diário), então reler por mês seria 12× o mesmo parse.
    const dados = lerDadosDaVida(user?.id ?? null);
    const out: RetroMes[] = [];
    for (let atras = 1; atras <= 12; atras++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - atras, 1);
      const r = construirRetroMes(d.getFullYear(), d.getMonth(), user?.id ?? null, dados);
      if (r) out.push(r);
    }
    return out;
  }, [user?.id]);

  // Chegou pela notificação/atalho com um mês no endereço? Abre direto nele.
  const [aberto, setAberto] = useState<RetroMes | null>(() => {
    if (!mesPedido) return null;
    const alvo = mesPedido.toLowerCase();
    return meses.find((m) => m.mes.toLowerCase() === alvo) ?? null;
  });

  const abrir = (r: RetroMes, origem: string) => {
    trackEvent("wrapped_open", { month: r.mes, origem });
    setAberto(r);
  };

  if (aberto) {
    return <MonthlyWrapped retro={aberto} onClose={() => setAberto(null)} />;
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-background/85 backdrop-blur border-b border-border
                         pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          onClick={() => navigate("/home")}
          aria-label="Voltar"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">Retrospectiva</h1>
      </header>

      <div className="px-4 py-5 space-y-3 pb-[max(1.5rem,var(--app-safe-bottom))]">
        {meses.length === 0 ? (
          <div className="pt-16 text-center px-6">
            <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-5">
              <Sparkles className="w-7 h-7" />
            </span>
            <p className="text-lg font-bold">Sua primeira retrospectiva tá vindo</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-[300px] mx-auto">
              Marque hábitos, registre gastos, termine um livro — no fim do mês
              tudo isso vira uma retrospectiva sua, pronta pra compartilhar.
            </p>
            <button
              onClick={() => navigate("/home")}
              className="mt-7 rounded-full bg-primary text-primary-foreground font-semibold px-7 py-3 text-sm active:scale-95 transition-transform"
            >
              Começar o mês
            </button>
          </div>
        ) : (
          meses.map((r, i) => (
            <motion.button
              key={`${r.ano}-${r.mes}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
              onClick={() => abrir(r, "lista")}
              className="w-full flex items-center gap-3.5 rounded-2xl p-4 text-left text-white active:scale-[0.99] transition-transform"
              style={{
                background: i === 0
                  ? "linear-gradient(120deg, #1c1917 25%, #D22D80 165%)"
                  : "linear-gradient(120deg, #1c1917 40%, #44403c 160%)",
              }}
            >
              <span className="grid place-items-center w-12 h-12 rounded-xl bg-white/12 text-2xl shrink-0">
                {r.perfil.emoji}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-bold leading-tight">
                  {r.mes}
                  {r.ano !== new Date().getFullYear() && <span className="text-white/45 font-normal"> {r.ano}</span>}
                </span>
                <span className="block text-[12px] text-white/55 mt-0.5 truncate">{RESUMO_DE(r)}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-white/50 shrink-0" />
            </motion.button>
          ))
        )}

        {meses.length > 0 && (
          <p className="text-[11px] text-muted-foreground text-center pt-3 px-6 leading-relaxed">
            A retrospectiva do mês fica pronta no dia 1º. Te avisamos quando chegar.
          </p>
        )}
      </div>
    </div>
  );
};

export default Retrospectiva;
