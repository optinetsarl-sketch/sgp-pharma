import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import FEFOBadge from "@/components/FEFOBadge";
import {
  Lock, Boxes, AlertTriangle, CheckCircle2, ShieldAlert, Search, X,
  PackageCheck, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight,
  Layers, List, Package, Calendar, RefreshCw, Eye, Tag, Pill
} from "lucide-react";
import { toast } from "sonner";

export default function Stock() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("");
  const [statusTab, setStatusTab] = useState("all"); // all, active, expiring, blocked, depleted
  const [viewMode, setViewMode] = useState("grouped"); // 'grouped' (Par Numéro de Lot) ou 'flat' (Table individuelle)
  const [expandedLots, setExpandedLots] = useState(new Set()); // Set of expanded lot numbers

  // Sorting state
  const [sortField, setSortField] = useState("batch_number");
  const [sortAsc, setSortAsc] = useState(true);

  // Selected Lot Details Modal
  const [selectedLotModal, setSelectedLotModal] = useState(null);

  const reload = () => {
    api.get("/batches").then((r) => setBatches(r.data || [])).catch(() => {});
    api.get("/products").then((r) => setProducts(r.data || [])).catch(() => {});
  };

  useEffect(() => {
    reload();
  }, []);

  const block = async (b) => {
    if (!window.confirm(`Bloquer le lot ${b.batch_number} (${b.product_name}) ? Ce lot ne pourra plus être vendu.`)) return;
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

  // Global Stats
  const stats = useMemo(() => {
    const active = batches.filter((b) => b.status === "active" && b.current_quantity > 0);
    const expiring = batches.filter((b) => b.status === "active" && (isExpiring30(b.expiry_date) || isExpired(b.expiry_date)));
    const blocked = batches.filter((b) => b.status === "blocked");
    const totalValue = active.reduce((sum, b) => sum + b.current_quantity * (b.purchase_price || 0), 0);
    const uniqueLots = new Set(batches.map((b) => (b.batch_number || "").trim())).size;
    return { activeCount: active.length, expiringCount: expiring.length, blockedCount: blocked.length, totalValue, uniqueLots };
  }, [batches]);

  // Filtered raw batches
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
        normalize(b.batch_number).includes(f) ||
        normalize(b.product_code).includes(f)
      );
    });
  }, [batches, filter, statusTab]);

  // Flat sorted batches
  const sortedBatches = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      if (sortField === "batch_number") {
        const valA = (a.batch_number || "").trim().toLowerCase();
        const valB = (b.batch_number || "").trim().toLowerCase();
        return sortAsc
          ? valA.localeCompare(valB, undefined, { numeric: true })
          : valB.localeCompare(valA, undefined, { numeric: true });
      }
      if (sortField === "product_name") {
        const valA = (a.product_name || "").toLowerCase();
        const valB = (b.product_name || "").toLowerCase();
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortField === "expiry_date") {
        const valA = a.expiry_date || "";
        const valB = b.expiry_date || "";
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortField === "quantity") {
        const valA = a.current_quantity ?? 0;
        const valB = b.current_quantity ?? 0;
        return sortAsc ? valA - valB : valB - valA;
      }
      if (sortField === "purchase_price") {
        const valA = a.purchase_price ?? 0;
        const valB = b.purchase_price ?? 0;
        return sortAsc ? valA - valB : valB - valA;
      }
      return 0;
    });
    return list;
  }, [filtered, sortField, sortAsc]);

  // Grouped batches by Lot Number
  const groupedByLot = useMemo(() => {
    const map = new Map();
    for (const b of filtered) {
      const lotKey = (b.batch_number || "SANS-LOT").trim();
      if (!map.has(lotKey)) {
        map.set(lotKey, {
          batch_number: lotKey,
          items: [],
          totalQuantity: 0,
          totalValue: 0,
          earliestExpiry: null,
          latestExpiry: null,
          hasBlocked: false,
          hasExpiring: false,
          hasExpired: false,
        });
      }
      const group = map.get(lotKey);
      group.items.push(b);
      group.totalQuantity += b.current_quantity || 0;
      group.totalValue += (b.current_quantity || 0) * (b.purchase_price || 0);

      if (!group.earliestExpiry || b.expiry_date < group.earliestExpiry) {
        group.earliestExpiry = b.expiry_date;
      }
      if (!group.latestExpiry || b.expiry_date > group.latestExpiry) {
        group.latestExpiry = b.expiry_date;
      }
      if (b.status === "blocked") group.hasBlocked = true;
      if (isExpiring30(b.expiry_date)) group.hasExpiring = true;
      if (isExpired(b.expiry_date)) group.hasExpired = true;
    }

    const groups = Array.from(map.values());
    groups.sort((a, b) => {
      if (sortField === "batch_number") {
        return sortAsc
          ? a.batch_number.localeCompare(b.batch_number, undefined, { numeric: true })
          : b.batch_number.localeCompare(a.batch_number, undefined, { numeric: true });
      }
      if (sortField === "expiry_date") {
        const expA = a.earliestExpiry || "9999-99-99";
        const expB = b.earliestExpiry || "9999-99-99";
        return sortAsc ? expA.localeCompare(expB) : expB.localeCompare(expA);
      }
      if (sortField === "quantity") {
        return sortAsc ? a.totalQuantity - b.totalQuantity : b.totalQuantity - a.totalQuantity;
      }
      if (sortField === "products_count") {
        return sortAsc ? a.items.length - b.items.length : b.items.length - a.items.length;
      }
      return 0;
    });
    return groups;
  }, [filtered, sortField, sortAsc]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const toggleLotAccordion = (lotNumber) => {
    setExpandedLots((prev) => {
      const next = new Set(prev);
      if (next.has(lotNumber)) {
        next.delete(lotNumber);
      } else {
        next.add(lotNumber);
      }
      return next;
    });
  };

  const expandAllLots = () => {
    setExpandedLots(new Set(groupedByLot.map((g) => g.batch_number)));
  };

  const collapseAllLots = () => {
    setExpandedLots(new Set());
  };

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
            Gestion et consultation par <strong>Numéro de Lot</strong> avec liste détaillée des médicaments associés
          </p>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs self-start sm:self-auto">
          <button
            onClick={() => setViewMode("grouped")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === "grouped"
                ? "bg-white text-primary shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Vue par Numéro de Lot</span>
          </button>

          <button
            onClick={() => setViewMode("flat")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === "flat"
                ? "bg-white text-primary shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Vue Table Détaillée</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Lots répertoriés</span>
            <Tag className="w-4 h-4 text-primary" />
          </div>
          <div className="font-heading font-black text-2xl text-slate-900 mt-1">{stats.uniqueLots}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{stats.activeCount} lots actifs en rayon</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Valeur du stock (Achat)</span>
            <Boxes className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-heading font-black text-2xl text-emerald-800 mt-1">{formatXOF(stats.totalValue)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Valorisation à prix d'achat</div>
        </div>

        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-800 uppercase">Péremption &lt; 30j / Expirés</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-heading font-black text-2xl text-amber-900 mt-1">{stats.expiringCount}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">À prioriser en caisse (FEFO)</div>
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

      {/* Filter Tabs, Search & Sort Toolbars */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
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

          {/* Search Bar */}
          <div className="w-full lg:w-80 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Rechercher par N° de lot, médicament, code..."
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

        {/* Quick Sorting & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">Trier par :</span>

            <button
              onClick={() => toggleSort("batch_number")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                sortField === "batch_number"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs font-black"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>N° de Lot</span>
              {sortField === "batch_number" ? (
                sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
              ) : (
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              )}
            </button>

            <button
              onClick={() => toggleSort("expiry_date")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                sortField === "expiry_date"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs font-black"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>Date Péremption (FEFO)</span>
              {sortField === "expiry_date" ? (
                sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
              ) : (
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              )}
            </button>

            <button
              onClick={() => toggleSort("quantity")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                sortField === "quantity"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs font-black"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>Quantité en stock</span>
              {sortField === "quantity" ? (
                sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
              ) : (
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              )}
            </button>
          </div>

          {viewMode === "grouped" && (
            <div className="flex items-center gap-2">
              <button
                onClick={expandAllLots}
                className="text-[11px] font-bold text-primary hover:underline px-2 py-1"
              >
                Tout déplier
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={collapseAllLots}
                className="text-[11px] font-bold text-slate-500 hover:underline px-2 py-1"
              >
                Tout replier
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. VUE GROUPÉE PAR NUMÉRO DE LOT (ACCORDÉON INTERACTIF)                   */}
      {/* ========================================================================= */}
      {viewMode === "grouped" ? (
        <div className="space-y-3" data-testid="grouped-lots-container">
          {groupedByLot.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 shadow-sm">
              <Boxes className="w-10 h-10 mx-auto mb-2 opacity-30 text-primary" />
              <div className="font-bold text-slate-700">Aucun lot correspondant</div>
              <div className="text-xs text-slate-400 mt-1">Modifiez vos filtres ou effectuez une nouvelle réception de stock.</div>
            </div>
          ) : (
            groupedByLot.map((group) => {
              const isExpanded = expandedLots.has(group.batch_number);

              return (
                <div
                  key={group.batch_number}
                  className={`bg-white border rounded-2xl transition-all shadow-xs overflow-hidden ${
                    isExpanded ? "border-primary/40 ring-1 ring-primary/20" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Lot Card Header (Clickable to expand) */}
                  <div
                    onClick={() => toggleLotAccordion(group.batch_number)}
                    className={`px-5 py-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors select-none ${
                      isExpanded ? "bg-emerald-50/30" : "hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform ${
                        isExpanded ? "bg-primary text-white rotate-90" : "bg-slate-100 text-slate-600"
                      }`}>
                        <ChevronRight className="w-4 h-4" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/80">
                            N° Lot : {group.batch_number}
                          </span>
                          <span className="text-xs font-bold text-primary bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            {group.items.length} produit{group.items.length > 1 ? "s" : ""} rattaché{group.items.length > 1 ? "s" : ""}
                          </span>
                          {group.hasBlocked && (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md uppercase">
                              Contient lot bloqué
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                          <span>Date péremption : <strong className="text-slate-800">{group.earliestExpiry || "N/A"}</strong></span>
                          <span>·</span>
                          <span className="text-emerald-800 font-bold">{group.totalQuantity} unités au total</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Valeur totale du lot</div>
                        <div className="font-mono font-black text-sm text-slate-900">{formatXOF(group.totalValue)}</div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLotModal(group);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
                        title="Ouvrir la fiche complète du lot"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Fiche Lot</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Products Table under this Lot */}
                  {isExpanded && (
                    <div className="border-t border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5 text-primary" />
                        <span>Médicaments & Articles enregistrés sous le lot {group.batch_number} :</span>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100/90 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2.5">Médicament / Produit</th>
                              <th className="px-3 py-2.5">Date Péremption</th>
                              <th className="px-3 py-2.5">Priorité FEFO</th>
                              <th className="px-3 py-2.5 text-right">Quantité</th>
                              <th className="px-3 py-2.5 text-right">Prix d'Achat</th>
                              <th className="px-3 py-2.5 text-right">Valeur</th>
                              <th className="px-3 py-2.5 text-center">Statut</th>
                              {hasRole("admin", "pharmacist") && <th className="px-3 py-2.5 text-right">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.items.map((b) => {
                              const prod = products.find((p) => p.id === b.product_id);
                              const isRx = prod?.requires_prescription;
                              const isExp = b.expired || (b.expiry_date && new Date(b.expiry_date) < new Date());

                              return (
                                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-2.5">
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      <span className={isRx ? "text-red-950" : ""}>{b.product_name}</span>
                                      {isRx && (
                                        <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.2 rounded">
                                          Rx
                                        </span>
                                      )}
                                    </div>
                                    {b.product_code && (
                                      <div className="text-[10px] text-slate-400 font-mono">Code: {b.product_code}</div>
                                    )}
                                  </td>

                                  <td className="px-3 py-2.5 font-medium text-slate-700">
                                    {b.expiry_date}
                                  </td>

                                  <td className="px-3 py-2.5">
                                    <FEFOBadge expiryDate={b.expiry_date} />
                                  </td>

                                  <td className="px-3 py-2.5 text-right font-mono font-black text-sm text-emerald-900">
                                    {b.current_quantity} unités
                                  </td>

                                  <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                                    {formatXOF(b.purchase_price)}
                                  </td>

                                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                                    {formatXOF((b.current_quantity || 0) * (b.purchase_price || 0))}
                                  </td>

                                  <td className="px-3 py-2.5 text-center">
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                        b.status === "blocked"
                                          ? "bg-red-50 text-red-700 border-red-200"
                                          : isExp
                                          ? "bg-red-50 text-red-700 border-red-200"
                                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      }`}
                                    >
                                      {b.status === "blocked" ? "Bloqué" : isExp ? "Périmé" : "Actif"}
                                    </span>
                                  </td>

                                  {hasRole("admin", "pharmacist") && (
                                    <td className="px-3 py-2.5 text-right">
                                      {b.status === "active" && (
                                        <button
                                          onClick={() => block(b)}
                                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                                          title="Bloquer ce lot pour la vente"
                                        >
                                          <Lock className="w-3 h-3" /> Bloquer
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
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. VUE TABLE INDIVIDUELLE AVEC TRI DIRECT PAR N° DE LOT                    */
        /* ========================================================================= */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="batches-table">
              <thead className="bg-slate-100/90 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th
                    onClick={() => toggleSort("batch_number")}
                    className="px-4 py-3 cursor-pointer hover:text-primary transition-colors bg-emerald-50/50"
                  >
                    <div className="flex items-center gap-1.5 text-primary">
                      <span>{t("batch_number")}</span>
                      {sortField === "batch_number" ? (
                        sortAsc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort("product_name")}
                    className="px-4 py-3 cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Produit / Médicament</span>
                      {sortField === "product_name" ? (
                        sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort("expiry_date")}
                    className="px-4 py-3 cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t("expiry")}</span>
                      {sortField === "expiry_date" ? (
                        sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3">Priorité FEFO</th>
                  <th
                    onClick={() => toggleSort("quantity")}
                    className="px-4 py-3 text-right cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t("quantity")}</span>
                      {sortField === "quantity" ? (
                        sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right">{t("purchase_price")}</th>
                  <th className="px-4 py-3">{t("status")}</th>
                  {hasRole("admin", "pharmacist") && <th className="px-4 py-3 text-right">{t("actions")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <div>{t("no_data")}</div>
                    </td>
                  </tr>
                ) : (
                  sortedBatches.map((b) => {
                    const prod = products.find((p) => p.id === b.product_id);
                    const isRx = prod?.requires_prescription;

                    return (
                      <tr
                        key={b.id}
                        onClick={() => {
                          const grp = groupedByLot.find((g) => g.batch_number === b.batch_number);
                          if (grp) setSelectedLotModal(grp);
                        }}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        data-testid={`batch-row-${b.id}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900 bg-emerald-50/20">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md">
                            {b.batch_number}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className={isRx ? "text-red-950 font-bold" : ""}>{b.product_name}</span>
                            {isRx && (
                              <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.2 rounded shadow-2xs">
                                Rx
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-medium text-slate-700">
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
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {b.status === "active" && (
                              <button
                                onClick={() => block(b)}
                                data-testid={`block-batch-${b.id}`}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 ml-auto"
                                title="Bloquer ce lot pour empêcher toute vente"
                              >
                                <Lock className="w-3 h-3" /> {t("block")}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FICHE DÉTAILLÉE DU LOT (AFFICHE TOUS LES PRODUITS DU LOT)            */}
      {/* ========================================================================= */}
      {selectedLotModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-primary flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-lg text-slate-900">
                    Fiche du Lot : <span className="font-mono text-primary">{selectedLotModal.batch_number}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedLotModal.items.length} médicament(s) enregistré(s) sous ce lot
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLotModal(null)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics in Modal */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Stock total du lot</div>
                <div className="font-mono font-black text-base text-emerald-900 mt-0.5">
                  {selectedLotModal.totalQuantity} unités
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Valeur marchande</div>
                <div className="font-mono font-black text-base text-slate-900 mt-0.5">
                  {formatXOF(selectedLotModal.totalValue)}
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Date Péremption</div>
                <div className="font-mono font-black text-base text-slate-900 mt-0.5">
                  {selectedLotModal.earliestExpiry || "N/A"}
                </div>
              </div>
            </div>

            {/* Products List in Modal */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-left text-[11px] font-bold uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5">Médicament</th>
                    <th className="px-3 py-2.5 text-right">Quantité</th>
                    <th className="px-3 py-2.5 text-right">Prix Achat</th>
                    <th className="px-3 py-2.5 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedLotModal.items.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-2.5 font-bold text-slate-900">
                        {b.product_name}
                        {b.product_code && <div className="text-[10px] font-mono text-slate-400">CIP: {b.product_code}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-800">
                        {b.current_quantity} unités
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                        {formatXOF(b.purchase_price)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLotModal(null)}
                className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-xs hover:bg-[#14532D]"
              >
                Fermer la fiche
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
