import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Pill, Boxes, PackagePlus,
  ClipboardList, Truck, AlertTriangle, BarChart3, Users, ScrollText, LogOut, Cross, Building2, BookOpen,
  Keyboard, Clock, Wifi, Sparkles, History
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import api from "@/lib/api";
import LanguageSwitcher from "./LanguageSwitcher";
import PharmacyLogo from "./PharmacyLogo";

const ALL_LINKS = [
  { to: "/", icon: LayoutDashboard, key: "nav_dashboard", roles: ["super_admin", "admin", "pharmacist", "cashier", "storekeeper"], shortcut: "F9" },
  { to: "/pos", icon: ShoppingCart, key: "nav_pos", roles: ["super_admin", "admin", "pharmacist", "cashier"], shortcut: "F2", highlight: true },
  { to: "/sales", icon: History, key: "nav_sales_history", roles: ["super_admin", "admin", "pharmacist", "cashier"], shortcut: "F8" },
  { to: "/products", icon: Pill, key: "nav_products", roles: ["super_admin", "admin", "pharmacist", "cashier", "storekeeper"], shortcut: "F3" },
  { to: "/stock", icon: Boxes, key: "nav_stock", roles: ["super_admin", "admin", "pharmacist", "storekeeper"] },
  { to: "/reception", icon: PackagePlus, key: "nav_reception", roles: ["super_admin", "admin", "pharmacist", "storekeeper"], shortcut: "F4" },
  { to: "/orders", icon: ClipboardList, key: "nav_orders", roles: ["super_admin", "admin", "pharmacist", "storekeeper"] },
  { to: "/suppliers", icon: Truck, key: "nav_suppliers", roles: ["super_admin", "admin", "pharmacist", "storekeeper"] },
  { to: "/losses", icon: AlertTriangle, key: "nav_losses", roles: ["super_admin", "admin", "pharmacist"] },
  { to: "/reports", icon: BarChart3, key: "nav_reports", roles: ["super_admin", "admin", "pharmacist"] },
  { to: "/users", icon: Users, key: "nav_users", roles: ["super_admin", "admin"] },
  { to: "/pharmacy-setup", icon: Building2, key: "nav_pharmacy_setup", roles: ["super_admin", "admin"] },
  { to: "/pharmacies", icon: Building2, key: "nav_pharmacies", roles: ["super_admin"] },
  { to: "/audit", icon: ScrollText, key: "nav_audit", roles: ["super_admin", "admin", "pharmacist"] },
  { to: "/documentation", icon: BookOpen, key: "nav_documentation", roles: ["super_admin", "admin"] },
];

const ROLE_LABEL = {
  super_admin: "super_admin",
  admin: "admin",
  pharmacist: "pharmacist",
  cashier: "cashier",
  storekeeper: "storekeeper"
};

export default function Layout({ children }) {
  const { user, pharmacy, logout, isSuperAdmin } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [timeStr, setTimeStr] = useState("");
  const [alertsCount, setAlertsCount] = useState({ expiring: 0, lowStock: 0 });
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Live digital clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch quick alert badges for operators
  useEffect(() => {
    if (!user) return;
    api.get("/dashboard").then((r) => {
      if (r.data?.alerts) {
        setAlertsCount({
          expiring: (r.data.alerts.expired || 0) + (r.data.alerts.expiring_30 || 0),
          lowStock: r.data.alerts.low_stock_count || 0
        });
      }
    }).catch(() => {});
  }, [location.pathname, user]);

  // Global Function key shortcuts for operators
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in a textarea or modal input unless it's a function key
      if (e.key === "F2") {
        e.preventDefault();
        if (user && ["super_admin", "admin", "pharmacist", "cashier"].includes(user.role)) {
          navigate("/pos");
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        if (user && ["super_admin", "admin", "pharmacist", "cashier"].includes(user.role)) {
          navigate("/sales");
        }
      } else if (e.key === "F3") {
        e.preventDefault();
        navigate("/products");
      } else if (e.key === "F4") {
        e.preventDefault();
        if (user && ["super_admin", "admin", "pharmacist", "storekeeper"].includes(user.role)) {
          navigate("/reception");
        }
      } else if (e.key === "F9") {
        e.preventDefault();
        navigate("/");
      } else if (e.key === "F1") {
        e.preventDefault();
        setShowShortcutsModal((s) => !s);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user, navigate]);

  const links = ALL_LINKS.filter((l) => l.roles.includes(user?.role));

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-screen z-30 shadow-[1px_0_4px_rgba(0,0,0,0.03)] print:hidden" data-testid="app-sidebar">
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-b from-emerald-50/40 to-white">
          <div className="flex items-center gap-3">
            <PharmacyLogo
              logoUrl={pharmacy?.logo_data || pharmacy?.logo_url}
              name={pharmacy?.name || "SGP-Pharma"}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="font-heading font-black text-sm leading-tight tracking-tight text-slate-900 truncate">
                {pharmacy?.name || "SGP-Pharma"}
              </div>
              <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                {pharmacy?.city ? `${pharmacy.city}, ${pharmacy.country || ""}` : "Gestion d'Officine"}
              </div>
            </div>
          </div>

          {isSuperAdmin() && (
            <div className="mt-3 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs shadow-xs" data-testid="super-admin-banner">
              <div className="font-bold text-amber-900 flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Mode Super Admin
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
          {links.map((l) => {
            const hasAlert = l.to === "/stock" && alertsCount.expiring > 0;
            const hasStockAlert = l.to === "/products" && alertsCount.lowStock > 0;

            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                data-testid={`nav-link-${l.key.replace("nav_", "")}`}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group ${
                    isActive
                      ? "bg-primary text-white shadow-sm shadow-emerald-900/20 font-bold"
                      : l.highlight
                      ? "bg-emerald-50/60 text-emerald-900 border border-emerald-200/60 hover:bg-emerald-100/70"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-2.5 truncate">
                      <l.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : l.highlight ? "text-primary font-bold" : "text-slate-500 group-hover:text-slate-800"}`} />
                      <span className="truncate">{t(l.key)}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {hasAlert && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? "bg-white text-red-600" : "bg-red-500 text-white"}`}>
                          {alertsCount.expiring}
                        </span>
                      )}
                      {hasStockAlert && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? "bg-white text-amber-700" : "bg-amber-500 text-white"}`}>
                          {alertsCount.lowStock}
                        </span>
                      )}
                      {l.shortcut && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          isActive ? "bg-emerald-800/50 text-emerald-100" : "bg-slate-200 text-slate-600 group-hover:bg-slate-300"
                        }`}>
                          {l.shortcut}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer info & operator profile */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="text-[11px] text-slate-500 hover:text-primary font-medium flex items-center gap-1 px-1.5 py-1 rounded hover:bg-slate-200/60"
              title="Aide raccourcis clavier"
            >
              <Keyboard className="w-3.5 h-3.5 text-primary" /> Raccourcis (F1)
            </button>
            <LanguageSwitcher />
          </div>

          <div className="px-2 py-2 bg-white rounded-md border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 truncate" data-testid="current-user-name">
                {user?.name}
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                <Wifi className="w-2.5 h-2.5 text-emerald-600" /> {t("online")}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              {t(ROLE_LABEL[user?.role] || "user")}
            </div>
          </div>

          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> {t("logout")}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 min-h-screen flex flex-col print:ml-0 print:m-0 print:p-0 print:w-full">
        {/* Top Operator Quickbar */}
        <header className="bg-white border-b border-slate-200/80 px-6 py-2 flex items-center justify-between sticky top-0 z-20 shadow-2xs print:hidden">
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5 text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md font-mono text-[11px]">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{timeStr}</span>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Accès rapide :</span>
              {user && ["super_admin", "admin", "pharmacist", "cashier"].includes(user.role) && (
                <button onClick={() => navigate("/pos")} className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-semibold text-[11px] flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3 text-primary" /> Caisse <kbd className="bg-white px-1 rounded text-[9px] border">F2</kbd>
                </button>
              )}
              <button onClick={() => navigate("/products")} className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] flex items-center gap-1">
                <Pill className="w-3 h-3 text-slate-500" /> Produits <kbd className="bg-white px-1 rounded text-[9px] border">F3</kbd>
              </button>
              {user && ["super_admin", "admin", "pharmacist", "storekeeper"].includes(user.role) && (
                <>
                  <button onClick={() => navigate("/stock")} className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] flex items-center gap-1">
                    <Boxes className="w-3 h-3 text-slate-500" /> Stock
                  </button>
                  <button onClick={() => navigate("/reception")} className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-semibold text-[11px] flex items-center gap-1">
                    <PackagePlus className="w-3 h-3 text-primary" /> Réception <kbd className="bg-white px-1 rounded text-[9px] border">F4</kbd>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Connecté en tant que</div>
              <div className="text-xs font-bold text-slate-800">{user?.name} · <span className="text-primary font-semibold">{t(ROLE_LABEL[user?.role] || "")}</span></div>
            </div>
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 p-6 md:p-8 print:p-0 print:m-0 print:w-full">
          {children}
        </main>
      </div>

      {/* Raccourcis Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-base text-slate-900">Raccourcis Clavier Opérateurs</h3>
              </div>
              <button onClick={() => setShowShortcutsModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-100">
                <span className="font-medium text-slate-700">Ouvrir la Caisse / POS</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-emerald-700">F2</kbd>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-100">
                <span className="font-medium text-slate-700">Rechercher / Catalogue Produits</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">F3</kbd>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-100">
                <span className="font-medium text-slate-700">Réceptionner du Stock / Facture</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">F4</kbd>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-100">
                <span className="font-medium text-slate-700">Tableau de bord</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">F9</kbd>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-100">
                <span className="font-medium text-slate-700">Valider l'encaissement en caisse</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-primary">Ctrl + Entrée</kbd>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-100">
                <span className="font-medium text-slate-700">Imprimer le ticket de caisse</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">Ctrl + P</kbd>
              </div>
            </div>

            <button
              onClick={() => setShowShortcutsModal(false)}
              className="mt-5 w-full py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-emerald-800 transition-colors"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
