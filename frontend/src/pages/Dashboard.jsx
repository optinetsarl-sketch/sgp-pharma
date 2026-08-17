import React, { useEffect, useState } from "react";
import api, { formatXOF } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, AlertTriangle, Package, ShoppingCart, FileText, AlertCircle,
  PackagePlus, Pill, Boxes, ArrowUpRight, Sparkles, RefreshCw
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

function StatCard({ icon: Icon, label, value, sub, tone = "default", testid, onClick }) {
  const tones = {
    default: "bg-white border-slate-200 text-slate-900",
    danger: "bg-red-50/70 border-red-200 text-red-950",
    warn: "bg-amber-50/70 border-amber-200 text-amber-950",
    primary: "bg-emerald-50/70 border-emerald-200 text-emerald-950",
  };

  const iconTones = {
    default: "text-slate-400 bg-slate-100",
    danger: "text-red-600 bg-red-100",
    warn: "text-amber-600 bg-amber-100",
    primary: "text-primary bg-emerald-100",
  };

  return (
    <div
      onClick={onClick}
      className={`border rounded-2xl p-5 shadow-xs transition-all hover:shadow-sm ${tones[tone]} ${onClick ? "cursor-pointer hover:border-primary/50" : ""}`}
      data-testid={testid}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconTones[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="font-heading font-black text-2xl tracking-tight mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1 font-medium">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [expiring, setExpiring] = useState([]);
  const [setupStatus, setSetupStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = () => {
    setRefreshing(true);
    Promise.all([
      api.get("/dashboard").then((r) => setData(r.data)),
      api.get("/batches/expiring", { params: { days: 60 } }).then((r) => setExpiring(r.data)),
      api.get("/pharmacy/setup-status").then((r) => setSetupStatus(r.data)).catch(() => {}),
    ]).finally(() => setRefreshing(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!data) {
    return (
      <div className="p-12 text-center text-slate-400" data-testid="dashboard-loading">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
        <div className="text-sm font-semibold">{t("loading")}</div>
      </div>
    );
  }

  const isCashier = user?.role === "cashier";
  const isStorekeeper = user?.role === "storekeeper";

  const chart = data.chart_7d.map((d) => ({
    ...d,
    label: format(parseISO(d.date), "dd/MM"),
  }));

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Welcome & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">{t("nav_dashboard")} · TABLEAU DE BORD</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {t("welcome")}, {user?.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {format(new Date(), "EEEE dd MMMM yyyy", { locale: fr })} · SGP-Pharma Lomé
          </p>
        </div>

        {/* Quick action buttons for operators */}
        <div className="flex items-center gap-2 flex-wrap">
          {["super_admin", "admin", "pharmacist", "cashier"].includes(user?.role) && (
            <button
              onClick={() => navigate("/pos")}
              className="bg-primary hover:bg-[#14532D] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-900/10 transition-all hover:-translate-y-0.5"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Nouvelle vente (F2)</span>
            </button>
          )}

          {["super_admin", "admin", "pharmacist", "storekeeper"].includes(user?.role) && (
            <button
              onClick={() => navigate("/reception")}
              className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all hover:-translate-y-0.5"
            >
              <PackagePlus className="w-4 h-4 text-primary" />
              <span>Réception (F4)</span>
            </button>
          )}

          <button
            onClick={loadData}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-2xs"
            title="Actualiser les données"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* First-Run Onboarding Banner (if pharmacy unconfigured) */}
      {setupStatus && !setupStatus.is_configured && ["super_admin", "admin"].includes(user?.role) && (
        <div className="bg-gradient-to-r from-emerald-900 to-[#14532D] text-white rounded-3xl p-6 sm:p-7 shadow-lg shadow-emerald-900/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-emerald-700/50">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-600/50 text-[10px] font-black uppercase tracking-widest text-emerald-200">
              ✨ Premier Démarrage · Personnalisation
            </div>
            <h2 className="font-heading font-black text-xl sm:text-2xl text-white">
              Configurez l'Identité & le Logo de votre Pharmacie
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/85 max-w-2xl leading-relaxed">
              Personnalisez le nom officiel, le logo, les coordonnées GPS Google Maps, les numéros de téléphone et le N° d'Agrément qui s'afficheront sur vos tickets de caisse thermiques et documents de vente.
            </p>
          </div>

          <button
            onClick={() => navigate("/pharmacy-setup")}
            className="bg-white hover:bg-emerald-50 text-emerald-950 font-bold text-xs sm:text-sm px-6 py-3.5 rounded-2xl shadow-md transition-all hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-2"
          >
            <span>Configurer l'Officine</span>
            <ArrowRight className="w-4 h-4 text-primary" />
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isStorekeeper ? (
          <>
            <StatCard
              testid="kpi-stock-qty"
              icon={Package}
              tone="primary"
              label="Total Unités en Stock"
              value={`${data.stock_qty || 0} unités`}
              sub="Unités physiques en rayon · Voir stock →"
              onClick={() => navigate("/stock")}
            />
            <StatCard
              testid="kpi-products-count"
              icon={Pill}
              label="Références Produits"
              value={`${data.total_products || "Catalogue"}`}
              sub="Médicaments & articles répertoriés →"
              onClick={() => navigate("/products")}
            />
            <StatCard
              testid="kpi-reception-shortcut"
              icon={PackagePlus}
              label="Entrée de Stock (F4)"
              value="Réception de Lots"
              sub="Enregistrer une livraison fournisseur →"
              onClick={() => navigate("/reception")}
            />
            <StatCard
              testid="kpi-orders-count"
              icon={Boxes}
              label="Approvisionnements"
              value="Bons de Commande"
              sub="Gérer les commandes CAMEG / grossistes →"
              onClick={() => navigate("/orders")}
            />
          </>
        ) : isCashier ? (
          <>
            <StatCard
              testid="kpi-ca-today"
              icon={TrendingUp}
              tone="primary"
              label="Ventes de la journée"
              value={formatXOF(data.ca_today)}
              sub={`${data.nb_sales_today} ${t("sales_today").toLowerCase()} · Voir journal →`}
              onClick={() => navigate("/sales")}
            />
            <StatCard
              testid="kpi-tickets-count"
              icon={ShoppingCart}
              label="Tickets encaissés"
              value={data.nb_sales_today}
              sub="Ventes enregistrées aujourd'hui · Voir journal →"
              onClick={() => navigate("/sales")}
            />
            <div
              onClick={() => navigate("/pos")}
              className="border rounded-2xl p-5 shadow-xs transition-all hover:shadow-md bg-gradient-to-br from-emerald-800 to-emerald-950 text-white cursor-pointer group flex flex-col justify-between"
              data-testid="kpi-pos-shortcut"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Accès Caisse</div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/20 text-white group-hover:scale-110 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="font-heading font-black text-xl tracking-tight text-white flex items-center gap-1.5">
                  <span>Ouvrir Caisse</span>
                  <ArrowUpRight className="w-4 h-4 text-emerald-300" />
                </div>
                <div className="text-[11px] text-emerald-200/80 mt-1 font-medium">Touche F2</div>
              </div>
            </div>
            <StatCard
              testid="kpi-prescriptions"
              icon={FileText}
              label={t("prescriptions")}
              value={data.nb_prescriptions_today}
              sub={`Délivrées ${t("today").toLowerCase()}`}
            />
          </>
        ) : (
          <>
            <StatCard
              testid="kpi-ca-today"
              icon={TrendingUp}
              tone="primary"
              label={t("ca_today")}
              value={formatXOF(data.ca_today)}
              sub={`${data.nb_sales_today} ${t("sales_today").toLowerCase()} · Voir journal →`}
              onClick={() => navigate("/sales")}
            />
            <StatCard
              testid="kpi-ca-month"
              icon={TrendingUp}
              label={t("ca_month")}
              value={formatXOF(data.ca_month)}
              sub="Chiffre d'affaires mensuel"
            />
            <StatCard
              testid="kpi-stock-value"
              icon={Package}
              label={t("stock_value")}
              value={formatXOF(data.stock_value)}
              sub={`${data.stock_qty} ${t("stock_qty").toLowerCase()}`}
              onClick={() => navigate("/stock")}
            />
            <StatCard
              testid="kpi-prescriptions"
              icon={FileText}
              label={t("prescriptions")}
              value={data.nb_prescriptions_today}
              sub={`Délivrées ${t("today").toLowerCase()}`}
            />
          </>
        )}
      </div>

      {/* Critical Alerts Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          testid="alert-expired"
          icon={AlertCircle}
          tone="danger"
          label={t("expired")}
          value={data.alerts.expired}
          sub="Lots à retirer immédiatement"
          onClick={() => navigate("/stock")}
        />
        <StatCard
          testid="alert-expiring"
          icon={AlertTriangle}
          tone="warn"
          label={t("expiring_30")}
          value={data.alerts.expiring_30}
          sub="Lots prioritaires en caisse (FEFO)"
          onClick={() => navigate("/stock")}
        />
        <StatCard
          testid="alert-low-stock"
          icon={Boxes}
          tone="warn"
          label={t("low_stock")}
          value={data.alerts.low_stock_count}
          sub="Articles sous le seuil d'alerte"
          onClick={() => navigate("/products")}
        />
      </div>

      {/* Chart + Alerts List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs" data-testid="sales-chart-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {isStorekeeper
                  ? "Mouvements de Stock"
                  : isCashier
                  ? "Activité de Caisse"
                  : t("sales_7d")}
              </div>
              <h3 className="font-heading font-black text-lg text-slate-900">
                {isStorekeeper
                  ? "Quantités d'unités délivrées par jour"
                  : isCashier
                  ? "Nombre de tickets de caisse par jour"
                  : "Évolution du Chiffre d'Affaires"}
              </h3>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
              7 derniers jours
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#166534" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#166534" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                <Tooltip
                  formatter={(v) => [
                    isStorekeeper
                      ? `${v} unités sorties`
                      : isCashier
                      ? `${v} tickets`
                      : formatXOF(v),
                    isStorekeeper
                      ? "Unités délivrées"
                      : isCashier
                      ? "Tickets"
                      : "Ventes",
                  ]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                />
                <Area
                  type="monotone"
                  dataKey={isStorekeeper ? "qty" : isCashier ? "count" : "total"}
                  stroke="#166534"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorSales)"
                  dot={{ r: 4, fill: "#166534" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expiring Batches Mini Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between" data-testid="alerts-list-card">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("expiring_alerts")}</div>
                <h3 className="font-heading font-black text-lg text-slate-900">Lots à surveiller</h3>
              </div>
              <button onClick={() => navigate("/stock")} className="text-[11px] font-bold text-primary hover:underline">
                Voir tout
              </button>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {expiring.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {t("no_alerts")} — Tout est en ordre !
                </div>
              )}
              {expiring.slice(0, 6).map((b) => (
                <div
                  key={b.id}
                  className={`text-xs p-3 rounded-xl border transition-all ${
                    b.expired ? "bg-red-50 border-red-200 text-red-950" : "bg-amber-50 border-amber-200 text-amber-950"
                  }`}
                >
                  <div className="font-bold truncate">{b.product_name}</div>
                  <div className="text-[11px] flex justify-between items-center mt-1">
                    <span className="font-mono text-slate-600 font-medium">Lot {b.batch_number}</span>
                    <span className={`font-bold ${b.expired ? "text-red-700" : "text-amber-800"}`}>
                      {b.expiry_date}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Low stock Alert Table */}
      {data.low_stock.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs" data-testid="low-stock-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("low_stock")}</div>
              <h3 className="font-heading font-black text-lg text-slate-900">Articles sous le seuil d'alerte</h3>
            </div>
            <button onClick={() => navigate("/products")} className="text-xs font-bold text-primary hover:underline">
              Gérer le réapprovisionnement →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">{t("name")}</th>
                  <th className="py-2.5 px-3 text-right">Stock disponible</th>
                  <th className="py-2.5 px-3 text-right">{t("seuil")}</th>
                  <th className="py-2.5 px-3 text-right">Action recommandée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.low_stock.map((p) => (
                  <tr key={p.product_id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{p.nom_commercial}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-red-600">{p.stock}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">{p.seuil}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => navigate("/orders")}
                        className="text-[11px] bg-slate-100 hover:bg-primary hover:text-white font-bold text-slate-700 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        Commander
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
