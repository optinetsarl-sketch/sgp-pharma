import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Cloud, RefreshCw, Lock, Mail, Phone, MapPin,
  CheckCircle2, ShieldCheck, Database, ArrowRight, Sparkles
} from "lucide-react";
import api from "@/lib/api";
import { ALL_TOGO_CITIES } from "@/lib/praConfig";
import { toast } from "sonner";
import PharmacyLogo from "@/components/PharmacyLogo";

export default function SetupWizard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("new"); // "new" | "restore"
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Formulaire Nouvelle Pharmacie
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("Lomé");
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [cloudDbName, setCloudDbName] = useState("");
  const [adminName, setAdminName] = useState("Admin Pharmacie");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Formulaire Restauration
  const [restoreDbName, setRestoreDbName] = useState("");
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restorePassword, setRestorePassword] = useState("");

  // Génération automatique du code de base Cloud au fur et à mesure de la saisie
  const handleNameChange = (val) => {
    setNewName(val);
    const clean = val.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
    const words = clean.split(/\s+/).filter(Boolean);
    const filtered = (words[0] && words[0].toLowerCase().startsWith("pharm")) ? words.slice(1) : words;
    const slug = filtered.slice(0, 3).join("-").toUpperCase() || "CLIENT";
    setCloudDbName(`PHARMA-${slug}`);
  };

  // Vérification de l'état de l'installation : si déjà configurée, rediriger
  useEffect(() => {
    api.get("/setup/status")
      .then((res) => {
        if (res.data?.is_configured) {
          navigate("/", { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [navigate]);

  // Initialisation d'une nouvelle pharmacie
  const handleInitialize = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Veuillez renseigner le nom de la pharmacie");
      return;
    }
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast.error("Veuillez renseigner l'email et le mot de passe administrateur");
      return;
    }
    if (adminPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/setup/initialize", {
        name: newName,
        city: newCity,
        address: newAddress,
        phone: newPhone,
        email: newEmail,
        cloud_db_name: cloudDbName,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
      });

      if (res.data?.access_token) {
        localStorage.setItem("sgp_token", res.data.access_token);
        if (res.data?.user) {
          localStorage.setItem("sgp_user", JSON.stringify(res.data.user));
        }
        toast.success(`Pharmacie initialisée avec succès : ${newName}`);
        // Recharger l'application pour charger le nouveau contexte
        window.location.href = "/";
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Erreur lors de l'initialisation de l'officine";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Restauration d'une pharmacie existante depuis Atlas
  const handleRestore = async (e) => {
    e.preventDefault();
    if (!restoreDbName.trim()) {
      toast.error("Veuillez saisir l'identifiant de la base Cloud");
      return;
    }
    if (!restoreEmail.trim() || !restorePassword.trim()) {
      toast.error("Veuillez saisir les identifiants administrateur");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/setup/restore", {
        cloud_db_name: restoreDbName,
        admin_email: restoreEmail,
        admin_password: restorePassword,
      });

      if (res.data?.access_token) {
        localStorage.setItem("sgp_token", res.data.access_token);
        if (res.data?.user) {
          localStorage.setItem("sgp_user", JSON.stringify(res.data.user));
        }
        toast.success(`Restauration terminée : ${res.data.records_count || 0} enregistrements restaurés`);
        window.location.href = "/";
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Erreur lors de la restauration Cloud";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-emerald-50/30 to-slate-100 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* En-tête */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-200 mb-3">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-heading font-black text-slate-900 tracking-tight">
            SGP-Pharma · OPTINET
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Assistant d'initialisation et de gestion d'officine
          </p>
        </div>

        {/* Carte principale */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          {/* Sélecteur d'onglets épuré */}
          <div className="flex border-b border-slate-200 bg-slate-50/60 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={`flex-1 py-2.5 px-3 rounded-xl font-heading font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                activeTab === "new"
                  ? "bg-white text-primary shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Nouvelle Pharmacie</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("restore")}
              className={`flex-1 py-2.5 px-3 rounded-xl font-heading font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                activeTab === "restore"
                  ? "bg-white text-primary shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span>Restaurer une Pharmacie</span>
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {/* ONGLET A : NOUVELLE PHARMACIE */}
            {activeTab === "new" && (
              <form onSubmit={handleInitialize} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom de la Pharmacie *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pharmacie de la Paix"
                    value={newName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ville *
                    </label>
                    <select
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium bg-white"
                    >
                      {ALL_TOGO_CITIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="text"
                      placeholder="+228 90 00 00 00"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Adresse
                  </label>
                  <input
                    type="text"
                    placeholder="Quartier, rue ou repère"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Identifiant Base Cloud
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cloudDbName}
                      onChange={(e) => setCloudDbName(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold text-primary bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Nom réservé sur votre cluster MongoDB Atlas.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Compte Administrateur
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Email Admin *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="admin@pharmacie.tg"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Mot de passe *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Au moins 6 caractères"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 py-2.5 px-4 bg-primary hover:bg-emerald-700 disabled:opacity-50 text-white font-heading font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Initialisation en cours...</span>
                    </>
                  ) : (
                    <>
                      <span>Initialiser l'Officine</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ONGLET B : RESTAURER UNE PHARMACIE */}
            {activeTab === "restore" && (
              <form onSubmit={handleRestore} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Identifiant Base Cloud *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: HOP-Pharma"
                    value={restoreDbName}
                    onChange={(e) => setRestoreDbName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Nom exact de la base de données présente sur votre cluster Atlas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Administrateur *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@sgp-pharma.tg"
                    value={restoreEmail}
                    onChange={(e) => setRestoreEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mot de passe Administrateur *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Votre mot de passe"
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>
                    La restauration télécharge l'historique complet (produits, lots, ventes et répartiteurs) et configure ce PC automatiquement.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 py-2.5 px-4 bg-primary hover:bg-emerald-700 disabled:opacity-50 text-white font-heading font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Restauration des données...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-4 h-4" />
                      <span>Restaurer les données</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Pied de page */}
        <div className="text-center mt-6 text-[11px] text-slate-400">
          Système de Gestion de Pharmacie · SGP-Pharma · OPTINET SARLU
        </div>
      </div>
    </div>
  );
}

