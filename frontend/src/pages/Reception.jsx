import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { Plus, Trash2, CheckCircle2, Calculator, PackagePlus } from "lucide-react";
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
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data || [])).catch(() => {});
    api.get("/suppliers").then((r) => setSuppliers(r.data || [])).catch(() => {});
  }, []);

  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i, field, value) => {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        return { ...l, [field]: value };
      })
    );
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
        batch_number: l.batch_number,
        expiry_date: l.expiry_date,
        purchase_price: parseFloat(l.purchase_price) || 0,
        quantity: parseInt(l.quantity) || 0,
      }));
      await api.post("/reception", { supplier_id: supplierId || null, items });
      toast.success(t("rec_success"));
      setLines([emptyLine()]);
      setSupplierId("");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="reception-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">{t("nav_reception")} · ENTRÉES EN STOCK</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {t("receive_stock")}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Saisie conforme des arrivages par lot avec contrôle FEFO et validation de péremption
          </p>
        </div>

        {/* Invoice Summary Card */}
        <div className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-xl px-4 py-3 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-primary flex items-center justify-center flex-shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Facture Réception</div>
            <div className="font-heading font-black text-lg text-primary">{formatXOF(invoiceTotal)}</div>
            <div className="text-[10px] text-slate-500">{totalUnits} unité(s) · {lines.length} ligne(s)</div>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
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
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200/60 rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              La date de péremption est <strong>strictement obligatoire</strong> et sera utilisée pour ordonner la délivrance des médicaments selon la règle <strong>FEFO</strong> (First Expired, First Out).
            </span>
          </div>
        </div>

        {/* Lines Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 w-96 min-w-[280px]">Médicament / Produit</th>
                  <th className="px-3 py-3 w-36">{t("batch_number")}</th>
                  <th className="px-3 py-3 w-36">{t("expiry")}</th>
                  <th className="px-3 py-3 w-32 text-right">{t("purchase_price")} (FCFA)</th>
                  <th className="px-3 py-3 w-24 text-right">{t("quantity")}</th>
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
                      <td className="px-3 py-2.5">
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
              className="w-full sm:w-auto bg-primary hover:bg-[#14532D] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-900/10 disabled:opacity-50 text-sm transition-all hover:-translate-y-0.5"
            >
              <PackagePlus className="w-4 h-4" />
              <span>{submitting ? "Enregistrement..." : t("receive_stock")}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
