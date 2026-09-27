/**
 * PROVA SOCIAL VIVA (27/09, funil ROI 2).
 *
 * A edge function `prova-social` existe desde 29/07 e nunca foi usada: ela
 * conta, no banco, quem já comprou o acesso vitalício pela web (linhas de
 * `subscriptions` com os tickets 14,90 / 27,90 / 97,90, fora as contas +qa).
 * O paywall passa a mostrar esse número — preciso converte mais que redondo
 * (Schindler & Yalch 2006) e é o que já aconteceu, não promessa.
 *
 * Regras, e por que cada uma existe:
 *  · chamada UMA vez por carregamento de página, com cache em memória — o
 *    número não muda decisão nenhuma de 5 em 5 minutos, e a função já cacheia
 *    do lado dela;
 *  · falhou, demorou (> 6 s), veio 0 ou veio abaixo de MINIMO → `null`, e a
 *    tela mostra o texto fixo de sempre ("+1000 pessoas aprovaram o CORE").
 *    "0 pessoas" numa tela de venda é pior que nenhum número; abaixo de 1000
 *    contradiz o "+1000" que as outras telas do site já dizem (medido em
 *    1.058 em 10/08 e só cresceu);
 *  · o texto que usa o número tem que ser verdade PRA ESSA contagem: são
 *    pessoas que já garantiram o acesso vitalício — não "avaliaram", não
 *    "usam todo dia".
 *  · `dia` (compras nas últimas 24 h) vem junto mas NÃO é exibido: o dono
 *    vetou número pequeno de janela curta (29/07) — envelhece e desconverte.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProvaSocial = { total: number; dia: number };

/** Abaixo disso o número vivo não sobe pra tela (ver cabeçalho). */
export const PROVA_SOCIAL_MINIMO = 1000;
const PRAZO_MS = 6000;

let cache: ProvaSocial | null = null;
let emVoo: Promise<ProvaSocial | null> | null = null;

/** 1382 → "1.382" (pt-BR). */
export const formatarPessoas = (n: number): string => new Intl.NumberFormat("pt-BR").format(n);

export function buscarProvaSocial(): Promise<ProvaSocial | null> {
  if (cache) return Promise.resolve(cache);
  if (emVoo) return emVoo;
  emVoo = (async () => {
    try {
      const controle = typeof AbortController !== "undefined" ? new AbortController() : null;
      const prazo = controle ? setTimeout(() => controle.abort(), PRAZO_MS) : null;
      const { data, error } = await supabase.functions.invoke("prova-social", {
        body: {},
        ...(controle ? { signal: controle.signal } : {}),
      });
      if (prazo) clearTimeout(prazo);
      if (error) return null;
      const total = Math.floor(Number((data as { total?: unknown } | null)?.total));
      const dia = Math.max(0, Math.floor(Number((data as { dia?: unknown } | null)?.dia)) || 0);
      if (!Number.isFinite(total) || total < PROVA_SOCIAL_MINIMO) return null;
      cache = { total, dia };
      return cache;
    } catch {
      return null;
    } finally {
      emVoo = null;
    }
  })();
  return emVoo;
}

/** Devolve o número vivo quando (e se) ele chegar; até lá, `null` = texto fixo. */
export function useProvaSocial(ligado = true): ProvaSocial | null {
  const [prova, setProva] = useState<ProvaSocial | null>(cache);
  useEffect(() => {
    if (!ligado || cache) return;
    let vivo = true;
    buscarProvaSocial().then((p) => { if (vivo && p) setProva(p); });
    return () => { vivo = false; };
  }, [ligado]);
  return prova;
}

/** Só pra teste: esquece o cache entre casos. */
export const _limparProvaSocial = () => { cache = null; emVoo = null; };
