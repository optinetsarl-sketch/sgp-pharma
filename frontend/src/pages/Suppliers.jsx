import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Pencil, Trash2, X, Truck, Search, Phone, Mail, MapPin,
  Building2, ShieldCheck, ClipboardList, Clock, Sparkles, Check, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

const TYPE_CONFIG = {
  centrale_achat: { label: "Centrale d'Achat", color: "bg-blue-50 text-blue-800 border-blue-200" },
  grossiste: { label: "Grossiste-Répartiteur", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  laboratoire: { label: "Laboratoire Fabricant", color: "bg-purple-50 text-purple-800 border-purple-200" },
  distributeur: { label: "Distributeur Local", color: "bg-amber-50 text-amber-800 border-amber-200" },
  autre: { label: "Autre Partenaire", color: "bg-slate-100 text-slate-700 border-slate-200" },
};

const STANDARD_SUPPLIERS = [
  {
    raison_sociale: "CAMEG Togo",
    type: "centrale_achat",
    contact: "Direction CAMEG (Approvisionnements)",
    telephone: "+228 22 21 80 00",
    email: "commandes@cameg.tg",
    adresse: "Quartier Bé / Zone Portuaire, Lomé",
    delai_livraison: "24h - 48h",
    conditions_paiement: "30 jours fin de mois",
  },
  {
    raison_sociale: "UBIPHARM Togo",
    type: "grossiste",
    contact: "M. Adjiwa (Service Répartiteurs)",
    telephone: "+228 22 21 30 40",
    email: "contact@ubipharm.tg",
    adresse: "Zone Industrielle, Lomé, Togo",
    delai_livraison: "Même jour / 24h",
    conditions_paiement: "30 jours fin de mois",
  },
  {
    raison_sociale: "COPHARMA",
    type: "grossiste",
    contact: "Mme. Bassa (Commandes Officines)",
    telephone: "+228 22 25 65 87",
    email: "info@copharma.tg",
    adresse: "Quartier Adidogomé, Lomé, Togo",
    delai_livraison: "24h",
    conditions_paiement: "30 jours",
  },
  {
    raison_sociale: "LABOREX Togo",
    type: "grossiste",
    contact: "M. Kodjo (Service Commercial)",
    telephone: "+228 22 50 14 22",
    email: "togo@laborex.com",
    adresse: "Zone Portuaire, Lomé, Togo",
    delai_livraison: "24h",
    conditions_paiement: "30 jours",
  },
  {
    raison_sociale: "TEDIS Pharma",
    type: "grossiste",
    contact: "Cellule Approvisionnement",
    telephone: "+228 22 21 55 10",
    email: "commandes@tedis.tg",
    adresse: "Lomé, Togo",
    delai_livraison: "24h",
    conditions_paiement: "30 jours fin de mois",
  },
  {
    raison_sociale: "CIPHARM",
    type: "laboratoire",
    contact: "Délégation Médicale Régionale",
    telephone: "+225 21 21 00 00",
    email: "commandes@cipharm.com",
    adresse: "Abidjan / Représentation Lomé",
    delai_livraison: "48h - 72h",
    conditions_paiement: "Au comptant / 30 jours",
  }
];

const empty = {
  raison_sociale: "",
  type: "grossiste",
  contact: "",
  email: "",
  telephone: "",
  adresse: "",
  delai_livraison: "24h",
  conditions_paiement: "30 jours",
  notes: "",
  pharmacy_id: "",
};

export default function Suppliers() {
  const { t } = useI18n();
  const { user, hasRole, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [pharmaciesList, setPharmaciesList] = useState([]);

  // Any admin, super_admin, pharmacist, or storekeeper can manage suppliers
  const canEdit = hasRole("admin", "pharmacist", "storekeeper") || isSuperAdmin?.();
  const canDelete = hasRole("admin") || isSuperAdmin?.();
  const isAdmin = hasRole("admin") || isSuperAdmin?.();

  const reload = () => {
    setLoading(true);
    api.get("/suppliers")
      .then((r) => setItems(r.data || []))
      .catch((err) => {
        toast.error("Impossible de charger les fournisseurs : " + (err.response?.data?.detail || err.message));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    if (isSuperAdmin?.()) {
      api.get("/pharmacies").then((r) => setPharmaciesList(r.data || [])).catch(() => {});
    }
  }, []);

  const filtered = useMemo(() => {
    let res = items;
    if (typeFilter !== "all") {
      res = res.filter((s) => (s.type || "grossiste") === typeFilter);
    }
    if (q) {
      const ql = q.toLowerCase();
      res = res.filter(
        (s) =>
          s.raison_sociale?.toLowerCase().includes(ql) ||
          s.contact?.toLowerCase().includes(ql) ||
          s.telephone?.toLowerCase().includes(ql) ||
          s.email?.toLowerCase().includes(ql) ||
          s.adresse?.toLowerCase().includes(ql)
      );
    }
    return res;
  }, [items, q, typeFilter]);

  const save = async (e) => {
    e.preventDefault();
    if (!form.raison_sociale?.trim()) {
      toast.error("Veuillez saisir la raison sociale du fournisseur");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.pharmacy_id) delete payload.pharmacy_id;

      if (editing) {
        await api.put(`/suppliers/${editing.id}`, payload);
        toast.success("Fournisseur mis à jour avec succès");
      } else {
        await api.post("/suppliers", payload);
        toast.success("Nouveau fournisseur ajouté avec succès");
      }
      setShowForm(false);
      setEditing(null);
      setForm(empty);
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const del = async (s) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer "${s.raison_sociale}" ?`)) return;
    try {
      await api.delete(`/suppliers/${s.id}`);
      toast.success("Fournisseur supprimé avec succès");
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erreur lors de la suppression");
    }
  };

  const applyPreset = (preset) => {
    setForm((prev) => ({
      ...prev,
      ...preset,
      pharmacy_id: prev.pharmacy_id || "",
    }));
  };

  const seedStandardGrossistes = async () => {
    if (!window.confirm("Voulez-vous ajouter les 4 grossistes de référence (CAMEG, UBIPHARM, COPHARMA, LABOREX) ?")) return;
    try {
      let added = 0;
      for (const p of STANDARD_SUPPLIERS.slice(0, 4)) {
        const exists = items.some((it) => it.raison_sociale?.toLowerCase() === p.raison_sociale.toLowerCase());
        if (!exists) {
          await api.post("/suppliers", p);
          added++;
        }
      }
      if (added > 0) {
        toast.success(`${added} grossistes partenaires ajoutés avec succès !`);
        reload();
      } else {
        toast.info("Tous les grossistes partenaires de référence sont déjà présents.");
      }
    } catch (err) {
      toast.error("Erreur lors de l'initialisation : " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-6" data-testid="suppliers-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="label-tiny text-primary font-bold">{t("nav_suppliers")} · RÉSEAU LOGISTIQUE & GROSSISTES</span>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-700" /> Mode Administrateur
              </span>
            )}
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Fournisseurs & Grossistes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Annuaire complet des centrales d'achats pharmaceutiques, répartiteurs officinaux et laboratoires.
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setEditing(null);
                setForm(empty);
                setShowForm(true);
              }}
              data-testid="add-supplier-btn"
              className="bg-primary hover:bg-[#14532D] text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-md shadow-emerald-900/10 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Nouveau Fournisseur / Grossiste
            </button>
          </div>
        )}
      </div>

      {/* Controls bar: search & type filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par nom, délégué, téléphone, email ou ville..."
            className="w-full text-xs font-medium text-slate-900 outline-none bg-transparent placeholder:text-slate-400"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
          <button
            onClick={() => setTypeFilter("all")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all text-[11px] whitespace-nowrap cursor-pointer ${
              typeFilter === "all"
                ? "bg-primary text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tous ({items.length})
          </button>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
            const count = items.filter((s) => (s.type || "grossiste") === key).length;
            if (count === 0 && typeFilter !== key) return null;
            return (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all text-[11px] whitespace-nowrap cursor-pointer ${
                  typeFilter === key
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Fournisseur / Grossiste</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Contact & Délégué</th>
                <th className="px-4 py-3">Téléphone & Email</th>
                <th className="px-4 py-3">Délai & Règlement</th>
                {canEdit && <th className="px-4 py-3 text-right">{t("actions")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 opacity-40 animate-pulse text-primary" />
                    <div>Chargement des fournisseurs...</div>
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <Truck className="w-10 h-10 mx-auto mb-3 opacity-30 text-slate-500" />
                    <div className="font-bold text-slate-700 text-sm mb-1">Aucun fournisseur trouvé</div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                      {q ? "Aucun fournisseur ne correspond à votre recherche." : "Vous n'avez pas encore enregistré de fournisseurs dans votre officine."}
                    </p>
                    {canEdit && (
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <button
                          onClick={() => {
                            setEditing(null);
                            setForm(empty);
                            setShowForm(true);
                          }}
                          className="px-4 py-2 bg-primary hover:bg-[#14532D] text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                        >
                          <Plus className="w-4 h-4 inline mr-1" /> Ajouter un fournisseur
                        </button>
                        <button
                          onClick={seedStandardGrossistes}
                          className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 inline mr-1 text-emerald-600" /> Ajouter grossistes recommandés (CAMEG, Ubipharm...)
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}

              {!loading && filtered.map((s) => {
                const typeInfo = TYPE_CONFIG[s.type] || TYPE_CONFIG.grossiste;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-black text-xs shrink-0">
                          {s.raison_sociale ? s.raison_sociale.charAt(0).toUpperCase() : "F"}
                        </div>
                        <div>
                          <div className="text-slate-900 font-extrabold text-[13px]">{s.raison_sociale}</div>
                          {s.adresse && (
                            <div className="text-[10px] text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" /> {s.adresse}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      {s.contact ? (
                        <div className="font-semibold text-slate-800">{s.contact}</div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 space-y-0.5">
                      {s.telephone ? (
                        <div className="font-mono text-xs font-semibold text-slate-800">
                          <a href={`tel:${s.telephone}`} className="hover:text-primary flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-emerald-600" /> {s.telephone}
                          </a>
                        </div>
                      ) : null}
                      {s.email ? (
                        <div className="text-[11px] text-slate-600">
                          <a href={`mailto:${s.email}`} className="text-primary hover:underline flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-slate-400" /> {s.email}
                          </a>
                        </div>
                      ) : null}
                      {!s.telephone && !s.email && <span className="text-slate-400">—</span>}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Livraison : {s.delai_livraison || "24h"}</span>
                      </div>
                      {s.conditions_paiement && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Règlement : {s.conditions_paiement}
                        </div>
                      )}
                    </td>

                    {canEdit && (
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate("/orders")}
                            className="p-1.5 hover:bg-emerald-50 text-emerald-700 hover:text-emerald-900 rounded-lg transition-colors cursor-pointer"
                            title="Créer un Bon de Commande pour ce fournisseur"
                          >
                            <ClipboardList className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditing(s);
                              setForm({
                                raison_sociale: s.raison_sociale || "",
                                type: s.type || "grossiste",
                                contact: s.contact || "",
                                email: s.email || "",
                                telephone: s.telephone || "",
                                adresse: s.adresse || "",
                                delai_livraison: s.delai_livraison || "24h",
                                conditions_paiement: s.conditions_paiement || "30 jours",
                                notes: s.notes || "",
                                pharmacy_id: s.pharmacy_id || "",
                              });
                              setShowForm(true);
                            }}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                            data-testid={`edit-supplier-${s.id}`}
                            title="Modifier les coordonnées"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => del(s)}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              data-testid={`delete-supplier-${s.id}`}
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-heading text-base font-bold text-slate-900">
                    {editing ? "Modifier le fournisseur" : "Ajouter un Fournisseur / Grossiste"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {editing ? `Mise à jour des informations de ${editing.raison_sociale}` : "Enregistrement dans l'annuaire d'officine"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Quick suggestions chips (only when adding new) */}
              {!editing && (
                <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Suggestions rapides (cliquez pour pré-remplir) :</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STANDARD_SUPPLIERS.map((st) => (
                      <button
                        key={st.raison_sociale}
                        type="button"
                        onClick={() => applyPreset(st)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold border transition-all cursor-pointer ${
                          form.raison_sociale === st.raison_sociale
                            ? "bg-primary text-white border-primary shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50"
                        }`}
                      >
                        {st.raison_sociale}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Raison Sociale */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  Raison sociale / Nom officiel <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  autoFocus
                  data-testid="supplier-form-name"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                  value={form.raison_sociale}
                  onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })}
                  placeholder="ex: CAMEG TOGO, UBIPHARM, COPHARMA..."
                />
              </div>

              {/* Type de fournisseur */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Catégorie du partenaire
                  </label>
                  <select
                    value={form.type || "grossiste"}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="grossiste">Grossiste-Répartiteur</option>
                    <option value="centrale_achat">Centrale d'Achat (CAMEG)</option>
                    <option value="laboratoire">Laboratoire Fabricant</option>
                    <option value="distributeur">Distributeur Local</option>
                    <option value="autre">Autre Partenaire</option>
                  </select>
                </div>

                {/* If Super Admin, show target pharmacy */}
                {isSuperAdmin?.() && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                      Officine de rattachement
                    </label>
                    <select
                      value={form.pharmacy_id || ""}
                      onChange={(e) => setForm({ ...form, pharmacy_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-amber-50/50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">Partagé (Toutes les officines)</option>
                      {pharmaciesList.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Contact & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Contact / Délégué médical
                  </label>
                  <input
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    value={form.contact || ""}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    placeholder="ex: M. KOUASSI (Délégué)"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Téléphone commandes
                  </label>
                  <input
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    value={form.telephone || ""}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    placeholder="ex: +228 22 21 00 00"
                  />
                </div>
              </div>

              {/* Email & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Email commandes
                  </label>
                  <input
                    type="email"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    value={form.email || ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="commandes@fournisseur.tg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Adresse géographique / Ville
                  </label>
                  <input
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    value={form.adresse || ""}
                    onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                    placeholder="Zone Portuaire / Lomé"
                  />
                </div>
              </div>

              {/* Délai & Conditions de règlement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Délai de livraison
                  </label>
                  <input
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    value={form.delai_livraison || ""}
                    onChange={(e) => setForm({ ...form, delai_livraison: e.target.value })}
                    placeholder="ex: 24h ou Même jour"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Modalités de règlement
                  </label>
                  <input
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    value={form.conditions_paiement || ""}
                    onChange={(e) => setForm({ ...form, conditions_paiement: e.target.value })}
                    placeholder="ex: 30 jours fin de mois, Comptant"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  data-testid="submit-supplier-form"
                  className="bg-primary hover:bg-[#14532D] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <span>Enregistrement...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editing ? "Mettre à jour" : "Enregistrer le Fournisseur"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
