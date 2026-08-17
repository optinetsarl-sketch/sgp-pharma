"""PDF generation: thermal receipts (80mm) + A4 purchase orders. Uses ReportLab."""
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfgen import canvas

from database import get_db
from auth import get_current_user
from tenant import assert_same_pharmacy

router = APIRouter(prefix="/api", tags=["pdf"])


def fmt_xof(amount):
    try:
        return f"{int(round(float(amount))):,}".replace(",", " ") + " FCFA"
    except Exception:
        return "0 FCFA"


def fmt_dt(s: str | None):
    if not s:
        return ""
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).strftime("%d/%m/%Y %H:%M")
    except Exception:
        return s


# ---------- Thermal receipt (80mm wide) ----------
@router.get("/sales/{sid}/receipt.pdf")
async def sale_receipt_pdf(sid: str, user: dict = Depends(get_current_user)):
    db = get_db()
    sale = await db.sales.find_one({"id": sid}, {"_id": 0})
    assert_same_pharmacy(user, sale)

    # Pharmacy header
    pharmacy = None
    if sale.get("pharmacy_id"):
        pharmacy = await db.pharmacies.find_one({"id": sale["pharmacy_id"]}, {"_id": 0})
    if not pharmacy:
        pharmacy = await db.pharmacies.find_one({}, {"_id": 0}) or {"name": "PHARMACIE"}

    cashier = await db.users.find_one({"id": sale["user_id"]}, {"_id": 0, "name": 1, "email": 1}) or {"name": "?"}

    # Build product map
    pids = [it["product_id"] for it in sale["items"]]
    products = await db.products.find({"id": {"$in": pids}}, {"_id": 0}).to_list(200)
    pmap = {p["id"]: p for p in products}

    # 80mm width = 226 pts ; height auto-sized via canvas redraw
    width = 80 * mm
    # Estimate height
    base_lines = 16
    item_lines = sum(2 for _ in sale["items"])
    height = (base_lines + item_lines + 8) * 4.2 * mm

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))
    y = height - 5 * mm
    line_h = 4.2 * mm

    def line(text, size=8, bold=False, center=False, font="Helvetica"):
        nonlocal y
        c.setFont("Helvetica-Bold" if bold else font, size)
        text = str(text)
        if center:
            tw = c.stringWidth(text, "Helvetica-Bold" if bold else font, size)
            c.drawString((width - tw) / 2, y, text)
        else:
            c.drawString(3 * mm, y, text)
        y -= line_h

    def hr():
        nonlocal y
        c.setLineWidth(0.3)
        c.line(2 * mm, y + 1 * mm, width - 2 * mm, y + 1 * mm)
        y -= 1.5 * mm

    # Pharmacy header
    line(pharmacy.get("name", "PHARMACIE SGP-PHARMA").upper(), 10, True, True)
    if pharmacy.get("address"):
        line(pharmacy["address"], 7, center=True)
    if pharmacy.get("phone"):
        line(f"Tél: {pharmacy['phone']}", 7, center=True)
    if pharmacy.get("license_number"):
        line(f"N° Agrément: {pharmacy['license_number']}", 7, center=True)
    hr()

    # Ticket Meta
    line(f"TICKET #TC-{sid[:8].upper()}", 9, True)
    line(f"Date: {fmt_dt(sale.get('date'))}", 7)
    line(f"Caissier: {cashier.get('name', 'Opérateur')}", 7)
    if sale.get("customer_name"):
        line(f"Client: {sale['customer_name']}", 7)
    if sale.get("prescription_ref"):
        line(f"Réf. Ord: {sale['prescription_ref']} (Rx)", 7, bold=True)
    line(f"Règlement: {sale.get('payment_method', 'ESPECES').upper()}", 7)
    hr()

    # Items
    for it in sale["items"]:
        prod = pmap.get(it["product_id"], {})
        name = prod.get("nom_commercial", "Médicament")
        is_rx = prod.get("requires_prescription", False)
        if is_rx:
            name = f"[Rx] {name}"
        if len(name) > 30:
            name = name[:29] + "."
        line(name, 8, True)
        sub_str = fmt_xof(it["subtotal"])
        line(f"  {it['quantity']} x {fmt_xof(it['unit_price'])}", 7)
        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(width - 3 * mm, y + line_h, sub_str)
    hr()

    # Total
    c.setFont("Helvetica-Bold", 11)
    c.drawString(3 * mm, y, "TOTAL TTC")
    total_str = fmt_xof(sale.get("total_amount", 0))
    c.drawRightString(width - 3 * mm, y, total_str)
    y -= line_h * 1.5

    if sale.get("amount_received"):
        line(f"Reçu: {fmt_xof(sale.get('amount_received'))}", 7)
        if sale.get("change_due") is not None:
            line(f"Rendu: {fmt_xof(sale.get('change_due'))}", 7, bold=True)
        hr()

    # Footer
    line("Merci de votre visite · Bon rétablissement !", 7, True, center=True)
    line("Les médicaments ne sont ni repris ni échangés.", 6, center=True)
    line(f"*TC-{sid[:8].upper()}*", 7, center=True)
    line("SGP-Pharma · OPTINET SARLU Lomé", 6, center=True)

    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="ticket-{sid[:8]}.pdf"'})


# ---------- A4 Purchase Order ----------
@router.get("/purchase-orders/{oid}/pdf")
async def purchase_order_pdf(oid: str, user: dict = Depends(get_current_user)):
    db = get_db()
    order = await db.purchase_orders.find_one({"id": oid}, {"_id": 0})
    assert_same_pharmacy(user, order)

    pharmacy = await db.pharmacies.find_one({"id": order.get("pharmacy_id")}, {"_id": 0}) or {}
    supplier = await db.suppliers.find_one({"id": order["supplier_id"]}, {"_id": 0}) or {}
    pids = [it["product_id"] for it in order["items"]]
    products = await db.products.find({"id": {"$in": pids}}, {"_id": 0}).to_list(500)
    pmap = {p["id"]: p for p in products}

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    title_st = ParagraphStyle("title", parent=styles["Heading1"], textColor=colors.HexColor("#166534"), fontSize=20, leading=24, spaceAfter=4)
    label_st = ParagraphStyle("lbl", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#6B7280"), leading=10, fontName="Helvetica-Bold")
    body_st = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, leading=13)
    small_st = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#4B5563"))

    story = []

    # Header: pharmacy + PO ref
    header_data = [[
        Paragraph(f"<b>{pharmacy.get('name', 'Pharmacie')}</b>", body_st),
        Paragraph(f"<b>BON DE COMMANDE</b><br/>N° {oid[:8].upper()}", title_st),
    ]]
    header_tbl = Table(header_data, colWidths=[100*mm, 70*mm])
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 4))
    if pharmacy.get("address"):
        story.append(Paragraph(pharmacy["address"], small_st))
    if pharmacy.get("phone"):
        story.append(Paragraph(f"Tél: {pharmacy['phone']} — {pharmacy.get('email', '')}", small_st))
    story.append(Spacer(1, 12))

    # Supplier + PRA + Delivery + dates
    pra_info = f"<br/><font color='#166534'><b>📍 Destinataire : {order['target_pra_name']}</b></font>" if order.get("target_pra_name") else ""
    delivery_info = f"<br/><font color='#374151'>Livraison : {order.get('delivery_city') or pharmacy.get('city', 'Togo')}</font>"

    info_data = [
        [Paragraph("FOURNISSEUR / PRA DESTINATAIRE", label_st), Paragraph("DATE DE COMMANDE", label_st), Paragraph("STATUT", label_st)],
        [
            Paragraph(f"<b>{supplier.get('raison_sociale', '?')}</b>{pra_info}<br/>{supplier.get('adresse', '') or ''}<br/>{supplier.get('telephone', '') or ''}{delivery_info}", body_st),
            Paragraph(fmt_dt(order.get("created_at")), body_st),
            Paragraph(order.get("status", "draft").upper(), body_st),
        ],
    ]
    info_tbl = Table(info_data, colWidths=[85*mm, 45*mm, 40*mm])
    info_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(info_tbl)
    story.append(Spacer(1, 16))

    # Items table
    rows = [["#", "Produit", "DCI", "Qté", "P.U.", "Total"]]
    total = 0
    for i, it in enumerate(order["items"], 1):
        prod = pmap.get(it["product_id"], {})
        line_total = it["quantity"] * it["unit_price"]
        total += line_total
        rows.append([
            str(i),
            prod.get("nom_commercial", "?"),
            prod.get("dci", "") or "-",
            str(it["quantity"]),
            fmt_xof(it["unit_price"]),
            fmt_xof(line_total),
        ])
    items_tbl = Table(rows, colWidths=[10*mm, 60*mm, 40*mm, 15*mm, 22*mm, 23*mm])
    items_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#166534")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E5E7EB")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(items_tbl)
    story.append(Spacer(1, 12))

    # Total
    total_tbl = Table([
        ["TOTAL HT", fmt_xof(total)],
    ], colWidths=[145*mm, 25*mm])
    total_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 12),
        ("ALIGN", (0, 0), (0, 0), "RIGHT"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("TEXTCOLOR", (1, 0), (1, 0), colors.HexColor("#166534")),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(total_tbl)
    story.append(Spacer(1, 16))

    if order.get("notes"):
        story.append(Paragraph("<b>Notes :</b>", label_st))
        story.append(Paragraph(order["notes"], body_st))
        story.append(Spacer(1, 12))

    # Signature footer
    story.append(Spacer(1, 30))
    sign_tbl = Table([
        [Paragraph("Signature & cachet pharmacie", small_st), Paragraph("Signature & cachet fournisseur", small_st)],
        ["", ""],
    ], colWidths=[80*mm, 80*mm], rowHeights=[6*mm, 25*mm])
    sign_tbl.setStyle(TableStyle([
        ("LINEABOVE", (0, 1), (-1, 1), 0.5, colors.HexColor("#9CA3AF")),
    ]))
    story.append(sign_tbl)

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="bon-commande-{oid[:8]}.pdf"'})
