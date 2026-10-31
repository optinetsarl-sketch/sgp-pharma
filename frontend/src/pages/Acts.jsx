import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Stethoscope, Plus, Pencil, Trash2, Search, X, CheckCircle, RotateCcw,
  Sparkles, DollarSign, Activity, Layers, AlertCircle, ShieldAlert
} from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  "Tous",
  "Consultation",
  "Maternité",
  "Chirurgie / Soins",
  "Soins Infirmiers",
  "Autre"
];

export default function Acts() {
  const { user } = useAuth();
  const isManager = ["super_admin", "admin", "pharmacist"].includes(user?.role);
  const isAdmin = ["super_admin", "admin"].includes(user?.role);

  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAct, setEditingAct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    category: "Consultation",
    price: "",
    description: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadActs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/acts");
      setActs(res.data || []);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur de chargement des actes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActs();
  }, []);

  const generateNewCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await api.get("/acts/generate-code");
      if (res.data?.code) {
        setFormData((prev) => ({ ...prev, code: res.data.code }));
      }
    } catch {
      const fallback = `ACT-${String(acts.length + 1).padStart(3, "0")}`;
      setFormData((prev) => ({ ...prev, code: fallback }));
    } finally {
      setGeneratingCode(false);
    }
  };

  // Filtered acts
  const filtered = useMemo(() => {
    return acts.filter((a) => {
      const matchesCat =
        selectedCategory === "Tous" ||
        a.category?.toLowerCase() === selectedCategory.toLowerCase();

      if (!matchesCat) return false;
      if (!q.trim()) return true;

      const ql = q.toLowerCase();
      return (
        a.name?.toLowerCase().includes(ql) ||
        a.code?.toLowerCase().includes(ql) ||
        a.category?.toLowerCase().includes(ql) ||
        a.description?.toLowerCase().includes(ql)
      );
    });
  }, [acts, q, selectedCategory]);

  // Metrics
  const metrics = useMemo(() => {
    const totalCount = acts.length;
    const activeCount = acts.filter((a) => a.active !== false).length;
    const avgPrice =
      totalCount > 0
        ? Math.round(acts.reduce((acc, a) => acc + (a.price || 0), 0) / totalCount)
        : 0;
    return { totalCount, activeCount, avgPrice };
  }, [acts]);

  const handleOpenCreate = () => {
    setEditingAct(null);
    const fallbackCode = `ACT-${String(acts.length + 1).padStart(3, "0")}`;
    setFormData({
      name: "",
      code: fallbackCode,
      category: "Consultation",
      price: "",
      description: "",
      active: true,
    });
    setIsModalOpen(true);
    generateNewCode();
  };

  const handleOpenEdit = (act) => {
    setEditingAct(act);
    setFormData({
      name: act.name,
      code: act.code || "",
      category: act.category || "Consultation",
      price: act.price,
      description: act.description || "",
      active: act.active !== false,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Le nom de l'acte est obligatoire");
      return;
    }
    const parsedPrice = parseFloat(formData.price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Veuillez renseigner un tarif valide en FCFA");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code?.trim() || null,
        category: formData.category,
        price: parsedPrice,
        description: formData.description?.trim() || null,
        active: formData.active,
      };

      if (editingAct) {
        await api.put(`/acts/${editingAct.id}`, payload);
        toast.success(`Acte "${payload.name}" modifié avec succès !`);
      } else {
        await api.post("/acts", payload);
        toast.success(`Acte "${payload.name}" ajouté au catalogue !`);
      }
      setIsModalOpen(false);
      loadActs();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (act) => {
    if (!window.confirm(`Confirmer la suppression de l'acte "${act.name}" ?`)) return;
    try {
      await api.delete(`/acts/${act.id}`);
      toast.success(`Acte "${act.name}" supprimé`);
      loadActs();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur de suppression");
    }
  };

  const handleResetDefaults = async () => {
    setResetting(true);
    try {
      await api.post("/acts/reset-defaults");
      toast.success("Les 7 actes de soins standards ont été restaurés avec succès !");
      setConfirmResetOpen(false);
      loadActs();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur de réinitialisation");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Actes Médicaux et Soins</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Prestations Cliniques
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Tarification officielle des consultations, maternité, chirurgie mineure et soins infirmiers (sans décompte de stock).
            </p>
          </div>
        </div>

        {isManager && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setConfirmResetOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-xs"
              title="Restaurer la liste officielle des 7 actes de base"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>Réinitialiser (7 actes CAMESG)</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un acte</span>
            </button>
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Actes Enregistrés</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Actes Actifs en Caisse</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.activeCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tarif Moyen Officiel</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatXOF(metrics.avgPrice)}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un acte (Consultation, CPN, Suture, code...)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Categories Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 border-collapse">
            <thead className="bg-slate-50/80 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 w-28">Code</th>
                <th className="px-5 py-3.5">Acte Médical</th>
                <th className="px-5 py-3.5">Catégorie</th>
                <th className="px-5 py-3.5">Description / Spécificités</th>
                <th className="px-5 py-3.5 text-right">Tarif Officiel</th>
                <th className="px-5 py-3.5 text-center">Statut</th>
                <th className="px-5 py-3.5 text-right sticky right-0 bg-slate-50/95 backdrop-blur-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.12)] z-10 w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Chargement des actes médicaux...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Aucun acte médical trouvé {q && `pour "${q}"`}
                  </td>
                </tr>
              ) : (
                filtered.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-500">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                        {act.code || "ACTE"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>{act.name}</span>
                        {act.name?.toLowerCase().includes("accouchement") && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-pink-50 text-pink-700 border border-pink-200 font-medium">
                            Maternité
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {act.category || "Consultation"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs max-w-xs truncate">
                      {act.description || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                      <span className="text-base text-emerald-600 font-semibold">{formatXOF(act.price)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {act.active !== false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right sticky right-0 bg-white/95 group-hover:bg-slate-50/95 backdrop-blur-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.12)] z-10">
                      <div className="flex items-center justify-end gap-1">
                        {isManager && (
                          <button
                            onClick={() => handleOpenEdit(act)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Modifier le tarif ou les informations"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(act)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Supprimer l'acte"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    {editingAct ? "Modifier l'acte médical" : "Ajouter un acte médical"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Prestation de soin facturable en caisse
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nom de l'acte *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Consultation, CPN, Suture..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase">
                      Code interne *
                    </label>
                    {!editingAct && (
                      <button
                        type="button"
                        onClick={generateNewCode}
                        disabled={generatingCode}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors"
                        title="Générer automatiquement le code suivant"
                      >
                        <Sparkles className={`w-3 h-3 ${generatingCode ? "animate-spin" : ""}`} />
                        <span>{generatingCode ? "..." : "Générer"}</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: ACT-008"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold uppercase focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Code unique généré automatiquement.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Catégorie
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Maternité">Maternité</option>
                    <option value="Chirurgie / Soins">Chirurgie / Soins</option>
                    <option value="Soins Infirmiers">Soins Infirmiers</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Tarif Officiel (FCFA) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="Ex: 500, 1000, 2000"
                    className="w-full pl-3.5 pr-16 py-2 rounded-xl border border-slate-200 text-base font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    FCFA
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tarif appliqué directement en caisse et sur le reçu thermique.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description / Protocole
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Détails de l'intervention ou indications cliniques..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="act_active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="act_active" className="text-sm font-medium text-slate-700">
                  Acte actif (visible et facturable en caisse POS)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {saving ? "Enregistrement..." : editingAct ? "Mettre à jour" : "Ajouter l'acte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Reset Defaults Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-lg">
                Restaurer les 7 actes officiels ?
              </h3>
              <p className="text-xs text-slate-500">
                Cette action va rétablir la grille tarifaire officielle :
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 border border-slate-200/60 font-medium text-slate-700">
              <div className="flex justify-between"><span>• Consultation</span><span className="font-bold text-emerald-600">500 FCFA</span></div>
              <div className="flex justify-between"><span>• CPN</span><span className="font-bold text-emerald-600">1 500 FCFA</span></div>
              <div className="flex justify-between"><span>• Acte Petite Chirurgie</span><span className="font-bold text-emerald-600">1 000 FCFA</span></div>
              <div className="flex justify-between"><span>• Pansement</span><span className="font-bold text-emerald-600">1 000 FCFA</span></div>
              <div className="flex justify-between"><span>• Acte d’accouchement</span><span className="font-bold text-emerald-600">2 000 FCFA</span></div>
              <div className="flex justify-between"><span>• Révision utérine</span><span className="font-bold text-emerald-600">2 000 FCFA</span></div>
              <div className="flex justify-between"><span>• Suture</span><span className="font-bold text-emerald-600">1 000 FCFA</span></div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex-1"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={handleResetDefaults}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-600/20 flex-1 disabled:opacity-50"
              >
                {resetting ? "Restauration..." : "Oui, réinitialiser"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

