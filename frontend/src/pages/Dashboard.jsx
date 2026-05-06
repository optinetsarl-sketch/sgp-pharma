import React, { useEffect, useState } from "react";
import api, { formatXOF } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import {
  TrendingUp, AlertTriangle, Package, ShoppingBag, FileText, AlertCircle,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";

function StatCard({ icon: Icon, label, value, sub, tone = "default", testid }) {
  const tones = {
    default: "bg-white border-gray-200",
    danger: "bg-red-50 border-red-200",
    warn: "bg-amber-50 border-amber-200",
    primary: "bg-emerald-50 border-emerald-200",
  };
  return (
    <div className={`border rounded-md p-5 ${tones[tone]}`} data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <div className="label-tiny">{label}</div>
        <Icon className={`w-4 h-4 ${tone === "danger" ? "text-red-500" : tone === "warn" ? "text-amber-500" : tone === "primary" ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-2">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [expiring, setExpiring] = useState([]);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data)).catch(() => {});
    api.get("/batches/expiring", { params: { days: 60 } }).then((r) => setExpiring(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="p-8" data-testid="dashboard-loading">{t("loading")}</div>;

  const chart = data.chart_7d.map((d) => ({ ...d, label: format(parseISO(d.date), "dd/MM") }));

  return (
    <div className="p-6 md:p-8 space-y-6" data-testid="dashboard-page">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="label-tiny mb-1">{t("nav_dashboard")}</div>
          <h1 className="font-heading text-3xl font-black tracking-tight">{t("welcome")}, {user?.name}</h1>
        </div>
        <div className="text-sm text-muted-foreground">{format(new Date(), "EEEE dd MMMM yyyy")}</div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard testid="kpi-ca-today" icon={TrendingUp} tone="primary" label={t("ca_today")} value={formatXOF(data.ca_today)} sub={`${data.nb_sales_today} ${t("sales_today").toLowerCase()}`} />
        <StatCard testid="kpi-ca-month" icon={TrendingUp} label={t("ca_month")} value={formatXOF(data.ca_month)} />
        <StatCard testid="kpi-stock-value" icon={Package} label={t("stock_value")} value={formatXOF(data.stock_value)} sub={`${data.stock_qty} ${t("stock_qty").toLowerCase()}`} />
        <StatCard testid="kpi-prescriptions" icon={FileText} label={t("prescriptions")} value={data.nb_prescriptions_today} sub={t("today")} />
      </div>

      {/* Alerts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard testid="alert-expired" icon={AlertCircle} tone="danger" label={t("expired")} value={data.alerts.expired} />
        <StatCard testid="alert-expiring" icon={AlertTriangle} tone="warn" label={t("expiring_30")} value={data.alerts.expiring_30} />
        <StatCard testid="alert-low-stock" icon={ShoppingBag} tone="warn" label={t("low_stock")} value={data.alerts.low_stock_count} />
      </div>

      {/* Chart + Alerts list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-md p-5" data-testid="sales-chart-card">
          <div className="label-tiny mb-3">{t("sales_7d")}</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatXOF(v)} />
                <Line type="monotone" dataKey="total" stroke="#166534" strokeWidth={2.5} dot={{ r: 4, fill: "#166534" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-5" data-testid="alerts-list-card">
          <div className="label-tiny mb-3">{t("expiring_alerts")}</div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {expiring.length === 0 && <div className="text-sm text-muted-foreground">{t("no_alerts")}</div>}
            {expiring.slice(0, 8).map((b) => (
              <div key={b.id} className={`text-sm py-2 px-3 rounded border ${b.expired ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                <div className="font-semibold">{b.product_name}</div>
                <div className="text-xs flex justify-between mt-1">
                  <span>Lot {b.batch_number}</span>
                  <span className="font-bold">{b.expiry_date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low stock */}
      {data.low_stock.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-5" data-testid="low-stock-card">
          <div className="label-tiny mb-3">{t("low_stock")}</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground uppercase tracking-wider">
              <tr><th className="py-2">{t("name")}</th><th className="py-2 text-right">Stock</th><th className="py-2 text-right">{t("seuil")}</th></tr>
            </thead>
            <tbody>
              {data.low_stock.map((p) => (
                <tr key={p.product_id} className="border-t border-gray-100">
                  <td className="py-2">{p.nom_commercial}</td>
                  <td className="py-2 text-right font-bold text-red-600">{p.stock}</td>
                  <td className="py-2 text-right text-muted-foreground">{p.seuil}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
