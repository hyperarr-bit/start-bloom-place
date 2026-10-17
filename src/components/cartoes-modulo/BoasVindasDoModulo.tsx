import { useLocation } from "react-router-dom";
import { ModuleTip } from "@/components/ModuleTip";
import { cartoesLigados, guardarForcasDaUrl } from "@/lib/tour-home";
import { CartoesDoModulo } from "./CartoesDoModulo";
import { INTROS, MODULOS_SEM_NADA, guardarForcaDaIntro, introLigada } from "@/lib/intro-modulo";
import { IntroDoModulo } from "@/components/intro-modulo/IntroDoModulo";

/**
 * A BOAS-VINDAS DO MÓDULO, UMA PORTA SÓ (1.0.14): com a chave `CARTOES_MODULO`
 * ligada, o módulo abre com os 3 cartões em popup (CartoesDoModulo, carregados pelo
 * registro); desligada, é o ModuleTip "Dicas para começar" de sempre — byte a byte,
 * com as mesmas dicas. Nunca na demo (/preview). Pet, que não tinha dica nenhuma,
 * passa a ter só os cartões (sem `tips`, a reserva é nada).
 *
 * 16/10 (1.0.16, chave `INTRO_MODULO`, ligada no app): com a intro ligada os CARTÕES SAEM DO
 * FLUXO em todos os módulos (o código fica de reserva) — o módulo que TEM intro (lib/intro-modulo:
 * Finanças/Rotina/Saúde guiadas, os outros com estado vazio e captura real) mostra ela; o que não
 * tem (Relações, Pet, Beleza — a tela vazia deles já é o primeiro passo) fica com o "Dicas para
 * começar" de sempre, sem cartão; Treino fica só com a tela dele (MODULOS_SEM_NADA, 17/10). Desligada = o de
 * hoje (travado em src/test/intro-modulo.test.tsx).
 */
export const BoasVindasDoModulo = ({ moduleId, tips, icon }: { moduleId: string; tips?: string[]; icon?: string }) => {
  const { pathname } = useLocation();
  const demo = pathname.startsWith("/preview");
  guardarForcasDaUrl(); // a força do link (`?cartoes=on`) tem que estar guardada ANTES de perguntar se está ligado
  guardarForcaDaIntro();
  const comIntro = !demo && introLigada();
  if (comIntro && INTROS[moduleId]) return <IntroDoModulo moduleId={moduleId} />;
  // 17/10: Treino não ganha nada por cima — a tela vazia dele ("Comece com um modelo pronto") é o 1º passo
  if (comIntro && MODULOS_SEM_NADA.includes(moduleId)) return null;
  const comCartoes = !demo && !comIntro && cartoesLigados();
  if (comCartoes) return <CartoesDoModulo moduleId={moduleId} />;
  if (!tips?.length) return null;
  return <ModuleTip moduleId={moduleId} tips={tips} icon={icon} />;
};
