import React, { useEffect, useMemo, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, X, KeyRound, Copy, Check, Users as UsersIcon, Search, Shield, UserCheck } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";

const empty = { email: "", name: "", password: "", role: "cashier", pharmacy_id: null };

export default function Users() {
  const { t } = useI18n();
  const { isSuperAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [resetResult, setResetResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users");
      setItems(res.data || []);
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error("Impossible de charger les utilisateurs");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    if (isSuperAdmin()) {
      api.get("/pharmacies").then((r) => setPharmacies(r.data || [])).catch(() => {});
    }
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/users", form);
      toast.success(t("saved"));
      setShowForm(false);
      setForm(empty);
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { active: !u.active });
      toast.success(`Utilisateur ${u.active ? "désactivé" : "activé"}`);
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const del = async (u) => {
    if (!window.confirm(t("confirm_delete"))) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success(t("deleted"));
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const resetPassword = async (u) => {
    if (!window.confirm(`Réinitialiser le mot de passe de ${u.name} ?\nUn mot de passe temporaire sera généré.`)) return;
    try {
      const { data } = await api.post(`/users/${u.id}/reset-password`);
      setResetResult(data);
      setCopied(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const copyTemp = () => {
    navigator.clipboard.writeText(resetResult.temp_password);
    setCopied(true);
    toast.success("Mot de passe copié dans le presse-papier");
    setTimeout(() => setCopied(false), 2000);
  };

  const phName = (pid) => pharmacies.find((p) => p.id === pid)?.name || "-";

  const filteredUsers = useMemo(() => {
    return items.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      const ql = q.toLowerCase();
      return u.name?.toLowerCase().includes(ql) || u.email?.toLowerCase().includes(ql);
    });
  }, [items, roleFilter, q]);

  const getRoleBadge = (r) => {
    switch (r) {
      case "super_admin":
        return "bg-rose-50 text-rose-800 border-rose-200";
      case "admin":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "pharmacist":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "cashier":
        return "bg-blue-50 text-blue-800 border-blue-200";
      default:
        return "bg-purple-50 text-purple-800 border-purple-200";
    }
  };

  return (
    <div className="space-y-6" data-testid="users-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">{t("nav_users")} · CONTRÔLE D'ACCÈS RBAC</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Gestion des Utilisateurs & Rôles
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Création des comptes opérateurs (caissiers, pharmaciens, magasiniers) et gestion de la sécurité
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          data-testid="add-user-btn"
          className="bg-primary hover:bg-[#14532D] text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-md shadow-emerald-900/10 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> {t("create_user")}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "Tous les rôles" },
            { id: "admin", label: "Administrateurs" },
            { id: "pharmacist", label: "Pharmaciens" },
            { id: "cashier", label: "Caissiers" },
            { id: "storekeeper", label: "Magasiniers" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                roleFilter === tab.id
                  ? "bg-primary text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full md:w-72 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher nom ou email..."
            className="w-full bg-transparent outline-none text-xs font-medium text-slate-900"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">{t("name")}</th>
                <th className="px-4 py-3">{t("email")}</th>
                <th className="px-4 py-3">{t("role")}</th>
                {isSuperAdmin() && <th className="px-4 py-3">Pharmacie</th>}
                <th className="px-4 py-3">{t("active")}</th>
                <th className="px-4 py-3 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <div>{t("no_data")}</div>
                  </td>
                </tr>
              )}

              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition-colors" data-testid={`user-row-${u.id}`}>
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {u.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getRoleBadge(u.role)}`}>
                      {t(u.role)}
                    </span>
                  </td>
                  {isSuperAdmin() && (
                    <td className="px-4 py-3 text-slate-600 font-semibold">
                      {phName(u.pharmacy_id)}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(u)}
                      data-testid={`toggle-user-${u.id}`}
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                        u.active
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {u.active ? "Actif" : "Inactif"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => resetPassword(u)}
                        data-testid={`reset-password-${u.id}`}
                        aria-label="Réinitialiser mot de passe"
                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1"
                        title="Générer un mot de passe temporaire"
                      >
                        <KeyRound className="w-3.5 h-3.5" /> Reset
                      </button>
                      <button
                        onClick={() => del(u)}
                        data-testid={`delete-user-${u.id}`}
                        aria-label="Supprimer utilisateur"
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-primary" />
                <h2 className="font-heading text-lg font-bold text-slate-900">{t("create_user")}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">{t("name")}</label>
                <input
                  required
                  autoFocus
                  data-testid="user-form-name"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ex: Jean DUPONT"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">{t("email")}</label>
                <input
                  required
                  type="email"
                  data-testid="user-form-email"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ex: j.dupont@sgp-pharma.tg"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">{t("password")}</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  data-testid="user-form-password"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">{t("role")}</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  data-testid="user-form-role"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white"
                >
                  {isSuperAdmin() && <option value="super_admin">{t("super_admin")} (OPTINET)</option>}
                  <option value="admin">{t("admin")} (Gestionnaire pharmacie)</option>
                  <option value="pharmacist">{t("pharmacist")} (Validation / Ordonnances)</option>
                  <option value="cashier">{t("cashier")} (Caisse & Vente POS)</option>
                  <option value="storekeeper">{t("storekeeper")} (Réception & Magasin)</option>
                </select>
              </div>

              {isSuperAdmin() && form.role !== "super_admin" && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">Pharmacie rattachée</label>
                  <SearchableSelect
                    required
                    value={form.pharmacy_id || ""}
                    onChange={(val) => setForm({ ...form, pharmacy_id: val })}
                    placeholder="— Sélectionner ou rechercher pharmacie —"
                    searchPlaceholder="Rechercher par nom..."
                    options={pharmacies.map((p) => ({
                      value: p.id,
                      label: p.name,
                      sublabel: p.address || "",
                    }))}
                  />
                </div>
              )}

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
                  data-testid="submit-user-form"
                  className="bg-primary hover:bg-[#14532D] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 disabled:opacity-50"
                >
                  {submitting ? "Enregistrement..." : t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Temporary Password Modal */}
      {resetResult && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" data-testid="reset-password-modal">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-amber-50/60">
              <h2 className="font-heading text-lg font-bold text-amber-950 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                Mot de passe temporaire généré
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed font-medium">
                ⚠ Ce mot de passe à usage unique ne sera affiché qu'une seule fois. Communiquez-le de manière sécurisée à l'opérateur.
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email du compte</label>
                <div className="font-mono text-xs font-bold bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-800">
                  {resetResult.email}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nouveau mot de passe temporaire</label>
                <div className="flex gap-2">
                  <div
                    className="flex-1 font-mono text-base font-black bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 tracking-wider flex items-center justify-center"
                    data-testid="temp-password-value"
                  >
                    {resetResult.temp_password}
                  </div>
                  <button
                    onClick={copyTemp}
                    data-testid="copy-temp-password"
                    className="px-4 border border-slate-200 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-700 font-bold text-xs gap-1.5 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "Copié !" : "Copier"}</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => setResetResult(null)}
                className="w-full bg-primary hover:bg-[#14532D] text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-900/10 mt-2"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
