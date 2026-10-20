import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { isNativeShell } from "@/lib/native-shell";
import { problemaDeCobranca, type ProblemaDeCobranca } from "@/lib/revenuecat";
import { donoDaFolha, nomeLoja } from "@/lib/loja";
import { trackEvent } from "@/lib/analytics";
import {
  avisoFechadoNestaAbertura, avisoVistoNestaAbertura, cobrancaV14Ligada, diasRestantesDaCarencia, fecharAvisoNestaAbertura,
  guiaNaTela, marcarAvisoVistoNestaAbertura, registrarVisibilidadeDoAviso, textoDaCarencia, urlAtualizarPagamento,
} from "@/lib/cobranca-recusada";

/**
 * COBRANÇA RECUSADA NA LOJA (26/09) — o irmão do GracePeriodBanner pro app.
 *
 * 11 testes do iPhone (turmas 21–23/09) quiseram pagar e o cartão foi
 * recusado no fim do teste. A loja segue tentando por semanas; se a pessoa
 * troca o cartão, a cobrança entra (R$ 97,90 cada). Sem aviso ela só via o
 * acesso sumir e achava que o app tinha travado.
 *
 * Fala só da LOJA (Apple/Google) e leva pra tela de pagamento dela — nada
 * de Pix ou cartão nosso, que dentro do app é pagamento fora da loja.
 *
 * 10/10 (1.0.14, ver lib/cobranca-recusada):
 *  · LIGADO: no iPhone o botão abre a página da FORMA DE PAGAMENTO da Apple
 *    (apps.apple.com/account/billing) — a tela de assinaturas, pra onde ia,
 *    não tem cartão nenhum. Android segue na Play. O aviso_cobranca_view leva
 *    `dias_restantes` da carência de 28 dias.
 *  · COBRANCA_V14 (desligada): contador "você tem N dias pra atualizar" e
 *    "Agora não" só até a próxima abertura do app (antes: 24 h em disco —
 *    quem fechava no dia 1 só revia no dia 2, com a carência andando).
 */
const CHAVE_FECHADO = "core-aviso-cobranca-fechado-ate"; // o modo antigo (chave desligada)

const fechadoAgora = () => {
  if (cobrancaV14Ligada()) return avisoFechadoNestaAbertura();
  try { return Number(localStorage.getItem(CHAVE_FECHADO) || 0) > Date.now(); } catch { return false; }
};

/*
 * SEM ACESSO, O AVISO MORA NO ALTO DO BLOQUEIO (28/09). Quando o acesso cai, o
 * gate do TrialBanner (fixed inset-0 z-[310]) cobre a tela inteira e escondia
 * esta faixa: justo quem teve o cartão recusado via "compre de novo por
 * R$ 97,90" em vez de "atualize o pagamento". O gate abre uma VAGA no topo
 * dele e, sem acesso, esta MESMA instância é desenhada lá (portal): empurra o
 * paywall pra baixo, não cobre controle nenhum e continua sendo uma exibição
 * só — um aviso_cobranca_view, sem contar de novo na troca de lugar. Com
 * acesso (carência ligada), segue a faixa de cima, como sempre.
 */
let vagaNoGate: HTMLElement | null = null;
const ouvintesDaVaga = new Set<() => void>();
const registrarVaga = (el: HTMLDivElement | null) => { vagaNoGate = el; ouvintesDaVaga.forEach((f) => f()); };
const assinarVaga = (f: () => void) => { ouvintesDaVaga.add(f); return () => { ouvintesDaVaga.delete(f); }; };
const lerVaga = () => vagaNoGate;

/** A vaga do aviso no topo do bloqueio (TrialBanner). Vazia, não ocupa nada. */
export const VagaDoAvisoCobranca = () => <div ref={registrarVaga} data-vaga="aviso-cobranca" />;

export const AvisoCobrancaRecusada = () => {
  const [p, setP] = useState<ProblemaDeCobranca | null>(null);
  const [fechado, setFechado] = useState(fechadoAgora);
  const vaga = useSyncExternalStore(assinarVaga, lerVaga, () => null);

  useEffect(() => {
    if (!isNativeShell()) return;
    let vivo = true;
    const conferir = () => { void problemaDeCobranca().then((r) => { if (vivo) setP(r); }); };
    conferir();
    // Trocou o cartão na loja e voltou pro app: confere de novo. E, com a chave
    // ligada, voltar depois de 30 min no fundo conta como abertura nova.
    const aoVoltar = () => {
      registrarVisibilidadeDoAviso(document.visibilityState === "visible");
      if (document.visibilityState === "visible") { setFechado(fechadoAgora()); conferir(); }
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { vivo = false; document.removeEventListener("visibilitychange", aoVoltar); };
  }, []);

  /* 1.0.17: com acesso, nunca por cima de uma guia (missão, Montar, festa, tour, folha) — lib/cobranca-recusada.
     O relógio só roda pra quem tem o cartão recusado. */
  const [guia, setGuia] = useState(false);
  const esperaGuia = !!p?.temProblema && !!p?.comAcesso;
  useEffect(() => {
    if (!esperaGuia) { setGuia(false); return; }
    const ver = () => setGuia(guiaNaTela());
    ver();
    const t = window.setInterval(ver, 700);
    return () => window.clearInterval(t);
  }, [esperaGuia]);

  // lido também no render: a 1ª pintura com o problema já respeita a guia (o relógio só re-renderiza quando muda)
  void guia;
  const visivel = isNativeShell() && !!p?.temProblema && !fechado && !(esperaGuia && guiaNaTela());
  const diasRestantes = p ? diasRestantesDaCarencia(p.detectadoEm) : null;
  useEffect(() => {
    // no máximo 1 view por abertura do app (some e volta com as guias sem contar de novo)
    if (!visivel || avisoVistoNestaAbertura()) return;
    marcarAvisoVistoNestaAbertura();
    trackEvent("aviso_cobranca_view", { com_acesso: p!.comAcesso, dias_restantes: diasRestantes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);
  if (!visivel || !p) return null;

  const dono = donoDaFolha();
  const quem = dono.charAt(0).toUpperCase() + dono.slice(1);
  const contador = cobrancaV14Ligada() ? textoDaCarencia(diasRestantes) : null;

  const fechar = () => {
    if (cobrancaV14Ligada()) fecharAvisoNestaAbertura();
    else { try { localStorage.setItem(CHAVE_FECHADO, String(Date.now() + 24 * 3600_000)); } catch { /* noop */ } }
    setFechado(true);
    trackEvent("aviso_cobranca_fechar", { dias_restantes: diasRestantes });
  };

  const faixa = (
    <div role="alert" className="w-full bg-amber-500/10 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0 text-sm">
          <strong className="block">Seu pagamento não passou</strong>
          <span>
            {quem} não conseguiu cobrar o seu plano. Atualize a forma de pagamento na {nomeLoja()} pra{" "}
            {p.comAcesso ? "não perder o acesso." : "voltar a usar o CORE."}
          </span>
          {contador && <span data-testid="carencia-dias" className="block mt-1 font-medium">{contador}</span>}
          <a
            href={urlAtualizarPagamento(p)}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent("aviso_cobranca_click", { dias_restantes: diasRestantes })}
            className="mt-2 inline-flex items-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Atualizar pagamento
          </a>
        </div>
        <button onClick={fechar} aria-label="Agora não" className="p-1 rounded-md text-amber-900/70 dark:text-amber-200/70 hover:bg-amber-500/10">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
  // Sem acesso e com o bloqueio aberto: no alto dele, abaixo da área segura do topo.
  if (!p.comAcesso && vaga) return createPortal(<div className="pt-[var(--app-safe-top)]">{faixa}</div>, vaga);
  return faixa;
};
