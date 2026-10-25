import { useEffect, useState } from "react";
import { checkIsAdmin } from "@/lib/admin";
import {
  adminHomeNovaConhecido, guardarAdmin, homeNovaLigada, homeNovaPrecisaDeAdmin, informarAdminHomeNova, lerAdminGuardado, modoHomeNova,
  type ModoHomeNova,
} from "@/lib/home-nova";

/**
 * "A Home nova está ligada pra esta conta?" (lib/home-nova). Só no modo "admin" existe trabalho: a checagem
 * de admin do /admin (user_roles, lib/admin), feita UMA vez por abertura — compartilhada entre quem pergunta
 * (a Home e a barra de vidro) — e guardada no aparelho pra conta (`core-home-nova-admin`): na abertura
 * seguinte a resposta guardada vale na hora (a Home nem espera) e a consulta só confirma por trás.
 * `pronta` = dá pra decidir (a Home segura a tela em branco de sempre enquanto não dá: só na 1ª vez do modo admin).
 */
let consulta: { userId: string; promessa: Promise<boolean> } | null = null;
/** Só testes: esquece a consulta desta "abertura". */
export const _zerarConsultaAdmin = (): void => { consulta = null; };

const consultarAdmin = (userId: string): Promise<boolean> => {
  if (consulta && consulta.userId === userId) return consulta.promessa;
  const promessa = checkIsAdmin(userId).then((ok) => { guardarAdmin(userId, ok); return ok; }).catch(() => { informarAdminHomeNova(false); return false; });
  consulta = { userId, promessa };
  return promessa;
};

export function useHomeNova(user: { id?: string } | null | undefined): { ligada: boolean; pronta: boolean; modo: ModoHomeNova } {
  const modo = modoHomeNova();
  const precisaAdmin = homeNovaPrecisaDeAdmin();
  const [admin, setAdmin] = useState<boolean | null>(() => adminHomeNovaConhecido() ?? lerAdminGuardado(user?.id));

  useEffect(() => {
    if (!precisaAdmin || !user?.id) return;
    const guardado = adminHomeNovaConhecido() ?? lerAdminGuardado(user.id);
    if (guardado !== null) { informarAdminHomeNova(guardado); setAdmin(guardado); }
    let vivo = true;
    consultarAdmin(user.id).then((ok) => { if (vivo) setAdmin(ok); });
    return () => { vivo = false; };
  }, [precisaAdmin, user?.id]);

  const pronta = !precisaAdmin || admin !== null;
  return { ligada: pronta && homeNovaLigada(admin), pronta, modo };
}
