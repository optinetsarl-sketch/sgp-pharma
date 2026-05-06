import React, { useEffect, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { Plus, Trash2, X, Download } from "lucide-react";
import { toast } from "sonner";

export default function Orders() {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState([{ product_id: "", quantity: 1, unit_price: 0 }]);
  const [notes, setNotes] = useState("");

  const reload = () => api.get("/purchase-orders").then((r) => setOrders(r.data));
  useEffect(() => {
    reload();
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/suppliers").then((r) => setSuppliers(r.data));
  }, []);

  const total = lines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseInt(l.quantity) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        supplier_id: supplierId,
        items: lines.map((l) => ({ product_id: l.product_id, quantity: parseInt(l.quantity), unit_price: parseFloat(l.unit_price) })),
        notes,
      };
      await api.post("/purchase-orders", payload);
      toast.success(t("saved"));
      setShowForm(false); setSupplierId(""); setLines([{ product_id: "", quantity: 1, unit_price: 0 }]); setNotes("");
      reload();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const updateStatus = async (oid, status) => {
    try { await api.put(`/purchase-orders/${oid}/status`, null, { params: { status } }); reload(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const supplierName = (sid) => suppliers.find((s) => s.id === sid)?.raison_sociale || "?";

  const downloadPdf = async (oid) => {
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/purchase-orders/${oid}/pdf`;
    const token = localStorage.getItem("sgp_access_token");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { toast.error("Erreur PDF"); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bon-commande-${oid.slice(0, 8)}.pdf`;
    a.click();
  };

  return (
    <div className="p-6 md:p-8 space-y-4" data-testid="orders-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-tiny mb-1">{t("nav_orders")}</div>
          <h1 className="font-heading text-3xl font-black tracking-tight">Bons de commande</h1>
        </div>
        <button onClick={() => setShowForm(true)} data-testid="add-order-btn" className="bg-primary text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold"><Plus className="w-4 h-4" /> {t("create_order")}</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">{t("date")}</th><th className="px-4 py-3">{t("supplier")}</th><th className="px-4 py-3 text-right">{t("items_count")}</th><th className="px-4 py-3 text-right">{t("total")}</th><th className="px-4 py-3">{t("status")}</th><th className="px-4 py-3 text-right">{t("actions")}</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t("no_data")}</td></tr>}
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-gray-100 table-row-hover">
                <td className="px-4 py-3 text-xs">{new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3 font-semibold">{supplierName(o.supplier_id)}</td>
                <td className="px-4 py-3 text-right">{o.items.length}</td>
                <td className="px-4 py-3 text-right font-bold">{formatXOF(o.total)}</td>
                <td className="px-4 py-3"><span className="text-xs bg-secondary px-2 py-0.5 rounded">{o.status}</span></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => downloadPdf(o.id)} data-testid={`download-order-pdf-${o.id}`} aria-label="Télécharger PDF" className="p-1.5 hover:bg-emerald-50 hover:text-primary rounded mr-1" title="Télécharger PDF"><Download className="w-3.5 h-3.5" /></button>
                  <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} data-testid={`order-status-${o.id}`} className="text-xs border border-gray-200 rounded px-2 py-1">
                    <option value="draft">draft</option>
                    <option value="validated">validated</option>
                    <option value="partial">partial</option>
                    <option value="received">received</option>
                    <option value="closed">closed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-md w-full max-w-3xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="font-heading text-xl font-bold">{t("create_order")}</h2><button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button></div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div><label className="label-tiny block mb-1">{t("supplier")}</label>
                <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} data-testid="order-supplier-select" className="w-full px-3 py-2 border border-gray-200 rounded-md">
                  <option value="">— {t("select_supplier")} —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
                </select>
              </div>
              <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
                <thead className="bg-gray-50 text-xs uppercase text-muted-foreground"><tr><th className="px-2 py-2 text-left">Produit</th><th className="px-2 py-2 text-right">Qté</th><th className="px-2 py-2 text-right">Prix unit.</th><th></th></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-2"><select required value={l.product_id} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, product_id: e.target.value } : x))} data-testid={`order-line-product-${i}`} className="w-full px-2 py-1 border rounded"><option value="">—</option>{products.map((p) => <option key={p.id} value={p.id}>{p.nom_commercial}</option>)}</select></td>
                      <td className="px-2 py-2"><input required type="number" min="1" value={l.quantity} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))} className="w-20 px-2 py-1 border rounded text-right" /></td>
                      <td className="px-2 py-2"><input required type="number" min="0" step="0.01" value={l.unit_price} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, unit_price: e.target.value } : x))} className="w-28 px-2 py-1 border rounded text-right" /></td>
                      <td className="px-2 py-2">{lines.length > 1 && <button type="button" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-red-600"><Trash2 className="w-4 h-4" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={() => setLines([...lines, { product_id: "", quantity: 1, unit_price: 0 }])} className="text-sm text-primary font-semibold flex items-center gap-1"><Plus className="w-4 h-4" /> {t("add_line")}</button>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" rows={2} />
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <div><span className="label-tiny">{t("total")}: </span><span className="font-heading font-black text-xl text-primary">{formatXOF(total)}</span></div>
                <div className="flex gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-md text-sm">{t("cancel")}</button><button type="submit" data-testid="submit-order" className="bg-primary text-white px-4 py-2 rounded-md text-sm font-semibold">{t("save")}</button></div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
