import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { useNavigate, Navigate } from "react-router-dom";
import { Cross, Loader2, Eye, EyeOff, ShieldCheck, UserCheck, ShoppingCart, Boxes, Sparkles } from "lucide-react";
import { formatApiErrorDetail } from "@/lib/api";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const DEMO_ACCOUNTS = [
  { role: "Caissier", email: "caissier@sgp-pharma.tg", pass: "Cash@2026", icon: ShoppingCart, color: "bg-blue-50 text-blue-700 border-blue-200" },
  { role: "Pharmacien", email: "pharmacien@sgp-pharma.tg", pass: "Pharma@2026", icon: UserCheck, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { role: "Magasinier", email: "magasinier@sgp-pharma.tg", pass: "Store@2026", icon: Boxes, color: "bg-purple-50 text-purple-700 border-purple-200" },
  { role: "Admin", email: "admin@sgp-pharma.tg", pass: "Admin@2026", icon: ShieldCheck, color: "bg-amber-50 text-amber-700 border-amber-200" },
  { role: "Super Admin", email: "optinet@sgp-pharma.tg", pass: "Optinet@2026", icon: Sparkles, color: "bg-rose-50 text-rose-700 border-rose-200" },
];

export default function Login() {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@sgp-pharma.tg");
  const [password, setPassword] = useState("Admin@2026");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || t("invalid_credentials"));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (acc) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setErr("");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between" data-testid="login-page">
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 0%, #166534 0%, transparent 40%), radial-gradient(circle at 80% 100%, #14532D 0%, transparent 40%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-900/20 ring-2 ring-primary/20">
            <Cross className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-heading font-black text-xl tracking-tight text-slate-900 leading-none">
              SGP-Pharma
            </div>
            <div className="text-[10px] tracking-widest uppercase text-emerald-800/70 font-semibold mt-0.5">
              OPTINET · Lomé
            </div>
          </div>
        </div>
        <LanguageSwitcher />
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-block text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-full uppercase tracking-wider mb-2">
              Système de Gestion de Pharmacie (SGP)
            </div>
            <h1 className="font-heading text-3xl font-black tracking-tight text-slate-900 mb-1">
              {t("welcome")}
            </h1>
            <p className="text-sm text-slate-500">{t("tagline")}</p>
          </div>

          {/* Login Card */}
          <form
            onSubmit={submit}
            className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-lg shadow-slate-200/50 space-y-4"
            data-testid="login-form"
          >
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                {t("email")}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="ex: caissier@sgp-pharma.tg"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                {t("password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {err && (
              <div
                className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 flex items-center gap-2"
                data-testid="login-error"
              >
                <span>⚠</span>
                <span>{err}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full bg-primary hover:bg-[#14532D] text-white font-bold py-3 rounded-lg shadow-sm transition-all hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("sign_in")}
            </button>
          </form>

          {/* Quick Demo Accounts for Operators */}
          <div className="mt-6 bg-white/80 backdrop-blur-xs border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>{t("quick_login")}</span>
              <span className="text-[10px] text-slate-400 font-normal">Cliquez pour tester un rôle</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickLogin(acc)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95 ${acc.color} ${
                    email === acc.email ? "ring-2 ring-primary ring-offset-1" : ""
                  }`}
                >
                  <acc.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{acc.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 px-8 py-4 text-xs text-slate-400 text-center border-t border-slate-200/60 bg-white/50 print:hidden">
        © 2026 PharmaLife Hope v1.0 · Système de Gestion de Pharmacie · Tous droits réservés
      </footer>
    </div>
  );
}
