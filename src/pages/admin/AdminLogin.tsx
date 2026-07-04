import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { checkIsAdmin } from "@/lib/admin";
import { ADMIN_EMAIL } from "./AdminLayout";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (user.email !== ADMIN_EMAIL) return;
    checkIsAdmin(user.id).then(ok => {
      if (ok) navigate("/admin/funil", { replace: true });
    });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
      setError("Acesso negado.");
      setSubmitting(false);
      return;
    }

    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authErr || !data.user) {
      setError("Credenciais inválidas.");
      setSubmitting(false);
      return;
    }

    const isAdmin = await checkIsAdmin(data.user.id);
    if (!isAdmin) {
      await supabase.auth.signOut();
      setError("Acesso negado.");
      setSubmitting(false);
      return;
    }

    navigate("/admin/funil", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-11 h-11 rounded-2xl bg-accent/10 items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5 text-accent" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Painel administrativo</h1>
          <p className="text-xs text-muted-foreground mt-1">Área restrita</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground font-bold text-sm rounded-lg py-2.5 transition-opacity"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
          </button>
        </form>

        <p className="text-[10px] text-muted-foreground/60 text-center mt-6">
          Acessos são auditados. Tentativas inválidas são registradas.
        </p>
      </div>
    </div>
  );
}
