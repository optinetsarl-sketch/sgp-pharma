import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Pencil, Trash2, Search, X, Pill, AlertTriangle, CheckCircle, Check, PackageX, FileText, Filter, Sparkles, Zap, Barcode, Printer, Tags, FolderPlus
} from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";
import BarcodeSvg, { getBarcodeSvgHtml } from "@/components/BarcodeSvg";

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
  const [generatingCode, setGeneratingCode] = useState(false);

  // Quick Barcode Modal State
  const [barcodeProduct, setBarcodeProduct] = useState(null);
  const [barcodeVal, setBarcodeVal] = useState("");
  const [barcodeSaving, setBarcodeSaving] = useState(false);
  const [barcodeGenLoading, setBarcodeGenLoading] = useState(false);
  const [pharmacyInfo, setPharmacyInfo] = useState(null);

  // Category Management Modal State
  const [showCatModal, setShowCatModal] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [catSearch, setCatSearch] = useState("");

  const canEdit = hasRole("admin", "pharmacist");

  const startEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
  };

  const cancelEditCategory = () => {
    setEditingCatId(null);
    setEditingCatName("");
  };

  const handleSaveCategoryName = async (catId) => {
    const trimmed = editingCatName.trim();
    if (!trimmed) {
      toast.error("Le nom de la catégorie ne peut pas être vide");
      return;
    }
    try {
      await api.put(`/categories/${catId}`, { name: trimmed });
      setCats((prev) => prev.map((c) => (c.id === catId ? { ...c, name: trimmed } : c)));
      setEditingCatId(null);
      setEditingCatName("");
      toast.success(`Catégorie renommée en "${trimmed}" !`);
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur de modification");
    }
  };

  const loadCategories = () => {
    api.get("/categories").then((r) => setCats(r.data || [])).catch(() => {});
  };

  const handleCategoryChange = async (val) => {
    if (!val) {
      setForm((prev) => ({ ...prev, categorie_id: "" }));
      return;
    }
    const existing = cats.find((c) => c.id === val || c.name.toLowerCase() === val.toLowerCase());
    if (existing) {
      setForm((prev) => ({ ...prev, categorie_id: existing.id }));
    } else {
      // User typed a new custom category name!
      try {
        const res = await api.post("/categories", { name: val.trim() });
        const createdCat = res.data;
        setCats((prev) => [...prev, createdCat]);
        setForm((prev) => ({ ...prev, categorie_id: createdCat.id }));
        toast.success(`Nouvelle catégorie créée : "${createdCat.name}"`);
      } catch (err) {
        toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur de création");
      }
    }
  };

  const handleAddCategory = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = (newCatName || "").trim();
    if (!trimmed) {
      toast.error("Veuillez saisir le nom de la catégorie");
      return;
    }
    if (cats.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`La catégorie "${trimmed}" existe déjà`);
      return;
    }
    setCatSaving(true);
    try {
      const res = await api.post("/categories", { name: trimmed });
      setCats((prev) => [...prev, res.data]);
      setNewCatName("");
      setIsAddingCategory(false);
      toast.success(`Catégorie "${trimmed}" ajoutée avec succès !`);
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur d'ajout de la catégorie");
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const productsInCat = items.filter((p) => p.categorie_id === cat.id);
    let msg = `Confirmer la suppression définitive de la catégorie "${cat.name}" ?`;
    if (productsInCat.length > 0) {
      msg = `Attention : ${productsInCat.length} produit(s) sont classés dans "${cat.name}".\n\nConfirmer la suppression ? (Ces produits n'auront plus de catégorie)`;
    }
    if (!window.confirm(msg)) return;
    try {
      await api.delete(`/categories/${cat.id}`);
      setCats((prev) => prev.filter((c) => c.id !== cat.id));
      setItems((prev) => prev.map((p) => (p.categorie_id === cat.id ? { ...p, categorie_id: null } : p)));
      if (categoryFilter === cat.id) setCategoryFilter("");
      toast.success(`Catégorie "${cat.name}" supprimée.`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur de suppression");
    }
  };

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
    api.get("/pharmacy/current").then((r) => setPharmacyInfo(r.data)).catch(() => {});
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

  const generateBarcode = async () => {
    setGeneratingCode(true);
    try {
      const r = await api.get("/products/generate-barcode");
      setForm((prev) => ({ ...prev, code_barre: r.data.code_barre }));
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setGeneratingCode(false);
    }
  };

  const openBarcodeModal = (p) => {
    setBarcodeProduct(p);
    setBarcodeVal(p.code_barre || "");
  };

  const handleGenerateInModal = async () => {
    setBarcodeGenLoading(true);
    try {
      const r = await api.get("/products/generate-barcode");
      setBarcodeVal(r.data.code_barre);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setBarcodeGenLoading(false);
    }
  };

  const handleSaveBarcode = async () => {
    if (!barcodeProduct) return;
    setBarcodeSaving(true);
    try {
      const updated = {
        ...barcodeProduct,
        code_barre: (barcodeVal || "").trim(),
      };
      await api.put(`/products/${barcodeProduct.id}`, updated);
      toast.success("Code-barre enregistré avec succès !");
      setBarcodeProduct(null);
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setBarcodeSaving(false);
    }
  };

  const handlePrintLabel = (onlyBarcode = false) => {
    if (!barcodeProduct) return;
    const printWindow = window.open("", "_blank", "width=420,height=520");
    if (!printWindow) {
      toast.error("Veuillez autoriser les fenêtres pop-up pour imprimer l'étiquette");
      return;
    }
    const pharmName = pharmacyInfo?.name || "PHARMACIE";
    const prodName = barcodeProduct.nom_commercial;
    const dci = barcodeProduct.dci || "";
    const forme = barcodeProduct.forme_pharmaceutique || "";
    const price = formatXOF(barcodeProduct.prix_vente);
    const code = (barcodeVal || barcodeProduct.code_barre || "").trim();
    const barcodeSvgHtml = getBarcodeSvgHtml(code, 48);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Étiquette - ${prodName}</title>
          <style>
            @page { size: auto; margin: 3mm; }
            * { box-sizing: border-box; }
            body {
              font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 4px;
              color: #000;
              background: #fff;
              text-align: center;
              width: 58mm;
              max-width: 100%;
            }
            .label-card {
              border: 1px solid #000;
              border-radius: 6px;
              padding: 6px 4px;
              background: #fff;
              margin: 0 auto;
            }
            .header {
              font-size: 8px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.6px;
              border-bottom: 1px dashed #555;
              padding-bottom: 3px;
              margin-bottom: 4px;
            }
            .title {
              font-size: 11px;
              font-weight: 900;
              line-height: 1.2;
              margin: 2px 0;
              word-break: break-word;
            }
            .sub {
              font-size: 8px;
              color: #222;
              margin-bottom: 4px;
            }
            .price {
              font-size: 13px;
              font-weight: 900;
              margin: 4px 0;
              padding: 2px 0;
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
            }
            .barcode-box {
              margin-top: 4px;
              padding: 2px 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .barcode-only-card {
              border: 1px solid #000;
              border-radius: 6px;
              padding: 8px 4px;
              background: #fff;
              display: inline-block;
              margin: 0 auto;
            }
            svg {
              display: block;
              margin: 0 auto;
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          ${onlyBarcode ? `
            <div class="barcode-only-card">
              ${barcodeSvgHtml}
            </div>
          ` : `
            <div class="label-card">
              <div class="header">${pharmName}</div>
              <div class="title">${prodName}</div>
              ${dci || forme ? `<div class="sub">${[forme, dci].filter(Boolean).join(" · ")}</div>` : ""}
              <div class="price">${price}</div>
              <div class="barcode-box">
                ${barcodeSvgHtml}
              </div>
            </div>
          `}
          <script>
            function triggerPrint() {
              window.print();
              setTimeout(function() { window.close(); }, 600);
            }
            if (document.readyState === 'complete') {
              triggerPrint();
            } else {
              window.addEventListener('load', triggerPrint);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        code_barre: (form.code_barre || "").trim(),
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
            Médicaments et Produits
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
          <div className="flex-1 min-w-[180px]">
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
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowCatModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 flex-shrink-0 hover:scale-[1.02] active:scale-[0.98]"
              title="Gérer les catégories : Ajouter, modifier ou supprimer"
            >
              <Tags className="w-4 h-4" />
              <span className="whitespace-nowrap font-bold">Catégories</span>
            </button>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="products-table">
            <thead className="bg-slate-100/90 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-3 sm:px-4 py-3 hidden sm:table-cell">{t("code_barre")}</th>
                <th className="px-3 sm:px-4 py-3">{t("name")}</th>
                <th className="px-4 py-3 hidden xl:table-cell">{t("dci")}</th>
                <th className="px-4 py-3 hidden md:table-cell">{t("category")}</th>
                <th className="px-3 sm:px-4 py-3 text-right">Stock</th>
                <th className="px-3 sm:px-4 py-3 text-right">{t("price")}</th>
                <th className="px-3 sm:px-4 py-3 text-center hidden lg:table-cell">Régime</th>
                {canEdit && (
                  <th className="px-3 sm:px-4 py-3 text-right sticky right-0 bg-slate-100/95 backdrop-blur-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.12)] z-10">
                    {t("actions")}
                  </th>
                )}
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
                    className={`transition-colors group ${
                      isRx ? "bg-red-50/20 hover:bg-red-50/40" : "hover:bg-slate-50/70"
                    }`}
                    data-testid={`product-row-${p.id}`}
                  >
                    {/* Code-barres (desktop sm+) */}
                    <td className="px-3 sm:px-4 py-3 font-mono text-[11px] text-slate-600 font-semibold hidden sm:table-cell whitespace-nowrap">
                      {p.code_barre || "—"}
                    </td>

                    {/* Nom + Forme + informations compactes sur petit écran */}
                    <td className="px-3 sm:px-4 py-3 font-bold text-slate-900 min-w-[140px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={isRx ? "text-red-950 font-bold" : ""}>{p.nom_commercial}</span>
                        {isRx && (
                          <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.2 rounded shadow-2xs">
                            🔴 Rx
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1 flex-wrap mt-0.5">
                        {p.forme_pharmaceutique && <span>{p.forme_pharmaceutique}</span>}
                        {p.dci && <span className="xl:hidden text-slate-500 font-medium">· {p.dci}</span>}
                        <span className="md:hidden text-emerald-800 bg-emerald-50 px-1 rounded font-medium">· {catName(p.categorie_id)}</span>
                        {p.code_barre && <span className="sm:hidden font-mono text-[9px] text-slate-500">· {p.code_barre}</span>}
                      </div>
                    </td>

                    {/* DCI (desktop xl) */}
                    <td className="px-4 py-3 text-slate-600 font-medium hidden xl:table-cell">{p.dci || "—"}</td>

                    {/* Catégorie (desktop md) */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                        {catName(p.categorie_id)}
                      </span>
                    </td>

                    {/* Stock */}
                    <td className="px-3 sm:px-4 py-3 text-right font-mono whitespace-nowrap">
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

                    {/* Prix */}
                    <td className="px-3 sm:px-4 py-3 text-right font-bold font-mono text-primary whitespace-nowrap text-xs">
                      {formatXOF(p.prix_vente)}
                    </td>

                    {/* Régime (desktop lg) */}
                    <td className="px-3 sm:px-4 py-3 text-center hidden lg:table-cell whitespace-nowrap">
                      {isRx ? (
                        <span className="text-[10px] bg-red-100 text-red-800 border border-red-300 font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                          🔴 Ordonnance
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Vente libre</span>
                      )}
                    </td>

                    {/* Actions: STICKY RIGHT - TOUJOURS VISIBLE SANS DÉBORDEMENT */}
                    {canEdit && (
                      <td className="px-3 sm:px-4 py-3 text-right sticky right-0 bg-white/95 backdrop-blur-xs group-hover:bg-slate-50/95 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.12)] z-10 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openBarcodeModal(p)}
                            data-testid={`barcode-product-${p.id}`}
                            className="p-1.5 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-lg transition-colors border border-slate-200 sm:border-transparent"
                            title="Générer / Imprimer le code-barre"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => startEdit(p)}
                            data-testid={`edit-product-${p.id}`}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors border border-slate-200 sm:border-transparent"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {hasRole("admin") && (
                            <button
                              onClick={() => del(p)}
                              data-testid={`delete-product-${p.id}`}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors border border-slate-200 sm:border-transparent"
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t("code_barre")}</label>
                  <button
                    type="button"
                    onClick={generateBarcode}
                    disabled={generatingCode}
                    data-testid="product-form-generate-code"
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 disabled:opacity-50"
                    title="Générer un code-barre interne unique"
                  >
                    <Zap className="w-3 h-3" />
                    {generatingCode ? "..." : "Générer"}
                  </button>
                </div>
                <input
                  autoFocus
                  data-testid="product-form-code"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:ring-1 focus:ring-primary"
                  value={form.code_barre || ""}
                  onChange={(e) => setForm({ ...form, code_barre: e.target.value })}
                  placeholder="Scannez la boîte ou laissez vide"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Vide = code généré automatiquement à l'enregistrement
                </p>
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
                  allowCustom={true}
                  value={form.categorie_id || ""}
                  onChange={handleCategoryChange}
                  placeholder="— Choisir ou saisir une catégorie —"
                  searchPlaceholder="Rechercher ou taper une nouvelle catégorie..."
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

      {/* Quick Barcode Modal */}
      {barcodeProduct && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          data-testid="barcode-modal"
        >
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-emerald-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Barcode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold text-slate-900 leading-tight">
                    Code-barre et Étiquette
                  </h3>
                  <div className="text-[11px] text-slate-500 truncate max-w-[260px]">
                    {barcodeProduct.nom_commercial}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setBarcodeProduct(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Product mini recap */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-slate-900">{barcodeProduct.nom_commercial}</div>
                  <div className="text-[10px] text-slate-500">
                    {[barcodeProduct.forme_pharmaceutique, barcodeProduct.dci].filter(Boolean).join(" · ") || "Médicament"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Prix vente</div>
                  <div className="font-mono font-black text-primary text-sm">
                    {formatXOF(barcodeProduct.prix_vente)}
                  </div>
                </div>
              </div>

              {/* Barcode Visual Preview */}
              <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <BarcodeSvg code={barcodeVal} height={52} />
              </div>

              {/* Input & Generator Actions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Numéro Code-barre (EAN-13)
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateInModal}
                    disabled={barcodeGenLoading}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
                    title="Générer automatiquement un code-barre interne unique"
                  >
                    <Zap className="w-3 h-3 text-emerald-600" />
                    <span>{barcodeGenLoading ? "Génération..." : "⚡ Nouveau code"}</span>
                  </button>
                </div>
                <input
                  autoFocus
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:ring-1 focus:ring-primary"
                  value={barcodeVal}
                  onChange={(e) => setBarcodeVal(e.target.value)}
                  placeholder="Scannez avec la douchette ou cliquez sur Nouveau code"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Vous pouvez aussi scanner directement la boîte avec votre douchette.
                </p>
              </div>

              {/* Modal footer buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintLabel(false)}
                    disabled={!barcodeVal}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                    title="Imprimer l'étiquette complète avec la pharmacie, le produit, le prix et le code-barres"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-200" />
                    <span>Imprimer étiquette</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintLabel(true)}
                    disabled={!barcodeVal}
                    className="px-3 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Imprimer uniquement le code-barres comme dans la boîte de prévisualisation"
                  >
                    <Barcode className="w-3.5 h-3.5 text-slate-600" />
                    <span>Code-barre seul</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBarcodeProduct(null)}
                    className="px-3 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBarcode}
                    disabled={barcodeSaving}
                    className="bg-primary hover:bg-[#14532D] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{barcodeSaving ? "Enregistrement..." : "Enregistrer"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Gérer les catégories */}
      {showCatModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center shadow-xs">
                  <Tags className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Gestion des Catégories</h3>
                  <p className="text-[11px] text-slate-500">
                    {cats.length} catégories enregistrées · Ajouter, modifier ou supprimer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCatModal(false);
                  cancelEditCategory();
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Category Section: Button or Input Area */}
            {!isAddingCategory ? (
              <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 font-medium">Créer une nouvelle catégorie pour vos produits</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCategory(true);
                    setNewCatName("");
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une catégorie</span>
                </button>
              </div>
            ) : (
              <div className="p-4 border-b border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                    <FolderPlus className="w-4 h-4 text-emerald-600" />
                    <span>Renseigner le nom de la nouvelle catégorie</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCategory(false);
                      setNewCatName("");
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <input
                    type="text"
                    autoFocus
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCategory(e);
                      }
                      if (e.key === "Escape") {
                        setIsAddingCategory(false);
                        setNewCatName("");
                      }
                    }}
                    placeholder="Tapez le nom ici (ex: Compléments alimentaires, Dermocosmétique...)"
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-emerald-300 focus:border-emerald-600 rounded-xl text-xs font-semibold text-slate-900 outline-none transition-all shadow-inner"
                  />
                  <p className="text-[10px] text-slate-500">
                    Appuyez sur Entrée pour valider directement ou cliquez sur « Enregistrer ».
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCategory(false);
                      setNewCatName("");
                    }}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={catSaving}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{catSaving ? "Enregistrement..." : "Enregistrer la catégorie"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Filter Inside Categories List */}
            <div className="px-4 pt-3 pb-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  placeholder="Rechercher une catégorie..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
                {catSearch && (
                  <button onClick={() => setCatSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Categories List */}
            <div className="p-3 max-h-80 overflow-y-auto divide-y divide-slate-100 space-y-1">
              {cats.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">Aucune catégorie trouvée</div>
              ) : (
                cats
                  .filter((c) => !catSearch.trim() || c.name.toLowerCase().includes(catSearch.toLowerCase()))
                  .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }))
                  .map((cat) => {
                    const count = items.filter((p) => p.categorie_id === cat.id).length;
                    const isEditing = editingCatId === cat.id;

                    return (
                      <div key={cat.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2 py-1.5 px-2.5 hover:bg-slate-50/80 rounded-xl transition-colors">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              autoFocus
                              value={editingCatName}
                              onChange={(e) => setEditingCatName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveCategoryName(cat.id);
                                if (e.key === "Escape") cancelEditCategory();
                              }}
                              className="flex-1 px-3 py-1 text-xs font-bold bg-white border-2 border-emerald-500 rounded-lg outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveCategoryName(cat.id)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs"
                              title="Valider la modification"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditCategory}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                              title="Annuler"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                              <span className="text-xs font-bold text-slate-800 truncate">{cat.name}</span>
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                {count} produit{count > 1 ? "s" : ""}
                              </span>
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEditCategory(cat)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                                  title={`Modifier le nom de "${cat.name}"`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title={`Supprimer "${cat.name}"`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
              <span>{cats.length} catégories au total</span>
              <button
                type="button"
                onClick={() => {
                  setShowCatModal(false);
                  cancelEditCategory();
                }}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors shadow-2xs"
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
