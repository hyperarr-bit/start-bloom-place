import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { construirRetroMes, lerDadosDaVida, nomeDaPessoa, type Leitor, type RetroMes } from "@/lib/retrospectiva";
import { MonthlyWrapped } from "@/components/wrapped/MonthlyWrapped";
import { CHAVE_DO_TEMA, lerTema, perfilEmFrase, type TemaDaRetro } from "@/components/wrapped/temas";
import { foilCss } from "@/components/wrapped/prancheta";
import { Espiral, Fita, P3, creme, kicker, linho, relevo, serif, vinheta } from "@/components/wrapped/pecas-planner";

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
 *
 * (26/09) Os dados vêm do STORE (useUserData), não do localStorage, e os
 * meses são RECALCULADOS quando ele carrega ou muda: no dia 1º, aberto pela
 * notificação com o app frio, o cálculo único da montagem acontecia antes da
 * carga do servidor e do arquivamento do mês — e setembro saía sem Finanças.
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
  if (partes.length === 0 && v && v.humorMedio !== null) partes.push(`humor ${v.humorMedio.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/5`); // vírgula decimal (26/09)
  if (partes.length === 0 && v && v.copos > 0) partes.push(plural(v.copos, "copo d'água", "copos d'água"));
  if (partes.length === 0 && r.financas) partes.push("suas finanças do mês");
  return partes.slice(0, 3).join(" · ") || "seu mês em números";
};

const idDe = (r: RetroMes) => `${r.ano}-${r.mesIdx}`;

/** (26/09, temas) o fundo da espera = o da capa do tema salvo (a espera emenda na capa sem piscar). */
const FUNDO_DA_ESPERA: Record<TemaDaRetro, { fundo: string; spinner: string }> = {
  paginas: { fundo: P3.grafite, spinner: "rgba(230,193,92,.8)" },
  edicao: { fundo: "#1b1b20", spinner: "rgba(246,241,231,.7)" },
  recortes: { fundo: "#d5b787", spinner: "rgba(35,35,39,.6)" },
};

/**
 * Chaves que passam de 50KB com facilidade: a hidratação não as grava no
 * localStorage, e se a carga do servidor falhou elas não estão no store.
 * Busca UMA vez por sessão, só as que faltam (26/09).
 */
const CHAVES_PESADAS = ["journal-entries", "lib-books", "mood-log", "rotina-habit-log"];
const jaBuscadas = new Set<string>();

/** Quanto esperar pelo mês pedido antes de desistir e mostrar a lista. */
const ESPERA_MAXIMA_MS = 8000;

const Retrospectiva = () => {
  const { user } = useAuth();
  const { get, loaded, fetchKey } = useUserData();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mesPedido = params.get("mes");
  const uid = user?.id ?? null;

  // Últimos 12 meses FECHADOS, do mais recente pro mais antigo. Começa em
  // `atras = 1` de propósito (02/09, bug visto pelo dono): com 0, o mês
  // CORRENTE entrava na lista e a capa dizia "Setembro fechou" no dia 2 —
  // retrospectiva de mês que mal começou é mentira com dois dias de dado.
  // O próprio rodapé da tela já prometia o contrato certo: "fica pronta no
  // dia 1º". 12 é o teto natural: é o que cabe numa "vida no app".
  //
  // (26/09) `get` muda de identidade a cada mudança do store (e quando ele
  // termina de carregar): é a "versão dos dados" que faz os meses serem
  // refeitos. Mês com o MESMO conteúdo devolve o MESMO objeto, pra
  // retrospectiva aberta não re-renderizar a cada gravação.
  const cache = useRef(new Map<string, { json: string; r: RetroMes }>());
  const meses = useMemo(() => {
    const ler: Leitor = (chave) => get<unknown>(chave, undefined);
    const hoje = new Date();
    // um snapshot só pros 12 meses: as chaves de vida são globais e algumas
    // são grandes (diário), então reler por mês seria 12× o mesmo parse.
    const dados = lerDadosDaVida(ler);
    const out: RetroMes[] = [];
    for (let atras = 1; atras <= 12; atras++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - atras, 1);
      const r = construirRetroMes(d.getFullYear(), d.getMonth(), uid, dados, { ler, agora: hoje });
      if (!r) continue;
      const json = JSON.stringify(r);
      const antes = cache.current.get(idDe(r));
      if (antes && antes.json === json) out.push(antes.r);
      else {
        cache.current.set(idDe(r), { json, r });
        out.push(r);
      }
    }
    return out;
    // `loaded` de propósito: o fim da carga refaz os meses mesmo num provider cujo `get` não mude
  }, [uid, get, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chave pesada que não veio (carga do servidor falhou): busca sob demanda.
  const fetchKeyRef = useRef(fetchKey);
  fetchKeyRef.current = fetchKey;
  const getRef = useRef(get);
  getRef.current = get;
  useEffect(() => {
    if (!loaded || !uid) return;
    for (const chave of CHAVES_PESADAS) {
      const marca = `${uid}:${chave}`;
      if (jaBuscadas.has(marca) || getRef.current<unknown>(chave, undefined) !== undefined) continue;
      jaBuscadas.add(marca);
      void fetchKeyRef.current(chave).catch(() => null);
    }
  }, [loaded, uid]);

  // Qual mês está aberto é um ID, não o objeto: o objeto é refeito quando o
  // store muda, e a retrospectiva aberta acompanha.
  const [abertoId, setAbertoId] = useState<string | null>(null);
  // Chegou pela notificação/atalho com um mês no endereço? Abre direto nele —
  // assim que ele existir nos dados (no dia 1º, com o app frio, os dados
  // chegam depois da primeira pintura).
  const [pedidoEncerrado, setPedidoEncerrado] = useState(!mesPedido);
  const [desistiu, setDesistiu] = useState(false);
  const alvo = mesPedido?.toLowerCase() ?? null;
  const doPedido = !pedidoEncerrado && alvo ? meses.find((m) => m.mes.toLowerCase() === alvo) ?? null : null;
  const esperandoPedido = !pedidoEncerrado && !doPedido && !loaded && !desistiu;

  useEffect(() => {
    if (!esperandoPedido) return;
    const t = window.setTimeout(() => setDesistiu(true), ESPERA_MAXIMA_MS);
    return () => window.clearTimeout(t);
  }, [esperandoPedido]);
  // Carregou (ou cansou de esperar) e o mês não tem nada: fica a lista, e o
  // pedido não abre sozinho mais tarde por cima dela.
  useEffect(() => {
    if (!pedidoEncerrado && !doPedido && (loaded || desistiu)) setPedidoEncerrado(true);
  }, [pedidoEncerrado, doPedido, loaded, desistiu]);

  // (26/09) quem abria pela notificação não gerava wrapped_open — o funil da
  // notificação não tinha o passo "abriu".
  const contouPedido = useRef(false);
  useEffect(() => {
    if (!doPedido || contouPedido.current) return;
    contouPedido.current = true;
    // (26/09, temas) com o tema salvo: quem abre em qual pele
    trackEvent("wrapped_open", { month: doPedido.mes, origem: params.get("origem") || "notif", tema: lerTema(getRef.current<unknown>(CHAVE_DO_TEMA, null)) });
  }, [doPedido, params]);

  const abrir = (r: RetroMes, origem: string) => {
    trackEvent("wrapped_open", { month: r.mes, origem, tema: lerTema(get<unknown>(CHAVE_DO_TEMA, null)) });
    setPedidoEncerrado(true);
    setAbertoId(idDe(r));
  };

  const aberto = doPedido ?? (abertoId ? meses.find((m) => idDe(m) === abertoId) ?? null : null);
  // "O setembro de Ana" (26/09, redesenho): o nome que a pessoa deu, nunca o e-mail
  const nome = nomeDaPessoa((chave) => get<unknown>(chave, undefined), user?.user_metadata);

  if (aberto) {
    return (
      <MonthlyWrapped
        retro={aberto}
        nome={nome}
        onClose={() => {
          setPedidoEncerrado(true);
          setAbertoId(null);
        }}
      />
    );
  }

  if (esperandoPedido) {
    // mesmo fundo da capa (a do tema salvo): a espera emenda na retrospectiva sem piscar a lista
    const espera = FUNDO_DA_ESPERA[lerTema(get<unknown>(CHAVE_DO_TEMA, null))];
    return (
      <div
        className="fixed inset-0 z-[400] grid place-items-center"
        style={{ background: espera.fundo }}
        aria-busy="true"
        aria-label="Carregando a retrospectiva"
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: espera.spinner }} />
      </div>
    );
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
        {meses.length === 0 && !loaded ? (
          <div className="pt-24 grid place-items-center" aria-busy="true">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : meses.length === 0 ? (
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
          // (26/09, temas) cada mês é uma lombada do planner (a pele do tema padrão):
          // linho grafite, espiral, o mês em foil; o mais recente leva o marcador
          meses.map((r, i) => (
            <motion.button
              key={idDe(r)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
              onClick={() => abrir(r, "lista")}
              className="relative block w-full overflow-hidden text-left active:scale-[0.99] transition-transform"
              style={{ borderRadius: 14, background: P3.mesa, color: P3.creme }}
            >
              <span aria-hidden style={{ position: "absolute", left: 12, top: 0, right: 0, bottom: 0, borderRadius: "3px 14px 14px 3px", ...linho() }} />
              <span aria-hidden style={{ ...vinheta, left: 12 }} />
              <Espiral n={3} passo={26} topo={10} esquerda={12} w={10} h={18} caixa={24} />
              {i === 0 && <Fita style={{ right: 48, top: -4, height: 44 }} largura={10} bico={6} />}
              <span className="relative flex items-center gap-3" style={{ padding: "13px 14px 14px 32px" }}>
                <span className="flex-1 min-w-0">
                  {/* mês curto (pouco dado) não tem perfil — 26/09 */}
                  <span className="block truncate" style={kicker(9)}>{r.curta ? "Edição curta" : perfilEmFrase(r.perfil.name)}</span>
                  <span className="block" style={{ ...serif, fontSize: 25, lineHeight: 1.05, marginTop: 2 }}>
                    <span style={{ ...foilCss, paddingRight: 3 }}>{r.mes}</span>
                    {r.ano !== new Date().getFullYear() && <span style={{ ...relevo, fontFamily: "inherit", fontStyle: "normal", fontSize: 13, fontWeight: 900, letterSpacing: ".06em" }}> {r.ano}</span>}
                  </span>
                  <span className="block truncate" style={{ fontSize: 12, color: creme(0.55), marginTop: 2 }}>{RESUMO_DE(r)}</span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: P3.ouroTxt }} />
              </span>
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
