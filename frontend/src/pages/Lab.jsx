import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  FlaskConical, Plus, Pencil, Trash2, Search, X, Check, CheckCircle, RotateCcw,
  Sparkles, DollarSign, Activity, Layers, AlertCircle, ShieldAlert, Microscope, Tag
} from "lucide-react";
import { toast } from "sonner";

const DEFAULT_CATEGORIES = [
  "Biochimie",
  "Hématologie",
  "Sérologie",
  "Parasitologie",
  "Bactériologie",
  "Immunologie",
  "Immuno-Hématologie",
  "Autre"
];

export default function Lab() {
  const { user } = useAuth();
  const isManager = ["super_admin", "admin", "pharmacist"].includes(user?.role);
  const isAdmin = ["super_admin", "admin"].includes(user?.role);

  const [exams, setExams] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES.map((name, i) => ({ id: `default_${i}`, name })));
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");

  // Modal Exam states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    category: "Biochimie",
    price: "",
    description: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Modal Disciplines / Categories states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showAddCatInput, setShowAddCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [updatingCat, setUpdatingCat] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState(null);

  const loadExams = async () => {
    try {
      const res = await api.get("/lab-exams");
      setExams(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur de chargement des analyses de laboratoire");
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get("/lab-exams/categories/list");
      if (Array.isArray(res.data) && res.data.length > 0) {
        setCategories(res.data);
      } else if (Array.isArray(res.data?.categories)) {
        setCategories(res.data.categories);
      }
    } catch {
      // Keep existing default categories
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadExams(), loadCategories()]).finally(() => setLoading(false));
  }, []);

  const generateNewCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await api.get("/lab-exams/generate-code");
      if (res.data?.code) {
        setFormData((prev) => ({ ...prev, code: res.data.code }));
      }
    } catch {
      const fallback = `LAB-${String(exams.length + 1).padStart(3, "0")}`;
      setFormData((prev) => ({ ...prev, code: fallback }));
    } finally {
      setGeneratingCode(false);
    }
  };

  // Safe category list
  const safeCategories = useMemo(() => {
    return Array.isArray(categories) ? categories : [];
  }, [categories]);

  // Category list names
  const categoryNames = useMemo(() => {
    const list = safeCategories.map((c) => c?.name).filter(Boolean);
    DEFAULT_CATEGORIES.forEach((d) => {
      if (!list.includes(d)) list.push(d);
    });
    if (Array.isArray(exams)) {
      exams.forEach((e) => {
        if (e.category && !list.includes(e.category)) {
          list.push(e.category);
        }
      });
    }
    return list;
  }, [safeCategories, exams]);

  // Filtered exams
  const filtered = useMemo(() => {
    return exams.filter((e) => {
      const matchesCat =
        selectedCategory === "Tous" ||
        e.category?.toLowerCase() === selectedCategory.toLowerCase();

      if (!matchesCat) return false;
      if (!q.trim()) return true;

      const ql = q.toLowerCase();
      return (
        e.name?.toLowerCase().includes(ql) ||
        e.code?.toLowerCase().includes(ql) ||
        e.category?.toLowerCase().includes(ql) ||
        e.description?.toLowerCase().includes(ql)
      );
    });
  }, [exams, q, selectedCategory]);

  // Metrics
  const metrics = useMemo(() => {
    const totalCount = exams.length;
    const activeCount = exams.filter((e) => e.active !== false).length;
    const avgPrice =
      totalCount > 0
        ? Math.round(exams.reduce((sum, e) => sum + (Number(e.price) || 0), 0) / totalCount)
        : 0;
    const catCount = categoryNames.length;
    return { totalCount, activeCount, avgPrice, catCount };
  }, [exams, categoryNames]);

  const handleOpenAdd = () => {
    setEditingExam(null);
    setFormData({
      name: "",
      code: "",
      category: categoryNames[0] || "Biochimie",
      price: "",
      description: "",
      active: true,
    });
    setIsModalOpen(true);
    generateNewCode();
  };

  const handleOpenEdit = (exam) => {
    setEditingExam(exam);
    setFormData({
      name: exam.name || "",
      code: exam.code || "",
      category: exam.category || "Biochimie",
      price: exam.price ?? 0,
      description: exam.description || "",
      active: exam.active !== false,
    });
    setIsModalOpen(true);
  };

  const handleSaveExam = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Le nom de l'analyse est obligatoire.");
      return;
    }
    const numPrice = parseFloat(formData.price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Veuillez saisir un tarif valide (supérieur ou égal à 0).");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        category: formData.category,
        price: numPrice,
        description: formData.description.trim() || undefined,
        active: formData.active,
      };

      if (editingExam) {
        await api.put(`/lab-exams/${editingExam.id}`, payload);
        toast.success(`Analyse "${payload.name}" mise à jour avec succès`);
      } else {
        await api.post("/lab-exams", payload);
        toast.success(`Analyse "${payload.name}" créée avec succès`);
      }
      setIsModalOpen(false);
      loadExams();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur lors de l'enregistrement de l'analyse");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExam = async (exam) => {
    if (!window.confirm(`Confirmer la suppression définitive de l'analyse "${exam.name}" (${exam.code}) ?`)) {
      return;
    }
    try {
      await api.delete(`/lab-exams/${exam.id}`);
      toast.success(`Analyse "${exam.name}" supprimée`);
      loadExams();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur de suppression de l'analyse");
    }
  };

  const handleResetDefaults = async () => {
    setResetting(true);
    try {
      const res = await api.post("/lab-exams/reset-defaults");
      setExams(res.data || []);
      setConfirmResetOpen(false);
      toast.success("Les 32 analyses officielles ont été réinitialisées avec succès !");
      loadCategories();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur lors de la réinitialisation");
    } finally {
      setResetting(false);
    }
  };

  // --- Category / Discipline Actions ---
  const handleAddCategory = async (e) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      toast.error("Veuillez saisir un nom pour la discipline.");
      return;
    }
    setAddingCat(true);
    try {
      await api.post("/lab-exams/categories/create", { name: trimmed });
      toast.success(`Discipline "${trimmed}" ajoutée avec succès !`);
      setNewCatName("");
      setShowAddCatInput(false);
      loadCategories();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur lors de l'ajout de la discipline");
    } finally {
      setAddingCat(false);
    }
  };

  const handleStartEditCat = (cat) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
  };

  const handleSaveEditCat = async (catId) => {
    const trimmed = editingCatName.trim();
    if (!trimmed) {
      toast.error("Le nom de la discipline ne peut pas être vide.");
      return;
    }
    setUpdatingCat(true);
    try {
      await api.put(`/lab-exams/categories/${catId}`, { name: trimmed });
      toast.success("Discipline mise à jour avec succès !");
      setEditingCatId(null);
      setEditingCatName("");
      loadCategories();
      loadExams();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur lors de la mise à jour");
    } finally {
      setUpdatingCat(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const count = exams.filter((e) => e.category === cat.name).length;
    const warning = count > 0
      ? `Attention : ${count} analyse(s) sont actuellement classées sous "${cat.name}". Elles seront reclassées sous "Autre". Confirmer ?`
      : `Confirmer la suppression de la discipline "${cat.name}" ?`;

    if (!window.confirm(warning)) return;

    setDeletingCatId(cat.id);
    try {
      await api.delete(`/lab-exams/categories/${cat.id}`);
      toast.success(`Discipline "${cat.name}" supprimée`);
      if (selectedCategory === cat.name) {
        setSelectedCategory("Tous");
      }
      loadCategories();
      loadExams();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur de suppression");
    } finally {
      setDeletingCatId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Laboratoire d'Analyses
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Catalogue et tarification officielle des examens et analyses médicales
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Prominent Disciplines Manager Button */}
          {isManager && (
            <button
              onClick={() => {
                setIsCategoryModalOpen(true);
                setShowAddCatInput(false);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-bold text-sm transition-all shadow-sm"
              title="Gérer les disciplines (ajouter, renommer, supprimer)"
            >
              <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Disciplines ({safeCategories.length})</span>
            </button>
          )}

          {isManager && (
            <button
              onClick={() => setConfirmResetOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 font-medium text-sm transition-all shadow-sm"
              title="Restaurer les 32 analyses officielles"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              <span>Réinitialiser (32 analyses)</span>
            </button>
          )}

          {isManager && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Ajouter une analyse</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Analyses</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{metrics.totalCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Analyses Actives</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.activeCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tarif Moyen</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{formatXOF(metrics.avgPrice)}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Disciplines Médicales</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{metrics.catCount}</div>
          </div>
        </div>
      </div>

      {/* Toolbar: Search + Category filter */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher par nom d'analyse, code (LAB-...), discipline..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Categories pills dynamically loaded */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("Tous")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === "Tous"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Tous ({exams.length})
          </button>
          {categoryNames.map((cat) => {
            const active = selectedCategory.toLowerCase() === cat.toLowerCase();
            const count = exams.filter((e) => e.category?.toLowerCase() === cat.toLowerCase()).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Analyse / Examen</th>
                <th className="py-3 px-4">Discipline</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Tarif (FCFA)</th>
                <th className="py-3 px-4 text-center">Statut</th>
                {isManager && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={isManager ? 7 : 6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Chargement du catalogue de laboratoire...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 7 : 6} className="py-12 text-center text-slate-400">
                    <FlaskConical className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-medium text-slate-600 dark:text-slate-300">Aucune analyse trouvée</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {q ? "Modifiez votre recherche ou vos filtres." : "Cliquez sur '+ Ajouter une analyse' pour démarrer."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((exam) => (
                  <tr
                    key={exam.id || exam.code}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-750/50 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                      {exam.code || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Microscope className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{exam.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
                        {exam.category || "Biochimie"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {exam.description || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 dark:text-white">
                      {formatXOF(exam.price || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          exam.active !== false
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            exam.active !== false ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {exam.active !== false ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    {isManager && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(exam)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteExam(exam)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit Analysis */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingExam ? "Modifier l'analyse" : "Nouvelle analyse de laboratoire"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingExam ? `Code interne : ${editingExam.code}` : "Ajouter un examen médical au catalogue"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nom de l'analyse / examen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : GE, NFS, Glycémie, Ionogramme..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Code interne
                    </label>
                    {!editingExam && (
                      <button
                        type="button"
                        onClick={generateNewCode}
                        disabled={generatingCode}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Générer</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="LAB-001"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Discipline / Domaine <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryModalOpen(true);
                        setShowAddCatInput(false);
                      }}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      + Gérer
                    </button>
                  </div>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  >
                    {categoryNames.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tarif officiel (FCFA) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="2000"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full pl-3.5 pr-16 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                    FCFA
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Protocole médical
                </label>
                <textarea
                  rows="2"
                  placeholder="Ex : Recherche de Plasmodium, délai résultat 15 min..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="examActive"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <label htmlFor="examActive" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Analyse active (disponible à la caisse et comptoir)
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {saving ? "Enregistrement..." : editingExam ? "Mettre à jour" : "Créer l'analyse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Disciplines Management (Ajouter, Modifier, Supprimer) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Disciplines du Laboratoire
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ajoutez, modifiez ou supprimez les disciplines et domaines médicaux
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Add form area */}
              {showAddCatInput ? (
                <form onSubmit={handleAddCategory} className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-3">
                  <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    Nouvelle discipline médicale :
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="Ex : Bactériologie, Génétique, Toxicologie..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <button
                      type="submit"
                      disabled={addingCat}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
                    >
                      {addingCat ? "..." : "Enregistrer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCatInput(false);
                        setNewCatName("");
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddCatInput(true)}
                  className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 flex items-center justify-center gap-2 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Ajouter une nouvelle discipline</span>
                </button>
              )}

              {/* List of existing categories */}
              <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-700/60">
                {safeCategories.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    Aucune discipline enregistrée pour le moment.
                  </div>
                ) : (
                  safeCategories.map((cat) => {
                    const count = exams.filter((e) => e.category?.toLowerCase() === cat.name.toLowerCase()).length;
                    const isEditing = editingCatId === cat.id;

                    return (
                      <div
                        key={cat.id}
                        className="pt-2 first:pt-0 flex items-center justify-between gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-750/50 rounded-xl transition-colors"
                      >
                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingCatName}
                              autoFocus
                              onChange={(e) => setEditingCatName(e.target.value)}
                              className="flex-1 px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={updatingCat}
                              onClick={() => handleSaveEditCat(cat.id)}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                              title="Valider la modification"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCatId(null);
                                setEditingCatName("");
                              }}
                              className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                              title="Annuler"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                              <span className="font-semibold text-sm text-slate-900 dark:text-white">
                                {cat.name}
                              </span>
                              <span className="text-xs text-slate-400 font-medium">
                                ({count} analyse{count > 1 ? "s" : ""})
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditCat(cat)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                title="Modifier le nom de la discipline"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={deletingCatId === cat.id}
                                onClick={() => handleDeleteCategory(cat)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                                title="Supprimer la discipline"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Reset Defaults */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Réinitialiser le catalogue laboratoire ?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Cette action va réinitialiser l'ensemble des analyses de votre pharmacie pour rétablir
                les <strong>32 analyses officielles</strong> avec leurs tarifs standards (GE à 500, NFS à 3 500, Ionogramme à 10 500...).
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={handleResetDefaults}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                {resetting ? "Réinitialisation..." : "Confirmer la réinitialisation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
