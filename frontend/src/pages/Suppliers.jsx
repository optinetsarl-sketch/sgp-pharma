import React, { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const empty = { raison_sociale: "", contact: "", email: "", telephone: "", adresse: "" };

export default function Suppliers() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const canEdit = hasRole("admin", "pharmacist", "storekeeper");

  const reload = () => api.get("/suppliers").then((r) => setItems(r.data));
  useEffect(() => { reload(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/suppliers/${editing.id}`, form);
      else await api.post("/suppliers", form);
      toast.success(t("saved")); setShowForm(false); setEditing(null); setForm(empty); reload();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const del = async (s) => {
    if (!window.confirm(t("confirm_delete"))) return;
    try { await api.delete(`/suppliers/${s.id}`); toast.success(t("deleted")); reload(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <div className="p-6 md:p-8 space-y-4" data-testid="suppliers-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-tiny mb-1">{t("nav_suppliers")}</div>
          <h1 className="font-heading text-3xl font-black tracking-tight">Fournisseurs</h1>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }} data-testid="add-supplier-btn" className="bg-primary hover:bg-[#14532D] text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold">
            <Plus className="w-4 h-4" />{t("add")}
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Raison sociale</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Téléphone</th>{canEdit && <th className="px-4 py-3 text-right">{t("actions")}</th>}</tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">{t("no_data")}</td></tr>}
            {items.map((s) => (
              <tr key={s.id} className="border-t border-gray-100 table-row-hover">
                <td className="px-4 py-3 font-semibold">{s.raison_sociale}</td>
                <td className="px-4 py-3">{s.contact}</td>
                <td className="px-4 py-3">{s.email}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.telephone}</td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditing(s); setForm(s); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 rounded mr-1" data-testid={`edit-supplier-${s.id}`}><Pencil className="w-3.5 h-3.5" /></button>
                    {hasRole("admin") && <button onClick={() => del(s)} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded" data-testid={`delete-supplier-${s.id}`}><Trash2 className="w-3.5 h-3.5" /></button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-md w-full max-w-xl border border-gray-200">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="font-heading text-xl font-bold">{editing ? t("edit") : t("add")} fournisseur</h2><button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button></div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div><label className="label-tiny block mb-1">Raison sociale</label><input required data-testid="supplier-form-name" className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.raison_sociale} onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-tiny block mb-1">Contact</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.contact || ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
                <div><label className="label-tiny block mb-1">Email</label><input type="email" className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><label className="label-tiny block mb-1">Téléphone</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.telephone || ""} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></div>
                <div><label className="label-tiny block mb-1">Adresse</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.adresse || ""} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-3"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-md text-sm">{t("cancel")}</button><button type="submit" data-testid="submit-supplier-form" className="bg-primary text-white px-4 py-2 rounded-md text-sm font-semibold">{t("save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
