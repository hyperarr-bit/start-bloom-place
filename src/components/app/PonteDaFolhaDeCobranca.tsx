import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { plataformaApp } from "@/lib/native-shell";
import { informarTelaAtual, ligarPonteDaFolhaDeCobranca } from "@/lib/cobranca-nativa";

/**
 * A ponte entre a rota do React e a folha nativa "Problema de cobrança" do
 * StoreKit (10/10, 1.0.14) — ver lib/cobranca-nativa. Monta uma vez dentro do
 * BrowserRouter; a cada navegação conta ao nativo em que tela está, e ele só
 * exibe a folha na Home. Fora do iPhone não faz nada e não importa nada.
 */
export const PonteDaFolhaDeCobranca = () => {
  const { pathname } = useLocation();
  const iphone = plataformaApp() === "ios";

  useEffect(() => {
    if (!iphone) return;
    let desligar = () => {};
    ligarPonteDaFolhaDeCobranca().then((fn) => { desligar = fn; }).catch(() => {});
    return () => desligar();
  }, [iphone]);

  useEffect(() => {
    if (!iphone) return;
    void informarTelaAtual(pathname);
  }, [iphone, pathname]);

  return null;
};
