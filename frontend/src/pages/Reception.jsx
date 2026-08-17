import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import {
  Plus, Trash2, CheckCircle2, Calculator, PackagePlus, ArrowUpDown,
  ArrowUp, ArrowDown, Search, Filter, Calendar, Boxes, RefreshCw,
  Clock, Truck, Check, Sparkles, Eye
} from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";

const emptyLine = () => ({
  product_id: "",
  batch_number: "",
  expiry_date: "",
  purchase_price: 0,
  quantity: 1,
});

export default function Reception() {
  const { t } = useI18n();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [recentBatches, setRecentBatches] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Sorting state for current entry lines
  const [sortField, setSortField] = useState("batch_number");
  const [sortAsc, setSortAsc] = useState(true);

  // Search & Sorting state for received batches history
  const [historySearch, setHistorySearch] = useState("");
  const [historySortField, setHistorySortField] = useState("batch_number");
  const [historySortAsc, setHistorySortAsc] = useState(true);

  const loadInitialData = () => {
    setLoadingBatches(true);
    Promise.all([
      api.get("/products").then((r) => setProducts(r.data || [])).catch(() => {}),
      api.get("/suppliers").then((r) => setSuppliers(r.data || [])).catch(() => {}),
      api.get("/batches").then((r) => setRecentBatches(r.data || [])).catch(() => {}),
    ]).finally(() => setLoadingBatches(false));
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i, field, value) => {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        return { ...l, [field]: value };
      })
    );
  };

  // Sort current entry lines
  const handleSortLines = (field) => {
    const isSame = sortField === field;
    const newAsc = isSame ? !sortAsc : true;
    setSortField(field);
    setSortAsc(newAsc);

    setLines((prevLines) => {
      const sorted = [...prevLines].sort((a, b) => {
        if (field === "batch_number") {
          const valA = (a.batch_number || "").trim().toLowerCase();
          const valB = (b.batch_number || "").trim().toLowerCase();
          return newAsc ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
        }
        if (field === "product_name") {
          const pA = (products.find((p) => p.id === a.product_id)?.nom_commercial || "").toLowerCase();
          const pB = (products.find((p) => p.id === b.product_id)?.nom_commercial || "").toLowerCase();
          return newAsc ? pA.localeCompare(pB) : pB.localeCompare(pA);
        }
        if (field === "expiry_date") {
          const valA = a.expiry_date || "9999-99-99";
          const valB = b.expiry_date || "9999-99-99";
          return newAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (field === "quantity") {
          const valA = parseInt(a.quantity) || 0;
          const valB = parseInt(b.quantity) || 0;
          return newAsc ? valA - valB : valB - valA;
        }
        if (field === "purchase_price") {
          const valA = parseFloat(a.purchase_price) || 0;
          const valB = parseFloat(b.purchase_price) || 0;
          return newAsc ? valA - valB : valB - valA;
        }
        return 0;
      });
      return sorted;
    });

    const labels = {
      batch_number: "N° de Lot",
      product_name: "Nom de Produit",
      expiry_date: "Date de Péremption",
      quantity: "Quantité",
      purchase_price: "Prix d'Achat",
    };
    toast.success(`Lignes triées par ${labels[field]} (${newAsc ? "A → Z / Croissant" : "Z → A / Décroissant"})`);
  };

  const invoiceTotal = lines.reduce(
    (sum, l) => sum + (parseFloat(l.purchase_price) || 0) * (parseInt(l.quantity) || 0),
    0
  );
  const totalUnits = lines.reduce((sum, l) => sum + (parseInt(l.quantity) || 0), 0);

  const isExpiryClose = (dateStr) => {
    if (!dateStr) return false;
    const exp = new Date(dateStr);
    const now = new Date();
    const diffMonths = (exp.getFullYear() - now.getFullYear()) * 12 + (exp.getMonth() - now.getMonth());
    return diffMonths < 6;
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const items = lines.map((l) => ({
        product_id: l.product_id,
        batch_number: l.batch_number.trim(),
        expiry_date: l.expiry_date,
        purchase_price: parseFloat(l.purchase_price) || 0,
        quantity: parseInt(l.quantity) || 0,
      }));
      await api.post("/reception", { supplier_id: supplierId || null, items });
      toast.success(t("rec_success"));
      setLines([emptyLine()]);
      setSupplierId("");
      // Refresh recent batches table
      api.get("/batches").then((r) => setRecentBatches(r.data || [])).catch(() => {});
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  // Filter and sort received batches history
  const filteredBatches = useMemo(() => {
    let list = [...recentBatches];
    if (historySearch) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter((b) => {
        const pName = (b.product_name || "").toLowerCase();
        const bNum = (b.batch_number || "").toLowerCase();
        const pCode = (b.product_code || "").toLowerCase();
        return pName.includes(q) || bNum.includes(q) || pCode.includes(q);
      });
    }

    list.sort((a, b) => {
      if (historySortField === "batch_number") {
        const valA = (a.batch_number || "").trim().toLowerCase();
        const valB = (b.batch_number || "").trim().toLowerCase();
        return historySortAsc
          ? valA.localeCompare(valB, undefined, { numeric: true })
          : valB.localeCompare(valA, undefined, { numeric: true });
      }
      if (historySortField === "product_name") {
        const valA = (a.product_name || "").toLowerCase();
        const valB = (b.product_name || "").toLowerCase();
        return historySortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (historySortField === "expiry_date") {
        const valA = a.expiry_date || "";
        const valB = b.expiry_date || "";
        return historySortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (historySortField === "quantity") {
        const valA = a.current_quantity ?? a.initial_quantity ?? 0;
        const valB = b.current_quantity ?? b.initial_quantity ?? 0;
        return historySortAsc ? valA - valB : valB - valA;
      }
      if (historySortField === "received_at") {
        const valA = a.received_at || "";
        const valB = b.received_at || "";
        return historySortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return 0;
    });

    return list;
  }, [recentBatches, historySearch, historySortField, historySortAsc]);

  const toggleHistorySort = (field) => {
    if (historySortField === field) {
      setHistorySortAsc(!historySortAsc);
    } else {
      setHistorySortField(field);
      setHistorySortAsc(true);
    }
  };

  return (
    <div className="space-y-8" data-testid="reception-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">{t("nav_reception")} · ENTRÉES EN STOCK</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {t("receive_stock")}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Saisie conforme des arrivages avec contrôle FEFO et tri automatique par N° de lot
          </p>
        </div>

        {/* Invoice Summary Card */}
        <div className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl px-4 py-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-primary flex items-center justify-center flex-shrink-0 border border-emerald-100">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Facture Réception</div>
            <div className="font-heading font-black text-lg text-primary">{formatXOF(invoiceTotal)}</div>
            <div className="text-[10px] text-slate-500">{totalUnits} unité(s) · {lines.length} ligne(s)</div>
          </div>
        </div>
      </div>

      {/* RECEPTION FORM */}
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
        {/* Supplier & metadata bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-100">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
              {t("supplier")}
            </label>
            <SearchableSelect
              value={supplierId}
              onChange={(val) => setSupplierId(val)}
              placeholder="— Sélectionner fournisseur —"
              searchPlaceholder="Rechercher par nom..."
              data-testid="reception-supplier-select"
              options={suppliers.map((s) => ({
                value: s.id,
                label: s.raison_sociale,
                sublabel: s.telephone || ""
              }))}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="leading-relaxed">
              La date de péremption est <strong>strictement obligatoire</strong>. Les médicaments sont ordonnés selon la règle <strong>FEFO</strong> (First Expired, First Out) lors de la délivrance en caisse.
            </span>
          </div>
        </div>

        {/* Quick Sorting Toolbar for Entry Lines */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Trier les lignes saisies :</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleSortLines("batch_number")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                sortField === "batch_number"
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
              title="Trier la liste par N° de lot"
            >
              <span>N° de Lot</span>
              {sortField === "batch_number" ? (
                sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSortLines("product_name")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                sortField === "product_name"
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span>Médicament (A-Z)</span>
              {sortField === "product_name" ? (
                sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSortLines("expiry_date")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                sortField === "expiry_date"
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span>Péremption (FEFO)</span>
              {sortField === "expiry_date" ? (
                sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              )}
            </button>
          </div>
        </div>

        {/* Lines Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100/90 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th
                    onClick={() => handleSortLines("product_name")}
                    className="px-3 py-3 w-96 min-w-[280px] cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Médicament / Produit</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortLines("batch_number")}
                    className="px-3 py-3 w-40 cursor-pointer hover:text-primary transition-colors bg-emerald-50/50"
                  >
                    <div className="flex items-center gap-1.5 text-primary">
                      <span>{t("batch_number")}</span>
                      {sortField === "batch_number" ? (
                        sortAsc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortLines("expiry_date")}
                    className="px-3 py-3 w-36 cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t("expiry")}</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortLines("purchase_price")}
                    className="px-3 py-3 w-32 text-right cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t("purchase_price")} (FCFA)</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortLines("quantity")}
                    className="px-3 py-3 w-24 text-right cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t("quantity")}</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th className="px-3 py-3 w-32 text-right">Sous-total</th>
                  <th className="px-2 py-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l, i) => {
                  const subtotal = (parseFloat(l.purchase_price) || 0) * (parseInt(l.quantity) || 0);
                  const expiryWarning = isExpiryClose(l.expiry_date);

                  return (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors" data-testid={`reception-line-${i}`}>
                      {/* Product Selector with Category info */}
                      <td className="px-3 py-2.5 min-w-[280px]">
                        <SearchableSelect
                          required
                          value={l.product_id}
                          onChange={(val) => updateLine(i, "product_id", val)}
                          placeholder="— Sélectionner produit —"
                          searchPlaceholder="Nom, DCI, code-barres..."
                          data-testid={`reception-product-${i}`}
                          options={products.map((p) => ({
                            value: p.id,
                            label: p.nom_commercial,
                            sublabel: `${p.dci || ""} ${p.code_barre ? `[${p.code_barre}]` : ""}`.trim(),
                            isRx: p.requires_prescription,
                          }))}
                        />
                      </td>

                      {/* Batch Number */}
                      <td className="px-3 py-2.5 bg-emerald-50/20">
                        <input
                          required
                          value={l.batch_number}
                          onChange={(e) => updateLine(i, "batch_number", e.target.value)}
                          data-testid={`reception-batch-${i}`}
                          placeholder="ex: LOT-2026-A"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs text-slate-900 font-bold focus:ring-1 focus:ring-primary"
                        />
                      </td>

                      {/* Expiry Date */}
                      <td className="px-3 py-2.5">
                        <div className="relative">
                          <input
                            required
                            type="date"
                            value={l.expiry_date}
                            onChange={(e) => updateLine(i, "expiry_date", e.target.value)}
                            data-testid={`reception-expiry-${i}`}
                            className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium ${
                              expiryWarning ? "border-amber-400 bg-amber-50/40 text-amber-900 font-bold" : "border-slate-200 text-slate-900"
                            }`}
                          />
                          {expiryWarning && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-600 pointer-events-none" title="Péremption proche (< 6 mois)">
                              ⚠
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Purchase Price */}
                      <td className="px-3 py-2.5">
                        <input
                          required
                          type="number"
                          min="0"
                          step="1"
                          value={l.purchase_price}
                          onChange={(e) => updateLine(i, "purchase_price", e.target.value)}
                          data-testid={`reception-price-${i}`}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-mono font-bold text-xs text-slate-900"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="px-3 py-2.5">
                        <input
                          required
                          type="number"
                          min="1"
                          value={l.quantity}
                          onChange={(e) => updateLine(i, "quantity", e.target.value)}
                          data-testid={`reception-qty-${i}`}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-mono font-bold text-xs text-emerald-800"
                        />
                      </td>

                      {/* Line Subtotal */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                        {formatXOF(subtotal)}
                      </td>

                      {/* Remove Line */}
                      <td className="px-2 py-2.5 text-center">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                            title="Supprimer la ligne"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons & Grand Total */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={addLine}
            data-testid="add-reception-line"
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 transition-colors"
          >
            <Plus className="w-4 h-4 text-primary" /> {t("add_line")} (Tab)
          </button>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total à valider</div>
              <div className="text-base font-heading font-black text-primary">{formatXOF(invoiceTotal)}</div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              data-testid="submit-reception"
              className="w-full sm:w-auto bg-primary hover:bg-[#14532D] text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-900/10 disabled:opacity-50 text-sm transition-all hover:-translate-y-0.5"
            >
              <PackagePlus className="w-4 h-4" />
              <span>{submitting ? "Enregistrement..." : t("receive_stock")}</span>
            </button>
          </div>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* SECTION : HISTORIQUE DES RÉCEPTIONS & LOTS REÇUS AVEC TRI PAR N° DE LOT */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="label-tiny mb-0.5 text-primary font-bold">RÉPERTOIRE DES ARRIVAGES</div>
            <h2 className="font-heading text-lg sm:text-xl font-black text-slate-900">
              Lots Reçus en Rayon & Traçabilité
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Consultez et triez tous les lots enregistrés en pharmacie par numéro de lot, péremption ou produit
            </p>
          </div>

          {/* Search & Sort Controls for History */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Filtrer par N° lot, produit..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              onClick={() => toggleHistorySort("batch_number")}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                historySortField === "batch_number"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>N° de Lot</span>
              {historySortField === "batch_number" ? (
                historySortAsc ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
              ) : (
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
              )}
            </button>

            <button
              onClick={() => toggleHistorySort("expiry_date")}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                historySortField === "expiry_date"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>Péremption</span>
              {historySortField === "expiry_date" ? (
                historySortAsc ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
              ) : (
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
              )}
            </button>

            <button
              onClick={loadInitialData}
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-50 shadow-2xs"
              title="Actualiser la liste des lots"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBatches ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>

        {/* Batches Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th
                    onClick={() => toggleHistorySort("batch_number")}
                    className="px-4 py-3 cursor-pointer hover:text-primary transition-colors bg-emerald-50/50"
                  >
                    <div className="flex items-center gap-1.5 text-primary">
                      <span>N° de Lot</span>
                      {historySortField === "batch_number" ? (
                        historySortAsc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => toggleHistorySort("product_name")}
                    className="px-4 py-3 cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Médicament / Produit</span>
                      {historySortField === "product_name" ? (
                        historySortAsc ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => toggleHistorySort("expiry_date")}
                    className="px-4 py-3 cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Date Péremption</span>
                      {historySortField === "expiry_date" ? (
                        historySortAsc ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => toggleHistorySort("quantity")}
                    className="px-4 py-3 text-right cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Stock Restant</span>
                      {historySortField === "quantity" ? (
                        historySortAsc ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right">Prix d'Achat</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      Aucun lot trouvé correspondant à vos critères de recherche.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.slice(0, 50).map((b) => {
                    const isExp = b.expired || (b.expiry_date && new Date(b.expiry_date) < new Date());
                    const isClose = isExpiryClose(b.expiry_date);

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Lot Badge */}
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 bg-emerald-50/15">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[11px] text-slate-800">
                            {b.batch_number}
                          </span>
                        </td>

                        {/* Product */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{b.product_name}</div>
                          {b.product_code && (
                            <div className="text-[10px] text-slate-400 font-mono">CIP/Code: {b.product_code}</div>
                          )}
                        </td>

                        {/* Expiry */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              isExp
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : isClose
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {b.expiry_date}
                          </span>
                        </td>

                        {/* Stock Quantity */}
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {b.current_quantity ?? b.initial_quantity ?? 0} unités
                        </td>

                        {/* Purchase Price */}
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          {formatXOF(b.purchase_price)}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3 text-center">
                          {b.status === "blocked" ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                              Bloqué
                            </span>
                          ) : isExp ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold uppercase">
                              Périmé
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                              Actif
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
