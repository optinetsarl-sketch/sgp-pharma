import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import FEFOBadge from "@/components/FEFOBadge";
import { Lock, Boxes, AlertTriangle, CheckCircle2, ShieldAlert, Search, X, PackageCheck } from "lucide-react";
import { toast } from "sonner";

export default function Stock() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("");
  const [statusTab, setStatusTab] = useState("all"); // all, active, expiring, blocked, depleted

  const reload = () => {
    api.get("/batches").then((r) => setBatches(r.data || [])).catch(() => {});
    api.get("/products").then((r) => setProducts(r.data || [])).catch(() => {});
  };
  useEffect(() => {
    reload();
  }, []);

  const block = async (b) => {
    if (!window.confirm(`Bloquer le lot ${b.batch_number} de ${b.product_name} ? Ce lot ne pourra plus être vendu.`)) return;
    try {
      await api.put(`/batches/${b.id}/block`);
      toast.success("Lot bloqué avec succès");
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  // Helper to check if batch expires within 30 days
  const isExpiring30 = (expiryDate) => {
    if (!expiryDate) return false;
    const diff = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  // Stats
  const stats = useMemo(() => {
    const active = batches.filter((b) => b.status === "active" && b.current_quantity > 0);
    const expiring = batches.filter((b) => b.status === "active" && (isExpiring30(b.expiry_date) || isExpired(b.expiry_date)));
    const blocked = batches.filter((b) => b.status === "blocked");
    const totalValue = active.reduce((sum, b) => sum + b.current_quantity * (b.purchase_price || 0), 0);
    return { activeCount: active.length, expiringCount: expiring.length, blockedCount: blocked.length, totalValue };
  }, [batches]);

  const filtered = useMemo(() => {
    return batches.filter((b) => {
      // Tab filter
      if (statusTab === "active" && (b.status !== "active" || b.current_quantity <= 0)) return false;
      if (statusTab === "expiring" && !(isExpiring30(b.expiry_date) || isExpired(b.expiry_date))) return false;
      if (statusTab === "blocked" && b.status !== "blocked") return false;
      if (statusTab === "depleted" && b.current_quantity > 0) return false;

      // Text search
      if (!filter) return true;
      const normalize = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const f = normalize(filter);
      return (
        normalize(b.product_name).includes(f) ||
        normalize(b.batch_number).includes(f)
      );
    });
  }, [batches, filter, statusTab]);

  return (
    <div className="space-y-6" data-testid="stock-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">{t("nav_stock")} · INVENTAIRE & TRAÇABILITÉ</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Stock & Lots (FEFO)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion fine par numéro de lot avec suivi automatique des dates de péremption
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Lots actifs en stock</span>
            <PackageCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-heading font-black text-2xl text-slate-900 mt-1">{stats.activeCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Disponibles à la vente</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Valeur du stock (Achat)</span>
            <Boxes className="w-4 h-4 text-primary" />
          </div>
          <div className="font-heading font-black text-2xl text-primary mt-1">{formatXOF(stats.totalValue)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Valorisation à prix d'achat</div>
        </div>

        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-800 uppercase">Péremption &lt; 30j / Expirés</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-heading font-black text-2xl text-amber-900 mt-1">{stats.expiringCount}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">À prioriser en caisse ou retirer</div>
        </div>

        <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-800 uppercase">Lots bloqués</span>
            <ShieldAlert className="w-4 h-4 text-purple-600" />
          </div>
          <div className="font-heading font-black text-2xl text-purple-900 mt-1">{stats.blockedCount}</div>
          <div className="text-[10px] text-purple-700 mt-0.5">Retirés de la vente</div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "Tous les lots" },
            { id: "active", label: "Actifs en stock" },
            { id: "expiring", label: "Péremption proche" },
            { id: "blocked", label: "Bloqués" },
            { id: "depleted", label: "Épuisés" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusTab === tab.id
                  ? "bg-primary text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full md:w-72 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer médicament ou n° lot..."
            data-testid="stock-filter-input"
            className="w-full bg-transparent outline-none text-xs font-medium text-slate-900"
          />
          {filter && (
            <button onClick={() => setFilter("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="batches-table">
            <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">{t("batch_number")}</th>
                <th className="px-4 py-3">{t("expiry")}</th>
                <th className="px-4 py-3">Priorité FEFO</th>
                <th className="px-4 py-3 text-right">{t("quantity")}</th>
                <th className="px-4 py-3 text-right">{t("purchase_price")}</th>
                <th className="px-4 py-3">{t("status")}</th>
                {hasRole("admin", "pharmacist") && <th className="px-4 py-3 text-right">{t("actions")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <div>{t("no_data")}</div>
                  </td>
                </tr>
              )}

              {filtered.map((b) => {
                const prod = products.find((p) => p.id === b.product_id);
                const isRx = prod?.requires_prescription;

                return (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors" data-testid={`batch-row-${b.id}`}>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className={isRx ? "text-red-950 font-bold" : ""}>{b.product_name}</span>
                        {isRx && (
                          <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.2 rounded shadow-2xs">
                            🔴 Rx
                          </span>
                        )}
                      </div>
                    </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">
                    {b.batch_number}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {b.expiry_date}
                  </td>
                  <td className="px-4 py-3">
                    <FEFOBadge expiryDate={b.expiry_date} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-black text-sm">
                    <span className={b.current_quantity === 0 ? "text-slate-400" : "text-emerald-900"}>
                      {b.current_quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-slate-600">
                    {formatXOF(b.purchase_price)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        b.status === "active"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : b.status === "blocked"
                          ? "bg-red-50 text-red-800 border-red-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {b.status === "active" ? t("active") : b.status === "blocked" ? t("blocked") : t("depleted")}
                    </span>
                  </td>
                  {hasRole("admin", "pharmacist") && (
                    <td className="px-4 py-3 text-right">
                      {b.status === "active" && (
                        <button
                          onClick={() => block(b)}
                          data-testid={`block-batch-${b.id}`}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 ml-auto"
                          title="Bloquer ce lot pour empêcher toute vente"
                        >
                          <Lock className="w-3 h-3" /> {t("block")}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
