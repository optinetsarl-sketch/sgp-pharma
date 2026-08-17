import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useI18n } from "@/i18n";
import { ScrollText, Search, Shield, Filter, User, Activity, Clock } from "lucide-react";

export default function AuditLog() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    api.get("/audit-logs").then((r) => setItems(r.data || [])).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return items.filter((l) => {
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (!q) return true;
      const ql = q.toLowerCase();
      return (
        l.user_email?.toLowerCase().includes(ql) ||
        l.action?.toLowerCase().includes(ql) ||
        l.entity?.toLowerCase().includes(ql)
      );
    });
  }, [items, q, actionFilter]);

  const uniqueActions = useMemo(() => {
    const set = new Set(items.map((i) => i.action).filter(Boolean));
    return Array.from(set);
  }, [items]);

  return (
    <div className="space-y-6" data-testid="audit-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">{t("nav_audit")} · TRAÇABILITÉ RÉGLEMENTAIRE</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Journal d'Audit & Sécurité
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enregistrement immuable de toutes les opérations sensibles (ventes, réceptions, annulations, créations)
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="w-full md:flex-1 flex items-center gap-2 px-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par utilisateur, action ou entité..."
            className="w-full text-xs font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="w-full md:w-auto flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full md:w-48 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="all">Toutes les actions</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">{t("audit_time")}</th>
                <th className="px-4 py-3">{t("user")}</th>
                <th className="px-4 py-3">{t("audit_action")}</th>
                <th className="px-4 py-3">{t("audit_entity")}</th>
                <th className="px-4 py-3">{t("audit_details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <div>{t("no_data")}</div>
                  </td>
                </tr>
              )}

              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800">
                    {l.user_email || <span className="text-slate-400 font-normal">Système</span>}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded text-[11px]">
                      {l.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-600">
                    {l.entity || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                    {typeof l.details === "object" ? (
                      <span className="bg-slate-50 px-2 py-1 rounded border border-slate-200/80 font-mono text-[10px]">
                        {JSON.stringify(l.details)}
                      </span>
                    ) : (
                      String(l.details || "—")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
