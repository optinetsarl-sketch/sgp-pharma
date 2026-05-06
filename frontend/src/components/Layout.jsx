import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Pill, Boxes, PackagePlus,
  ClipboardList, Truck, AlertTriangle, BarChart3, Users, ScrollText, LogOut, Cross, Building2, BookOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import LanguageSwitcher from "./LanguageSwitcher";

const ALL_LINKS = [
  { to: "/", icon: LayoutDashboard, key: "nav_dashboard", roles: ["super_admin", "admin", "pharmacist", "cashier", "storekeeper"] },
  { to: "/pos", icon: ShoppingCart, key: "nav_pos", roles: ["super_admin", "admin", "pharmacist", "cashier"] },
  { to: "/products", icon: Pill, key: "nav_products", roles: ["super_admin", "admin", "pharmacist", "cashier", "storekeeper"] },
  { to: "/stock", icon: Boxes, key: "nav_stock", roles: ["super_admin", "admin", "pharmacist", "storekeeper"] },
  { to: "/reception", icon: PackagePlus, key: "nav_reception", roles: ["super_admin", "admin", "pharmacist", "storekeeper"] },
  { to: "/orders", icon: ClipboardList, key: "nav_orders", roles: ["super_admin", "admin", "pharmacist", "storekeeper"] },
  { to: "/suppliers", icon: Truck, key: "nav_suppliers", roles: ["super_admin", "admin", "pharmacist", "storekeeper"] },
  { to: "/losses", icon: AlertTriangle, key: "nav_losses", roles: ["super_admin", "admin", "pharmacist"] },
  { to: "/reports", icon: BarChart3, key: "nav_reports", roles: ["super_admin", "admin", "pharmacist"] },
  { to: "/users", icon: Users, key: "nav_users", roles: ["super_admin", "admin"] },
  { to: "/pharmacies", icon: Building2, key: "nav_pharmacies", roles: ["super_admin", "admin"] },
  { to: "/audit", icon: ScrollText, key: "nav_audit", roles: ["super_admin", "admin", "pharmacist"] },
  { to: "/documentation", icon: BookOpen, key: "nav_documentation", roles: ["super_admin", "admin", "pharmacist", "cashier", "storekeeper"] },
];

const ROLE_LABEL = { super_admin: "super_admin", admin: "admin", pharmacist: "pharmacist", cashier: "cashier", storekeeper: "storekeeper" };

export default function Layout({ children }) {
  const { user, pharmacy, logout, isSuperAdmin } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const links = ALL_LINKS.filter((l) => l.roles.includes(user?.role));

  const handleLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-screen" data-testid="app-sidebar">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-md flex items-center justify-center text-white">
              <Cross className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-heading font-black text-lg leading-none tracking-tight">SGP-Pharma</div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-1">OPTINET • Lomé</div>
            </div>
          </div>
          {pharmacy && !isSuperAdmin() && (
            <div className="mt-3 px-2 py-2 bg-emerald-50 border border-emerald-100 rounded text-xs">
              <div className="text-[10px] tracking-wider uppercase text-emerald-700 font-bold">Pharmacie</div>
              <div className="font-semibold text-emerald-900 leading-tight" data-testid="current-pharmacy-name">{pharmacy.name}</div>
            </div>
          )}
          {isSuperAdmin() && (
            <div className="mt-3 px-2 py-2 bg-amber-50 border border-amber-100 rounded text-xs" data-testid="super-admin-banner">
              <div className="font-semibold text-amber-900">Mode Super Admin</div>
              <div className="text-[10px] text-amber-700">Vue toutes pharmacies</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              data-testid={`nav-link-${l.key.replace("nav_", "")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-white" : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              <l.icon className="w-4 h-4" />
              {t(l.key)}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2 px-2">
            <LanguageSwitcher />
          </div>
          <div className="px-2 py-2">
            <div className="text-sm font-semibold truncate" data-testid="current-user-name">{user?.name}</div>
            <div className="text-xs text-muted-foreground truncate">{t(ROLE_LABEL[user?.role] || "user")}</div>
          </div>
          <button onClick={handleLogout} data-testid="logout-btn" className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" /> {t("logout")}
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 min-h-screen">{children}</main>
    </div>
  );
}
