"""Generate the SGP-Pharma user manual presentation PDF.

Output: /app/docs/SGP-Pharma_Manuel_Utilisateur.pdf
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

SCREENSHOTS = Path("/app/docs/screenshots")
OUT_PDF = Path("/app/docs/SGP-Pharma_Manuel_Utilisateur.pdf")

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
                          fontSize=28, leading=32, textColor=PRIMARY, spaceAfter=4)
subtitle_st = ParagraphStyle("subtitle", parent=styles["Normal"], fontName="Helvetica",
                             fontSize=12, leading=16, textColor=MUTED, spaceAfter=8)
section_st = ParagraphStyle("section", parent=styles["Heading2"], fontName="Helvetica-Bold",
                            fontSize=14, leading=18, textColor=TEXT, spaceAfter=6, spaceBefore=4)
bullet_st = ParagraphStyle("bullet", parent=styles["Normal"], fontName="Helvetica",
                           fontSize=10, leading=14, textColor=TEXT, leftIndent=12, bulletIndent=2)
small_st = ParagraphStyle("small", parent=styles["Normal"], fontName="Helvetica",
                          fontSize=9, leading=11, textColor=MUTED)
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
    canvas.drawRightString(PAGE_W - 1.2 * cm, PAGE_H - 0.42 * cm, "Manuel utilisateur · v1.1")
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


def slide(story, title, subtitle, bullets, screenshot, badge=None):
    """One slide: title + bullets on left, screenshot on right."""
    # Header
    story.append(Spacer(1, 0.6 * cm))
    if badge:
        story.append(Paragraph(badge, label_st))
    story.append(Paragraph(title, title_st))
    story.append(Paragraph(subtitle, subtitle_st))

    # Two-column body: bullets (left), screenshot (right)
    bullet_paras = []
    for b in bullets:
        if b.startswith("**"):
            # mini-section header
            bullet_paras.append(Paragraph(b.replace("**", ""), section_st))
        else:
            bullet_paras.append(Paragraph(f"• {b}", bullet_st))
    bullet_paras.append(Spacer(1, 0.3 * cm))

    # Screenshot — fit into right cell
    img = None
    img_path = SCREENSHOTS / screenshot
    if img_path.exists():
        # natural width 1600, scale to fit ~18cm wide
        img = Image(str(img_path), width=18 * cm, height=11.25 * cm)

    body = Table(
        [[bullet_paras, img if img else Paragraph("(image manquante)", small_st)]],
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
    story.append(Paragraph("Système de Gestion Intégrée de Pharmacie", cover_sub_st))
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph("Manuel utilisateur — Présentation des modules", cover_meta_st))
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("OPTINET SARLU — Lomé, Togo", cover_meta_st))
    story.append(Paragraph("Quartier Agoè Cacavéli · Derrière la CEET", cover_meta_st))
    story.append(Paragraph("+228 90 74 84 65  ·  optinetsarl@gmail.com  ·  www.optinet.tg", cover_meta_st))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("Version 1.1 — Mai 2026", cover_meta_st))
    story.append(PageBreak())


def toc(story):
    """Table of contents slide."""
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph("SOMMAIRE", label_st))
    story.append(Paragraph("Table des matières", title_st))
    story.append(Paragraph("13 modules couvrant l'intégralité du cycle de vie pharmaceutique", subtitle_st))
    story.append(Spacer(1, 0.3 * cm))

    items = [
        ("1.", "Connexion & Rôles", "Sécurité JWT et 5 niveaux d'accès"),
        ("2.", "Tableau de bord", "KPIs temps réel + alertes péremption"),
        ("3.", "Produits", "Catalogue ~150 médicaments CAMEG"),
        ("4.", "Stock & Lots", "Gestion par lot avec FEFO"),
        ("5.", "Réception", "Entrée stock + validation péremption"),
        ("6.", "Commandes fournisseur", "Bons de commande + PDF A4"),
        ("7.", "Fournisseurs", "Annuaire CAMEG / Ubipharm / Laborex"),
        ("8.", "Caisse (POS)", "Vente FEFO + ordonnance + ticket PDF"),
        ("9.", "Pertes", "Péremption / Casse / Vol"),
        ("10.", "Rapports", "CA, top ventes, marges, export CSV"),
        ("11.", "Utilisateurs", "RBAC + reset mot de passe"),
        ("12.", "Journal d'audit", "Traçabilité légale"),
        ("13.", "Multi-pharmacies", "Mode SaaS Super Admin OPTINET"),
    ]
    rows = []
    for n, name, desc in items:
        rows.append([
            Paragraph(f"<b>{n}</b>", section_st),
            Paragraph(f"<b>{name}</b>", section_st),
            Paragraph(desc, small_st),
        ])
    tbl = Table(rows, colWidths=[1.5 * cm, 7 * cm, 22 * cm])
    tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#E5E7EB")),
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

    # --- Cover (no chrome, full green)
    cover(story)
    # --- TOC
    toc(story)

    # --- Slide 1: Login & Roles
    slide(
        story,
        "Connexion & Gestion des rôles",
        "Authentification sécurisée par JWT — 5 niveaux d'accès distincts.",
        [
            "**Comptes de démonstration**",
            "Super Admin (OPTINET) — optinet@sgp-pharma.tg",
            "Admin Pharmacie — admin@sgp-pharma.tg",
            "Pharmacien — pharmacien@sgp-pharma.tg",
            "Caissier — caissier@sgp-pharma.tg",
            "Magasinier — magasinier@sgp-pharma.tg",
            "**Sécurité**",
            "Mots de passe chiffrés (bcrypt)",
            "Verrouillage après 5 tentatives (15 min)",
            "Tokens JWT 8 h + refresh 7 jours",
            "Switch FR / EN en bas de la barre latérale",
        ],
        "01_dashboard.png",  # using dashboard as it's first; login screen could be separate
        badge="MODULE 1 — AUTHENTIFICATION",
    )

    # --- Slide 2: Dashboard
    slide(
        story,
        "Tableau de bord",
        "Vue d'ensemble en temps réel : ventes, stock, alertes critiques.",
        [
            "**KPIs principaux (cartes vertes)**",
            "CA du jour & du mois (FCFA)",
            "Valeur totale du stock + nombre d'unités",
            "Nombre d'ordonnances servies aujourd'hui",
            "**Alertes critiques (rouge / orange)**",
            "Lots expirés (rouge) — à retirer immédiatement",
            "Expirations < 30 jours (orange) — à écouler",
            "Produits en stock faible (sous le seuil)",
            "**Visualisation**",
            "Graphique ventes des 7 derniers jours",
            "Liste alertes péremption détaillée",
            "Tableau produits sous le seuil d'alerte",
        ],
        "01_dashboard.png",
        badge="MODULE 2 — DASHBOARD",
    )

    # --- Slide 3: Products
    slide(
        story,
        "Produits — Catalogue CAMEG",
        "~150 médicaments essentiels couvrant tous les besoins du marché togolais.",
        [
            "**Données par produit**",
            "Code-barres, nom commercial, DCI",
            "Forme pharmaceutique (cp, sirop, gélule…)",
            "Catégorie (Antibiotiques, Antipaludiques…)",
            "Prix de vente, seuil d'alerte stock",
            "Indicateur ordonnance requise (Oui/Non)",
            "**Recherche intelligente**",
            "Recherche par nom, DCI ou code-barres",
            "**Catégories couvertes**",
            "Antalgiques, Antibiotiques, Antipaludiques",
            "Cardiologie, Diabète, Gastro, Respiratoire",
            "Dermato, Gynéco, Pédiatrie, Vitamines, Matériel",
            "VIH/TB, Antiparasitaires, Anesthésiques, Solutions",
        ],
        "02_produits.png",
        badge="MODULE 3 — PRODUITS",
    )

    # --- Slide 4: Stock & Lots
    slide(
        story,
        "Stock & Lots — Traçabilité FEFO",
        "Vue par lot avec date de péremption et badges colorés.",
        [
            "**Badges FEFO automatiques**",
            "🟢 OK — péremption > 90 jours",
            "🟡 Bientôt — entre 0 et 90 jours",
            "🔴 Expiré — péremption dépassée",
            "**Informations par lot**",
            "Numéro de lot fabricant",
            "Date de péremption + jours restants",
            "Quantité actuelle / prix d'achat unitaire",
            "Statut : Actif / Bloqué / Épuisé",
            "**Actions**",
            "Bloquer un lot (qualité douteuse)",
            "Filtrage par produit ou texte libre",
            "Tri automatique par péremption croissante",
        ],
        "03_stock_lots.png",
        badge="MODULE 4 — STOCK & LOTS",
    )

    # --- Slide 5: Reception
    slide(
        story,
        "Réception fournisseur",
        "Entrée de stock multi-lignes avec validation stricte de péremption.",
        [
            "**Saisie obligatoire par ligne**",
            "Produit (sélection dans catalogue)",
            "Numéro de lot fabricant",
            "Date de péremption (refus si < aujourd'hui)",
            "Prix d'achat unitaire",
            "Quantité reçue",
            "**Règles métier**",
            "Blocage immédiat si lot déjà expiré",
            "Création automatique de mouvement ENTREE_ACHAT",
            "Lien optionnel vers un bon de commande",
            "**Productivité**",
            "Réception multi-lignes sur une seule transaction",
            "Sélection fournisseur en haut du formulaire",
        ],
        "04_reception.png",
        badge="MODULE 5 — RÉCEPTION",
    )

    # --- Slide 6: Orders
    slide(
        story,
        "Bons de commande fournisseur",
        "Gestion des commandes avec génération PDF A4 imprimable.",
        [
            "**Cycle de commande**",
            "Brouillon → Validée → Reçue → Clôturée",
            "Modification de statut depuis la liste",
            "**Génération PDF A4**",
            "Téléchargement instantané (icône)",
            "En-tête vert OPTINET + nom pharmacie",
            "Coordonnées fournisseur + date + statut",
            "Tableau articles avec total HT en FCFA",
            "Zone signature pharmacie + fournisseur",
            "**Données calculées**",
            "Total automatique (Σ qté × prix)",
            "Audit log à chaque changement de statut",
        ],
        "05_commandes.png",
        badge="MODULE 6 — COMMANDES",
    )

    # --- Slide 7: Suppliers
    slide(
        story,
        "Fournisseurs",
        "Annuaire des grossistes pharmaceutiques.",
        [
            "**Pré-chargés (démo)**",
            "CAMEG Togo (centrale d'achat nationale)",
            "UBIPHARM Togo",
            "COPHARMA",
            "Laborex Togo",
            "**Champs gérés**",
            "Raison sociale, contact, email",
            "Téléphone, adresse complète",
            "**Actions**",
            "Création / modification / suppression",
            "Liaison aux lots (traçabilité origine)",
            "Liaison aux bons de commande",
        ],
        "06_fournisseurs.png",
        badge="MODULE 7 — FOURNISSEURS",
    )

    # --- Slide 8: POS
    slide(
        story,
        "Caisse (POS) — Vente avec FEFO automatique",
        "Interface optimisée pour le caissier — sélection de lot intelligente.",
        [
            "**Recherche & ajout panier**",
            "Recherche par nom / DCI / code-barres",
            "Clic = ajout au panier (+1)",
            "Indicateur 📄 ordonnance + stock disponible",
            "**Algorithme FEFO**",
            "Sélection automatique du lot le plus proche péremption",
            "Lots expirés exclus systématiquement",
            "Décrémentation atomique (race-safe)",
            "**Ordonnance (si requise)**",
            "Référence texte + photo (upload base64)",
            "Prévisualisation miniature avant validation",
            "**Ticket de caisse**",
            "PDF thermique 80mm téléchargeable",
            "Impression directe navigateur",
            "Modes : Espèces / Carte / Mobile money",
        ],
        "07_caisse_pos.png",
        badge="MODULE 8 — CAISSE POS",
    )

    # --- Slide 9: Losses
    slide(
        story,
        "Pertes & Casses",
        "Justification fiscale et comptable des sorties non-vendeuses.",
        [
            "**3 motifs disponibles**",
            "Péremption — auto-détectable nightly",
            "Casse — produit endommagé physiquement",
            "Vol — disparition non justifiée",
            "**Effets sur le système**",
            "Décrémentation immédiate du lot concerné",
            "Création de mouvement PERTE_* (immuable)",
            "Audit log avec utilisateur + horodatage",
            "**Cas d'usage**",
            "Justification fiscale auprès du CAMEG",
            "Suivi des pertes par motif sur la période",
            "Identification des produits à risque (vol récurrent)",
        ],
        "08_pertes.png",
        badge="MODULE 9 — PERTES",
    )

    # --- Slide 10: Reports
    slide(
        story,
        "Rapports & Analyses",
        "3 rapports clés avec export CSV.",
        [
            "**Onglet Historique des ventes**",
            "Liste détaillée période (date, client, total, mode)",
            "Export CSV pour comptabilité",
            "**Onglet Top produits**",
            "Classement quantité vendue + CA",
            "Top 10 par défaut (configurable)",
            "**Onglet Marge brute**",
            "Calcul marge = CA − Coût (par produit)",
            "Marge en FCFA + en pourcentage",
            "Optimisation MongoDB aggregation $lookup",
            "**Filtres**",
            "Par période (date début / fin)",
            "Pagination automatique",
        ],
        "09_rapports.png",
        badge="MODULE 10 — RAPPORTS",
    )

    # --- Slide 11: Users
    slide(
        story,
        "Gestion des utilisateurs",
        "Création de comptes + réinitialisation mots de passe sécurisée.",
        [
            "**Création utilisateur (Admin)**",
            "Email unique + nom complet",
            "Mot de passe initial (≥ 6 caractères)",
            "Rôle : Admin / Pharmacien / Caissier / Magasinier",
            "Pharmacie d'affectation (Super Admin uniquement)",
            "**Réinitialisation mot de passe (icône clé)**",
            "Génération automatique pass temporaire fort",
            "Affichage UNE SEULE FOIS dans une modale",
            "Bouton de copie vers presse-papier",
            "**Activation / désactivation**",
            "Bouton Actif / Inactif (toggle)",
            "Suppression avec confirmation",
        ],
        "10_utilisateurs.png",
        badge="MODULE 11 — UTILISATEURS",
    )

    # --- Slide 12: Audit Log
    slide(
        story,
        "Journal d'audit",
        "Traçabilité légale de toutes les actions critiques.",
        [
            "**Actions journalisées**",
            "Connexions / déconnexions",
            "Création / modification / suppression de produits",
            "Réceptions de stock",
            "Ventes (montant, panier)",
            "Pertes (motif, quantité)",
            "Resets de mots de passe",
            "Changements de statut commandes",
            "**Données capturées**",
            "Utilisateur (email + ID), horodatage UTC",
            "Adresse IP, action, entité concernée, détails",
            "**Conformité**",
            "Conservation immuable (insert-only)",
            "Filtrage par utilisateur ou action",
        ],
        "11_audit_log.png",
        badge="MODULE 12 — AUDIT LOG",
    )

    # --- Slide 13: Pharmacies (Multi-tenant)
    slide(
        story,
        "Multi-pharmacies — Mode SaaS",
        "Architecture multi-tenant : OPTINET peut servir plusieurs officines.",
        [
            "**Rôle Super Admin (OPTINET)**",
            "Voit toutes les pharmacies du système",
            "Crée / modifie / supprime des pharmacies",
            "Crée des admins par pharmacie",
            "**Rôle Admin Pharmacie**",
            "Vue limitée à sa propre pharmacie",
            "Affichage du nom en bandeau vert (sidebar)",
            "**Isolation stricte des données**",
            "Produits, stocks, ventes, utilisateurs cloisonnés",
            "Cross-tenant access → erreur 404",
            "**Données par pharmacie**",
            "Nom, adresse, téléphone, email",
            "N° d'agrément officiel, devise (FCFA)",
            "Statut Actif / Inactif",
        ],
        "12_pharmacies.png",
        badge="MODULE 13 — MULTI-PHARMACIES",
    )

    # --- Bonus slide: Super Admin view
    slide(
        story,
        "Vue Super Admin OPTINET",
        "Tableau de bord agrégé sur l'ensemble du parc de pharmacies.",
        [
            "**Bandeau jaune Mode Super Admin**",
            "Visible dans la barre latérale gauche",
            "Indique « Vue toutes pharmacies »",
            "**Données agrégées**",
            "CA cumulé toutes pharmacies confondues",
            "Valeur stock totale du réseau",
            "Alertes péremption consolidées",
            "**Accès**",
            "Page Pharmacies — gestion complète",
            "Gestion utilisateurs cross-pharmacie",
            "Audit log global",
            "**Cas d'usage**",
            "OPTINET supervise un réseau (Lomé, Kara…)",
            "Onboarding rapide d'une nouvelle officine",
        ],
        "13_super_admin_dashboard.png",
        badge="VUE SUPER ADMIN",
    )

    # --- Final slide: Resources
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("MERCI", label_st))
    story.append(Paragraph("Questions ?", title_st))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("OPTINET SARLU — Solutions Réseaux & Télécommunications", subtitle_st))
    story.append(Spacer(1, 0.6 * cm))
    info_rows = [
        ["Porteur du projet", "OPTINET SARLU"],
        ["Responsable", "NABINE Tassounti — Directeur Général"],
        ["Adresse", "Quartier Agoè Cacavéli, derrière la CEET — Lomé, Togo"],
        ["Téléphone", "+228 90 74 84 65  ·  +228 99 05 84 71"],
        ["Email", "optinetsarl@gmail.com"],
        ["Site web", "www.optinet.tg"],
        ["RCCM / NIF", "TG-LFW-01-2026-B13-00831  ·  1002114979"],
        ["Version actuelle", "1.1 — Mai 2026"],
        ["Stack technique", "FastAPI + MongoDB + React + Tailwind"],
        ["Architecture", "Multi-tenant SaaS  ·  ~150 médicaments CAMEG"],
        ["Compte démo Super Admin", "optinet@sgp-pharma.tg / Optinet@2026"],
        ["Compte démo Admin", "admin@sgp-pharma.tg / Admin@2026"],
    ]
    info_tbl = Table(info_rows, colWidths=[8 * cm, 22 * cm])
    info_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY),
        ("TEXTCOLOR", (1, 0), (1, -1), TEXT),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#E5E7EB")),
    ]))
    story.append(info_tbl)

    # Use special canvas: cover_chrome on first page, page_chrome on others
    def first_page(canvas, doc):
        cover_chrome(canvas, doc)

    def later_pages(canvas, doc):
        page_chrome(canvas, doc)

    doc.build(story, onFirstPage=first_page, onLaterPages=later_pages)
    print(f"PDF generated: {OUT_PDF} ({OUT_PDF.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
