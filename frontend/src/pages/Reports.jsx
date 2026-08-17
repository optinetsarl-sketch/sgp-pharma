import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import {
  Printer, Download, BarChart3, TrendingUp, DollarSign, ShoppingBag,
  Search, Calendar, Filter, FileText, CheckCircle, RefreshCw,
  Building2, ShieldAlert, Package, Boxes, Eye, Sparkles, ArrowRight,
  TrendingDown, Percent, CreditCard, Banknote, Smartphone
} from "lucide-react";
import { toast } from "sonner";
import ReceiptModal from "@/components/ReceiptModal";
import PharmacyLogo from "@/components/PharmacyLogo";

function toCSV(rows, headers) {
  const head = headers.map((h) => h.label).join(",");
  const body = rows
    .map((r) =>
      headers
        .map((h) => `"${(r[h.key] ?? "").toString().replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
  return head + "\n" + body;
}

function downloadCSV(name, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [pharmacy, setPharmacy] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [salesList, setSalesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("consolidated"); // "consolidated", "sales", "top", "margins"
  const [period, setPeriod] = useState("all"); // "all", "today", "7d", "month", "last_month", "year", "custom"
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);

  // Fetch pharmacy profile for official header
  useEffect(() => {
    api.get("/pharmacy/current")
      .then((r) => { if (r.data) setPharmacy(r.data); })
      .catch(() => {});
  }, []);

  // Format local YYYY-MM-DD
  const formatYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Compute start/end date strings based on selected period
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = formatYMD(now);

    if (period === "today") {
      return { start: todayStr, end: todayStr, label: "Aujourd'hui" };
    }
    if (period === "7d") {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 7);
      return { start: formatYMD(past7), end: todayStr, label: "7 derniers jours" };
    }
    if (period === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: formatYMD(startOfMonth), end: todayStr, label: "Mois en cours" };
    }
    if (period === "last_month") {
      const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLast = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: formatYMD(startOfLast), end: formatYMD(endOfLast), label: "Mois précédent" };
    }
    if (period === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return { start: formatYMD(startOfYear), end: todayStr, label: "Année en cours" };
    }
    if (period === "custom") {
      return {
        start: customStart || todayStr,
        end: customEnd || todayStr,
        label: `Du ${customStart || todayStr} au ${customEnd || todayStr}`,
      };
    }
    return { start: "", end: "", label: "Toute la période (Historique complet)" };
  }, [period, customStart, customEnd]);

  // Load report data from backend
  const loadReports = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange.start) params.start = dateRange.start;
      if (dateRange.end) params.end = dateRange.end;

      const [resSummary, resSales] = await Promise.all([
        api.get("/reports/summary", { params }),
        api.get("/reports/sales", { params }),
      ]);

      setSummaryData(resSummary.data);
      setSalesList(resSales.data.sales || []);
    } catch (err) {
      toast.error("Erreur lors de la génération du rapport");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  // Client search filter for sales tab
  const filteredSales = useMemo(() => {
    if (!searchClient.trim()) return salesList;
    const q = searchClient.toLowerCase().trim().replace(/^#/, "");
    return salesList.filter((s) => {
      const matchCustomer = (s.customer_name?.toLowerCase() || "").includes(q);
      const matchPayment = (s.payment_method?.toLowerCase() || "").includes(q);
      const matchId = (s.id?.toLowerCase() || "").includes(q);
      return matchCustomer || matchPayment || matchId;
    });
  }, [salesList, searchClient]);

  // Trigger Print dialog for clean A4 report
  const handlePrint = () => {
    window.print();
  };

  // Export Sales to CSV
  const exportSalesCSV = () => {
    const flat = filteredSales.map((s) => ({
      date: new Date(s.date).toLocaleString("fr-FR"),
      id: s.id.slice(0, 8).toUpperCase(),
      total: s.total_amount,
      payment: s.payment_method?.toUpperCase(),
      customer: s.customer_name || "Comptoir",
      items: s.items.length,
    }));
    downloadCSV(
      `rapport-ventes-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(flat, [
        { key: "date", label: "Date et Heure" },
        { key: "id", label: "N° Ticket" },
        { key: "total", label: "Total (FCFA)" },
        { key: "payment", label: "Règlement" },
        { key: "customer", label: "Client" },
        { key: "items", label: "Articles" },
      ])
    );
  };

  // Export Profitability & Margins to CSV
  const exportMarginsCSV = () => {
    if (!summaryData?.margins) return;
    const flat = summaryData.margins.map((m) => ({
      name: m.name,
      dci: m.dci || "",
      qty: m.qty,
      revenue: m.revenue,
      cost: m.cost,
      margin: m.margin,
      margin_pct: `${m.margin_pct}%`,
    }));
    downloadCSV(
      `rapport-marges-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(flat, [
        { key: "name", label: "Médicament" },
        { key: "dci", label: "DCI" },
        { key: "qty", label: "Quantité Vendue" },
        { key: "revenue", label: "Chiffre d'Affaires (FCFA)" },
        { key: "cost", label: "Coût d'Achat (FCFA)" },
        { key: "margin", label: "Marge Brute (FCFA)" },
        { key: "margin_pct", label: "Taux de Marge" },
      ])
    );
  };

  const currentGenDate = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Top Header & Actions (Hidden in Print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">GESTION & DIRECTION · STATISTIQUES</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Rapports d'Activité & Rentabilité
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Rapport officiel consolidé, analyse des marges, top produits phares et valorisation du stock
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrint}
            className="bg-primary hover:bg-[#14532D] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-900/10 transition-all hover:-translate-y-0.5"
            title="Imprimer le rapport officiel en format A4 propre"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer Rapport A4</span>
          </button>

          <button
            onClick={tab === "margins" ? exportMarginsCSV : exportSalesCSV}
            className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all hover:-translate-y-0.5"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={loadReports}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs"
            title="Actualiser les statistiques"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* Period Filter Bar (Hidden in Print) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          <span className="text-xs font-bold text-slate-500 mr-2 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>Période :</span>
          </span>
          {[
            { id: "all", label: "Tout l'historique" },
            { id: "today", label: "Aujourd'hui" },
            { id: "7d", label: "7 derniers jours" },
            { id: "month", label: "Mois en cours" },
            { id: "last_month", label: "Mois précédent" },
            { id: "year", label: "Année 2026" },
            { id: "custom", label: "Personnalisée..." },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === p.id
                  ? "bg-primary text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Range Picker */}
        {period === "custom" && (
          <div className="flex items-center gap-2 text-xs animate-in fade-in w-full md:w-auto">
            <span className="font-bold text-slate-600">Du :</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
            />
            <span className="font-bold text-slate-600">Au :</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
            />
          </div>
        )}
      </div>

      {/* Navigation Tabs (Hidden in Print) */}
      <div className="flex gap-2 border-b border-slate-200 print:hidden overflow-x-auto">
        {[
          { k: "consolidated", label: "Rapport Global Consolidé", icon: FileText },
          { k: "sales", label: "Ventes & Encaissements", icon: ShoppingBag },
          { k: "top", label: "Produits Phares (Volume & CA)", icon: TrendingUp },
          { k: "margins", label: "Marges & Rentabilité", icon: DollarSign },
        ].map((tabBtn) => (
          <button
            key={tabBtn.k}
            onClick={() => setTab(tabBtn.k)}
            data-testid={`report-tab-${tabBtn.k}`}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
              tab === tabBtn.k
                ? "border-primary text-primary bg-emerald-50/50"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <tabBtn.icon className="w-4 h-4" />
            <span>{tabBtn.label}</span>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CONSOLIDATED REPORT (REGROUPÉ ET TOTALEMENT IMPRIMABLE FORMAT A4) */}
      {/* ========================================================================= */}
      {(tab === "consolidated" || true) && (
        <div className={tab !== "consolidated" ? "hidden print:block" : "space-y-6"}>
          {/* Printable Container */}
          <div className="printable-a4 bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm print:shadow-none print:border-none print:p-0 space-y-8">
            
            {/* 1. Official Pharmacy Header */}
            <div className="border-b-2 border-emerald-800/80 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <PharmacyLogo
                  logoUrl={pharmacy?.logo_url || pharmacy?.logo_data}
                  name={pharmacy?.name || "Pharmacie"}
                  size="lg"
                />
                <div>
                  <h2 className="font-heading font-black text-xl sm:text-2xl text-slate-950 uppercase tracking-tight">
                    {pharmacy?.name || "OFFICINE PHARMACEUTIQUE"}
                  </h2>
                  {pharmacy?.slogan && (
                    <div className="text-xs italic text-emerald-800 font-semibold">{pharmacy.slogan}</div>
                  )}
                  <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                    <div>{pharmacy?.address || "Lomé"} · {pharmacy?.city || "Togo"}</div>
                    <div>Tél : <strong>{pharmacy?.phone || "+228 00 00 00 00"}</strong> {pharmacy?.email && `· ${pharmacy.email}`}</div>
                    {pharmacy?.license_number && (
                      <div className="text-primary font-bold">Agrément N° : {pharmacy.license_number}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Document Meta Box */}
              <div className="sm:text-right bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 text-xs space-y-1 w-full sm:w-auto">
                <div className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-800 text-white font-black text-[10px] uppercase tracking-widest">
                  DOCUMENT OFFICIEL
                </div>
                <div className="font-heading font-black text-sm text-emerald-950 mt-1">
                  RAPPORT D'ACTIVITÉ & GESTION
                </div>
                <div className="text-slate-600 font-medium text-[11px]">
                  Période : <strong className="text-slate-900">{dateRange.label}</strong>
                </div>
                <div className="text-[10px] text-slate-500">
                  Édité le : {currentGenDate}
                </div>
                <div className="text-[10px] text-slate-500">
                  Responsable : <strong>{user?.name}</strong> ({user?.role?.toUpperCase()})
                </div>
              </div>
            </div>

            {/* 2. Executive Financial Summary Cards */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <h3 className="font-heading font-black text-sm uppercase tracking-wider text-slate-900">
                  1. Synthèse Financière & Performance Commerciale
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Chiffre d'Affaires (TTC)</div>
                  <div className="font-heading font-black text-xl sm:text-2xl text-primary mt-1">
                    {formatXOF(summaryData?.sales?.total_revenue || 0)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                    {summaryData?.sales?.nb_sales || 0} tickets encaissés
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Coût d'Achat Global</div>
                  <div className="font-heading font-black text-xl sm:text-2xl text-slate-800 mt-1">
                    {formatXOF(summaryData?.profitability?.total_cost || 0)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                    Valeur d'achat des sorties
                  </div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase text-emerald-800">Marge Brute Réalisée</div>
                  <div className="font-heading font-black text-xl sm:text-2xl text-emerald-950 mt-1">
                    {formatXOF(summaryData?.profitability?.gross_margin || 0)}
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-0.5 font-bold">
                    Taux de marge : {summaryData?.profitability?.margin_pct || 0}%
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Panier Moyen & Rx</div>
                  <div className="font-heading font-black text-xl sm:text-2xl text-slate-900 mt-1">
                    {formatXOF(summaryData?.sales?.avg_cart || 0)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                    {summaryData?.sales?.nb_prescriptions || 0} ordonnances traitées
                  </div>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-3 sm:p-4 text-xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Répartition des Règlements Encaissés
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500">Espèces</div>
                      <div className="font-mono font-bold text-slate-900">
                        {formatXOF(summaryData?.sales?.payment_methods?.cash || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500">Mobile Money (T-Money / Flooz)</div>
                      <div className="font-mono font-bold text-slate-900">
                        {formatXOF(summaryData?.sales?.payment_methods?.mobile_money || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500">Carte Bancaire</div>
                      <div className="font-mono font-bold text-slate-900">
                        {formatXOF(summaryData?.sales?.payment_methods?.card || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500">Assurance Maladie</div>
                      <div className="font-mono font-bold text-slate-900">
                        {formatXOF(summaryData?.sales?.payment_methods?.insurance || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Top 10 Best Selling Medicines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <h3 className="font-heading font-black text-sm uppercase tracking-wider text-slate-900">
                    2. Top 10 Médicaments & Produits Phares
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-medium print:hidden">Classés par Chiffre d'Affaires</span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100/90 text-left text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5 w-12 text-center">Rang</th>
                      <th className="px-3.5 py-2.5">Nom Commercial / DCI</th>
                      <th className="px-3.5 py-2.5">Forme</th>
                      <th className="px-3.5 py-2.5 text-right">Qté Vendue</th>
                      <th className="px-3.5 py-2.5 text-right">CA Généré</th>
                      <th className="px-3.5 py-2.5 text-right">Marge Nette</th>
                      <th className="px-3.5 py-2.5 text-right">Taux (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(!summaryData?.top_products || summaryData.top_products.length === 0) && (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-slate-400">
                          Aucune vente enregistrée sur cette période
                        </td>
                      </tr>
                    )}
                    {(summaryData?.top_products || []).map((p, idx) => (
                      <tr key={p.product_id} className="hover:bg-slate-50/50">
                        <td className="px-3.5 py-2 text-center font-bold font-mono text-slate-500">
                          #{idx + 1}
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          {p.dci && <div className="text-[10px] text-slate-400 font-normal">{p.dci}</div>}
                        </td>
                        <td className="px-3.5 py-2 text-slate-600">{p.forme || "—"}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-800">{p.qty}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-black text-primary">{formatXOF(p.revenue)}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-emerald-800">{formatXOF(p.margin)}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-700">{p.margin_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Stock Health & Losses Status */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <h3 className="font-heading font-black text-sm uppercase tracking-wider text-slate-900">
                  3. État des Stocks & Pertes d'Exploitation
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Valeur Actuelle du Stock</div>
                  <div className="font-heading font-black text-lg sm:text-xl text-slate-900 mt-1">
                    {formatXOF(summaryData?.inventory?.stock_value || 0)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {summaryData?.inventory?.stock_units || 0} unités en rayon
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Lots Proches Péremption (30j)</div>
                  <div className="font-heading font-black text-lg sm:text-xl text-amber-700 mt-1">
                    {summaryData?.inventory?.expiring_30_batches || 0} lots
                  </div>
                  <div className="text-[10px] text-amber-600 mt-0.5 font-medium">
                    À prioriser en caisse (FEFO)
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Lots Expirés à Déclasser</div>
                  <div className="font-heading font-black text-lg sm:text-xl text-red-700 mt-1">
                    {summaryData?.inventory?.expired_batches || 0} lots
                  </div>
                  <div className="text-[10px] text-red-600 mt-0.5 font-medium">
                    À retirer immédiatement
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Pertes & Avaries Déclarées</div>
                  <div className="font-heading font-black text-lg sm:text-xl text-slate-900 mt-1">
                    {formatXOF(summaryData?.losses?.total_value || 0)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {summaryData?.losses?.total_units || 0} unité(s) sorties
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Official Signature & Approval Box */}
            <div className="border-t border-slate-200 pt-6 mt-8 grid grid-cols-2 gap-8 text-xs">
              <div>
                <div className="text-slate-500 font-bold uppercase text-[10px]">Observations / Contrôle de gestion</div>
                <div className="h-20 border border-dashed border-slate-300 rounded-xl mt-1.5 p-2 text-slate-400 italic text-[11px]">
                  R.A.S. - Conforme aux normes d'audit et de traçabilité FEFO.
                </div>
              </div>
              <div className="text-right flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-900">
                    Fait à {pharmacy?.city || "Lomé"}, le {new Date().toLocaleDateString("fr-FR")}
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Le Pharmacien Titulaire / Responsable
                  </div>
                </div>
                <div className="text-[11px] font-bold text-slate-400 italic mt-6 border-t border-slate-200 pt-2">
                  Signature & Cachet Officiel de l'Officine
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DETAILED SALES JOURNAL (VUE ÉCRAN) */}
      {/* ========================================================================= */}
      {tab === "sales" && (
        <div className="space-y-4 print:hidden">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase text-slate-400">Total Ventes Sélectionnées</div>
              <div className="font-heading font-black text-2xl text-primary mt-0.5">
                {formatXOF(filteredSales.reduce((acc, s) => acc + s.total_amount, 0))}
              </div>
              <div className="text-[11px] text-slate-500">{filteredSales.length} ticket(s) de caisse</div>
            </div>

            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                value={searchClient}
                onChange={(e) => setSearchClient(e.target.value)}
                placeholder="Filtrer par client, N° ticket..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:bg-white focus:ring-1 focus:ring-primary"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">Date & Heure</th>
                    <th className="px-4 py-3.5">N° Ticket</th>
                    <th className="px-4 py-3.5">Client</th>
                    <th className="px-4 py-3.5 text-right">Articles</th>
                    <th className="px-4 py-3.5">Règlement</th>
                    <th className="px-4 py-3.5 text-right">Montant</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        Aucune vente trouvée
                      </td>
                    </tr>
                  )}
                  {filteredSales.slice(0, 100).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">
                        {new Date(s.date).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        #{s.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">
                        {s.customer_name || <span className="text-slate-400 font-normal">Client Comptoir</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-700">
                        {(s.items || []).length} art.
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md uppercase">
                          {s.payment_method || "cash"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-black text-primary">
                        {formatXOF(s.total_amount)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedSale(s)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" /> Ticket
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TOP PRODUCTS FULL LIST */}
      {/* ========================================================================= */}
      {tab === "top" && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-16 text-center">Rang</th>
                  <th className="px-4 py-3.5">Médicament / DCI</th>
                  <th className="px-4 py-3.5 text-right">Quantité Vendue</th>
                  <th className="px-4 py-3.5 text-right">Chiffre d'Affaires</th>
                  <th className="px-4 py-3.5 text-right">Marge Brute</th>
                  <th className="px-4 py-3.5 text-right">Taux (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!summaryData?.margins || summaryData.margins.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      Aucune donnée de vente sur la période
                    </td>
                  </tr>
                )}
                {(summaryData?.margins || []).map((r, i) => (
                  <tr key={r.product_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-500">
                      <span className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-[10px] ${
                        i === 0 ? "bg-amber-100 text-amber-900 font-bold" : i === 1 ? "bg-slate-200 text-slate-800" : i === 2 ? "bg-amber-50 text-amber-800" : "text-slate-400"
                      }`}>
                        #{i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{r.name}</div>
                      {r.dci && <div className="text-[10px] text-slate-400 font-normal">{r.dci}</div>}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">{r.qty}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-black text-primary">{formatXOF(r.revenue)}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-800">{formatXOF(r.margin)}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-700">{r.margin_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PROFIT MARGINS TABLE */}
      {/* ========================================================================= */}
      {tab === "margins" && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Médicament</th>
                  <th className="px-4 py-3.5 text-right">Qté</th>
                  <th className="px-4 py-3.5 text-right">Chiffre d'Affaires</th>
                  <th className="px-4 py-3.5 text-right">Coût d'Achat</th>
                  <th className="px-4 py-3.5 text-right">Marge Nette</th>
                  <th className="px-4 py-3.5 text-right">Taux de Marge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!summaryData?.margins || summaryData.margins.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      Aucune donnée de marge disponible
                    </td>
                  </tr>
                )}
                {(summaryData?.margins || []).map((r) => (
                  <tr key={r.product_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{r.name}</div>
                      {r.dci && <div className="text-[10px] text-slate-400 font-normal">{r.dci}</div>}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-700">{r.qty}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">{formatXOF(r.revenue)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-500">{formatXOF(r.cost)}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-800">{formatXOF(r.margin)}</td>
                    <td className="px-4 py-3.5 text-right font-mono">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        (r.margin_pct || 0) >= 25 ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"
                      }`}>
                        {r.margin_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical Receipt Modal */}
      {selectedSale && (
        <ReceiptModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </div>
  );
}
