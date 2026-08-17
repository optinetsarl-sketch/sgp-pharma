import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Calendar, Clock, Search, Filter, Printer, Download, Eye, FileText,
  CreditCard, Banknote, Smartphone, ShoppingBag, ArrowUpRight, RotateCcw,
  ShieldAlert, User, ChevronRight, X, Sparkles, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import ReceiptModal from "@/components/ReceiptModal";

export default function SalesHistory() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState(null);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState(null);

  // Time and Date filters
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const [filterMode, setFilterMode] = useState("today"); // "today", "date", "month", "all"
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [timeSlot, setTimeSlot] = useState("all"); // "all", "morning", "afternoon", "evening", "custom"
  const [timeFrom, setTimeFrom] = useState("08:00");
  const [timeTo, setTimeTo] = useState("20:00");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadSales = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterMode === "today") {
        params.date_filter = todayStr;
      } else if (filterMode === "date") {
        params.date_filter = selectedDate;
      } else if (filterMode === "month") {
        params.month_filter = selectedMonth;
      }

      if (paymentFilter !== "all") {
        params.payment_method = paymentFilter;
      }

      const res = await api.get("/sales", { params });
      setSales(res.data || []);
    } catch (err) {
      toast.error("Impossible de charger l'historique des ventes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [filterMode, selectedDate, selectedMonth, paymentFilter]);

  // Filter in memory by Time and Search Query
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      // 1. Time filtering (based on HH:mm of sale.date)
      const saleDt = new Date(s.date);
      const hours = saleDt.getHours();
      const mins = saleDt.getMinutes();
      const totalMinutes = hours * 60 + mins;

      if (timeSlot === "morning") {
        // 07:00 -> 12:30 (420 -> 750)
        if (totalMinutes < 420 || totalMinutes > 750) return false;
      } else if (timeSlot === "afternoon") {
        // 12:30 -> 18:30 (750 -> 1110)
        if (totalMinutes < 750 || totalMinutes > 1110) return false;
      } else if (timeSlot === "evening") {
        // 18:30 -> 07:00 next day
        if (totalMinutes >= 420 && totalMinutes <= 1110) return false;
      } else if (timeSlot === "custom") {
        const [fh, fm] = timeFrom.split(":").map(Number);
        const [th, tm] = timeTo.split(":").map(Number);
        const fromMin = (fh || 0) * 60 + (fm || 0);
        const toMin = (th || 23) * 60 + (tm || 59);
        if (totalMinutes < fromMin || totalMinutes > toMin) return false;
      }

      // 2. Search query filtering (supports "#FE107E2C", "FE107E2C", client name, products, etc.)
      if (searchQuery.trim()) {
        const rawQ = searchQuery.trim().toLowerCase();
        const cleanQ = rawQ.replace(/^#/, "").trim();

        const matchClient = (s.customer_name?.toLowerCase() || "").includes(rawQ) || (s.customer_name?.toLowerCase() || "").includes(cleanQ);
        const matchId = (s.id?.toLowerCase() || "").includes(cleanQ) || (`#${(s.id || "").toLowerCase()}`).includes(rawQ);
        const matchRef = (s.prescription_ref?.toLowerCase() || "").includes(rawQ) || (s.prescription_ref?.toLowerCase() || "").includes(cleanQ);
        const matchCashier = (s.cashier_name?.toLowerCase() || "").includes(rawQ);
        const matchProducts = s.items?.some((it) =>
          (it.nom_commercial?.toLowerCase() || "").includes(rawQ) ||
          (it.dci?.toLowerCase() || "").includes(rawQ) ||
          (it.nom_commercial?.toLowerCase() || "").includes(cleanQ)
        );

        if (!matchClient && !matchId && !matchRef && !matchCashier && !matchProducts) {
          return false;
        }
      }

      return true;
    });
  }, [sales, timeSlot, timeFrom, timeTo, searchQuery]);

  // Aggregate statistics for the filtered sales
  const stats = useMemo(() => {
    const totalAmount = filteredSales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
    const count = filteredSales.length;
    const avgCart = count > 0 ? Math.round(totalAmount / count) : 0;
    const cashTotal = filteredSales.filter((s) => s.payment_method === "cash").reduce((acc, s) => acc + s.total_amount, 0);
    const mobileTotal = filteredSales.filter((s) => ["mobile_money", "tmoney", "flooz"].includes(s.payment_method)).reduce((acc, s) => acc + s.total_amount, 0);
    const cardTotal = filteredSales.filter((s) => s.payment_method === "card").reduce((acc, s) => acc + s.total_amount, 0);
    const rxCount = filteredSales.filter((s) => s.prescription_ref || s.prescription_image).length;

    return { totalAmount, count, avgCart, cashTotal, mobileTotal, cardTotal, rxCount };
  }, [filteredSales]);

  // Restrict global financial totals (Total encaissé & Espèces vs Mobile Money) to Admin / SuperAdmin
  const canViewFinancialTotals = ["super_admin", "admin"].includes(user?.role);

  const getPaymentBadge = (method) => {
    switch (method) {
      case "cash":
        return { label: "Espèces", icon: Banknote, bg: "bg-emerald-50 text-emerald-800 border-emerald-200" };
      case "mobile_money":
      case "tmoney":
      case "flooz":
        return { label: "T-Money / Flooz", icon: Smartphone, bg: "bg-blue-50 text-blue-800 border-blue-200" };
      case "card":
        return { label: "Carte Bancaire", icon: CreditCard, bg: "bg-purple-50 text-purple-800 border-purple-200" };
      case "insurance":
        return { label: "Assurance", icon: ShieldAlert, bg: "bg-amber-50 text-amber-800 border-amber-200" };
      default:
        return { label: method || "Espèces", icon: Banknote, bg: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  const downloadPdf = async (sid) => {
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/sales/${sid}/receipt.pdf`;
    const token = localStorage.getItem("sgp_access_token");
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Erreur PDF");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ticket-${sid.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Téléchargement du ticket démarré");
    } catch {
      toast.error("Erreur lors de la génération du ticket PDF");
    }
  };

  return (
    <div className="space-y-6" data-testid="sales-history-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">CAISSE & ENCAISSEMENTS · HISTORIQUE</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Journal des Ventes de Caisse
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Consultation chronologique des encaissements par Date, Mois et Heure avec réimpression thermique
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/pos")}
            className="bg-primary hover:bg-[#14532D] text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-md shadow-emerald-900/10 transition-all hover:-translate-y-0.5"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Nouvelle Vente (F2)</span>
          </button>
          <button
            onClick={loadSales}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs"
            title="Actualiser la liste"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {canViewFinancialTotals ? (
          <>
            <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                <span>Total Encaissé</span>
                <Banknote className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="font-heading font-black text-2xl text-emerald-950">
                {formatXOF(stats.totalAmount)}
              </div>
              <div className="text-[11px] text-emerald-700/90 mt-0.5 font-medium">
                Sur la période sélectionnée
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                <span>Nombre de Tickets</span>
                <ShoppingBag className="w-4 h-4 text-slate-400" />
              </div>
              <div className="font-heading font-black text-2xl text-slate-900">
                {stats.count} <span className="text-sm font-semibold text-slate-500">tickets</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                Panier moyen : <strong>{formatXOF(stats.avgCart)}</strong>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                <span>Espèces vs Mobile Money</span>
                <Smartphone className="w-4 h-4 text-blue-500" />
              </div>
              <div className="space-y-1 mt-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Espèces :</span>
                  <span className="font-bold text-emerald-700">{formatXOF(stats.cashTotal)}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Mobile Money :</span>
                  <span className="font-bold text-blue-700">{formatXOF(stats.mobileTotal)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                <span>Ordonnances Validées</span>
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
              <div className="font-heading font-black text-2xl text-slate-900">
                {stats.rxCount} <span className="text-sm font-semibold text-slate-500">avec Rx</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                Médicaments contrôlés délivrés
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                <span>Tickets Encaissés</span>
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="font-heading font-black text-2xl text-slate-900">
                {stats.count} <span className="text-sm font-semibold text-slate-500">ventes</span>
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                Sur la période consultée
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                <span>Ordonnances Traitées</span>
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
              <div className="font-heading font-black text-2xl text-slate-900">
                {stats.rxCount} <span className="text-sm font-semibold text-slate-500">ordonnance(s)</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                Médicaments contrôlés validés
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                <span>Période Active</span>
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div className="font-heading font-bold text-base text-slate-900 truncate">
                {filterMode === "today" ? "Aujourd'hui" : filterMode === "date" ? selectedDate : filterMode === "month" ? selectedMonth : "Tout"}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                Créneau : {timeSlot === "all" ? "Journée complète" : timeSlot === "morning" ? "Matin" : timeSlot === "afternoon" ? "Après-midi" : "Soirée"}
              </div>
            </div>

            <div
              onClick={() => navigate("/pos")}
              className="border rounded-2xl p-4 shadow-xs bg-gradient-to-br from-emerald-800 to-emerald-950 text-white cursor-pointer group flex flex-col justify-between hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">Accès Caisse</div>
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              </div>
              <div className="font-heading font-black text-lg text-white flex items-center justify-between">
                <span>Ouvrir Caisse</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
              <div className="text-[10px] text-emerald-200/80 font-medium">Raccourci F2</div>
            </div>
          </>
        )}
      </div>

      {/* Main Filter Control Box */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        {/* Row 1: Date and Period Switchers */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider">
              Période :
            </span>
            {[
              { id: "today", label: "Aujourd'hui (Journée en cours)" },
              { id: "date", label: "Date précise" },
              { id: "month", label: "Tout le mois" },
              { id: "all", label: "Tout l'historique" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterMode(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterMode === tab.id
                    ? "bg-primary text-white shadow-xs"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dynamic Date/Month Selectors */}
          {filterMode === "date" && (
            <div className="flex items-center gap-2 animate-in fade-in">
              <Calendar className="w-4 h-4 text-primary" />
              <label className="text-xs font-bold text-slate-700">Choisir la date :</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
              />
            </div>
          )}

          {filterMode === "month" && (
            <div className="flex items-center gap-2 animate-in fade-in">
              <Calendar className="w-4 h-4 text-primary" />
              <label className="text-xs font-bold text-slate-700">Choisir le mois :</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
              />
            </div>
          )}
        </div>

        {/* Row 2: Time / Slot & Payment & Search Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Time Slot Filter */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Filtrer par Heure :</span>
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white"
              >
                <option value="all">Toute la journée (00h - 24h)</option>
                <option value="morning">Matin (07h00 - 12h30)</option>
                <option value="afternoon">Après-midi (12h30 - 18h30)</option>
                <option value="evening">Soirée & Garde (18h30 - 07h00)</option>
                <option value="custom">Tranche horaire personnalisée...</option>
              </select>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1 uppercase tracking-wider">
              <CreditCard className="w-3.5 h-3.5 text-primary" />
              <span>Mode de Paiement :</span>
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white"
            >
              <option value="all">Tous les modes de règlement</option>
              <option value="cash">Espèces (Cash)</option>
              <option value="mobile_money">Mobile Money (T-Money / Flooz)</option>
              <option value="card">Carte bancaire</option>
              <option value="insurance">Assurance maladie</option>
            </select>
          </div>

          {/* Live Search Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1 uppercase tracking-wider">
              <Search className="w-3.5 h-3.5 text-primary" />
              <span>Recherche en Direct :</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Client, N° Ticket, Médicament..."
                className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-1 focus:ring-primary"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Custom Hour Range (if custom selected) */}
        {timeSlot === "custom" && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs animate-in fade-in">
            <span className="font-bold text-emerald-950">De :</span>
            <input
              type="time"
              value={timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
              className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-xs text-emerald-950"
            />
            <span className="font-bold text-emerald-950">À :</span>
            <input
              type="time"
              value={timeTo}
              onChange={(e) => setTimeTo(e.target.value)}
              className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-xs text-emerald-950"
            />
          </div>
        )}
      </div>

      {/* Sales List Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Heure & Date</th>
                <th className="px-4 py-3.5">N° Ticket & Client</th>
                <th className="px-4 py-3.5">Articles & Détails</th>
                <th className="px-4 py-3.5">Règlement</th>
                <th className="px-4 py-3.5">Ordonnance</th>
                <th className="px-4 py-3.5 text-right">Total Encaissé</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
                    <div className="font-bold text-slate-600">Aucune vente trouvée pour ces critères</div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Modifiez les filtres de date, d'heure ou le terme de recherche
                    </p>
                  </td>
                </tr>
              )}

              {filteredSales.map((sale) => {
                const saleDate = new Date(sale.date);
                const timeFormatted = saleDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                const dateFormatted = saleDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
                const pay = getPaymentBadge(sale.payment_method);
                const PayIcon = pay.icon;

                return (
                  <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Hour & Date */}
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-black text-sm text-emerald-950 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>{timeFormatted}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {dateFormatted}
                      </div>
                    </td>

                    {/* Ticket & Client */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <span>{sale.customer_name || "Client Comptoir"}</span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                        #{sale.id.slice(0, 8).toUpperCase()} · Caissier : <strong>{sale.cashier_name || "Opérateur"}</strong>
                      </div>
                    </td>

                    {/* Sold Products */}
                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {(sale.items || []).slice(0, 3).map((it, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 rounded-md text-[10px] font-medium"
                          >
                            <span className="font-bold text-primary">{it.quantity}x</span>
                            <span className="truncate max-w-[120px]">{it.nom_commercial}</span>
                          </span>
                        ))}
                        {(sale.items || []).length > 3 && (
                          <span className="text-[10px] text-slate-500 font-bold self-center">
                            +{(sale.items || []).length - 3} autre(s)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Payment Method */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${pay.bg}`}>
                        <PayIcon className="w-3 h-3" />
                        <span>{pay.label}</span>
                      </span>
                    </td>

                    {/* Prescription Badge */}
                    <td className="px-4 py-3.5">
                      {sale.prescription_ref || sale.prescription_image ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <FileText className="w-3 h-3 text-amber-600" />
                          <span>Rx : {sale.prescription_ref || "Photo"}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal">Sans Rx</span>
                      )}
                    </td>

                    {/* Total Amount */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="font-mono font-black text-sm text-primary">
                        {formatXOF(sale.total_amount)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {(sale.items || []).length} article(s)
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedSaleForReceipt(sale)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors shadow-2xs"
                          title="Imprimer Ticket de Caisse Thermique (80mm)"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Ticket</span>
                        </button>

                        <button
                          onClick={() => setSelectedSaleDetail(sale)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shadow-2xs"
                          title="Voir le détail complet"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => downloadPdf(sale.id)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shadow-2xs"
                          title="Télécharger reçu PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thermal Receipt Print Modal */}
      {selectedSaleForReceipt && (
        <ReceiptModal
          sale={selectedSaleForReceipt}
          onClose={() => setSelectedSaleForReceipt(null)}
        />
      )}

      {/* Sale Detail Inspection Modal */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-base text-slate-900">
                    Détail du Ticket #{selectedSaleDetail.id.slice(0, 8).toUpperCase()}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {new Date(selectedSaleDetail.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Customer & Cashier Info */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Client</div>
                  <div className="font-bold text-slate-900">{selectedSaleDetail.customer_name || "Client Comptoir"}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Caissier / Opérateur</div>
                  <div className="font-bold text-slate-900">{selectedSaleDetail.cashier_name || "Opérateur"}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Mode de règlement</div>
                  <div className="font-bold text-emerald-700">{selectedSaleDetail.payment_method?.toUpperCase()}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Ordonnance</div>
                  <div className="font-bold text-amber-700">{selectedSaleDetail.prescription_ref || "Aucune"}</div>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100/80 text-left text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Article</th>
                      <th className="px-3 py-2 text-right">Qté</th>
                      <th className="px-3 py-2 text-right">P.U.</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedSaleDetail.items || []).map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2">
                          <div className="font-bold text-slate-900">{it.nom_commercial}</div>
                          {it.dci && <div className="text-[10px] text-slate-400">{it.dci}</div>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{it.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatXOF(it.unit_price)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-primary">{formatXOF(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Footer */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <span className="font-bold text-emerald-950 text-sm">TOTAL ENCAISSÉ :</span>
                <span className="font-mono font-black text-xl text-primary">{formatXOF(selectedSaleDetail.total_amount)}</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedSaleForReceipt(selectedSaleDetail);
                  setSelectedSaleDetail(null);
                }}
                className="bg-primary hover:bg-[#14532D] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer Ticket Thermique</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
