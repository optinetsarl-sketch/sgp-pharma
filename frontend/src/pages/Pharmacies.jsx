import React, { useEffect, useMemo, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, X, Building2, Search, Phone, Mail, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", address: "", phone: "", email: "", license_number: "", currency: "FCFA", active: true };

export default function Pharmacies() {
  const { t } = useI18n();
  const { isSuperAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);

  const reload = () => api.get("/pharmacies").then((r) => setItems(r.data || [])).catch(() => {});
  useEffect(() => {
    reload();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) await api.put(`/pharmacies/${editing.id}`, form);
      else await api.post("/pharmacies", form);
      toast.success(t("saved"));
      setShowForm(false);
      setEditing(null);
      setForm(empty);
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  const del = async (p) => {
    if (!window.confirm(`Supprimer la pharmacie "${p.name}" ? Toutes les données associées seront inaccessibles.`)) return;
    try {
      await api.delete(`/pharmacies/${p.id}`);
      toast.success(t("deleted"));
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const filtered = useMemo(() => {
    if (!q) return items;
    const ql = q.toLowerCase();
    return items.filter(
      (p) =>
        p.name?.toLowerCase().includes(ql) ||
        p.license_number?.toLowerCase().includes(ql) ||
        p.phone?.toLowerCase().includes(ql)
    );
  }, [items, q]);

  return (
    <div className="space-y-6" data-testid="pharmacies-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">ARCHITECTURE SAAS · MULTI-TENANTS</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Pharmacies & Officines
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion centralisée des officines affiliées et isolation stricte des données
          </p>
        </div>

        {isSuperAdmin() && (
          <button
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setShowForm(true);
            }}
            data-testid="add-pharmacy-btn"
            className="bg-primary hover:bg-[#14532D] text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-md shadow-emerald-900/10 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Nouvelle pharmacie
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2 shadow-2xs">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une pharmacie par nom ou n° d'agrément..."
          className="w-full text-xs font-medium text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            data-testid={`pharmacy-card-${p.id}`}
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-primary border border-emerald-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    p.active
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {p.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="font-heading font-black text-lg text-slate-900 mb-1">{p.name}</div>

              {p.license_number && (
                <div className="text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50/60 px-2 py-0.5 rounded inline-block mb-2">
                  Agrément n° {p.license_number}
                </div>
              )}

              <div className="space-y-1 text-xs text-slate-500 mt-2">
                {p.address && (
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{p.address}</span>
                  </div>
                )}
                {p.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{p.phone}</span>
                  </div>
                )}
                {p.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{p.email}</span>
                  </div>
                )}
              </div>
            </div>

            {isSuperAdmin() && (
              <div className="flex items-center justify-between gap-2 mt-5 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    setEditing(p);
                    setForm(p);
                    setShowForm(true);
                  }}
                  className="text-xs font-bold text-slate-700 hover:text-primary flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100"
                >
                  <Pencil className="w-3 h-3" /> Modifier
                </button>
                <button
                  onClick={() => del(p)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3" /> Supprimer
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="font-heading text-lg font-bold text-slate-900">
                  {editing ? "Modifier" : "Nouvelle"} pharmacie
                </h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  Nom de l'officine
                </label>
                <input
                  required
                  autoFocus
                  data-testid="pharmacy-form-name"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ex: Pharmacie Espoir Lomé"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">Adresse</label>
                <input
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.address || ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Boulevard du 13 Janvier, Lomé"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">Téléphone</label>
                  <input
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-1 focus:ring-primary"
                    value={form.phone || ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+228 90 00 00 00"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-primary"
                    value={form.email || ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="contact@pharmacie.tg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">N° Agrément Ministère</label>
                  <input
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-1 focus:ring-primary"
                    value={form.license_number || ""}
                    onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                    placeholder="TG-PH-2026-001"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">Devise</label>
                  <input
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white"
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-800">Pharmacie active</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
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
                  data-testid="submit-pharmacy"
                  className="bg-primary hover:bg-[#14532D] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 disabled:opacity-50"
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
