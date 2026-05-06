import React from "react";
import { useI18n } from "@/i18n";
import { FileText, Download, Presentation, BookOpen } from "lucide-react";
import { toast } from "sonner";

const downloads = [
  {
    key: "pdf",
    icon: FileText,
    title: "Manuel utilisateur PDF",
    desc: "Présentation complète format A4 paysage (16:9), prête à imprimer.",
    size: "~1.4 MB · 17 pages",
    url: "/api/docs/manual.pdf",
    filename: "SGP-Pharma_Manuel_Utilisateur.pdf",
    color: "bg-red-50 border-red-200 text-red-600",
  },
  {
    key: "pptx",
    icon: Presentation,
    title: "Présentation PowerPoint",
    desc: "Fichier .pptx éditable — modifiez les diapositives à votre convenance.",
    size: "~1.2 MB · 17 diapositives",
    url: "/api/docs/manual.pptx",
    filename: "SGP-Pharma_Manuel_Utilisateur.pptx",
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
];

const modules = [
  ["1", "Connexion & Rôles", "Sécurité JWT, 5 niveaux d'accès"],
  ["2", "Tableau de bord", "KPIs temps réel + alertes péremption"],
  ["3", "Produits", "Catalogue ~150 médicaments CAMEG"],
  ["4", "Stock & Lots", "Gestion par lot avec FEFO"],
  ["5", "Réception", "Entrée stock + validation péremption"],
  ["6", "Commandes", "Bons de commande + PDF A4"],
  ["7", "Fournisseurs", "Annuaire CAMEG / Ubipharm"],
  ["8", "Caisse (POS)", "Vente FEFO + ordonnance + ticket PDF"],
  ["9", "Pertes", "Péremption / Casse / Vol"],
  ["10", "Rapports", "CA, top ventes, marges, export CSV"],
  ["11", "Utilisateurs", "RBAC + reset mot de passe"],
  ["12", "Journal d'audit", "Traçabilité légale"],
  ["13", "Multi-pharmacies", "Mode SaaS Super Admin"],
];

export default function Documentation() {
  const { t } = useI18n();

  const download = async (item) => {
    const url = `${process.env.REACT_APP_BACKEND_URL}${item.url}`;
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
      toast.success("Téléchargement démarré");
    } catch {
      toast.error("Erreur de téléchargement");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6" data-testid="documentation-page">
      <div>
        <div className="label-tiny mb-1">DOCUMENTATION</div>
        <h1 className="font-heading text-3xl font-black tracking-tight">Manuel utilisateur</h1>
        <p className="text-muted-foreground mt-1">Présentation complète des modules avec captures d'écran</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {downloads.map((d) => (
          <div key={d.key} className="bg-white border border-gray-200 rounded-md p-6" data-testid={`download-card-${d.key}`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-md flex items-center justify-center border ${d.color}`}>
                <d.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-heading text-lg font-bold mb-1">{d.title}</h2>
                <p className="text-sm text-muted-foreground mb-2">{d.desc}</p>
                <div className="text-xs text-muted-foreground mb-4">{d.size}</div>
                <button
                  onClick={() => download(d)}
                  data-testid={`download-${d.key}-btn`}
                  className="bg-primary hover:bg-[#14532D] text-white text-sm font-semibold px-4 py-2 rounded-md flex items-center gap-2 transition-all hover:-translate-y-[1px]"
                >
                  <Download className="w-4 h-4" /> Télécharger
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="font-heading text-lg font-bold">Contenu du manuel</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          {modules.map(([n, name, desc]) => (
            <div key={n} className="flex items-start gap-3 py-2 border-b border-gray-100">
              <span className="font-heading font-black text-primary w-8 flex-shrink-0">{n}.</span>
              <div className="flex-1">
                <div className="font-semibold text-sm">{name}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-md p-5 text-sm">
        <div className="font-semibold text-emerald-900 mb-2">💡 Astuce — utiliser cette présentation</div>
        <ul className="space-y-1 text-emerald-800">
          <li>• Le PDF est prêt à imprimer ou à projeter en réunion</li>
          <li>• Le fichier .pptx est entièrement éditable dans PowerPoint, LibreOffice Impress ou Google Slides</li>
          <li>• Vous pouvez ajouter votre logo, modifier les textes et réorganiser les diapositives</li>
          <li>• Pour régénérer la documentation après modifications de l'application, exécutez : <code className="bg-emerald-100 px-1 rounded">python /app/scripts/generate_doc.py</code></li>
        </ul>
      </div>
    </div>
  );
}
