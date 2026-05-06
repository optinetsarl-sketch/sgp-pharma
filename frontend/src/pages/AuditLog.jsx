import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useI18n } from "@/i18n";

export default function AuditLog() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/audit-logs").then((r) => setItems(r.data)); }, []);

  return (
    <div className="p-6 md:p-8 space-y-4" data-testid="audit-page">
      <div>
        <div className="label-tiny mb-1">{t("nav_audit")}</div>
        <h1 className="font-heading text-3xl font-black tracking-tight">Journal d'audit</h1>
      </div>
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">{t("audit_time")}</th><th className="px-4 py-3">{t("user")}</th><th className="px-4 py-3">{t("audit_action")}</th><th className="px-4 py-3">{t("audit_entity")}</th><th className="px-4 py-3">{t("audit_details")}</th></tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">{t("no_data")}</td></tr>}
            {items.map((l) => (
              <tr key={l.id} className="border-t border-gray-100">
                <td className="px-4 py-3 text-xs">{new Date(l.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3">{l.user_email || "-"}</td>
                <td className="px-4 py-3 font-mono text-xs"><span className="bg-secondary px-2 py-0.5 rounded">{l.action}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{l.entity || "-"}</td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{JSON.stringify(l.details || {})}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
