import React, { useEffect, useMemo, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, X, Truck, Search, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";

const empty = { raison_sociale: "", contact: "", email: "", telephone: "", adresse: "" };

export default function Suppliers() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const canEdit = hasRole("admin", "pharmacist", "storekeeper");

  const reload = () => api.get("/suppliers").then((r) => setItems(r.data || [])).catch(() => {});
  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    if (!q) return items;
    const ql = q.toLowerCase();
    return items.filter(
      (s) =>
        s.raison_sociale?.toLowerCase().includes(ql) ||
        s.contact?.toLowerCase().includes(ql) ||
        s.telephone?.toLowerCase().includes(ql) ||
        s.email?.toLowerCase().includes(ql)
    );
  }, [items, q]);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/suppliers/${editing.id}`, form);
      else await api.post("/suppliers", form);
      toast.success(t("saved"));
      setShowForm(false);
      setEditing(null);
      setForm(empty);
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const del = async (s) => {
    if (!window.confirm(t("confirm_delete"))) return;
    try {
      await api.delete(`/suppliers/${s.id}`);
      toast.success(t("deleted"));
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6" data-testid="suppliers-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">{t("nav_suppliers")} · RÉSEAU FOURNISSEURS</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Fournisseurs & Grossistes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Annuaire des laboratoires et centrales d'achats pharmaceutiques (CAMEG, Ubipharm, etc.)
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setShowForm(true);
            }}
            data-testid="add-supplier-btn"
            className="bg-primary hover:bg-[#14532D] text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-md shadow-emerald-900/10 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> {t("add")} un fournisseur
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2 shadow-2xs">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher fournisseur par nom, contact, téléphone ou email..."
          className="w-full text-xs font-medium text-slate-900 outline-none placeholder:text-slate-400"
        />
        {q && (
          <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Suppliers Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Raison sociale</th>
                <th className="px-4 py-3">Personne de contact</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Téléphone</th>
                {canEdit && <th className="px-4 py-3 text-right">{t("actions")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <div>{t("no_data")}</div>
                  </td>
                </tr>
              )}

              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-900">
                    <div>{s.raison_sociale}</div>
                    {s.adresse && (
                      <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" /> {s.adresse}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {s.contact || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {s.email ? (
                      <a href={`mailto:${s.email}`} className="text-primary hover:underline flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" /> {s.email}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                    {s.telephone ? (
                      <a href={`tel:${s.telephone}`} className="hover:text-primary flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" /> {s.telephone}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditing(s);
                            setForm(s);
                            setShowForm(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg"
                          data-testid={`edit-supplier-${s.id}`}
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {hasRole("admin") && (
                          <button
                            onClick={() => del(s)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"
                            data-testid={`delete-supplier-${s.id}`}
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                <h2 className="font-heading text-lg font-bold text-slate-900">
                  {editing ? t("edit") : t("add")} un fournisseur
                </h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  Raison sociale / Nom de la centrale
                </label>
                <input
                  required
                  autoFocus
                  data-testid="supplier-form-name"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.raison_sociale}
                  onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })}
                  placeholder="ex: CAMEG TOGO"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Nom du contact
                  </label>
                  <input
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-primary"
                    value={form.contact || ""}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    placeholder="ex: M. KOUASSI"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Téléphone
                  </label>
                  <input
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-1 focus:ring-primary"
                    value={form.telephone || ""}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    placeholder="ex: +228 22 21 00 00"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-primary"
                    value={form.email || ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="commandes@cameg.tg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Adresse
                  </label>
                  <input
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-primary"
                    value={form.adresse || ""}
                    onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                    placeholder="Zone Industrielle, Lomé"
                  />
                </div>
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
                  data-testid="submit-supplier-form"
                  className="bg-primary hover:bg-[#14532D] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10"
                >
                  {t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
