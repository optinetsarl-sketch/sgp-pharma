import React, { useState, useMemo } from "react";
import { useI18n } from "@/i18n";
import {
  FileText,
  Download,
  Presentation,
  BookOpen,
  Search,
  CheckCircle2,
  HelpCircle,
  Keyboard,
  ShieldCheck,
  Pill,
  Activity,
  FlaskConical,
  ShoppingBag,
  Boxes,
  Truck,
  FileSpreadsheet,
  Settings,
  Users,
  ChevronDown,
  ChevronUp,
  Printer,
  Sparkles,
  PhoneCall,
  Clock,
  Layers,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getBackendUrl } from "@/lib/api";

const downloads = [
  {
    key: "pdf",
    icon: FileText,
    badge: "Version 2.0 Officielle",
    title: "Manuel Utilisateur PDF (Complet)",
    desc: "Présentation intégrale format 16:9 paysage, prête à imprimer ou projeter en réunion.",
    size: "~1.4 MB · 20 diapositives",
    url: "/api/docs/manual.pdf",
    filename: "SGP-Pharma_Manuel_Utilisateur.pdf",
    color: "bg-red-50 border-red-200 text-red-600",
    btnColor: "bg-red-600 hover:bg-red-700",
  },
  {
    key: "pptx",
    icon: Presentation,
    badge: "Fichier Éditable",
    title: "Présentation PowerPoint (.pptx)",
    desc: "Diapositives modifiables — personnalisez le support avec votre logo et vos procédures internes.",
    size: "~1.2 MB · 20 diapositives",
    url: "/api/docs/manual.pptx",
    filename: "SGP-Pharma_Manuel_Utilisateur.pptx",
    color: "bg-amber-50 border-amber-200 text-amber-700",
    btnColor: "bg-amber-600 hover:bg-amber-700",
  },
  {
    key: "quickstart-caissier",
    icon: ShoppingBag,
    badge: "Fiche Métier",
    title: "Guide Rapide Caissier (POS)",
    desc: "Procédure synthétique : encaissement d'un ticket, sélection FEFO, ordonnance et ticket de caisse.",
    size: "Format A4 plastifiable",
    url: "/api/docs/quickstart-caissier.pdf",
    filename: "QuickStart_Caissier.pdf",
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
    btnColor: "bg-primary hover:bg-[#14532D]",
  },
  {
    key: "quickstart-magasinier",
    icon: Boxes,
    badge: "Fiche Métier",
    title: "Guide Rapide Magasinier (Stocks)",
    desc: "Mémo opérationnel : réception fournisseur, contrôle strict des dates d'expiration et numéros de lots.",
    size: "Format A4 plastifiable",
    url: "/api/docs/quickstart-magasinier.pdf",
    filename: "QuickStart_Magasinier.pdf",
    color: "bg-blue-50 border-blue-200 text-blue-700",
    btnColor: "bg-blue-600 hover:bg-blue-700",
  },
];

const modulesData = [
  {
    id: "1",
    name: "Connexion et Gestion des Rôles",
    category: "Sécurité et Accès",
    path: "/login",
    icon: ShieldCheck,
    summary: "Authentification JWT sécurisée avec 6 profils d'accès stricts (RBAC).",
    roles: ["Super Admin", "Admin Pharmacie", "Pharmacien", "Opérateur Conseil", "Caissier", "Magasinier"],
    steps: [
      "Saisir l'adresse email professionnelle et le mot de passe attribué.",
      "Le système vérifie les identifiants et attribue un jeton JWT valide 8 heures.",
      "Après 5 tentatives infructueuses consécutives, le compte est temporairement verrouillé pendant 15 minutes par mesure de sécurité.",
      "La barre latérale s'adapte automatiquement selon les permissions accordées au rôle connecté."
    ],
    tips: "Le sélecteur de langue en bas de la barre latérale permet d'alterner à tout moment entre Français et Anglais."
  },
  {
    id: "2",
    name: "Tableau de Bord de Pilotage",
    category: "Direction et KPIs",
    path: "/",
    icon: Activity,
    summary: "Vue synthétique en temps réel du chiffre d'affaires, de la valeur du stock et des alertes d'expiration.",
    roles: ["Admin", "Super Admin", "Pharmacien"],
    steps: [
      "Consulter les indicateurs clés du jour et du mois (CA TTC, panier moyen, nombre d'ordonnances).",
      "Examiner les alertes prioritaires : lots déjà expirés (rouge) et péremptions sous 30/90 jours (orange).",
      "Vérifier les produits sous le seuil d'alerte pour planifier les réapprovisionnements.",
      "Analyser le graphique d'évolution du chiffre d'affaires sur les 7 derniers jours."
    ],
    tips: "Un clic sur une carte d'alerte redirige instantanément vers la liste filtrée des lots concernés."
  },
  {
    id: "3",
    name: "Catalogue Produits et DCI",
    category: "Stock et Produits",
    path: "/products",
    icon: Pill,
    summary: "Nomenclature officielle CAMEG Togo (~150 médicaments essentiels) et gestion des fiches articles.",
    roles: ["Admin", "Pharmacien"],
    steps: [
      "Rechercher un produit par nom commercial, DCI (Dénomination Commune Internationale) ou code-barres.",
      "Consulter la forme galénique, la classe thérapeutique, le prix d'achat et le prix public conseillé.",
      "Activer l'option 'Ordonnance obligatoire' pour les molécules nécessitant un contrôle pharmaceutique.",
      "Générer et imprimer les étiquettes avec code-barres EAN-13 pour chaque référence."
    ],
    tips: "Le filtre par catégorie permet d'isoler rapidement les antibiotiques, antipaludiques ou antalgiques."
  },
  {
    id: "4",
    name: "Stock et Lots (FEFO)",
    category: "Stock et Produits",
    path: "/stock",
    icon: Boxes,
    summary: "Suivi unitaire par numéro de lot fabricant avec application de la règle FEFO (First Expired, First Out).",
    roles: ["Admin", "Pharmacien", "Magasinier"],
    steps: [
      "Consulter l'état des stocks regroupé par numéro de lot et date d'expiration.",
      "Repérer les badges d'alerte : Vert (> 90 jours), Orange (< 90 jours), Rouge (Expiré).",
      "Mettre un lot en quarantaine / bloqué si une anomalie visuelle ou un rappel laboratoire est signalé.",
      "Vérifier la valeur financière globale du stock immobilisé."
    ],
    tips: "Les lots expirés sont automatiquement exclus du panier de vente de caisse pour éviter toute dispensation non conforme."
  },
  {
    id: "5",
    name: "Réception Fournisseur et Arrivages",
    category: "Approvisionnement",
    path: "/reception",
    icon: Truck,
    summary: "Enregistrement des livraisons multi-lignes avec contrôle obligatoire des dates d'expiration.",
    roles: ["Admin", "Magasinier"],
    steps: [
      "Sélectionner le grossiste répartiteur ou la centrale d'achat (ex: CAMEG Togo, Ubipharm).",
      "Renseigner les lignes de livraison : médicament, quantité livrée, prix d'achat HT et N° de lot fabricant.",
      "Saisir la date d'expiration exacte (le système bloque toute date antérieure ou égale au jour même).",
      "Valider la réception : les stocks sont immédiatement incrémentés et une écriture immuable ENTREE_ACHAT est enregistrée."
    ],
    tips: "Le tableau historique en bas de page permet de retrouver tous les arrivages passés triés par numéro de lot."
  },
  {
    id: "6",
    name: "Bons de Commande Fournisseur",
    category: "Approvisionnement",
    path: "/orders",
    icon: FileText,
    summary: "Création et suivi des commandes d'approvisionnement avec édition de bons de commande PDF A4.",
    roles: ["Admin", "Pharmacien"],
    steps: [
      "Créer un nouveau bon de commande en sélectionnant le fournisseur et les références souhaitées.",
      "Suivre le statut de la commande : Brouillon → Validée → Reçue → Clôturée.",
      "Générer et télécharger le bon de commande officiel au format PDF A4 officiel avec logo de la pharmacie.",
      "Faire signer et tamponner le document pour transmission au délégué ou coursier."
    ],
    tips: "Une commande validée peut servir de base pour générer une réception automatique lors de la livraison."
  },
  {
    id: "7",
    name: "Fournisseurs et Grossistes Répartiteurs",
    category: "Approvisionnement",
    path: "/suppliers",
    icon: Truck,
    summary: "Annuaire des grossistes officinaux agréés (CAMEG, Ubipharm, Laborex, COPHARMA) et conditions commerciales.",
    roles: ["Admin", "Pharmacien"],
    steps: [
      "Consulter les fiches des distributeurs pharmaceutiques partenaires.",
      "Renseigner les coordonnées des délégués médicaux, téléphones et adresses email de commande.",
      "Indiquer les délais moyens de livraison (heures/jours) et les modalités de règlement convenues.",
      "Accéder directement aux historiques de commandes et réceptions associées à chaque fournisseur."
    ],
    tips: "La CAMEG Togo dispose d'une configuration régionale par agence (Siège Lomé, PRA Région Centrale, Kara, etc.)."
  },
  {
    id: "8",
    name: "Guichet Saisie et Conseil (Pré-ventes)",
    category: "Ventes et Caisse",
    path: "/pos",
    icon: ShoppingBag,
    summary: "Flux optimisé de vente scindée : préparation du panier au comptoir et émission d'un ticket d'attente client.",
    roles: ["Opérateur Conseil", "Pharmacien", "Admin"],
    steps: [
      "L'opérateur accueille le patient et recherche les médicaments prescrits ou demandés.",
      "Ajout des produits au panier avec vérification des posologies et du stock en rayon.",
      "Possibilité d'ajouter des actes de soins ou examens de laboratoire sur le même panier.",
      "Attacher la référence d'ordonnance ou une photo si requise.",
      "Cliquer sur 'Valider et Envoyer en Caisse' : un numéro de ticket d'attente (ex: #0012) est généré.",
      "Remettre le numéro au client pour qu'il procède au paiement auprès de la caisse."
    ],
    tips: "Ce mode supprime l'attente prolongée en caisse et permet aux vendeurs de se concentrer sur le conseil thérapeutique."
  },
  {
    id: "9",
    name: "Caisse POS et Encaissement",
    category: "Ventes et Caisse",
    path: "/pos",
    icon: ShoppingBag,
    summary: "Point d'encaissement rapide : rappel de ticket d'attente ou vente directe, monnaie et ticket thermique 80mm.",
    roles: ["Caissier", "Admin", "Pharmacien"],
    steps: [
      "Rappeler un ticket client dans la file d'attente des pré-ventes ou composer une nouvelle vente directe (touche F2).",
      "Vérifier le montant total TTC et sélectionner le mode de paiement (Espèces, Mobile Money T-Money/Flooz, Carte).",
      "En cas de paiement en espèces, utiliser le clavier des coupures pour calculer automatiquement la monnaie à rendre.",
      "Valider l'encaissement : le ticket thermique 80mm est généré avec récapitulatif complet et mentions légales.",
      "La décrémentation des stocks selon la règle FEFO s'effectue instantanément de manière atomique."
    ],
    tips: "Raccourci clavier F2 : ouvre immédiatement une nouvelle vente sans quitter le clavier."
  },
  {
    id: "10",
    name: "Actes et Soins Médicaux",
    category: "Prestations Cliniques",
    path: "/acts",
    icon: Activity,
    summary: "Nomenclature des soins infirmiers et actes cliniques dispensés en pharmacie (injections, pansements, tension).",
    roles: ["Admin", "Pharmacien", "Opérateur Conseil", "Caissier"],
    steps: [
      "Consulter le catalogue des actes de soins par discipline (Soins Infirmiers, Urgences, Constantes).",
      "Ajouter ou modifier un acte avec son code unique (ex: ACT-001), son intitulé et son tarif officiel en FCFA.",
      "Depuis la Caisse POS, cliquer sur l'onglet 'Actes et Soins' pour intégrer la prestation directement au panier.",
      "La prestation figure clairement sur le ticket de caisse délivré au patient."
    ],
    tips: "Les actes n'impactent pas les stocks de médicaments mais s'intègrent dans le chiffre d'affaires journalier de l'officine."
  },
  {
    id: "11",
    name: "Laboratoire et Examens Médicaux",
    category: "Prestations Cliniques",
    path: "/lab",
    icon: FlaskConical,
    summary: "Catalogue complet des analyses biomédicales (GE, NFS, Glycémie, Ionogramme, etc.) avec disciplines dynamiques.",
    roles: ["Admin", "Pharmacien", "Opérateur Conseil", "Caissier"],
    steps: [
      "Accéder au catalogue des examens de laboratoire classés par disciplines biomédicales.",
      "Gérer les disciplines via le bouton dédié 'Disciplines' : ajouter une nouvelle spécialité, la renommer ou la supprimer.",
      "Créer ou éditer un examen : nom, code (génération automatique LAB-xxx), discipline et tarif en FCFA.",
      "Facturer l'analyse depuis la Caisse POS via l'onglet 'Laboratoire' : ajout en 1 clic au ticket du patient."
    ],
    tips: "Les 32 examens standards les plus demandés au Togo (GE, Widal, NFS, etc.) sont préconfigurés d'origine."
  },
  {
    id: "12",
    name: "Journal des Ventes et Caisse",
    category: "Ventes et Caisse",
    path: "/sales-history",
    icon: Clock,
    summary: "Consultation chronologique des encaissements par date, tranche horaire et réimpression thermique.",
    roles: ["Admin", "Super Admin", "Caissier"],
    steps: [
      "Filtrer les encaissements par date exacte ou mois complet.",
      "Sélectionner la tranche horaire : Journée entière, Matin (07h-12h30), Après-midi (12h30-18h30), Soirée et Garde (18h30-07h00).",
      "Rechercher un ticket précis par son numéro, le nom du client ou un médicament contenu dans le panier.",
      "Consulter le détail du panier servi et réimprimer le ticket de caisse à tout moment pour le client."
    ],
    tips: "Les totaux financiers globaux sont réservés aux administrateurs pour préserver la confidentialité des encaissements."
  },
  {
    id: "13",
    name: "Pertes et Dépréciations",
    category: "Stock et Produits",
    path: "/losses",
    icon: Boxes,
    summary: "Déclaration et justification fiscale des sorties de stock non-vendeuses (péremption, casse, vol).",
    roles: ["Admin", "Pharmacien", "Magasinier"],
    steps: [
      "Sélectionner le produit et le numéro de lot concerné par l'avarie.",
      "Indiquer le motif réglementaire : Péremption (date dépassée), Casse (flacon brisé, etc.) ou Vol.",
      "Saisir la quantité exacte à réformer et un commentaire explicatif.",
      "Valider la déclaration : le stock du lot est immédiatement débité et consigné dans l'historique comptable."
    ],
    tips: "Ce registre est obligatoire pour justifier les écarts d'inventaire auprès des commissaires aux comptes et de l'administration fiscale."
  },
  {
    id: "14",
    name: "Rapports d'Activité et Rentabilité",
    category: "Direction et KPIs",
    path: "/reports",
    icon: FileSpreadsheet,
    summary: "Analyses financières approfondies, marges commerciales, Top 10 produits et export comptable CSV.",
    roles: ["Admin", "Super Admin"],
    steps: [
      "Choisir la période d'analyse (du jour, hebdomadaire, mensuelle ou personnalisée).",
      "Examiner la synthèse financière : Chiffre d'affaires HT/TTC, panier moyen, nombre d'ordonnances.",
      "Consulter le Top 10 des produits les plus vendus en volume et en chiffre d'affaires.",
      "Analyser les marges brutes dégagées par référence (CA public moins coût d'achat CAMEG).",
      "Générer le rapport imprimable officiel avec espace de visa, signature et cachet du pharmacien titulaire.",
      "Exporter les données au format CSV pour intégration dans un logiciel comptable."
    ],
    tips: "Les calculs de marge sont optimisés via des pipelines d'agrégation MongoDB pour une réponse instantanée."
  },
  {
    id: "15",
    name: "Configuration de l'Officine (Marque Blanche)",
    category: "Sécurité et Accès",
    path: "/pharmacy-setup",
    icon: Settings,
    summary: "Personnalisation universelle de l'identité de la pharmacie, logo, coordonnées Google Maps et mentions légales.",
    roles: ["Admin", "Super Admin"],
    steps: [
      "Téléverser le logo officiel de l'officine (format PNG ou JPG haute résolution).",
      "Renseigner les coordonnées complètes : raison sociale, slogan, adresse physique, téléphones de garde, email.",
      "Ajouter le lien GPS Google Maps pour orienter facilement les patients.",
      "Saisir les mentions obligatoires : N° d'Agrément ministériel, NIF, RCCM et message de remerciement pour pied de ticket.",
      "Enregistrer : toutes les modifications s'appliquent immédiatement sur les tickets de caisse, reçus et bons de commande."
    ],
    tips: "Cette architecture marque blanche permet d'adapter l'application à n'importe quelle officine en quelques minutes."
  },
  {
    id: "16",
    name: "Gestion des Utilisateurs et Rôles",
    category: "Sécurité et Accès",
    path: "/users",
    icon: Users,
    summary: "Création des comptes opérateurs, attribution des rôles RBAC et réinitialisation sécurisée des mots de passe.",
    roles: ["Admin", "Super Admin"],
    steps: [
      "Cliquer sur 'Nouvel Utilisateur' et renseigner le nom complet et l'adresse email professionnelle.",
      "Sélectionner le rôle adapté aux responsabilités : Opérateur Conseil, Caissier, Pharmacien, Magasinier ou Admin.",
      "Pour réinitialiser un mot de passe oublié, cliquer sur l'icône Clé : un mot de passe fort temporaire est généré.",
      "Transmettre ce mot de passe à l'opérateur en toute confidentialité."
    ],
    tips: "En cas de départ d'un collaborateur, désactivez son compte en 1 clic sans supprimer l'historique de ses opérations."
  },
  {
    id: "17",
    name: "Journal d'Audit et Sécurité",
    category: "Sécurité et Accès",
    path: "/audit-log",
    icon: ShieldCheck,
    summary: "Traçabilité légale et immuable de toutes les opérations sensibles effectuées sur le système.",
    roles: ["Admin", "Super Admin"],
    steps: [
      "Consulter la liste chronologique de tous les événements système.",
      "Vérifier pour chaque action : utilisateur auteur, adresse IP, date et heure UTC exacte, entité impactée.",
      "Filtrer par type d'événement : Connexion, Création de produit, Vente, Réception de stock, Réinitialisation de compte.",
      "Exporter ou archiver les pistes d'audit pour les audits réglementaires."
    ],
    tips: "Le journal d'audit est en lecture seule (insert-only) et ne peut être altéré, garantissant une intégrité juridique totale."
  },
  {
    id: "18",
    name: "Multi-pharmacies (Mode SaaS)",
    category: "Sécurité et Accès",
    path: "/pharmacies",
    icon: Layers,
    summary: "Supervision centrale multi-tenants pour réseaux d'officines ou centrales de gestion avec isolation étanche des données.",
    roles: ["Super Admin"],
    steps: [
      "Accéder au parc global des pharmacies clientes gérées par OPTINET SARLU.",
      "Créer une nouvelle officine en renseignant ses coordonnées administratives de base.",
      "Créer le compte de l'administrateur titulaire de la pharmacie.",
      "Suivre les indicateurs consolidés : chiffre d'affaires global cumulé et valeur globale des stocks du réseau."
    ],
    tips: "L'isolation technique stricte garantit qu'aucune donnée de stock, de vente ou de patient ne peut fuiter d'une officine à une autre."
  }
];

const keyboardShortcuts = [
  { key: "F2", action: "Nouvelle Vente au comptoir (Caisse POS)" },
  { key: "F4", action: "Focus immédiat sur la barre de recherche produit" },
  { key: "Entrée", action: "Valider la sélection ou confirmer le panier" },
  { key: "Échap (Esc)", action: "Fermer les modales ou annuler la saisie en cours" },
  { key: "Flèches ↑ / ↓", action: "Naviguer dans les résultats de recherche produit" },
];

export default function Documentation() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedModule, setExpandedModule] = useState("8"); // Open Presale/POS by default

  const categories = useMemo(() => {
    const set = new Set(modulesData.map((m) => m.category));
    return ["all", ...Array.from(set)];
  }, []);

  const filteredModules = useMemo(() => {
    return modulesData.filter((m) => {
      const matchCat = selectedCategory === "all" || m.category === selectedCategory;
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        m.steps.some((s) => s.toLowerCase().includes(q)) ||
        m.roles.some((r) => r.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [searchTerm, selectedCategory]);

  const download = async (item) => {
    const url = `${getBackendUrl()}${item.url}`;
    const token = localStorage.getItem("sgp_access_token");
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = item.filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`Téléchargement démarré : ${item.filename}`);
    } catch {
      toast.error(`Erreur de téléchargement pour ${item.title}`);
    }
  };

  return (
    <div className="space-y-8 pb-12" data-testid="documentation-page">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-primary to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-radial from-white to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-500/40 text-[11px] font-bold uppercase tracking-wider text-emerald-200">
            <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
            <span>CENTRE D'AIDE ET DOCUMENTATION OFFICIELLE · SGP-PHARMA v2.0</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            Manuel Utilisateur et Guides Opérationnels
          </h1>
          <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed">
            Consultez les procédures pas-à-pas pour chacun des <strong>18 modules</strong> intégrés : 
            comptoir et caisse, catalogue CAMEG, traçabilité FEFO, actes et soins, laboratoire biomédical, rapports et configuration de marque blanche.
          </p>
        </div>
      </div>

      {/* Downloads Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-black text-slate-900 flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              <span>Manuels et Fiches Métiers à Télécharger</span>
            </h2>
            <p className="text-xs text-slate-500">Supports imprimables et présentations éditables pour la formation de votre équipe</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {downloads.map((d) => (
            <div
              key={d.key}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              data-testid={`download-card-${d.key}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${d.color}`}>
                    <d.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {d.badge}
                  </span>
                </div>
                <h3 className="font-heading text-sm font-bold text-slate-900 mb-1">{d.title}</h3>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">{d.desc}</p>
              </div>

              <div>
                <div className="text-[11px] font-mono text-slate-400 mb-3">{d.size}</div>
                <button
                  onClick={() => download(d)}
                  data-testid={`download-${d.key}-btn`}
                  className={`w-full ${d.btnColor} text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5 shadow-sm cursor-pointer`}
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Guide: 18 Modules */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="label-tiny mb-1 text-primary font-bold">GUIDE OPÉRATIONNEL INTERACTIF</div>
            <h2 className="font-heading text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Sommaire et Mode d'Emploi des 18 Modules</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cliquez sur un module pour afficher la procédure pas-à-pas, les règles métier et les astuces d'utilisation.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[260px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher (ex: FEFO, Caisse, Labo, Soins)..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Filtrer par pôle :</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-primary text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {cat === "all" ? "Tous les modules (18)" : cat}
            </button>
          ))}
        </div>

        {/* Modules Accordion List */}
        <div className="space-y-3">
          {filteredModules.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Aucun module ne correspond à votre recherche « {searchTerm} ».
            </div>
          ) : (
            filteredModules.map((m) => {
              const isExpanded = expandedModule === m.id;
              const IconComp = m.icon;
              return (
                <div
                  key={m.id}
                  className={`border rounded-2xl transition-all ${
                    isExpanded
                      ? "border-primary/40 bg-emerald-50/20 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <button
                    onClick={() => setExpandedModule(isExpanded ? null : m.id)}
                    className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                          isExpanded
                            ? "bg-primary text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {m.id}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <h3 className="font-heading text-sm sm:text-base font-bold text-slate-900 truncate">
                            {m.name}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {m.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate max-w-xl">{m.summary}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-primary" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-slate-200/80 p-5 sm:p-6 bg-white rounded-b-2xl space-y-5 animate-in fade-in duration-200">
                      {/* Roles & Direct Navigation Link */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-bold text-slate-700">Profils autorisés :</span>
                          {m.roles.map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 font-medium text-[11px]"
                            >
                              {r}
                            </span>
                          ))}
                        </div>

                        <button
                          onClick={() => navigate(m.path)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-[#14532D] hover:underline self-start sm:self-auto cursor-pointer"
                        >
                          <span>Accéder à la page</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Step by step procedure */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span>Procédure Opérationnelle Étape par Étape :</span>
                        </h4>
                        <ol className="space-y-2 text-xs text-slate-600 pl-1">
                          {m.steps.map((st, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span className="leading-relaxed">{st}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Tips alert box */}
                      {m.tips && (
                        <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Bon à savoir : </span>
                            <span>{m.tips}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts & Operational Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shortcuts card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Keyboard className="w-5 h-5 text-primary" />
            <h3 className="font-heading text-base font-bold text-slate-900">
              Raccourcis Clavier pour la Caisse et le Comptoir
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Optimisez votre vitesse d'encaissement et de délivrance en utilisant ces touches de raccourci :
          </p>
          <div className="divide-y divide-slate-100">
            {keyboardShortcuts.map((sc) => (
              <div key={sc.key} className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-mono font-bold bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-800 shadow-2xs">
                  {sc.key}
                </span>
                <span className="text-slate-600 font-medium">{sc.action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Support & Legal Info Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <PhoneCall className="w-5 h-5 text-primary" />
            <h3 className="font-heading text-base font-bold text-slate-900">
              Assistance Technique et Support Éditeur
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pour toute demande d'assistance, formation d'équipe, personnalisation de ticket ou intégration de matériel POS (imprimantes thermiques, douchettes codes-barres) :
          </p>
          <div className="space-y-2 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex justify-between">
              <span className="text-slate-500">Éditeur :</span>
              <strong className="text-slate-900">OPTINET SARLU</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Responsable :</span>
              <span className="font-semibold text-slate-800">NABINE Tassounti (DG)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Téléphones :</span>
              <span className="font-mono font-bold text-primary">+228 90 74 84 65 / 99 05 84 71</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email :</span>
              <span className="font-mono text-slate-800">optinetsarl@gmail.com</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Siège social :</span>
              <span className="text-right">Agoè Cacavéli (derrière CEET), Lomé, Togo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
