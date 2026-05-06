import React, { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, X, KeyRound, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const empty = { email: "", name: "", password: "", role: "cashier", pharmacy_id: null };

export default function Users() {
  const { t } = useI18n();
  const { isSuperAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [resetResult, setResetResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const reload = () => api.get("/users").then((r) => setItems(r.data));
  useEffect(() => {
    reload();
    if (isSuperAdmin()) api.get("/pharmacies").then((r) => setPharmacies(r.data));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", form);
      toast.success(t("saved")); setShowForm(false); setForm(empty); reload();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const toggle = async (u) => {
    try { await api.put(`/users/${u.id}`, { active: !u.active }); reload(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const del = async (u) => {
    if (!window.confirm(t("confirm_delete"))) return;
    try { await api.delete(`/users/${u.id}`); toast.success(t("deleted")); reload(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const resetPassword = async (u) => {
    if (!window.confirm(`Réinitialiser le mot de passe de ${u.name} ?\nUn mot de passe temporaire sera généré.`)) return;
    try {
      const { data } = await api.post(`/users/${u.id}/reset-password`);
      setResetResult(data);
      setCopied(false);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const copyTemp = () => {
    navigator.clipboard.writeText(resetResult.temp_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const phName = (pid) => pharmacies.find((p) => p.id === pid)?.name || "-";

  return (
    <div className="p-6 md:p-8 space-y-4" data-testid="users-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-tiny mb-1">{t("nav_users")}</div>
          <h1 className="font-heading text-3xl font-black tracking-tight">Utilisateurs</h1>
        </div>
        <button onClick={() => setShowForm(true)} data-testid="add-user-btn" className="bg-primary text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold"><Plus className="w-4 h-4" /> {t("create_user")}</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("name")}</th>
              <th className="px-4 py-3">{t("email")}</th>
              <th className="px-4 py-3">{t("role")}</th>
              {isSuperAdmin() && <th className="px-4 py-3">Pharmacie</th>}
              <th className="px-4 py-3">{t("active")}</th>
              <th className="px-4 py-3 text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 table-row-hover" data-testid={`user-row-${u.id}`}>
                <td className="px-4 py-3 font-semibold">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3"><span className="text-xs bg-secondary px-2 py-0.5 rounded">{t(u.role)}</span></td>
                {isSuperAdmin() && <td className="px-4 py-3 text-xs text-muted-foreground">{phName(u.pharmacy_id)}</td>}
                <td className="px-4 py-3">
                  <button onClick={() => toggle(u)} data-testid={`toggle-user-${u.id}`} className={`text-xs px-2 py-0.5 rounded border ${u.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>{u.active ? "Actif" : "Inactif"}</button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => resetPassword(u)} data-testid={`reset-password-${u.id}`} aria-label="Réinitialiser mot de passe" className="p-1.5 hover:bg-amber-50 hover:text-amber-700 rounded mr-1" title="Réinitialiser mot de passe"><KeyRound className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(u)} data-testid={`delete-user-${u.id}`} aria-label="Supprimer utilisateur" className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-md w-full max-w-md border border-gray-200">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="font-heading text-xl font-bold">{t("create_user")}</h2><button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button></div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div><label className="label-tiny block mb-1">{t("name")}</label><input required data-testid="user-form-name" className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label-tiny block mb-1">{t("email")}</label><input required type="email" data-testid="user-form-email" className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label-tiny block mb-1">{t("password")}</label><input required type="password" minLength={6} data-testid="user-form-password" className="w-full px-3 py-2 border border-gray-200 rounded-md" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><label className="label-tiny block mb-1">{t("role")}</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} data-testid="user-form-role" className="w-full px-3 py-2 border border-gray-200 rounded-md">
                  {isSuperAdmin() && <option value="super_admin">{t("super_admin")}</option>}
                  <option value="admin">{t("admin")}</option>
                  <option value="pharmacist">{t("pharmacist")}</option>
                  <option value="cashier">{t("cashier")}</option>
                  <option value="storekeeper">{t("storekeeper")}</option>
                </select>
              </div>
              {isSuperAdmin() && form.role !== "super_admin" && (
                <div><label className="label-tiny block mb-1">Pharmacie</label>
                  <select required value={form.pharmacy_id || ""} onChange={(e) => setForm({ ...form, pharmacy_id: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md">
                    <option value="">— Sélectionner —</option>
                    {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-md text-sm">{t("cancel")}</button>
                <button type="submit" data-testid="submit-user-form" className="bg-primary text-white px-4 py-2 rounded-md text-sm font-semibold">{t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" data-testid="reset-password-modal">
          <div className="bg-white rounded-md w-full max-w-md border border-gray-200">
            <div className="p-5 border-b"><h2 className="font-heading text-xl font-bold">Mot de passe temporaire généré</h2></div>
            <div className="p-5 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                ⚠ Ce mot de passe ne sera affiché qu'une seule fois. Communiquez-le immédiatement à l'utilisateur.
              </div>
              <div>
                <label className="label-tiny block mb-1">Email</label>
                <div className="font-mono text-sm bg-gray-50 p-2 rounded">{resetResult.email}</div>
              </div>
              <div>
                <label className="label-tiny block mb-1">Mot de passe temporaire</label>
                <div className="flex gap-2">
                  <div className="flex-1 font-mono text-lg font-bold bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-900" data-testid="temp-password-value">{resetResult.temp_password}</div>
                  <button onClick={copyTemp} data-testid="copy-temp-password" className="px-3 border border-gray-200 rounded hover:bg-gray-50">
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button onClick={() => setResetResult(null)} className="w-full bg-primary text-white py-2 rounded-md font-semibold">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
