import { useEffect, useState } from "react";
import { checkIsAdmin } from "@/lib/admin";
import {
  EVENTO_ORIGEM_HOME_NOVA, adminHomeNovaConhecido, guardarAdmin, homeNovaLigada, homeNovaPrecisaDeAdmin, informarAdminHomeNova, lerAdminGuardado,
  modoHomeNova, origemConhecida, type ModoHomeNova,
} from "@/lib/home-nova";

/**
 * "A Home nova está ligada pra esta conta?" (lib/home-nova). Só no modo "admin" existe trabalho: a checagem
 * de admin do /admin (user_roles, lib/admin), feita UMA vez por abertura — compartilhada entre quem pergunta
 * (a Home e a barra de vidro) — e guardada no aparelho pra conta (`core-home-nova-admin`).
 *
 * NUNCA TELA EM BRANCO (revisor 26/10): a chave é global no RevenueCat — em "admin", TODO cliente da versão faz
 * a checagem na 1ª abertura. Enquanto ela não responde (ou se não responder em TEMPO_LIMITE_ADMIN_MS), a resposta
 * vale "não é admin": a Home de hoje aparece na hora, como sempre. Só quem recebe "admin" troca pra nova — e a
 * Home (pages/Home) troca sem piscar, depois de carregar o pedaço; na abertura seguinte a resposta guardada vale
 * de cara. Uma resposta atrasada (depois do tempo limite) ainda vale: o dono numa rede lenta vê a nova chegar;
 * pro cliente ("não") nada muda. Erro de rede = "não" nesta abertura, sem guardar (a próxima abertura pergunta de novo).
 */
export const TEMPO_LIMITE_ADMIN_MS = 2500;
let tempoLimite = TEMPO_LIMITE_ADMIN_MS;

type Consulta = { userId: string; resposta: boolean | null; ouvintes: Set<(ok: boolean) => void> };
let consulta: Consulta | null = null;
/** Só testes: esquece a consulta desta "abertura" (e volta o tempo limite padrão). */
export const _zerarConsultaAdmin = (): void => { consulta = null; tempoLimite = TEMPO_LIMITE_ADMIN_MS; };
/** Só testes: encurta o tempo limite. */
export const _definirTempoLimiteAdmin = (ms: number): void => { tempoLimite = ms; };

/** Ouve a resposta da checagem desta abertura (1 consulta por conta; pode avisar 2x: "não" pelo tempo limite e um "sim" atrasado). */
function ouvirAdmin(userId: string, ouvinte: (ok: boolean) => void): () => void {
  if (!consulta || consulta.userId !== userId) {
    const c: Consulta = { userId, resposta: null, ouvintes: new Set() };
    consulta = c;
    const avisar = (ok: boolean) => { c.resposta = ok; c.ouvintes.forEach((f) => f(ok)); };
    const limite = setTimeout(() => { if (c.resposta === null) { informarAdminHomeNova(false); avisar(false); } }, tempoLimite);
    checkIsAdmin(userId)
      .then((ok) => { clearTimeout(limite); guardarAdmin(userId, ok); if (c.resposta !== ok) avisar(ok); })
      .catch(() => { clearTimeout(limite); informarAdminHomeNova(false); if (c.resposta === null) avisar(false); });
  }
  const c = consulta;
  c.ouvintes.add(ouvinte);
  if (c.resposta !== null) ouvinte(c.resposta);
  return () => { c.ouvintes.delete(ouvinte); };
}

export function useHomeNova(user: { id?: string } | null | undefined): { ligada: boolean; modo: ModoHomeNova } {
  const modo = modoHomeNova();
  const precisaAdmin = homeNovaPrecisaDeAdmin();
  const [admin, setAdmin] = useState<boolean | null>(() => adminHomeNovaConhecido() ?? lerAdminGuardado(user?.id));

  useEffect(() => {
    if (!precisaAdmin || !user?.id) return;
    const guardado = adminHomeNovaConhecido() ?? lerAdminGuardado(user.id);
    if (guardado !== null) { informarAdminHomeNova(guardado); setAdmin(guardado); }
    return ouvirAdmin(user.id, (ok) => setAdmin(ok));
  }, [precisaAdmin, user?.id]);

  // 26/10 (modo "novas"): a origem da conta (lib/home-nova) pode ficar conhecida depois do 1º render — relê no aviso
  const [, setOrigemVersao] = useState(0);
  useEffect(() => {
    const reler = () => setOrigemVersao((v) => v + 1);
    window.addEventListener(EVENTO_ORIGEM_HOME_NOVA, reler);
    return () => window.removeEventListener(EVENTO_ORIGEM_HOME_NOVA, reler);
  }, []);

  // sem resposta ainda (null), a decisão é "não": a Home de hoje, na hora — nunca a tela em branco
  return { ligada: homeNovaLigada(admin, origemConhecida(user?.id)), modo };
}
