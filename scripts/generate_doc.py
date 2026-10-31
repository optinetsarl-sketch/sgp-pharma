"""Generate the SGP-Pharma user manual presentation PDF.

Output: docs/SGP-Pharma_Manuel_Utilisateur.pdf
Style: 16:9 landscape slides, 1 module per slide with screenshot + bullet points.
"""
from pathlib import Path
from reportlab.lib.pagesizes import landscape
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

DOCS_ROOT = Path(__file__).resolve().parent.parent / "docs"
if not DOCS_ROOT.exists():
    DOCS_ROOT = Path("/app/docs")

SCREENSHOTS = DOCS_ROOT / "screenshots"
OUT_PDF = DOCS_ROOT / "SGP-Pharma_Manuel_Utilisateur.pdf"

# 16:9 landscape (PowerPoint-like)
PAGE_W = 33.87 * cm   # 13.33 inches
PAGE_H = 19.05 * cm   # 7.5 inches

PRIMARY = colors.HexColor("#166534")
PRIMARY_DARK = colors.HexColor("#14532D")
TEXT = colors.HexColor("#111827")
MUTED = colors.HexColor("#4B5563")
BG = colors.HexColor("#F9FAFB")
ACCENT = colors.HexColor("#F59E0B")


styles = getSampleStyleSheet()
title_st = ParagraphStyle("title", parent=styles["Heading1"], fontName="Helvetica-Bold",
                          fontSize=26, leading=30, textColor=PRIMARY, spaceAfter=3)
subtitle_st = ParagraphStyle("subtitle", parent=styles["Normal"], fontName="Helvetica",
                             fontSize=11, leading=15, textColor=MUTED, spaceAfter=6)
section_st = ParagraphStyle("section", parent=styles["Heading2"], fontName="Helvetica-Bold",
                            fontSize=13, leading=16, textColor=TEXT, spaceAfter=4, spaceBefore=4)
bullet_st = ParagraphStyle("bullet", parent=styles["Normal"], fontName="Helvetica",
                           fontSize=9.5, leading=13, textColor=TEXT, leftIndent=10, bulletIndent=2)
small_st = ParagraphStyle("small", parent=styles["Normal"], fontName="Helvetica",
                          fontSize=8.5, leading=11, textColor=MUTED)
label_st = ParagraphStyle("label", parent=styles["Normal"], fontName="Helvetica-Bold",
                          fontSize=8, leading=10, textColor=PRIMARY, alignment=TA_LEFT)
cover_title_st = ParagraphStyle("cover_t", parent=styles["Heading1"], fontName="Helvetica-Bold",
                                fontSize=44, leading=52, textColor=colors.white, alignment=TA_CENTER)
cover_sub_st = ParagraphStyle("cover_s", parent=styles["Normal"], fontName="Helvetica",
                              fontSize=18, leading=24, textColor=colors.HexColor("#A7F3D0"), alignment=TA_CENTER)
cover_meta_st = ParagraphStyle("cover_m", parent=styles["Normal"], fontName="Helvetica",
                               fontSize=12, leading=16, textColor=colors.white, alignment=TA_CENTER)


def page_chrome(canvas, doc):
    """Draw header band + page number footer."""
    canvas.saveState()
    # top bar
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, PAGE_H - 0.6 * cm, PAGE_W, 0.6 * cm, fill=1, stroke=0)
    # logo / brand
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(1.2 * cm, PAGE_H - 0.42 * cm, "SGP-PHARMA · OPTINET SARLU")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(PAGE_W - 1.2 * cm, PAGE_H - 0.42 * cm, "Manuel utilisateur · v2.0")
    # footer
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(1.2 * cm, 0.6 * cm, "© 2026 OPTINET SARLU · Lomé, Togo")
    canvas.drawRightString(PAGE_W - 1.2 * cm, 0.6 * cm, f"Slide {doc.page}")
    canvas.restoreState()


def cover_chrome(canvas, doc):
    """Solid green cover with subtle pattern."""
    canvas.saveState()
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Decorative cross
    canvas.setFillColor(colors.HexColor("#14532D"))
    canvas.rect(PAGE_W - 6 * cm, PAGE_H - 6 * cm, 5 * cm, 1.4 * cm, fill=1, stroke=0)
    canvas.rect(PAGE_W - 4.2 * cm, PAGE_H - 7.8 * cm, 1.4 * cm, 5 * cm, fill=1, stroke=0)
    canvas.restoreState()


def slide(story, title, subtitle, bullets, screenshot=None, badge=None):
    """One slide: title + bullets on left, screenshot on right."""
    story.append(Spacer(1, 0.5 * cm))
    if badge:
        story.append(Paragraph(badge, label_st))
    story.append(Paragraph(title, title_st))
    story.append(Paragraph(subtitle, subtitle_st))

    bullet_paras = []
    for b in bullets:
        if b.startswith("**"):
            bullet_paras.append(Paragraph(b.replace("**", ""), section_st))
        else:
            bullet_paras.append(Paragraph(f"• {b}", bullet_st))
    bullet_paras.append(Spacer(1, 0.2 * cm))

    img = None
    if screenshot:
        img_path = SCREENSHOTS / screenshot
        if img_path.exists():
            img = Image(str(img_path), width=18 * cm, height=11.25 * cm)

    body = Table(
        [[bullet_paras, img if img else Paragraph("(Illustration / Capture d'écran)", small_st)]],
        colWidths=[12 * cm, 18.5 * cm],
    )
    body.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(body)
    story.append(PageBreak())


def cover(story):
    """Cover page."""
    story.append(Spacer(1, 4 * cm))
    story.append(Paragraph("SGP-Pharma", cover_title_st))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("Système de Gestion Intégrée de Pharmacie et Clinique", cover_sub_st))
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph("Manuel utilisateur complet — Présentation des 18 modules", cover_meta_st))
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("OPTINET SARLU — Lomé, Togo", cover_meta_st))
    story.append(Paragraph("Quartier Agoè Cacavéli · Derrière la CEET", cover_meta_st))
    story.append(Paragraph("+228 90 74 84 65  ·  optinetsarl@gmail.com  ·  www.optinet.tg", cover_meta_st))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("Version 2.0 — Octobre 2026", cover_meta_st))
    story.append(PageBreak())


def toc(story):
    """Table of contents slide (2 columns)."""
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("SOMMAIRE", label_st))
    story.append(Paragraph("Table des matières", title_st))
    story.append(Paragraph("18 modules complets couvrant le circuit pharmaceutique, clinique et de laboratoire", subtitle_st))
    story.append(Spacer(1, 0.2 * cm))

    col1_items = [
        ("1.", "Connexion et Rôles", "Sécurité JWT et 6 rôles RBAC"),
        ("2.", "Tableau de bord", "KPIs temps réel et alertes péremption"),
        ("3.", "Produits et DCI", "Catalogue ~150 médicaments CAMEG"),
        ("4.", "Stock et Lots (FEFO)", "Gestion par lot, péremption et statuts"),
        ("5.", "Réception Arrivages", "Entrée stock et validation péremption"),
        ("6.", "Commandes Fournisseur", "Bons de commande et PDF A4"),
        ("7.", "Fournisseurs et Grossistes", "Annuaire CAMEG, Ubipharm, Laborex"),
        ("8.", "Guichet Conseil (Pré-ventes)", "File d'attente et tickets clients"),
        ("9.", "Caisse POS et Vente", "Encaissement FEFO et ticket thermique"),
    ]
    col2_items = [
        ("10.", "Actes et Soins Médicaux", "Prestations cliniques et disciplines"),
        ("11.", "Laboratoire et Analyses", "Examens médicaux et disciplines dynamiques"),
        ("12.", "Journal des Ventes", "Historique et réimpression tickets"),
        ("13.", "Pertes et Dépréciations", "Péremption, casse et vol"),
        ("14.", "Rapports d'Activité", "CA, top ventes, marges et export CSV"),
        ("15.", "Configuration Officine", "Marque blanche, logo, maps et mentions"),
        ("16.", "Gestion Utilisateurs", "Comptes opérateurs et reset mot de passe"),
        ("17.", "Journal d'Audit", "Traçabilité légale immuable"),
        ("18.", "Multi-pharmacies SaaS", "Supervision réseau et isolation stricte"),
    ]

    def render_col(items):
        rows = []
        for n, name, desc in items:
            rows.append([
                Paragraph(f"<b>{n}</b>", section_st),
                Paragraph(f"<b>{name}</b><br/><font color='#6B7280' size='8'>{desc}</font>", small_st),
            ])
        t = Table(rows, colWidths=[1.2 * cm, 13.5 * cm])
        t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#E5E7EB")),
        ]))
        return t

    tbl = Table([[render_col(col1_items), render_col(col2_items)]], colWidths=[15 * cm, 15.5 * cm])
    tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(tbl)
    story.append(PageBreak())


def build():
    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=(PAGE_W, PAGE_H),
        leftMargin=1.2 * cm, rightMargin=1.2 * cm,
        topMargin=1 * cm, bottomMargin=1.2 * cm,
        title="SGP-Pharma — Manuel utilisateur",
        author="OPTINET SARLU",
    )

    story = []

    # Cover & TOC
    cover(story)
    toc(story)

    # 1: Login & Roles
    slide(
        story,
        "Connexion et Gestion des rôles",
        "Authentification sécurisée par JWT — 6 niveaux d'accès distincts.",
        [
            "**Rôles utilisateurs (RBAC)**",
            "Super Admin (OPTINET) — Supervision globale multi-officines",
            "Admin Pharmacie — Gestion complète de l'officine",
            "Pharmacien — Validation d'ordonnances et catalogue",
            "Opérateur Conseil — Guichet de saisie et devis pré-ventes",
            "Caissier — Encaissement POS et clôture de caisse",
            "Magasinier — Réception des commandes et gestion des lots",
            "**Sécurité et Conformité**",
            "Mots de passe hachés avec algorithme bcrypt",
            "Verrouillage automatique après 5 tentatives infructueuses",
            "Tokens JWT sécurisés 8h et refresh token 7 jours",
        ],
        "01_dashboard.png",
        badge="MODULE 1 — AUTHENTIFICATION ET RBAC",
    )

    # 2: Dashboard
    slide(
        story,
        "Tableau de bord de pilotage",
        "Vue d'ensemble en temps réel : chiffre d'affaires, stock et alertes critiques.",
        [
            "**Indicateurs clés (KPIs temps réel)**",
            "Chiffre d'affaires journalier et mensuel (FCFA)",
            "Valeur financière globale du stock et nombre de références",
            "Nombre d'ordonnances et pré-ventes enregistrées",
            "**Alertes critiques prioritaires**",
            "Lots périmés (alerte rouge) — retrait immédiat",
            "Péremptions imminentes sous 30 et 90 jours (alerte orange)",
            "Ruptures et produits sous le seuil de sécurité",
            "**Graphiques et tendances**",
            "Courbe d'activité des 7 derniers jours",
            "Raccourcis rapides vers Vente (F2) et Inventaire",
        ],
        "01_dashboard.png",
        badge="MODULE 2 — TABLEAU DE BORD",
    )

    # 3: Products
    slide(
        story,
        "Catalogue Produits et DCI",
        "Nomenclature CAMEG Togo et gestion intégrale des médicaments et consommables.",
        [
            "**Fiche produit complète**",
            "Nom commercial, Dénomination Commune Internationale (DCI)",
            "Forme pharmaceutique (comprimé, sirop, injectable, gélule)",
            "Catégories thérapeutiques officielles CAMEG",
            "Prix d'achat, prix de vente public et seuil d'alerte",
            "Mention obligatoire d'ordonnance médicale",
            "**Outils et productivité**",
            "Générateur et lecteur de codes-barres EAN-13",
            "Recherche instantanée multicritère",
            "Importation et mise à jour collective de la mercuriale",
        ],
        "02_produits.png",
        badge="MODULE 3 — PRODUITS ET DCI",
    )

    # 4: Stock & Lots
    slide(
        story,
        "Stock et Lots — Traçabilité FEFO",
        "Gestion stricte par numéro de lot avec priorisation FEFO.",
        [
            "**Badges FEFO automatiques**",
            "🟢 Conforme : péremption supérieure à 90 jours",
            "🟡 À surveiller : péremption entre 0 et 90 jours",
            "🔴 Expiré : péremption dépassée, vente automatiquement bloquée",
            "**Traçabilité par lot fabricant**",
            "Numéro de lot, date d'expiration exacte et jours restants",
            "Quantité disponible en rayon et valeur d'achat",
            "Statuts de lot : Actif, Bloqué (quarantaine), Épuisé",
            "**Actions opérateur**",
            "Blocage préventif d'un lot défectueux ou rappelé",
            "Détection rapide des lots prioritaires pour écoulement",
        ],
        "03_stock_lots.png",
        badge="MODULE 4 — STOCK ET LOTS",
    )

    # 5: Reception
    slide(
        story,
        "Réception Fournisseur et Arrivages",
        "Entrée en stock multi-lignes avec contrôle réglementaire de péremption.",
        [
            "**Contrôle strict à l'arrivée**",
            "Sélection du grossiste répartiteur ou de la centrale",
            "Saisie obligatoire du numéro de lot fabricant",
            "Vérification de la date de péremption (rejet si expirée)",
            "Enregistrement du prix d'achat et des quantités livrées",
            "**Automatisation des écritures**",
            "Incrémentation instantanée des stocks disponibles",
            "Génération immuable du mouvement ENTREE_ACHAT",
            "Rapprochement optionnel avec un bon de commande",
            "Répertoire chronologique de tous les arrivages",
        ],
        "04_reception.png",
        badge="MODULE 5 — RÉCEPTION FOURNISSEUR",
    )

    # 6: Orders
    slide(
        story,
        "Commandes Fournisseurs et Répartiteurs",
        "Gestion des approvisionnements avec génération de bons de commande PDF A4.",
        [
            "**Cycle de vie de la commande**",
            "Brouillon → Validée → Reçue → Clôturée",
            "Mise à jour rapide des statuts depuis le tableau de bord",
            "**Bon de commande officiel PDF A4**",
            "En-tête officiel aux couleurs et logo de la pharmacie",
            "Coordonnées du fournisseur, référence et date d'émission",
            "Tableau détaillé des articles avec totaux HT et TTC",
            "Espace réservé pour signatures et cachets officiels",
            "Calcul automatique des montants et traçabilité",
        ],
        "05_commandes.png",
        badge="MODULE 6 — COMMANDES FOURNISSEUR",
    )

    # 7: Suppliers
    slide(
        story,
        "Fournisseurs et Grossistes Répartiteurs",
        "Annuaire complet des centrales d'achats et laboratoires partenaires.",
        [
            "**Partenaires intégrés**",
            "CAMEG Togo (Centrale d'Achat des Médicaments Essentiels)",
            "UBIPHARM Togo, LABOREX Togo, COPHARMA",
            "Laboratoires privés et grossistes agréés",
            "**Fiche fournisseur détaillée**",
            "Raison sociale, contact délégué, téléphone et email",
            "Délai moyen de livraison et conditions de règlement",
            "Liaison directe avec l'historique des réceptions et commandes",
        ],
        "06_fournisseurs.png",
        badge="MODULE 7 — FOURNISSEURS ET GROSSISTES",
    )

    # 8: Presales
    slide(
        story,
        "Guichet Saisie et Conseil (Pré-ventes)",
        "Séparation optimale du flux conseil et de l'encaissement en caisse.",
        [
            "**Flux optimisé de vente en officine**",
            "L'opérateur au guichet accueille le client et prépare le panier",
            "Ajout des médicaments, actes de soins et analyses",
            "Validation de l'ordonnance médicale si requise",
            "**Génération du ticket client**",
            "Création instantanée d'un numéro de ticket d'attente (ex: #0042)",
            "Remise du numéro au client pour paiement",
            "**Avantages organisationnels**",
            "Désengorgement de la file d'attente en caisse",
            "Le caissier rappelle le ticket en 1 clic pour encaissement",
        ],
        "07_caisse_pos.png",
        badge="MODULE 8 — GUICHET SAISIE ET CONSEIL",
    )

    # 9: POS
    slide(
        story,
        "Caisse POS et Encaissement",
        "Point de vente ultra-rapide avec décrémentation FEFO et ticket thermique.",
        [
            "**Encaissement fluide et sécurisé**",
            "Vente directe au comptoir ou rappel d'une pré-vente par ticket",
            "Sélection FEFO automatisée excluant les lots expirés",
            "Modes de paiement : Espèces, Mobile Money (T-Money/Flooz), Carte",
            "Calculateur de monnaie rendu et coupures de billets",
            "**Impression de ticket de caisse**",
            "Format ticket thermique 80mm prêt pour imprimante POS",
            "Informations complètes de l'officine et mentions fiscales",
            "Sécurisation des opérations et décrémentation atomique",
        ],
        "07_caisse_pos.png",
        badge="MODULE 9 — CAISSE POS ET ENCAISSEMENT",
    )

    # 10: Acts
    slide(
        story,
        "Actes et Soins Médicaux",
        "Gestion des prestations cliniques et infirmières dispensées à l'officine.",
        [
            "**Prestations cliniques répertoriées**",
            "Injections (IM, IV, SC), perfusions et surveillances",
            "Pansements simples, pansements complexes et brûlures",
            "Prise de constantes : tension artérielle, glycémie capillaire",
            "Aérosolthérapie, nébulisations et soins d'urgence",
            "**Disciplines et tarification**",
            "Organisation par disciplines : Soins Infirmiers, Urgences, etc.",
            "Tarifs officiels en FCFA et code prestation unique",
            "Intégration directe au panier de caisse et aux tickets",
        ],
        "07_caisse_pos.png",
        badge="MODULE 10 — ACTES ET SOINS MÉDICAUX",
    )

    # 11: Lab
    slide(
        story,
        "Laboratoire et Examens Médicaux",
        "Gestion complète des analyses biologiques avec disciplines dynamiques.",
        [
            "**Examens médicaux courants intégrés**",
            "Hématologie : NFS, Numération Blanche (NB), VS, Groupe RH",
            "Parasitologie : Goutte Épaisse (GE), KOP, Widal/Felix",
            "Biochimie : Glycémie, Urée, Créatinine, Transaminases (ALAT/ASAT), Ionogramme",
            "Sérologie : SRV (VIH), AgHBs, AgHCV, TPHA/VDRL, Test HP",
            "**Disciplines dynamiques personnalisables**",
            "Bouton dédié Disciplines : ajout, modification et suppression",
            "Filtrage instantané par catégorie dans le catalogue",
            "Facturation immédiate au comptoir avec récapitulatif clair",
        ],
        "07_caisse_pos.png",
        badge="MODULE 11 — LABORATOIRE ET ANALYSES",
    )

    # 12: Sales History
    slide(
        story,
        "Journal des Ventes et Caisse",
        "Consultation chronologique des encaissements et réimpression thermique.",
        [
            "**Traçabilité financière détaillée**",
            "Historique complet par date, mois et tranche horaire",
            "Filtre par vacations : Matin (07h-12h30), Après-midi, Soirée et Garde",
            "Recherche par numéro de ticket, nom du client ou médicament",
            "**Contrôle et clôture**",
            "Totaux encaissés par mode (Espèces vs Mobile Money)",
            "Visualisation du détail complet de chaque panier servi",
            "Réimpression du ticket thermique à tout moment",
        ],
        "07_caisse_pos.png",
        badge="MODULE 12 — JOURNAL DES VENTES",
    )

    # 13: Losses
    slide(
        story,
        "Pertes et Dépréciations",
        "Justification fiscale et comptable des sorties non-vendeuses.",
        [
            "**Motifs réglementaires reconnus**",
            "Péremption — détection automatisée des lots expirés",
            "Casse — avarie matérielle constatée en rayon",
            "Vol — disparition injustifiée lors de l'inventaire",
            "**Conséquences sur l'inventaire**",
            "Sortie immédiate du stock avec motif d'ajustement",
            "Génération d'écritures PERTE immuables",
            "Enregistrement de l'opérateur et horodatage légal",
            "Dossier de justification pour contrôles et bilans annuels",
        ],
        "08_pertes.png",
        badge="MODULE 13 — PERTES ET DÉPRÉCIATIONS",
    )

    # 14: Reports
    slide(
        story,
        "Rapports d'Activité et Rentabilité",
        "Synthèses de direction, marges commerciales et exports comptables.",
        [
            "**Rapports financiers complets**",
            "Synthèse financière : Chiffre d'affaires, panier moyen et ordonnances",
            "Top 10 des médicaments et produits phares en volume et en valeur",
            "Marges brutes calculées par produit (CA − Coût d'achat)",
            "État de santé du stock et pertes déclarées",
            "**Édition et conformité**",
            "Génération du rapport d'activité complet imprimable A4",
            "Espace de signature et cachet officiel de l'officine",
            "Export des données en format CSV pour tableur",
        ],
        "09_rapports.png",
        badge="MODULE 14 — RAPPORTS ET ANALYSES",
    )

    # 15: Pharmacy Setup
    slide(
        story,
        "Configuration de l'Officine (Marque Blanche)",
        "Personnalisation intégrale de l'identité de la pharmacie.",
        [
            "**Identité visuelle et commerciale**",
            "Nom de l'officine, logo haute résolution et slogan",
            "Numéro d'agrément ministériel officiel",
            "Identifiants fiscaux : NIF et numéro RCCM",
            "**Coordonnées et localisation**",
            "Adresse physique exacte, ville et préfecture",
            "Téléphones d'urgence et de garde, email officiel",
            "Lien GPS Google Maps pour guidage des patients",
            "Pied de ticket personnalisé (remerciements, mentions légales)",
        ],
        "12_pharmacies.png",
        badge="MODULE 15 — CONFIGURATION DE L'OFFICINE",
    )

    # 16: Users
    slide(
        story,
        "Gestion des Utilisateurs et Rôles",
        "Création des comptes opérateurs et réinitialisation sécurisée.",
        [
            "**Création de profil opérateur**",
            "Nom complet, email professionnel unique et mot de passe initial",
            "Attribution d'un rôle précis selon la fonction exercée",
            "Affectation de pharmacie pour les gestionnaires multi-sites",
            "**Sécurité renforcée des accès**",
            "Réinitialisation sécurisée par génération d'un mot de passe fort",
            "Affichage unique et copie directe dans le presse-papiers",
            "Désactivation instantanée d'un compte en cas de départ",
        ],
        "10_utilisateurs.png",
        badge="MODULE 16 — GESTION DES UTILISATEURS",
    )

    # 17: Audit Log
    slide(
        story,
        "Journal d'Audit et Sécurité",
        "Traçabilité légale et immuable de toutes les actions sensibles.",
        [
            "**Événements consignés**",
            "Connexions, échecs de connexion et déconnexions",
            "Créations, modifications et suppressions de produits et tarifs",
            "Entrées en stock, réceptions et modifications de lots",
            "Ventes validées, devis et déclarations de rebuts",
            "Changements de mot de passe et droits administrateurs",
            "**Données enregistrées**",
            "Identité de l'auteur, adresse IP, horodatage exact UTC",
            "Type d'action, ressource impactée et détails de l'opération",
        ],
        "11_audit_log.png",
        badge="MODULE 17 — JOURNAL D'AUDIT",
    )

    # 18: Multi-pharmacies SaaS
    slide(
        story,
        "Architecture Multi-pharmacies SaaS",
        "Supervision centrale pour réseaux d'officines et centrales de gestion.",
        [
            "**Capacités Super Admin (OPTINET)**",
            "Supervision globale de l'ensemble du réseau pharmaceutique",
            "Création et intégration rapide d'une nouvelle officine",
            "Indicateurs consolidés : CA total et valeur du stock du parc",
            "**Cloisonnement étanche des données**",
            "Chaque pharmacie dispose d'une étanchéité stricte de ses données",
            "Aucune fuite de données entre officines clientes",
            "Indépendance des catalogues, tarifs, stocks et utilisateurs",
        ],
        "13_super_admin_dashboard.png",
        badge="MODULE 18 — MULTI-PHARMACIES SAAS",
    )

    # Final slide: Contact & Support
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("SUPPORT ET ASSISTANCE", label_st))
    story.append(Paragraph("OPTINET SARLU", title_st))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("Solutions Réseaux, Logiciels et Télécommunications", subtitle_st))
    story.append(Spacer(1, 0.6 * cm))
    info_rows = [
        ["Éditeur de la solution", "OPTINET SARLU"],
        ["Direction Générale", "NABINE Tassounti"],
        ["Siège social", "Quartier Agoè Cacavéli, derrière la CEET — Lomé, Togo"],
        ["Ligne d'assistance", "+228 90 74 84 65  ·  +228 99 05 84 71"],
        ["Messagerie électronique", "optinetsarl@gmail.com"],
        ["Portail web officiel", "www.optinet.tg"],
        ["Identifiants légaux", "RCCM : TG-LFW-01-2026-B13-00831  ·  NIF : 1002114979"],
        ["Version du système", "SGP-Pharma v2.0 (Octobre 2026)"],
        ["Conformité", "Nomenclature CAMEG Togo  ·  FEFO Intégré  ·  Multi-tenants SaaS"],
    ]
    info_tbl = Table(info_rows, colWidths=[8 * cm, 22 * cm])
    info_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10.5),
        ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY),
        ("TEXTCOLOR", (1, 0), (1, -1), TEXT),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#E5E7EB")),
    ]))
    story.append(info_tbl)

    def first_page(canvas, doc):
        cover_chrome(canvas, doc)

    def later_pages(canvas, doc):
        page_chrome(canvas, doc)

    doc.build(story, onFirstPage=first_page, onLaterPages=later_pages)
    print(f"PDF generated: {OUT_PDF} ({OUT_PDF.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
