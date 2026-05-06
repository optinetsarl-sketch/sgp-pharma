import React, { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, X, Building2 } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", address: "", phone: "", email: "", license_number: "", currency: "FCFA", active: true };

export default function Pharmacies() {
  const { t } = useI18n();
  const { isSuperAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const reload = () => api.get("/pharmacies").then((r) => setItems(r.data));
  useEffect(() => { reload(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/pharmacies/${editing.id}`, form);
      else await api.post("/pharmacies", form);
      toast.success(t("saved")); setShowForm(false); setEditing(null); setForm(empty); reload();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const del = async (p) => {
    if (!window.confirm(t("confirm_delete"))) return;
    try { await api.delete(`/pharmacies/${p.id}`); toast.success(t("deleted")); reload(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <div className="p-6 md:p-8 space-y-4" data-testid="pharmacies-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-tiny mb-1">Multi-pharmacies</div>
          <h1 className="font-heading text-3xl font-black tracking-tight">Pharmacies</h1>
        </div>
        {isSuperAdmin() && (
          <button onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }} data-testid="add-pharmacy-btn" className="bg-primary text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold">
            <Plus className="w-4 h-4" /> Nouvelle pharmacie
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-md p-5" data-testid={`pharmacy-card-${p.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-md flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <span className={`text-xs px-2 py-0.5 rounded border ${p.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {p.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="font-heading font-bold text-lg mb-1">{p.name}</div>
            {p.license_number && <div className="text-xs text-muted-foreground mb-2">N° {p.license_number}</div>}
            {p.address && <div className="text-sm text-muted-foreground">{p.address}</div>}
            {p.phone && <div className="text-sm text-muted-foreground">{p.phone}</div>}
            {p.email && <div className="text-sm text-muted-foreground">{p.email}</div>}
            {isSuperAdmin() && (
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                <button onClick={() => { setEditing(p); setForm(p); setShowForm(true); }} className="text-xs flex items-center gap-1 hover:text-primary"><Pencil className="w-3 h-3" /> Modifier</button>
                <button onClick={() => del(p)} className="text-xs flex items-center gap-1 hover:text-red-600 ml-auto"><Trash2 className="w-3 h-3" /> Supprimer</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-md w-full max-w-xl border border-gray-200">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="font-heading text-xl font-bold">{editing ? "Modifier" : "Nouvelle"} pharmacie</h2><button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button></div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div><label className="label-tiny block mb-1">Nom</label><input required data-testid="pharmacy-form-name" className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label-tiny block mb-1">Adresse</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-tiny block mb-1">Téléphone</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><label className="label-tiny block mb-1">Email</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><label className="label-tiny block mb-1">N° Agrément</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.license_number || ""} onChange={(e) => setForm({ ...form, license_number: e.target.value })} /></div>
                <div><label className="label-tiny block mb-1">Devise</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /><span className="text-sm">Active</span></label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-md text-sm">{t("cancel")}</button>
                <button type="submit" data-testid="submit-pharmacy" className="bg-primary text-white px-4 py-2 rounded-md text-sm font-semibold">{t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
