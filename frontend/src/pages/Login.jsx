import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { useNavigate, Navigate } from "react-router-dom";
import { Cross, Loader2 } from "lucide-react";
import { formatApiErrorDetail } from "@/lib/api";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Login() {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@sgp-pharma.tg");
  const [password, setPassword] = useState("Admin@2026");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
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

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col" data-testid="login-page">
      <div className="absolute inset-0 opacity-30 pointer-events-none"
           style={{
             backgroundImage: 'radial-gradient(circle at 20% 0%, #166534 0%, transparent 40%), radial-gradient(circle at 80% 100%, #14532D 0%, transparent 40%)'
           }} />

      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary rounded-md flex items-center justify-center text-white">
            <Cross className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div className="font-heading font-black text-lg tracking-tight">SGP-Pharma</div>
        </div>
        <LanguageSwitcher />
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="label-tiny mb-3">OPTINET SARLU · Lomé, Togo</div>
            <h1 className="font-heading text-4xl font-black tracking-tight mb-2">{t("welcome")}</h1>
            <p className="text-muted-foreground">{t("tagline")}</p>
          </div>

          <form onSubmit={submit} className="bg-white border border-gray-200 rounded-md p-6 shadow-sm space-y-4" data-testid="login-form">
            <div>
              <label className="label-tiny block mb-2">{t("email")}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="admin@sgp-pharma.tg"
              />
            </div>
            <div>
              <label className="label-tiny block mb-2">{t("password")}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            {err && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2" data-testid="login-error">
                {err}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full bg-primary hover:bg-[#14532D] text-white font-semibold py-2.5 rounded-md transition-all hover:-translate-y-[1px] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("sign_in")}
            </button>
          </form>

          <div className="mt-6 text-xs text-muted-foreground text-center">
            <div>Comptes démo : admin / pharmacien / caissier / magasinier</div>
            <div className="mt-1 opacity-70">Voir <code>/app/memory/test_credentials.md</code></div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 px-8 py-4 text-xs text-muted-foreground text-center">
        © 2026 OPTINET SARLU · SGP-Pharma v1.0
      </footer>
    </div>
  );
}
