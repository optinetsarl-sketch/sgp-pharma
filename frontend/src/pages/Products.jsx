import React, { useEffect, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";

const empty = {
  code_barre: "", nom_commercial: "", dci: "", forme_pharmaceutique: "",
  categorie_id: "", seuil_alerte_stock: 10, requires_prescription: false, prix_vente: 0,
};

export default function Products() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const canEdit = hasRole("admin", "pharmacist");

  const reload = () => {
    api.get("/products", { params: q ? { q } : {} }).then((r) => setItems(r.data));
  };

  useEffect(() => {
    reload();
    api.get("/categories").then((r) => setCats(r.data));
  }, [q]);

  const startNew = () => { setEditing(null); setForm(empty); setShowForm(true); };
  const startEdit = (p) => { setEditing(p); setForm({ ...empty, ...p }); setShowForm(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        seuil_alerte_stock: parseInt(form.seuil_alerte_stock) || 0,
        prix_vente: parseFloat(form.prix_vente) || 0,
        categorie_id: form.categorie_id || null,
      };
      if (editing) await api.put(`/products/${editing.id}`, payload);
      else await api.post("/products", payload);
      toast.success(t("saved"));
      setShowForm(false); setEditing(null); setForm(empty); reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const del = async (p) => {
    if (!window.confirm(t("confirm_delete"))) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success(t("deleted")); reload();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const catName = (id) => cats.find((c) => c.id === id)?.name || "-";

  return (
    <div className="p-6 md:p-8 space-y-4" data-testid="products-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-tiny mb-1">{t("nav_products")}</div>
          <h1 className="font-heading text-3xl font-black tracking-tight">Produits</h1>
        </div>
        {canEdit && (
          <button onClick={startNew} data-testid="add-product-btn" className="bg-primary hover:bg-[#14532D] text-white font-semibold px-4 py-2 rounded-md flex items-center gap-2 transition-all hover:-translate-y-[1px]">
            <Plus className="w-4 h-4" /> {t("add")}
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          data-testid="products-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("barcode_search")}
          className="flex-1 outline-none text-sm"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm" data-testid="products-table">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("code_barre")}</th>
              <th className="px-4 py-3">{t("name")}</th>
              <th className="px-4 py-3">{t("dci")}</th>
              <th className="px-4 py-3">{t("category")}</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">{t("price")}</th>
              <th className="px-4 py-3 text-center">Ord.</th>
              {canEdit && <th className="px-4 py-3 text-right">{t("actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">{t("no_data")}</td></tr>}
            {items.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 table-row-hover" data-testid={`product-row-${p.id}`}>
                <td className="px-4 py-3 font-mono text-xs">{p.code_barre}</td>
                <td className="px-4 py-3 font-semibold">{p.nom_commercial}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.dci}</td>
                <td className="px-4 py-3"><span className="text-xs bg-secondary px-2 py-0.5 rounded">{catName(p.categorie_id)}</span></td>
                <td className={`px-4 py-3 text-right font-bold ${p.stock_total <= p.seuil_alerte_stock ? "text-red-600" : ""}`}>{p.stock_total}</td>
                <td className="px-4 py-3 text-right">{formatXOF(p.prix_vente)}</td>
                <td className="px-4 py-3 text-center">{p.requires_prescription ? <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">Oui</span> : <span className="text-muted-foreground text-xs">-</span>}</td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => startEdit(p)} data-testid={`edit-product-${p.id}`} className="p-1.5 hover:bg-gray-100 rounded mr-1"><Pencil className="w-3.5 h-3.5" /></button>
                    {hasRole("admin") && <button onClick={() => del(p)} data-testid={`delete-product-${p.id}`} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" data-testid="product-form-modal">
          <div className="bg-white rounded-md w-full max-w-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-heading text-xl font-bold">{editing ? t("edit") : t("add")} produit</h2>
              <button onClick={() => setShowForm(false)} data-testid="close-product-form"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-5 grid grid-cols-2 gap-4">
              <div>
                <label className="label-tiny block mb-1">{t("code_barre")}</label>
                <input required data-testid="product-form-code" className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.code_barre} onChange={(e) => setForm({ ...form, code_barre: e.target.value })} />
              </div>
              <div>
                <label className="label-tiny block mb-1">{t("name")}</label>
                <input required data-testid="product-form-name" className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.nom_commercial} onChange={(e) => setForm({ ...form, nom_commercial: e.target.value })} />
              </div>
              <div>
                <label className="label-tiny block mb-1">{t("dci")}</label>
                <input className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.dci} onChange={(e) => setForm({ ...form, dci: e.target.value })} />
              </div>
              <div>
                <label className="label-tiny block mb-1">{t("forme")}</label>
                <input className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.forme_pharmaceutique} onChange={(e) => setForm({ ...form, forme_pharmaceutique: e.target.value })} />
              </div>
              <div>
                <label className="label-tiny block mb-1">{t("category")}</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.categorie_id || ""} onChange={(e) => setForm({ ...form, categorie_id: e.target.value })}>
                  <option value="">—</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-tiny block mb-1">{t("price")} (FCFA)</label>
                <input type="number" min="0" data-testid="product-form-price" className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.prix_vente} onChange={(e) => setForm({ ...form, prix_vente: e.target.value })} />
              </div>
              <div>
                <label className="label-tiny block mb-1">{t("seuil")}</label>
                <input type="number" min="0" className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.seuil_alerte_stock} onChange={(e) => setForm({ ...form, seuil_alerte_stock: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 mt-6">
                <input type="checkbox" data-testid="product-form-prescription" checked={!!form.requires_prescription} onChange={(e) => setForm({ ...form, requires_prescription: e.target.checked })} />
                <span className="text-sm">{t("prescription_required")}</span>
              </label>
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-md text-sm">{t("cancel")}</button>
                <button type="submit" data-testid="submit-product-form" className="bg-primary hover:bg-[#14532D] text-white px-4 py-2 rounded-md text-sm font-semibold">{t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
