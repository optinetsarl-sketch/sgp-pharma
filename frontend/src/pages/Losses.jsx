import React, { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

export default function Losses() {
  const { t } = useI18n();
  const [losses, setLosses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ batch_id: "", quantity: 1, motif: "casse", notes: "" });

  const reload = () => {
    api.get("/losses").then((r) => setLosses(r.data));
    api.get("/batches").then((r) => setBatches(r.data.filter((b) => b.current_quantity > 0)));
  };
  useEffect(() => { reload(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/losses", { ...form, quantity: parseInt(form.quantity) });
      toast.success(t("saved"));
      setShowForm(false); setForm({ batch_id: "", quantity: 1, motif: "casse", notes: "" });
      reload();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <div className="p-6 md:p-8 space-y-4" data-testid="losses-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-tiny mb-1">{t("nav_losses")}</div>
          <h1 className="font-heading text-3xl font-black tracking-tight">Pertes</h1>
        </div>
        <button onClick={() => setShowForm(true)} data-testid="declare-loss-btn" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold">
          <AlertTriangle className="w-4 h-4" /> {t("declare_loss")}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">{t("date")}</th><th className="px-4 py-3">Produit</th><th className="px-4 py-3 text-right">{t("quantity")}</th><th className="px-4 py-3">{t("motif")}</th><th className="px-4 py-3">Notes</th></tr>
          </thead>
          <tbody>
            {losses.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">{t("no_data")}</td></tr>}
            {losses.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 table-row-hover">
                <td className="px-4 py-3 text-xs">{new Date(l.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 font-semibold">{l.product_name}</td>
                <td className="px-4 py-3 text-right font-bold text-red-600">{l.quantity}</td>
                <td className="px-4 py-3"><span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded">{t(l.motif)}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{l.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-md w-full max-w-md border border-gray-200">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="font-heading text-xl font-bold">{t("declare_loss")}</h2><button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button></div>
            <form onSubmit={submit} className="p-5 space-y-3">
              <div>
                <label className="label-tiny block mb-1">Lot</label>
                <select required value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })} data-testid="loss-batch-select" className="w-full px-3 py-2 border border-gray-200 rounded-md">
                  <option value="">— Sélectionner —</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.product_name} - {b.batch_number} (stock {b.current_quantity})</option>)}
                </select>
              </div>
              <div>
                <label className="label-tiny block mb-1">{t("quantity")}</label>
                <input required type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} data-testid="loss-quantity-input" className="w-full px-3 py-2 border border-gray-200 rounded-md" />
              </div>
              <div>
                <label className="label-tiny block mb-1">{t("motif")}</label>
                <select value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} data-testid="loss-motif-select" className="w-full px-3 py-2 border border-gray-200 rounded-md">
                  <option value="peremption">{t("peremption")}</option>
                  <option value="casse">{t("casse")}</option>
                  <option value="vol">{t("vol")}</option>
                </select>
              </div>
              <div>
                <label className="label-tiny block mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-md" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-md text-sm">{t("cancel")}</button>
                <button type="submit" data-testid="submit-loss" className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-semibold">{t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
