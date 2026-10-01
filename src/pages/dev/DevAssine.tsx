import { AssineNoApp } from "@/components/site/AssineNoApp";

/**
 * /dev/assine — SÓ NO SERVIDOR DE DESENVOLVIMENTO (some do build). A tela
 * "Assine no app e use aqui também" que a conta logada sem acesso vê na web
 * (TrialBanner / PlanosWeb), pra fotografar sem precisar de uma conta sem
 * pagamento. ?variante=pagina mostra a versão da /planos.
 */
export default function DevAssine() {
  const variante = new URLSearchParams(window.location.search).get("variante") === "pagina" ? "pagina" : "gate";
  return <AssineNoApp variante={variante} />;
}
