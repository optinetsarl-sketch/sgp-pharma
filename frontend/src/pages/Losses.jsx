import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { AlertTriangle, Plus, X, Trash2, ShieldAlert, Sparkles, Skull } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";

export default function Losses() {
  const { t } = useI18n();
  const [losses, setLosses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ batch_id: "", quantity: 1, motif: "casse", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  const reload = () => {
    api.get("/losses").then((r) => setLosses(r.data || [])).catch(() => {});
    api.get("/batches").then((r) => setBatches((r.data || []).filter((b) => b.current_quantity > 0))).catch(() => {});
  };
  useEffect(() => {
    reload();
  }, []);

  const selectedBatch = batches.find((b) => b.id === form.batch_id);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/losses", { ...form, quantity: parseInt(form.quantity) });
      toast.success(t("saved"));
      setShowForm(false);
      setForm({ batch_id: "", quantity: 1, motif: "casse", notes: "" });
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  // Breakdown statistics
  const stats = useMemo(() => {
    const totalQty = losses.reduce((sum, l) => sum + (l.quantity || 0), 0);
    const peremption = losses.filter((l) => l.motif === "peremption").reduce((sum, l) => sum + (l.quantity || 0), 0);
    const casse = losses.filter((l) => l.motif === "casse").reduce((sum, l) => sum + (l.quantity || 0), 0);
    const vol = losses.filter((l) => l.motif === "vol").reduce((sum, l) => sum + (l.quantity || 0), 0);
    return { totalQty, peremption, casse, vol, totalEvents: losses.length };
  }, [losses]);

  return (
    <div className="space-y-6" data-testid="losses-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-red-600 font-bold">{t("nav_losses")} · GESTION DES REBUTS</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Pertes & Dépréciations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Déclaration réglementaire des unités sorties pour péremption, casse ou vol
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          data-testid="declare-loss-btn"
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-md shadow-red-900/10 transition-all hover:-translate-y-0.5"
        >
          <AlertTriangle className="w-4 h-4" /> {t("declare_loss")}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Total pertes déclarées</div>
          <div className="font-heading font-black text-2xl text-slate-900 mt-1">{stats.totalQty} unités</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{stats.totalEvents} déclarations</div>
        </div>

        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 shadow-xs">
          <div className="text-[10px] font-bold text-amber-800 uppercase flex items-center justify-between">
            <span>Péremption</span>
            <Skull className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="font-heading font-black text-2xl text-amber-900 mt-1">{stats.peremption} u.</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Produits périmés</div>
        </div>

        <div className="bg-red-50/80 border border-red-200 rounded-2xl p-4 shadow-xs">
          <div className="text-[10px] font-bold text-red-800 uppercase flex items-center justify-between">
            <span>Casse</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="font-heading font-black text-2xl text-red-900 mt-1">{stats.casse} u.</div>
          <div className="text-[10px] text-red-700 mt-0.5">Flacons / boîtes brisées</div>
        </div>

        <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-4 shadow-xs">
          <div className="text-[10px] font-bold text-purple-800 uppercase flex items-center justify-between">
            <span>Vol / Écart</span>
            <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="font-heading font-black text-2xl text-purple-900 mt-1">{stats.vol} u.</div>
          <div className="text-[10px] text-purple-700 mt-0.5">Anomalies d'inventaire</div>
        </div>
      </div>

      {/* Losses Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">{t("date")}</th>
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3 text-right">{t("quantity")}</th>
                <th className="px-4 py-3">{t("motif")}</th>
                <th className="px-4 py-3">Notes justificatives</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {losses.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <div>{t("no_data")}</div>
                  </td>
                </tr>
              )}

              {losses.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-slate-600">
                    {new Date(l.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {l.product_name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-black text-red-600">
                    -{l.quantity}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      l.motif === "peremption"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : l.motif === "casse"
                        ? "bg-red-50 text-red-800 border-red-200"
                        : "bg-purple-50 text-purple-800 border-purple-200"
                    }`}>
                      {t(l.motif)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 italic">
                    {l.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Declare Loss Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-red-50/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h2 className="font-heading text-lg font-bold text-slate-900">{t("declare_loss")}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                  Lot concerné
                </label>
                <SearchableSelect
                  required
                  value={form.batch_id}
                  onChange={(val) => setForm({ ...form, batch_id: val })}
                  placeholder="— Sélectionner ou rechercher le lot —"
                  searchPlaceholder="Rechercher médicament ou n° lot..."
                  data-testid="loss-batch-select"
                  options={batches.map((b) => ({
                    value: b.id,
                    label: `${b.product_name} · Lot ${b.batch_number}`,
                    sublabel: `Stock: ${b.current_quantity} u. · Exp: ${b.expiry_date}`,
                  }))}
                />
                {selectedBatch && (
                  <div className="text-[11px] text-emerald-800 font-semibold mt-1">
                    Stock actuel disponible : {selectedBatch.current_quantity} unité(s)
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                  {t("quantity")} à retirer
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  max={selectedBatch?.current_quantity || 9999}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  data-testid="loss-quantity-input"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-red-700 focus:bg-white focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                  {t("motif")} de la perte
                </label>
                <select
                  value={form.motif}
                  onChange={(e) => setForm({ ...form, motif: e.target.value })}
                  data-testid="loss-motif-select"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white"
                >
                  <option value="peremption">{t("peremption")} (Périmé)</option>
                  <option value="casse">{t("casse")} (Cassé / Avarié)</option>
                  <option value="vol">{t("vol")} (Vol / Perte inexpliquée)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                  Justificatif / Circonstances
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Ex: Cassé lors du déchargement du carton..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="submit-loss"
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-red-900/10 disabled:opacity-50"
                >
                  {submitting ? "Enregistrement..." : t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
