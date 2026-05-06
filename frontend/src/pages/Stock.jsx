import React, { useEffect, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import FEFOBadge from "@/components/FEFOBadge";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export default function Stock() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const [batches, setBatches] = useState([]);
  const [filter, setFilter] = useState("");

  const reload = () => api.get("/batches").then((r) => setBatches(r.data));
  useEffect(() => { reload(); }, []);

  const block = async (b) => {
    try { await api.put(`/batches/${b.id}/block`); toast.success(t("saved")); reload(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const filtered = batches.filter((b) =>
    !filter || b.product_name?.toLowerCase().includes(filter.toLowerCase()) || b.batch_number.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 space-y-4" data-testid="stock-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-tiny mb-1">{t("nav_stock")}</div>
          <h1 className="font-heading text-3xl font-black tracking-tight">Stock & Lots</h1>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("search")}
          data-testid="stock-filter-input"
          className="w-full outline-none text-sm"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm" data-testid="batches-table">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">{t("batch_number")}</th>
              <th className="px-4 py-3">{t("expiry")}</th>
              <th className="px-4 py-3">FEFO</th>
              <th className="px-4 py-3 text-right">{t("quantity")}</th>
              <th className="px-4 py-3 text-right">{t("purchase_price")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              {hasRole("admin", "pharmacist") && <th className="px-4 py-3 text-right">{t("actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">{t("no_data")}</td></tr>}
            {filtered.map((b) => (
              <tr key={b.id} className="border-t border-gray-100 table-row-hover" data-testid={`batch-row-${b.id}`}>
                <td className="px-4 py-3 font-semibold">{b.product_name}</td>
                <td className="px-4 py-3 font-mono text-xs">{b.batch_number}</td>
                <td className="px-4 py-3">{b.expiry_date}</td>
                <td className="px-4 py-3"><FEFOBadge expiryDate={b.expiry_date} /></td>
                <td className={`px-4 py-3 text-right font-bold ${b.current_quantity === 0 ? "text-muted-foreground" : ""}`}>{b.current_quantity}</td>
                <td className="px-4 py-3 text-right">{formatXOF(b.purchase_price)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded border ${b.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : b.status === "blocked" ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                    {b.status === "active" ? t("active") : b.status === "blocked" ? t("blocked") : t("depleted")}
                  </span>
                </td>
                {hasRole("admin", "pharmacist") && (
                  <td className="px-4 py-3 text-right">
                    {b.status === "active" && (
                      <button onClick={() => block(b)} data-testid={`block-batch-${b.id}`} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded" title={t("block")}>
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
