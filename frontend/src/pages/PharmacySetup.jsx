import React, { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2, Upload, MapPin, Phone, Mail, FileText, CheckCircle2,
  Save, Image, ExternalLink, MessageSquare, Shield, Users, ArrowRight, X, Sparkles, Navigation
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CAMEG_PRA_LIST, TOGO_REGIONS, getNearestPra } from "@/lib/praConfig";

export default function PharmacySetup() {
  const { t } = useI18n();
  const { user, isSuperAdmin, hasRole } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slogan: "",
    logo_data: null,
    address: "",
    city: "Lomé",
    region: "Grand Lomé / Lomé Commune",
    default_pra_id: "cameg-lome-centrale",
    country: "Togo",
    phone: "",
    phone_secondary: "",
    whatsapp: "",
    email: "",
    maps_link: "",
    license_number: "",
    nif: "",
    rccm: "",
    currency: "FCFA",
    footer_message: "Merci de votre visite et prompt rétablissement !",
  });

  useEffect(() => {
    api.get("/pharmacy/current")
      .then((r) => {
        if (r.data) {
          setForm((prev) => ({ ...prev, ...r.data }));
        }
      })
      .catch((err) => {
        toast.error("Impossible de charger les paramètres de la pharmacie");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Le logo ne doit pas dépasser 2 Mo");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, logo_data: reader.result }));
      toast.success("Logo chargé avec succès");
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setForm((prev) => ({ ...prev, logo_data: null }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Le nom de la pharmacie est obligatoire");
      return;
    }
    setSubmitting(true);
    try {
      await api.put("/pharmacy/current", form);
      toast.success("Configuration de la pharmacie enregistrée avec succès !");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm font-semibold text-slate-500">Chargement des paramètres...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto" data-testid="pharmacy-setup-page">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">
            APPLICATION UNIVERSELLE · MARQUE BLANCHE
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Identité & Configuration de la Pharmacie
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Renseignez les coordonnées, le logo et les données légales de votre officine. Ces informations s'appliqueront instantanément sur tous vos tickets de caisse, reçus, bons de commande et en-têtes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/users")}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
          >
            <Users className="w-4 h-4" /> Créer Utilisateurs / Opérateurs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Configuration Form */}
        <form onSubmit={save} className="lg:col-span-7 space-y-6">
          {/* Section 1: Identité Visuelle & Logo */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="font-heading text-base font-bold text-slate-900">
                1. Identité de l'Officine & Logo
              </h2>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                Nom officiel de la pharmacie <span className="text-red-500">*</span>
              </label>
              <input
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex: Pharmacie Espoir Lomé"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                Slogan / Sous-titre
              </label>
              <input
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                value={form.slogan || ""}
                onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                placeholder="ex: Votre santé au cœur de nos priorités"
              />
            </div>

            {/* Logo Upload */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                Logo officiel de la Pharmacie
              </label>
              <div className="flex items-center gap-4 mt-2">
                {form.logo_data ? (
                  <div className="relative group w-24 h-24 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-2 flex items-center justify-center overflow-hidden">
                    <img
                      src={form.logo_data}
                      alt="Logo Pharmacie"
                      className="max-h-full max-w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl font-bold text-xs"
                      title="Supprimer le logo"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                    <Image className="w-8 h-8 mb-1 opacity-50" />
                    <span className="text-[10px]">Aucun logo</span>
                  </div>
                )}

                <div className="flex-1">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>{form.logo_data ? "Changer de logo" : "Importer un logo (PNG, JPG)"}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-tight">
                    Format recommandé : PNG fond transparent, max 2 Mo. Il sera imprimé sur les tickets de caisse et reçus PDF.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Localisation, Google Maps & Coordonnées */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <MapPin className="w-5 h-5 text-primary" />
              <h2 className="font-heading text-base font-bold text-slate-900">
                2. Localisation, Google Maps & Contacts
              </h2>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                Adresse géographique exacte
              </label>
              <input
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-1 focus:ring-primary"
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Boulevard du 13 Janvier, Quartier Déckon"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  Région Sanitaire (Togo)
                </label>
                <select
                  value={form.region || ""}
                  onChange={(e) => {
                    const nextReg = e.target.value;
                    const matchedReg = TOGO_REGIONS.find((r) => r.name === nextReg);
                    const defaultPra = matchedReg ? matchedReg.defaultPraId : form.default_pra_id;
                    setForm({ ...form, region: nextReg, default_pra_id: defaultPra });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white"
                >
                  {TOGO_REGIONS.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  Ville de Résidence
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                  value={form.city || ""}
                  onChange={(e) => {
                    const newCity = e.target.value;
                    const nearest = getNearestPra(newCity);
                    setForm({ ...form, city: newCity, default_pra_id: nearest.id });
                  }}
                  placeholder="ex: Dapaong, Kara, Sokodé, Atakpamé, Kpalimé, Tsévié, Lomé..."
                />
              </div>
            </div>

            {/* PRA CAMEG de Rattachement */}
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>PRA CAMEG de Rattachement (Approvisionnement)</span>
                </label>
                <span className="text-[10px] text-emerald-700 font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                  Rattachement Territorial
                </span>
              </div>
              <select
                value={form.default_pra_id || "cameg-lome-centrale"}
                onChange={(e) => setForm({ ...form, default_pra_id: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950 focus:ring-1 focus:ring-emerald-500"
              >
                {CAMEG_PRA_LIST.map((pra) => (
                  <option key={pra.id} value={pra.id}>
                    {pra.name} — ({pra.city})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-emerald-800">
                Vos bons de commande auprès de la CAMEG seront automatiquement orientés vers cette Pharmacie Régionale d'Approvisionnement selon votre ville.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                Lien Google Maps / Localisation GPS
              </label>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                  value={form.maps_link || ""}
                  onChange={(e) => setForm({ ...form, maps_link: e.target.value })}
                  placeholder="https://maps.google.com/?q=..."
                />
                {form.maps_link && (
                  <a
                    href={form.maps_link}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 flex items-center justify-center"
                    title="Tester le lien Maps"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  Téléphone Principal
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 font-bold focus:bg-white"
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+228 90 00 00 00"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  WhatsApp Pro
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white"
                  value={form.whatsapp || ""}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="+228 91 00 00 00"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  Téléphone Secondaire / Urgences
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white"
                  value={form.phone_secondary || ""}
                  onChange={(e) => setForm({ ...form, phone_secondary: e.target.value })}
                  placeholder="+228 22 00 00 00"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  Email de contact
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contact@pharmacie.tg"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Données Réglementaires & Fiscales */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="font-heading text-base font-bold text-slate-900">
                3. Informations Légales, Fiscales & Pied de Ticket
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  N° Agrément Ministère
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-emerald-900 focus:bg-white"
                  value={form.license_number || ""}
                  onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                  placeholder="TG-PH-2026-001"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  N° RCCM
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white"
                  value={form.rccm || ""}
                  onChange={(e) => setForm({ ...form, rccm: e.target.value })}
                  placeholder="TG-LOM-2026-B"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  NIF (Numéro fiscal)
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white"
                  value={form.nif || ""}
                  onChange={(e) => setForm({ ...form, nif: e.target.value })}
                  placeholder="1000123456"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                Message personnalisé en pied de ticket
              </label>
              <textarea
                rows={2}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-1 focus:ring-primary"
                value={form.footer_message || ""}
                onChange={(e) => setForm({ ...form, footer_message: e.target.value })}
                placeholder="Merci de votre visite et prompt rétablissement !"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              data-testid="save-pharmacy-settings-btn"
              className="bg-primary hover:bg-[#14532D] text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-emerald-900/15 flex items-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? "Enregistrement en cours..." : "Enregistrer la Configuration"}</span>
            </button>
          </div>
        </form>

        {/* Live Thermal Ticket Simulator on the Right Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">
              Aperçu en Direct
            </div>
            <div className="font-heading font-black text-sm text-slate-100">
              Format Ticket Thermique Compact (80mm)
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Voici comment le ticket de caisse ultra-compact imprimé apparaîtra avec vos coordonnées réelles :
            </p>
          </div>

          {/* Compact Thermal Receipt Box */}
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-4 font-mono text-xs text-slate-900 shadow-sm select-text">
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-slate-300">
              {form.logo_data ? (
                <img
                  src={form.logo_data}
                  alt="Logo"
                  className="h-10 mx-auto object-contain mb-1"
                />
              ) : (
                <div className="text-base font-bold">⚕️</div>
              )}
              <div className="font-bold text-sm uppercase tracking-tight text-slate-950">
                {form.name || "NOM DE LA PHARMACIE"}
              </div>
              {form.slogan && (
                <div className="text-[10px] text-slate-500 italic">{form.slogan}</div>
              )}
              <div className="text-[10px] text-slate-600 mt-0.5">
                {form.address || "Adresse de l'officine"} {form.city ? `· ${form.city}` : ""}
              </div>
              <div className="text-[10px] text-slate-500">
                Tél : {form.phone || "+228 00 00 00 00"}
              </div>
              {form.license_number && (
                <div className="text-[9px] text-emerald-800 font-bold">
                  Agrément n° {form.license_number}
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="py-1.5 text-[10px] border-b border-dashed border-slate-200 flex justify-between text-slate-600">
              <span>#TC-2026-001 · 16/08 15:30</span>
              <span>Caisse: Admin</span>
            </div>

            {/* Items (Compact single-line) */}
            <div className="py-1.5 space-y-1 border-b border-dashed border-slate-300 text-[11px]">
              <div className="flex justify-between items-baseline">
                <span className="truncate flex-1 pr-2">1x PARACETAMOL 500MG</span>
                <span className="font-bold font-mono">1 200</span>
              </div>
              <div className="flex justify-between items-baseline text-red-900">
                <span className="truncate flex-1 pr-2">2x AMOXICILLINE [🔴Rx]</span>
                <span className="font-bold font-mono">3 600</span>
              </div>
            </div>

            {/* Total */}
            <div className="pt-2 pb-1 border-b border-dashed border-slate-300">
              <div className="flex justify-between items-baseline font-black text-sm">
                <span>TOTAL :</span>
                <span className="font-mono text-emerald-800">4 800 {form.currency || "FCFA"}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Espèces reçu: 5 000</span>
                <span>Rendu: 200</span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 text-center text-[9px] text-slate-500 leading-tight">
              <div>{form.footer_message || "Merci de votre visite et prompt rétablissement !"}</div>
              <div className="text-[8px] text-slate-400 mt-1 italic">
                Médicaments vendus ni repris ni échangés.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
