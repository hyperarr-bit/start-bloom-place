import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { checkIsAdmin } from "@/lib/admin";
import ResetAnalyticsButton from "@/components/admin/ResetAnalyticsButton";
import {
  Users, LogOut, Shield, Mail, ShieldCheck, TrendingDown, UserPlus, BarChart3,
  BookOpen, CreditCard, Megaphone, GitBranch, LayoutDashboard, AlertCircle, Loader2,
} from "lucide-react";

export const ADMIN_EMAIL = "jv20101958@gmail.com";

const navItems = [
  { to: "/admin/visao-geral", label: "Visão Geral", Icon: LayoutDashboard },
  { to: "/admin/funil-lp", label: "Funil LP", Icon: GitBranch },
  { to: "/admin/onboarding", label: "Onboarding", Icon: BookOpen },
  { to: "/admin/engajamento", label: "Engajamento", Icon: BarChart3 },
  { to: "/admin/receita", label: "Receita", Icon: CreditCard },
  { to: "/admin/aquisicao", label: "Aquisição", Icon: Megaphone },
  { to: "/admin/trials", label: "Trials", Icon: UserPlus },
  { to: "/admin/usuarios", label: "Usuários", Icon: Users },
  { to: "/admin/churn", label: "Churn", Icon: TrendingDown },
  { to: "/admin/retention", label: "Retenção", Icon: ShieldCheck },
  { to: "/admin/emails", label: "E-mails", Icon: Mail },
];

// Login form rendered inline — avoids redirect loops with the layout route
function AdminLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError("Usuário não tem permissão de admin no banco. Verifique user_roles.");
      setSubmitting(false);
      return;
    }

    onSuccess();
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

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const checkAccess = (userId: string) => {
    const timeout = setTimeout(() => setAllowed(false), 8000);
    checkIsAdmin(userId).then(ok => {
      clearTimeout(timeout);
      setAllowed(ok);
    }).catch(() => {
      clearTimeout(timeout);
      setAllowed(false);
    });
    return () => clearTimeout(timeout);
  };

  useEffect(() => {
    if (loading) return;
    if (!user || user.email !== ADMIN_EMAIL) { setAllowed(false); return; }
    return checkAccess(user.id);
  }, [user, loading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAllowed(false);
    navigate("/admin", { replace: true });
  };

  if (loading || allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Verificando…
      </div>
    );
  }

  if (!allowed) {
    return (
      <AdminLoginForm
        onSuccess={() => {
          // Re-read the current user after successful login
          supabase.auth.getUser().then(({ data }) => {
            if (data.user) checkAccess(data.user.id);
          });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      <aside className="md:w-60 md:min-h-screen md:border-r border-zinc-800 bg-zinc-900/50">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-widest uppercase">Admin</span>
        </div>
        <div className="p-3 border-b border-zinc-800">
          <ResetAnalyticsButton onDone={() => window.location.reload()} />
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 gap-1">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors ${
                  isActive ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors mt-auto md:mt-4"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
