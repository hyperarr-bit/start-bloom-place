import { useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Mail, KeyRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { PwaInstallCard } from "@/components/PwaInstallCard";

/** /bem-vindo — recepção de quem PAGOU (15/07). Destino do e-mail de
 *  boas-vindas do cakto-webhook (?e=<e-mail da compra>). Uma função só:
 *  matar o reembolso "paguei e não consegui entrar" repetindo, na tela,
 *  qual e-mail e qual senha usar. Sem prefill no /entrar (decisão do dono). */
const BemVindo = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const email = useMemo(() => {
    const e = (params.get("e") ?? "").trim();
    return e.includes("@") ? e : null;
  }, [params]);

  useEffect(() => {
    trackEvent("welcome_screen_view", { has_email: !!email, logged: !!user });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 grid place-items-center">
            <CheckCircle2 className="w-9 h-9 text-emerald-500" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-center text-foreground leading-tight">
          Pagamento confirmado!
        </h1>
        <p className="text-center text-muted-foreground mt-2 mb-7">
          Seu acesso vitalício ao CORE tá liberado. Falta só entrar — leva 30 segundos.
        </p>

        {!loading && user ? (
          // Já logado (comprou dentro do app): manda pra dentro e aproveita o
          // pico de entusiasmo pós-compra pra convidar a instalar o app.
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-foreground text-center mb-4">
                Você já está com a conta <strong>{user.email}</strong> aberta — bora usar.
              </p>
              <Button className="w-full h-12 rounded-xl text-base" onClick={() => navigate("/home")}>
                Abrir meu CORE <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <PwaInstallCard variant="welcome" />
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center shrink-0">
                  <Mail className="w-[18px] h-[18px] text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Use exatamente este e-mail</p>
                  {email ? (
                    <p className="mt-1 px-3 py-2 rounded-lg bg-muted font-mono text-sm text-foreground break-all">
                      {email}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      O mesmo e-mail que você usou na compra.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center shrink-0">
                  <KeyRound className="w-[18px] h-[18px] text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">E a senha que você criou no cadastro</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Criou a conta com o Google? Então toque em <strong>“Continuar com Google”</strong> — sem senha.
                  </p>
                </div>
              </div>
            </div>

            <Button
              className="w-full h-12 rounded-xl text-base mt-5"
              onClick={() => {
                trackEvent("welcome_screen_login_click");
                navigate("/entrar");
              }}
            >
              Entrar no CORE <ArrowRight className="w-4 h-4 ml-1" />
            </Button>

            <p className="text-center mt-4 text-sm text-muted-foreground">
              Esqueceu a senha?{" "}
              <Link to="/reset-password" className="font-semibold text-foreground underline underline-offset-2">
                Redefina em 30 segundos
              </Link>
            </p>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground mt-7">
          Qualquer dificuldade, responde o e-mail de boas-vindas que a gente resolve com você.
        </p>
      </motion.div>
    </div>
  );
};

export default BemVindo;
