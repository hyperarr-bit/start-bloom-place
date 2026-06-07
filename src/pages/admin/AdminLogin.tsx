import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, AlertCircle, Loader2 } from "lucide-react";
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

  // If already logged AND admin, jump to dashboard
  useEffect(() => {
    if (loading || !user) return;
    if (user.email !== ADMIN_EMAIL) return;
    checkIsAdmin(user.id).then(ok => {
      if (ok) navigate("/admin/dashboard", { replace: true });
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

    navigate("/admin/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">Painel Administrativo</h1>
          <p className="text-xs text-zinc-500 mt-1">Área restrita</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-sm rounded-lg py-2.5 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
          </button>
        </form>

        <p className="text-[10px] text-zinc-600 text-center mt-6">
          Acessos são auditados. Tentativas inválidas são registradas.
        </p>
      </div>
    </div>
  );
}
