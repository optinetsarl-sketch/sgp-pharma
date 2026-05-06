import React, { useEffect, useState } from "react";
import api, { formatXOF } from "@/lib/api";
import { useI18n } from "@/i18n";
import { Download } from "lucide-react";

function toCSV(rows, headers) {
  const head = headers.map((h) => h.label).join(",");
  const body = rows.map((r) => headers.map((h) => `"${(r[h.key] ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
  return head + "\n" + body;
}

function downloadCSV(name, csv) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { t } = useI18n();
  const [sales, setSales] = useState([]);
  const [top, setTop] = useState([]);
  const [margins, setMargins] = useState([]);
  const [tab, setTab] = useState("sales");

  useEffect(() => {
    api.get("/reports/sales").then((r) => setSales(r.data.sales));
    api.get("/reports/top-products").then((r) => setTop(r.data));
    api.get("/reports/margins").then((r) => setMargins(r.data));
  }, []);

  const exportSales = () => {
    const flat = sales.map((s) => ({
      date: s.date, total: s.total_amount, payment: s.payment_method,
      customer: s.customer_name || "", items: s.items.length,
    }));
    downloadCSV("ventes.csv", toCSV(flat, [
      { key: "date", label: "Date" }, { key: "total", label: "Total" },
      { key: "payment", label: "Paiement" }, { key: "customer", label: "Client" }, { key: "items", label: "Articles" },
    ]));
  };

  const totalSales = sales.reduce((s, x) => s + x.total_amount, 0);

  return (
    <div className="p-6 md:p-8 space-y-4" data-testid="reports-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-tiny mb-1">{t("nav_reports")}</div>
          <h1 className="font-heading text-3xl font-black tracking-tight">Rapports</h1>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[
          { k: "sales", label: t("sales_history") },
          { k: "top", label: t("top_products") },
          { k: "margins", label: t("margin_report") },
        ].map((tabBtn) => (
          <button
            key={tabBtn.k}
            onClick={() => setTab(tabBtn.k)}
            data-testid={`report-tab-${tabBtn.k}`}
            className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === tabBtn.k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >{tabBtn.label}</button>
        ))}
      </div>

      {tab === "sales" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-md p-4">
            <div>
              <div className="label-tiny">Total période</div>
              <div className="stat-value">{formatXOF(totalSales)}</div>
              <div className="text-xs text-muted-foreground mt-1">{sales.length} ventes</div>
            </div>
            <button onClick={exportSales} data-testid="export-sales-csv" className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md font-semibold"><Download className="w-4 h-4" /> {t("export_csv")}</button>
          </div>
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">{t("date")}</th><th className="px-4 py-3">{t("customer_name")}</th><th className="px-4 py-3 text-right">{t("items_count")}</th><th className="px-4 py-3 text-right">{t("total")}</th><th className="px-4 py-3">{t("payment_method")}</th></tr>
              </thead>
              <tbody>
                {sales.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">{t("no_data")}</td></tr>}
                {sales.slice(0, 100).map((s) => (
                  <tr key={s.id} className="border-t border-gray-100 table-row-hover">
                    <td className="px-4 py-3 text-xs">{new Date(s.date).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3">{s.customer_name || "-"}</td>
                    <td className="px-4 py-3 text-right">{s.items.length}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatXOF(s.total_amount)}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-secondary px-2 py-0.5 rounded">{s.payment_method}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "top" && (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Produit</th><th className="px-4 py-3 text-right">Qté</th><th className="px-4 py-3 text-right">{t("revenue")}</th></tr>
            </thead>
            <tbody>
              {top.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">{t("no_data")}</td></tr>}
              {top.map((r, i) => (
                <tr key={r.product_id} className="border-t border-gray-100 table-row-hover">
                  <td className="px-4 py-3 font-bold text-primary">#{i + 1}</td>
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3 text-right">{r.qty}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatXOF(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "margins" && (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-3">Produit</th><th className="px-4 py-3 text-right">Qté</th><th className="px-4 py-3 text-right">{t("revenue")}</th><th className="px-4 py-3 text-right">{t("cost")}</th><th className="px-4 py-3 text-right">{t("margin")}</th><th className="px-4 py-3 text-right">{t("margin_pct")}</th></tr>
            </thead>
            <tbody>
              {margins.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t("no_data")}</td></tr>}
              {margins.map((r) => (
                <tr key={r.product_id} className="border-t border-gray-100 table-row-hover">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3 text-right">{r.qty}</td>
                  <td className="px-4 py-3 text-right">{formatXOF(r.revenue)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatXOF(r.cost)}</td>
                  <td className="px-4 py-3 text-right font-bold text-primary">{formatXOF(r.margin)}</td>
                  <td className="px-4 py-3 text-right">{r.margin_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
