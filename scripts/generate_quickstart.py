"""Generate two A4 Quick Start sheets (recto-verso) for new staff:
- /app/docs/QuickStart_Caissier.pdf  (cashier — POS focus)
- /app/docs/QuickStart_Magasinier.pdf (storekeeper — Reception/Stock focus)

Each: A4 portrait, 2 pages (recto-verso).
"""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

OUT_DIR = Path("/app/docs")
SCREENSHOTS = Path("/app/docs/screenshots")

PRIMARY = colors.HexColor("#166534")
PRIMARY_DARK = colors.HexColor("#14532D")
TEXT = colors.HexColor("#111827")
MUTED = colors.HexColor("#4B5563")
ACCENT = colors.HexColor("#F59E0B")
RED = colors.HexColor("#DC2626")
EMERALD_LIGHT = colors.HexColor("#ECFDF5")
AMBER_LIGHT = colors.HexColor("#FFFBEB")
RED_LIGHT = colors.HexColor("#FEF2F2")
GRAY_LIGHT = colors.HexColor("#F3F4F6")

styles = getSampleStyleSheet()

T_TITLE = ParagraphStyle("title", parent=styles["Heading1"], fontName="Helvetica-Bold",
                         fontSize=24, leading=28, textColor=PRIMARY, spaceAfter=2)
T_SUBTITLE = ParagraphStyle("sub", parent=styles["Normal"], fontName="Helvetica",
                            fontSize=11, leading=14, textColor=MUTED, spaceAfter=8)
T_BADGE = ParagraphStyle("badge", parent=styles["Normal"], fontName="Helvetica-Bold",
                         fontSize=8, leading=10, textColor=PRIMARY, alignment=TA_LEFT)
T_SECTION = ParagraphStyle("sec", parent=styles["Heading2"], fontName="Helvetica-Bold",
                           fontSize=12, leading=15, textColor=colors.white,
                           backColor=PRIMARY, leftIndent=8, rightIndent=8,
                           spaceBefore=4, spaceAfter=6, borderPadding=(4, 8, 4, 8))
T_BODY = ParagraphStyle("body", parent=styles["Normal"], fontName="Helvetica",
                        fontSize=10, leading=14, textColor=TEXT, spaceAfter=2)
T_STEP = ParagraphStyle("step", parent=styles["Normal"], fontName="Helvetica",
                        fontSize=10, leading=14, textColor=TEXT, leftIndent=18, spaceAfter=2)
T_TIP = ParagraphStyle("tip", parent=styles["Normal"], fontName="Helvetica",
                       fontSize=9, leading=12, textColor=MUTED, leftIndent=10, spaceAfter=2)
T_WARN = ParagraphStyle("warn", parent=styles["Normal"], fontName="Helvetica-Bold",
                        fontSize=10, leading=13, textColor=RED)
T_SMALL = ParagraphStyle("small", parent=styles["Normal"], fontName="Helvetica",
                         fontSize=8, leading=10, textColor=MUTED)


def chrome(canvas, doc):
    """Header band with OPTINET branding + page footer."""
    w, h = A4
    canvas.saveState()
    # top band
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, h - 1.4 * cm, w, 1.4 * cm, fill=1, stroke=0)
    # cross logo
    canvas.setFillColor(colors.white)
    canvas.setStrokeColor(colors.white)
    cx, cy = 1.5 * cm, h - 0.7 * cm
    canvas.rect(cx - 0.35 * cm, cy - 0.1 * cm, 0.7 * cm, 0.2 * cm, fill=1, stroke=0)
    canvas.rect(cx - 0.1 * cm, cy - 0.35 * cm, 0.2 * cm, 0.7 * cm, fill=1, stroke=0)
    # brand
    canvas.setFont("Helvetica-Bold", 11)
    canvas.drawString(2.5 * cm, h - 0.55 * cm, "SGP-PHARMA")
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2.5 * cm, h - 0.95 * cm, "OPTINET SARLU · Lomé, Togo")
    # right side: doc title
    canvas.setFont("Helvetica-Bold", 11)
    canvas.drawRightString(w - 1.5 * cm, h - 0.55 * cm, doc.quick_start_title)
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - 1.5 * cm, h - 0.95 * cm, "Fiche Quick Start · v1.1")

    # footer
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    contact = "OPTINET SARLU · Quartier Agoè Cacavéli, derrière la CEET, Lomé · +228 90 74 84 65 · optinetsarl@gmail.com · www.optinet.tg"
    canvas.drawCentredString(w / 2, 0.8 * cm, contact)
    canvas.setFont("Helvetica", 7)
    canvas.drawRightString(w - 1.5 * cm, 0.4 * cm, f"Page {doc.page} / 2")
    canvas.drawString(1.5 * cm, 0.4 * cm, "RCCM : TG-LFW-01-2026-B13-00831 · NIF : 1002114979")
    canvas.restoreState()


def section(text):
    return Paragraph(text, T_SECTION)


def step(n, text):
    return Paragraph(f"<b>{n}.</b>  {text}", T_STEP)


def colored_box(content, bg_color, border_color):
    """Returns a Table representing a colored callout box."""
    tbl = Table([[content]], colWidths=[16 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg_color),
        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return tbl


# =================================================================
# QUICK START 1 — CAISSIER
# =================================================================
def build_caissier():
    out = OUT_DIR / "QuickStart_Caissier.pdf"
    doc = SimpleDocTemplate(
        str(out), pagesize=A4,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.8 * cm, bottomMargin=1.4 * cm,
        title="SGP-Pharma — Quick Start Caissier",
        author="OPTINET SARLU",
    )
    doc.quick_start_title = "QUICK START — CAISSIER"
    story = []

    # ---- HEADER
    story.append(Paragraph("FICHE EXPRESS — RÔLE CAISSIER", T_BADGE))
    story.append(Paragraph("Vendre en 60 secondes", T_TITLE))
    story.append(Paragraph("Tout ce qu'il faut savoir le 1ᵉʳ jour pour servir un client à la caisse SGP-Pharma.", T_SUBTITLE))

    # ---- 1. Connexion
    story.append(section("1 — Se connecter"))
    story.append(step(1, "Ouvrir l'application dans le navigateur (URL fournie par votre Admin)."))
    story.append(step(2, "Saisir <b>votre email</b> professionnel et votre <b>mot de passe</b>."))
    story.append(step(3, "Cliquer sur <b>Se connecter</b>. Si bloqué après 5 tentatives, attendez 15 minutes."))
    story.append(Spacer(1, 4))
    story.append(colored_box(
        Paragraph("<b>💡 Premier login :</b> votre Admin vous remet un mot de passe temporaire. "
                  "Changez-le immédiatement (une demande de réinitialisation est aussi possible côté Admin via l'icône clé 🔑).", T_TIP),
        EMERALD_LIGHT, PRIMARY))

    # ---- 2. Lancer une vente
    story.append(Spacer(1, 6))
    story.append(section("2 — Encaisser une vente (POS)"))
    story.append(step(1, "Cliquer sur <b>Caisse</b> dans le menu de gauche."))
    story.append(step(2, "Dans la barre de recherche en haut, taper le <b>nom du médicament</b>, son <b>DCI</b>, ou scanner le <b>code-barres</b>."))
    story.append(step(3, "Cliquer sur la carte du produit pour l'ajouter au panier (à droite). Re-cliquer = +1."))
    story.append(step(4, "Ajuster les quantités avec les boutons <b>+</b> / <b>−</b> dans le panier."))
    story.append(step(5, "Saisir le <b>nom du client</b> (optionnel) et choisir le <b>mode de paiement</b> (Espèces / Carte / Mobile money)."))
    story.append(step(6, "Cliquer sur <b>Finaliser la vente</b> — le système choisit automatiquement le bon lot (FEFO)."))

    # ---- 3. Ordonnance
    story.append(Spacer(1, 6))
    story.append(section("3 — Cas particulier : produit avec ordonnance"))
    story.append(Paragraph("Certains produits ont l'icône 📄 (ex. antibiotiques, antipaludiques sur ordonnance). Le système refusera la vente sans ordonnance.", T_BODY))
    story.append(step(1, "Saisir la <b>référence ordonnance</b> (numéro / texte) dans le champ orange du panier."))
    story.append(step(2, "Optionnel : cliquer sur <b>📷 Joindre photo ordonnance</b> pour scanner / photographier l'ordonnance papier."))
    story.append(step(3, "Vérifier la prévisualisation, puis finaliser la vente normalement."))

    story.append(PageBreak())

    # ---- VERSO ----
    story.append(Paragraph("VERSO — RÔLE CAISSIER", T_BADGE))
    story.append(Paragraph("Ticket, erreurs courantes, FAQ", T_TITLE))
    story.append(Paragraph(" ", T_SUBTITLE))

    # ---- 4. Ticket
    story.append(section("4 — Imprimer / télécharger le ticket"))
    story.append(Paragraph("Une fois la vente finalisée, une fenêtre <b>Ticket de caisse</b> s'ouvre :", T_BODY))
    story.append(step(1, "<b>Imprimer</b> — envoie directement vers l'imprimante par défaut (format thermique 80mm)."))
    story.append(step(2, "<b>PDF</b> — télécharge un fichier PDF que vous pouvez sauvegarder ou réimprimer plus tard."))
    story.append(step(3, "Toujours remettre le ticket au client avec son achat."))

    # ---- 5. Erreurs courantes
    story.append(Spacer(1, 6))
    story.append(section("5 — Erreurs fréquentes & solutions"))
    err_data = [
        ["⚠ Message", "✅ Que faire"],
        ["« Stock insuffisant »", "Réduire la quantité dans le panier ou prévenir le magasinier."],
        ["« Aucun lot disponible non-expiré »", "Tout le stock du produit est expiré → prévenir le pharmacien immédiatement."],
        ["« Ordonnance requise »", "Saisir la référence ou joindre la photo avant de finaliser."],
        ["« Quantité invalide »", "Vérifier qu'aucun panier ne contient une quantité 0 ou négative."],
        ["Identifiants invalides", "Demander à l'Admin de réinitialiser votre mot de passe."],
    ]
    err_tbl = Table(err_data, colWidths=[6 * cm, 11 * cm])
    err_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRAY_LIGHT]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E5E7EB")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(err_tbl)

    # ---- 6. À NE JAMAIS FAIRE
    story.append(Spacer(1, 6))
    story.append(section("6 — Règles d'or à respecter"))
    story.append(colored_box(
        [
            Paragraph("<b>❌ NE JAMAIS</b> :", T_WARN),
            Paragraph("• modifier un prix dans le panier sans accord du Pharmacien", T_BODY),
            Paragraph("• vendre un produit avec ordonnance sans la noter dans le système", T_BODY),
            Paragraph("• partager votre mot de passe avec un collègue", T_BODY),
            Paragraph("• laisser la session ouverte si vous quittez votre poste", T_BODY),
        ],
        RED_LIGHT, RED))

    story.append(Spacer(1, 6))
    story.append(colored_box(
        [
            Paragraph("<b>✅ TOUJOURS</b> :", T_BODY),
            Paragraph("• vérifier le total affiché avant finalisation", T_BODY),
            Paragraph("• remettre le ticket de caisse au client", T_BODY),
            Paragraph("• se déconnecter en fin de service (icône <b>Déconnexion</b> en bas du menu)", T_BODY),
            Paragraph("• prévenir l'Admin / Pharmacien en cas d'anomalie", T_BODY),
        ],
        EMERALD_LIGHT, PRIMARY))

    # ---- 7. Contact
    story.append(Spacer(1, 8))
    story.append(section("7 — Besoin d'aide ?"))
    contact = Table([
        ["📞 Support OPTINET", "+228 90 74 84 65 · +228 99 05 84 71"],
        ["✉ Email", "optinetsarl@gmail.com"],
        ["👤 Directeur", "NABINE Tassounti"],
        ["🌐 Site web", "www.optinet.tg"],
    ], colWidths=[5 * cm, 12 * cm])
    contact.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(contact)

    doc.build(story, onFirstPage=chrome, onLaterPages=chrome)
    return out


# =================================================================
# QUICK START 2 — MAGASINIER
# =================================================================
def build_magasinier():
    out = OUT_DIR / "QuickStart_Magasinier.pdf"
    doc = SimpleDocTemplate(
        str(out), pagesize=A4,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.8 * cm, bottomMargin=1.4 * cm,
        title="SGP-Pharma — Quick Start Magasinier",
        author="OPTINET SARLU",
    )
    doc.quick_start_title = "QUICK START — MAGASINIER"
    story = []

    # ---- HEADER
    story.append(Paragraph("FICHE EXPRESS — RÔLE MAGASINIER", T_BADGE))
    story.append(Paragraph("Réceptionner & Suivre le stock", T_TITLE))
    story.append(Paragraph("Tout ce qu'il faut savoir le 1ᵉʳ jour pour gérer le stock SGP-Pharma.", T_SUBTITLE))

    # ---- 1. Connexion
    story.append(section("1 — Se connecter"))
    story.append(step(1, "Ouvrir l'application dans le navigateur."))
    story.append(step(2, "Saisir votre email et votre mot de passe (fournis par l'Admin)."))
    story.append(step(3, "Vous accédez aux modules : Tableau de bord, Produits, Stock & Lots, Réception, Commandes, Fournisseurs."))

    # ---- 2. Réception fournisseur
    story.append(Spacer(1, 6))
    story.append(section("2 — Réceptionner une livraison fournisseur"))
    story.append(step(1, "Cliquer sur <b>Réception</b> dans le menu de gauche."))
    story.append(step(2, "Sélectionner le <b>fournisseur</b> dans la liste déroulante (CAMEG, UBIPHARM, etc.)."))
    story.append(step(3, "Pour chaque ligne du bordereau de livraison :"))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;– Choisir le <b>produit</b> dans la liste", T_STEP))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;– Saisir le <b>numéro de lot</b> (figure sur la boîte)", T_STEP))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;– Saisir la <b>date de péremption</b> (impératif)", T_STEP))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;– Saisir le <b>prix d'achat unitaire</b> et la <b>quantité reçue</b>", T_STEP))
    story.append(step(4, "Cliquer sur <b>+ Ajouter ligne</b> pour autant de produits/lots que nécessaire."))
    story.append(step(5, "Vérifier l'ensemble, puis cliquer sur <b>Réceptionner stock</b>."))
    story.append(Spacer(1, 4))
    story.append(colored_box(
        Paragraph("<b>⚠ Vérification automatique :</b> si une date de péremption est antérieure à aujourd'hui, "
                  "le système REFUSE la réception. Comparer avec le bordereau et alerter le fournisseur.", T_WARN),
        AMBER_LIGHT, ACCENT))

    # ---- 3. Vue stock & alertes
    story.append(Spacer(1, 6))
    story.append(section("3 — Surveiller le stock & les péremptions"))
    story.append(step(1, "Cliquer sur <b>Stock & Lots</b> pour voir tous les lots, triés par péremption."))
    story.append(step(2, "Repérer les badges : 🟢 OK · 🟡 Bientôt (< 90 jours) · 🔴 Expiré."))
    story.append(step(3, "Le <b>Tableau de bord</b> affiche en haut le nombre de lots <b>expirés</b> (rouge) et <b>< 30 jours</b> (orange)."))
    story.append(step(4, "Vérifier également les <b>produits sous le seuil d'alerte</b> (carte « Stock faible »)."))

    story.append(PageBreak())

    # ---- VERSO ----
    story.append(Paragraph("VERSO — RÔLE MAGASINIER", T_BADGE))
    story.append(Paragraph("Pertes, commandes, FAQ", T_TITLE))
    story.append(Paragraph(" ", T_SUBTITLE))

    # ---- 4. Pertes
    story.append(section("4 — Déclarer une perte (péremption / casse / vol)"))
    story.append(Paragraph("Toute sortie non-vendeuse doit être tracée dans le système.", T_BODY))
    story.append(step(1, "Cliquer sur <b>Pertes</b> dans le menu (rôle Pharmacien requis pour valider)."))
    story.append(step(2, "Cliquer sur <b>Déclarer perte</b> (bouton rouge en haut à droite)."))
    story.append(step(3, "Sélectionner le <b>lot</b> concerné, saisir la <b>quantité</b> perdue."))
    story.append(step(4, "Choisir le <b>motif</b> : <i>Péremption</i> · <i>Casse</i> · <i>Vol</i>."))
    story.append(step(5, "Ajouter une note explicative si nécessaire, puis enregistrer."))
    story.append(Spacer(1, 4))
    story.append(colored_box(
        Paragraph("<b>📜 Conformité :</b> chaque perte est inscrite dans le journal d'audit avec votre identifiant, "
                  "l'heure et le motif. Indispensable pour la justification fiscale et les inspections du Ministère de la Santé.", T_TIP),
        EMERALD_LIGHT, PRIMARY))

    # ---- 5. Bons de commande
    story.append(Spacer(1, 6))
    story.append(section("5 — Préparer un bon de commande fournisseur"))
    story.append(step(1, "Cliquer sur <b>Commandes</b> puis <b>+ Créer commande</b>."))
    story.append(step(2, "Choisir le <b>fournisseur</b>, ajouter chaque produit avec quantité et prix unitaire négocié."))
    story.append(step(3, "Enregistrer en <i>Brouillon</i>, puis le valider quand prêt à envoyer."))
    story.append(step(4, "Cliquer sur l'icône <b>📥 Télécharger PDF</b> pour obtenir un bon A4 imprimable à transmettre au fournisseur."))
    story.append(step(5, "À la livraison, lier la réception à la commande pour suivi automatique."))

    # ---- 6. Bonnes pratiques
    story.append(Spacer(1, 6))
    story.append(section("6 — Bonnes pratiques & règles d'or"))

    story.append(colored_box(
        [
            Paragraph("<b>❌ NE JAMAIS</b> :", T_WARN),
            Paragraph("• stocker un produit sans le saisir dans le système", T_BODY),
            Paragraph("• modifier la date de péremption d'un lot existant", T_BODY),
            Paragraph("• ranger un nouveau lot devant un lot plus ancien (respecter le FEFO physique)", T_BODY),
            Paragraph("• jeter un produit expiré sans déclarer la perte au préalable", T_BODY),
        ],
        RED_LIGHT, RED))

    story.append(Spacer(1, 6))
    story.append(colored_box(
        [
            Paragraph("<b>✅ TOUJOURS</b> :", T_BODY),
            Paragraph("• vérifier l'intégrité de chaque colis à la réception", T_BODY),
            Paragraph("• ranger les nouveaux lots derrière les anciens (FEFO physique)", T_BODY),
            Paragraph("• signaler tout écart entre bordereau et livraison physique", T_BODY),
            Paragraph("• consulter le tableau de bord chaque matin pour les alertes péremption", T_BODY),
            Paragraph("• se déconnecter en fin de service", T_BODY),
        ],
        EMERALD_LIGHT, PRIMARY))

    # ---- 7. Contact
    story.append(Spacer(1, 8))
    story.append(section("7 — Besoin d'aide ?"))
    contact = Table([
        ["📞 Support OPTINET", "+228 90 74 84 65 · +228 99 05 84 71"],
        ["✉ Email", "optinetsarl@gmail.com"],
        ["👤 Directeur", "NABINE Tassounti"],
        ["🌐 Site web", "www.optinet.tg"],
    ], colWidths=[5 * cm, 12 * cm])
    contact.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(contact)

    doc.build(story, onFirstPage=chrome, onLaterPages=chrome)
    return out


if __name__ == "__main__":
    p1 = build_caissier()
    p2 = build_magasinier()
    print(f"Generated: {p1} ({p1.stat().st_size // 1024} KB)")
    print(f"Generated: {p2} ({p2.stat().st_size // 1024} KB)")
