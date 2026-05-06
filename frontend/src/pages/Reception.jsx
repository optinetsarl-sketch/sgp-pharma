import React, { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { Plus, Trash2, PackagePlus } from "lucide-react";
import { toast } from "sonner";

export default function Reception() {
  const { t } = useI18n();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState([
    { product_id: "", batch_number: "", expiry_date: "", purchase_price: 0, quantity: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/suppliers").then((r) => setSuppliers(r.data));
  }, []);

  const addLine = () => setLines([...lines, { product_id: "", batch_number: "", expiry_date: "", purchase_price: 0, quantity: 0 }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i, field, value) => setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

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
      setLines([{ product_id: "", batch_number: "", expiry_date: "", purchase_price: 0, quantity: 0 }]);
      setSupplierId("");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="p-6 md:p-8 space-y-4" data-testid="reception-page">
      <div>
        <div className="label-tiny mb-1">{t("nav_reception")}</div>
        <h1 className="font-heading text-3xl font-black tracking-tight">{t("receive_stock")}</h1>
      </div>

      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-md p-5 space-y-4">
        <div className="max-w-md">
          <label className="label-tiny block mb-1">{t("supplier")}</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} data-testid="reception-supplier-select" className="w-full px-3 py-2 border border-gray-200 rounded-md">
            <option value="">— {t("select_supplier")} —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
          </select>
        </div>

        <div className="border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 w-72">Produit</th>
                <th className="px-3 py-2">{t("batch_number")}</th>
                <th className="px-3 py-2">{t("expiry")}</th>
                <th className="px-3 py-2 text-right">{t("purchase_price")}</th>
                <th className="px-3 py-2 text-right">{t("quantity")}</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-gray-100" data-testid={`reception-line-${i}`}>
                  <td className="px-3 py-2">
                    <select required value={l.product_id} onChange={(e) => updateLine(i, "product_id", e.target.value)} data-testid={`reception-product-${i}`} className="w-full px-2 py-1.5 border border-gray-200 rounded">
                      <option value="">— {t("select_product")} —</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.nom_commercial}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2"><input required value={l.batch_number} onChange={(e) => updateLine(i, "batch_number", e.target.value)} data-testid={`reception-batch-${i}`} className="w-full px-2 py-1.5 border border-gray-200 rounded font-mono text-xs" /></td>
                  <td className="px-3 py-2"><input required type="date" value={l.expiry_date} onChange={(e) => updateLine(i, "expiry_date", e.target.value)} data-testid={`reception-expiry-${i}`} className="w-full px-2 py-1.5 border border-gray-200 rounded" /></td>
                  <td className="px-3 py-2"><input required type="number" min="0" step="0.01" value={l.purchase_price} onChange={(e) => updateLine(i, "purchase_price", e.target.value)} data-testid={`reception-price-${i}`} className="w-full px-2 py-1.5 border border-gray-200 rounded text-right" /></td>
                  <td className="px-3 py-2"><input required type="number" min="1" value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} data-testid={`reception-qty-${i}`} className="w-full px-2 py-1.5 border border-gray-200 rounded text-right" /></td>
                  <td className="px-3 py-2 text-right">
                    {lines.length > 1 && <button type="button" onClick={() => removeLine(i)} className="p-1 hover:bg-red-50 hover:text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between">
          <button type="button" onClick={addLine} data-testid="add-reception-line" className="text-sm text-primary font-semibold flex items-center gap-1 hover:underline">
            <Plus className="w-4 h-4" /> {t("add_line")}
          </button>
          <button type="submit" disabled={submitting} data-testid="submit-reception" className="bg-primary hover:bg-[#14532D] text-white px-5 py-2 rounded-md font-semibold flex items-center gap-2 disabled:opacity-50">
            <PackagePlus className="w-4 h-4" /> {t("receive_stock")}
          </button>
        </div>
      </form>
    </div>
  );
}
