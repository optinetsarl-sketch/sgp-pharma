import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Pencil, Trash2, Search, X, Pill, AlertTriangle, CheckCircle, PackageX, FileText, Filter, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";

const DEFAULT_PHARMACEUTICAL_FORMS = [
  "Comprimé",
  "Comprimé pelliculé",
  "Comprimé effervescent",
  "Comprimé sécable",
  "Comprimé orodispersible",
  "Gélule",
  "Capsule",
  "Sirop",
  "Suspension buvable",
  "Solution buvable",
  "Gouttes buvables",
  "Injectable (IV/IM)",
  "Ampoule injectable",
  "Flacon injectable",
  "Pommade",
  "Crème",
  "Gel",
  "Emulsion",
  "Collyre",
  "Gouttes auriculaires",
  "Spray nasal",
  "Spray buccal",
  "Inhalateur / Aérosol",
  "Sachet poudre",
  "Suppositoire",
  "Ovule gynécologique",
  "Patch transdermique",
  "Soluté perfusion",
  "Bain de bouche",
  "Poudre pour suspension",
  "Lotion",
  "Savon dermatologique",
];

// Logical rule mapping: keywords in forme -> category keywords
const FORME_TO_CATEGORY_RULES = [
  { keywords: ["collyre", "ophtalm", "oculaire", "yeux"], categoryKeywords: ["ophtalmologie"] },
  { keywords: ["auriculaire", "oreille", "nasal", "gargarisme", "orl", "buccal"], categoryKeywords: ["orl", "respiratoire"] },
  { keywords: ["pommade", "creme", "gel", "lotion", "dermatol", "savon", "emulsion", "cutan"], categoryKeywords: ["dermatologie", "anti-inflammatoires"] },
  { keywords: ["ovule", "vaginal", "gyneco"], categoryKeywords: ["gynecologie"] },
  { keywords: ["inhalat", "aerosol", "spray nasal", "broncho", "respiratoire"], categoryKeywords: ["respiratoire", "pneumologie"] },
  { keywords: ["perfusion", "solute", "ringer", "glucose", "salé"], categoryKeywords: ["solutions", "urgences"] },
  { keywords: ["injectable", "ampoule", "flacon inj"], categoryKeywords: ["anesthésiques", "antibiotiques", "solutions"] },
  { keywords: ["sirop", "suspension buvable", "gouttes buvables"], categoryKeywords: ["pediatrie", "antalgiques", "respiratoire"] },
  { keywords: ["suppositoire"], categoryKeywords: ["pediatrie", "antalgiques", "gastro-enterologie"] },
  { keywords: ["bain de bouche", "dentaire", "gingival"], categoryKeywords: ["orl", "stomatologie", "dermatologie"] },
  { keywords: ["pansement", "seringue", "aiguille", "gants", "thermometre", "tensiometre", "compresse", "coton", "sparadrap"], categoryKeywords: ["materiel", "consommables"] },
];

function normalizeStr(str) {
  if (!str) return "";
  return str.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function findSuggestedCategory(formeStr, categories, allProducts) {
  if (!formeStr || !categories || categories.length === 0) return null;
  const normalizedForme = normalizeStr(formeStr);

  // 1. Data-driven: check historical frequency in allProducts
  if (allProducts && allProducts.length > 0) {
    const matchingProducts = allProducts.filter(
      (p) => p.forme_pharmaceutique && normalizeStr(p.forme_pharmaceutique) === normalizedForme && p.categorie_id
    );
    if (matchingProducts.length >= 2) {
      const countMap = {};
      matchingProducts.forEach((p) => {
        countMap[p.categorie_id] = (countMap[p.categorie_id] || 0) + 1;
      });
      const topCatId = Object.keys(countMap).sort((a, b) => countMap[b] - countMap[a])[0];
      const matchedCat = categories.find((c) => String(c.id) === String(topCatId));
      if (matchedCat) return matchedCat;
    }
  }

  // 2. Rule-driven: check standard pharmaceutical mappings
  for (const rule of FORME_TO_CATEGORY_RULES) {
    const matchesForme = rule.keywords.some((kw) => normalizedForme.includes(normalizeStr(kw)));
    if (matchesForme) {
      for (const catKw of rule.categoryKeywords) {
        const found = categories.find((c) => normalizeStr(c.name).includes(normalizeStr(catKw)));
        if (found) return found;
      }
    }
  }

  return null;
}

const empty = {
  code_barre: "",
  nom_commercial: "",
  dci: "",
  forme_pharmaceutique: "",
  categorie_id: "",
  seuil_alerte_stock: 10,
  requires_prescription: false,
  prix_vente: 0,
};

export default function Products() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, in_stock, low_stock, out_of_stock, prescription
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const canEdit = hasRole("admin", "pharmacist");

  // Dynamic available forms list (standard forms + existing database forms)
  const availableForms = useMemo(() => {
    const existingForms = items
      .map((p) => p.forme_pharmaceutique?.trim())
      .filter(Boolean);
    const combined = Array.from(new Set([...DEFAULT_PHARMACEUTICAL_FORMS, ...existingForms]));
    return combined.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [items]);

  // Dynamic suggested category based on current forme_pharmaceutique
  const suggestedCategory = useMemo(() => {
    return findSuggestedCategory(form.forme_pharmaceutique, cats, items);
  }, [form.forme_pharmaceutique, cats, items]);

  const handleFormeChange = (val) => {
    const nextForm = { ...form, forme_pharmaceutique: val };
    const suggestion = findSuggestedCategory(val, cats, items);
    // If no category is selected yet, automatically pre-fill the logical suggested category!
    if (suggestion && !form.categorie_id) {
      nextForm.categorie_id = suggestion.id;
    }
    setForm(nextForm);
  };

  const reload = () => {
    api.get("/products", { params: q ? { q } : {} }).then((r) => setItems(r.data || [])).catch(() => {});
  };

  useEffect(() => {
    reload();
    api.get("/categories").then((r) => setCats(r.data || [])).catch(() => {});
  }, [q]);

  const startNew = () => {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  };

  const startEdit = (p) => {
    setEditing(p);
    setForm({ ...empty, ...p });
    setShowForm(true);
  };

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
      setShowForm(false);
      setEditing(null);
      setForm(empty);
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const del = async (p) => {
    if (!window.confirm(t("confirm_delete"))) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success(t("deleted"));
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const catName = (id) => cats.find((c) => c.id === id)?.name || "-";

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((p) => {
      // Category filter
      if (categoryFilter && p.categorie_id !== categoryFilter) return false;

      // Status filter
      if (statusFilter === "in_stock") return (p.stock_total || 0) > (p.seuil_alerte_stock || 10);
      if (statusFilter === "low_stock") return (p.stock_total || 0) > 0 && (p.stock_total || 0) <= (p.seuil_alerte_stock || 10);
      if (statusFilter === "out_of_stock") return (p.stock_total || 0) === 0;
      if (statusFilter === "prescription") return !!p.requires_prescription;
      return true;
    });
  }, [items, statusFilter, categoryFilter]);

  // Fast counts
  const stats = useMemo(() => {
    const total = items.length;
    const outOfStock = items.filter((p) => (p.stock_total || 0) === 0).length;
    const lowStock = items.filter((p) => (p.stock_total || 0) > 0 && (p.stock_total || 0) <= (p.seuil_alerte_stock || 10)).length;
    const prescription = items.filter((p) => p.requires_prescription).length;
    return { total, outOfStock, lowStock, prescription };
  }, [items]);

  return (
    <div className="space-y-6" data-testid="products-page">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">{t("nav_products")} · CATALOGUE OFFICINE</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Médicaments & Produits
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {stats.total} références enregistrées (Nomenclature CAMEG Togo)
          </p>
        </div>

        {canEdit && (
          <button
            onClick={startNew}
            data-testid="add-product-btn"
            className="bg-primary hover:bg-[#14532D] text-white font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-900/10 text-xs transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="w-4 h-4" /> {t("add")} un médicament
          </button>
        )}
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setStatusFilter("all")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "all" ? "bg-white border-primary ring-2 ring-primary/20 shadow-xs" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase">Toutes références</div>
          <div className="font-heading font-black text-xl text-slate-900 mt-0.5">{stats.total}</div>
        </button>

        <button
          onClick={() => setStatusFilter("low_stock")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "low_stock" ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20 shadow-xs" : "bg-white border-slate-200 hover:border-amber-200"
          }`}
        >
          <div className="text-[10px] font-bold text-amber-700 uppercase flex items-center justify-between">
            <span>Stock critique</span>
            <AlertTriangle className="w-3 h-3 text-amber-600" />
          </div>
          <div className="font-heading font-black text-xl text-amber-900 mt-0.5">{stats.lowStock}</div>
        </button>

        <button
          onClick={() => setStatusFilter("out_of_stock")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "out_of_stock" ? "bg-red-50/80 border-red-300 ring-2 ring-red-400/20 shadow-xs" : "bg-white border-slate-200 hover:border-red-200"
          }`}
        >
          <div className="text-[10px] font-bold text-red-700 uppercase flex items-center justify-between">
            <span>Rupture de stock</span>
            <PackageX className="w-3 h-3 text-red-600" />
          </div>
          <div className="font-heading font-black text-xl text-red-900 mt-0.5">{stats.outOfStock}</div>
        </button>

        <button
          onClick={() => setStatusFilter("prescription")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "prescription" ? "bg-red-50/90 border-red-300 ring-2 ring-red-400/30 shadow-xs" : "bg-white border-slate-200 hover:border-red-200"
          }`}
        >
          <div className="text-[10px] font-bold text-red-700 uppercase flex items-center justify-between">
            <span>🔴 Sur ordonnance</span>
            <FileText className="w-3 h-3 text-red-600" />
          </div>
          <div className="font-heading font-black text-xl text-red-900 mt-0.5">{stats.prescription}</div>
        </button>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-center gap-3 shadow-2xs">
        <div className="flex-1 w-full flex items-center gap-2 px-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            data-testid="products-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par nom, DCI ou code-barres (ex: Paracétamol, 34009...)"
            className="flex-1 outline-none text-xs font-medium text-slate-900 placeholder:text-slate-400"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="w-full md:w-auto flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 min-w-[220px]">
          <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block flex-shrink-0" />
          <SearchableSelect
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val)}
            placeholder="Toutes les catégories"
            searchPlaceholder="Filtrer catégorie..."
            options={[
              { value: "", label: "Toutes les catégories" },
              ...cats.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="products-table">
            <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">{t("code_barre")}</th>
                <th className="px-4 py-3">{t("name")}</th>
                <th className="px-4 py-3">{t("dci")}</th>
                <th className="px-4 py-3">{t("category")}</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">{t("price")}</th>
                <th className="px-4 py-3 text-center">Régime</th>
                {canEdit && <th className="px-4 py-3 text-right">{t("actions")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="text-center py-12 text-slate-400">
                    <Pill className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <div>{t("no_data")}</div>
                  </td>
                </tr>
              )}

              {filteredItems.map((p) => {
                const isOutOfStock = (p.stock_total || 0) === 0;
                const isLow = (p.stock_total || 0) <= (p.seuil_alerte_stock || 10);
                const isRx = p.requires_prescription;

                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${
                      isRx ? "bg-red-50/20 hover:bg-red-50/40" : "hover:bg-slate-50/70"
                    }`}
                    data-testid={`product-row-${p.id}`}
                  >
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 font-semibold">
                      {p.code_barre}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className={isRx ? "text-red-950 font-bold" : ""}>{p.nom_commercial}</span>
                        {isRx && (
                          <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.2 rounded shadow-2xs">
                            🔴 Rx
                          </span>
                        )}
                      </div>
                      {p.forme_pharmaceutique && (
                        <div className="text-[10px] text-slate-400 font-normal">{p.forme_pharmaceutique}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{p.dci || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                        {catName(p.categorie_id)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        isOutOfStock
                          ? "bg-red-50 text-red-600 border border-red-200"
                          : isLow
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-emerald-50 text-emerald-800"
                      }`}>
                        {p.stock_total || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-primary">
                      {formatXOF(p.prix_vente)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isRx ? (
                        <span className="text-[10px] bg-red-100 text-red-800 border border-red-300 font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                          🔴 Ordonnance
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Vente libre</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(p)}
                            data-testid={`edit-product-${p.id}`}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {hasRole("admin") && (
                            <button
                              onClick={() => del(p)}
                              data-testid={`delete-product-${p.id}`}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          data-testid="product-form-modal"
        >
          <div className="bg-white rounded-2xl w-full max-w-2xl border border-slate-200 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-primary" />
                <h2 className="font-heading text-lg font-bold text-slate-900">
                  {editing ? t("edit") : t("add")} un médicament
                </h2>
              </div>
              <button onClick={() => setShowForm(false)} data-testid="close-product-form" className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={save} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">{t("code_barre")}</label>
                <input
                  required
                  autoFocus
                  data-testid="product-form-code"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.code_barre}
                  onChange={(e) => setForm({ ...form, code_barre: e.target.value })}
                  placeholder="ex: 3400936123456"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">{t("name")}</label>
                <input
                  required
                  data-testid="product-form-name"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.nom_commercial}
                  onChange={(e) => setForm({ ...form, nom_commercial: e.target.value })}
                  placeholder="ex: Paracétamol 500mg"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">{t("dci")}</label>
                <input
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.dci}
                  onChange={(e) => setForm({ ...form, dci: e.target.value })}
                  placeholder="Dénomination Commune Internationale"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  {t("forme")}
                </label>
                <SearchableSelect
                  allowCustom={true}
                  value={form.forme_pharmaceutique || ""}
                  onChange={handleFormeChange}
                  placeholder="— Choisir ou saisir une forme —"
                  searchPlaceholder="Rechercher ou taper une forme libre..."
                  options={availableForms.map((f) => ({ value: f, label: f }))}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {t("category")}
                  </label>
                  {suggestedCategory && (
                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>Suggéré</span>
                    </span>
                  )}
                </div>

                <SearchableSelect
                  value={form.categorie_id || ""}
                  onChange={(val) => setForm({ ...form, categorie_id: val })}
                  placeholder="— Sélectionner ou rechercher catégorie —"
                  searchPlaceholder="Rechercher catégorie..."
                  options={cats.map((c) => ({ value: c.id, label: c.name }))}
                />

                {/* Interactive Suggestion Badge */}
                {suggestedCategory && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-900 bg-emerald-50/90 border border-emerald-200/90 px-2.5 py-1 rounded-lg animate-in fade-in duration-150">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span className="truncate">
                      Catégorie recommandée :
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, categorie_id: suggestedCategory.id }))}
                      className={`px-2 py-0.5 rounded font-bold text-[10px] transition-all flex items-center gap-1 flex-shrink-0 ${
                        form.categorie_id === suggestedCategory.id
                          ? "bg-emerald-600 text-white shadow-2xs cursor-default"
                          : "bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100 cursor-pointer"
                      }`}
                      title="Appliquer cette catégorie"
                    >
                      <span>{suggestedCategory.name}</span>
                      {form.categorie_id === suggestedCategory.id && <span>✓</span>}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">{t("price")} (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  required
                  data-testid="product-form-price"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-primary focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.prix_vente}
                  onChange={(e) => setForm({ ...form, prix_vente: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">{t("seuil")}</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.seuil_alerte_stock}
                  onChange={(e) => setForm({ ...form, seuil_alerte_stock: e.target.value })}
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="product-form-prescription"
                    checked={!!form.requires_prescription}
                    onChange={(e) => setForm({ ...form, requires_prescription: e.target.checked })}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-800">{t("prescription_required")}</span>
                </label>
              </div>

              <div className="col-span-full flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  data-testid="submit-product-form"
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
