import React, { useEffect, useState } from "react";
import api, { formatXOF } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Printer, Download, X, CheckCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import PharmacyLogo from "@/components/PharmacyLogo";

export default function ReceiptModal({ sale, onClose }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [pharmacy, setPharmacy] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // Fetch dynamic pharmacy profile
    api.get("/pharmacy/current")
      .then((r) => {
        if (r.data) setPharmacy(r.data);
      })
      .catch(() => {});
  }, [sale]);

  // Keyboard shortcut: Escape to close, Ctrl+P to print
  useEffect(() => {
    const handleKeys = (e) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [onClose]);

  if (!sale) return null;

  const items = sale._items || sale.items || [];
  const totalAmount = sale.total_amount || 0;
  const amountReceived = sale._amountReceived || sale.amount_received || 0;
  const changeDue = sale._changeDue || sale.change_due || 0;
  const cashierName = sale._cashierName || user?.name || "Opérateur";
  const pharmacyName = pharmacy?.name || "PHARMACIE";
  const pharmacySlogan = pharmacy?.slogan || "";
  const pharmacyAddress = pharmacy?.address || "Lomé";
  const pharmacyPhone = pharmacy?.phone || "+228 00 00 00 00";
  const pharmacyLicense = pharmacy?.license_number || "";
  const footerMessage = pharmacy?.footer_message || "Merci de votre visite · Bon rétablissement !";
  const hasRx = items.some((i) => (i.product?.requires_prescription || i.requires_prescription));

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/sales/${sale.id}/receipt.pdf`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Ticket_${sale.id.slice(0, 8).toUpperCase()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("Ticket PDF téléchargé");
    } catch (err) {
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setDownloading(false);
    }
  };

  const getPaymentLabel = (method) => {
    switch (method) {
      case "cash":
        return "Espèces";
      case "mobile_money":
        return "Mobile Money";
      case "card":
        return "Carte";
      case "insurance":
        return "Assurance";
      case "check":
        return "Chèque";
      default:
        return method?.toUpperCase() || "Espèces";
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto"
      data-testid="receipt-modal"
    >
      <div className="bg-white rounded-3xl w-full max-w-sm border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Action Bar (hidden in print) */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-100 print:hidden bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-heading font-black text-xs text-slate-900 leading-tight">
                Ticket de Caisse
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                #TC-{sale.id?.slice(0, 8).toUpperCase()}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="close-receipt-modal"
            className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* --- ULTRA-COMPACT THERMAL RECEIPT 80MM (ÉCONOMIE DE PAPIER) --- */}
        <div className="p-4 bg-white font-mono text-[11px] text-slate-900 printable select-text leading-tight">
          {/* Header */}
          <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-0.5">
            <PharmacyLogo
              logoUrl={pharmacy?.logo_data || pharmacy?.logo_url}
              name={pharmacyName}
              size="xs"
              className="mx-auto mb-1"
            />
            <div className="font-bold text-sm uppercase tracking-tight text-slate-950">
              {pharmacyName}
            </div>
            {pharmacySlogan && (
              <div className="text-[9px] text-slate-500 italic">{pharmacySlogan}</div>
            )}
            <div className="text-[10px] text-slate-600">
              {pharmacyAddress} {pharmacyPhone ? `· Tél: ${pharmacyPhone}` : ""}
            </div>
            {pharmacyLicense && (
              <div className="text-[9px] text-emerald-900 font-bold">
                Agrément n° {pharmacyLicense}
              </div>
            )}
          </div>

          {/* Compact Metadata */}
          <div className="py-1.5 text-[10px] border-b border-dashed border-slate-300 space-y-0.5 text-slate-700">
            <div className="flex justify-between">
              <span>#TC-{sale.id?.slice(0, 8).toUpperCase()}</span>
              <span>{new Date(sale.date || Date.now()).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
            <div className="flex justify-between">
              <span>Caisse: {cashierName}</span>
              <span>Règl: {getPaymentLabel(sale.payment_method)}</span>
            </div>
            {sale.customer_name && (
              <div className="flex justify-between text-slate-900 font-bold truncate">
                <span>Client:</span>
                <span className="truncate">{sale.customer_name}</span>
              </div>
            )}
            {sale.prescription_ref && (
              <div className="flex justify-between text-red-700 font-bold">
                <span>Réf. Ord (Rx):</span>
                <span>{sale.prescription_ref}</span>
              </div>
            )}
          </div>

          {/* Ultra-Dense Items (Single-line per product to save paper) */}
          <div className="py-1.5 space-y-1 border-b border-dashed border-slate-400">
            {items.map((item, idx) => {
              const prod = item.product || item;
              const name = prod.nom_commercial || prod.product_name || "Médicament";
              const qty = item.quantity || 1;
              const price = item.unit_price || prod.prix_vente || 0;
              const subtotal = item.subtotal || qty * price;
              const isRx = prod.requires_prescription || item.requires_prescription;

              return (
                <div key={idx} className="flex justify-between items-baseline text-[11px]">
                  <div className="truncate flex-1 pr-2">
                    <span className="font-semibold">{qty}x </span>
                    <span>{name}</span>
                    {isRx && <span className="text-red-700 font-bold text-[9px] ml-1">[🔴Rx]</span>}
                  </div>
                  <span className="font-bold font-mono text-right flex-shrink-0">
                    {formatXOF(subtotal)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Compact Total */}
          <div className="pt-2 pb-1.5 border-b border-dashed border-slate-400 space-y-0.5">
            <div className="flex justify-between items-baseline font-black text-sm text-slate-950">
              <span>TOTAL :</span>
              <span className="text-base text-primary font-mono" data-testid="receipt-total-value">
                {formatXOF(totalAmount)}
              </span>
            </div>

            {amountReceived > 0 && (
              <div className="text-[10px] text-slate-600 flex justify-between pt-0.5">
                <span>Reçu: {formatXOF(amountReceived)}</span>
                <span className="font-bold text-emerald-900">Rendu: {formatXOF(changeDue)}</span>
              </div>
            )}
          </div>

          {/* Ultra-Compact Footer */}
          <div className="pt-2 text-center text-[9px] text-slate-500 leading-tight space-y-0.5">
            <div className="font-medium text-slate-700">{footerMessage}</div>
            <div className="text-[8px] text-slate-400 italic">
              Médicaments vendus ni repris ni échangés.
            </div>
            <div className="text-[7px] text-slate-400 pt-1 tracking-widest uppercase">
              *TC-{sale.id?.slice(0, 8).toUpperCase()}*
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions (hidden in print) */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 print:hidden flex gap-2">
          <button
            onClick={() => window.print()}
            data-testid="print-receipt-btn"
            className="flex-1 bg-primary hover:bg-[#14532D] text-white py-2.5 px-3 rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 flex items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimer (80mm)
          </button>

          <button
            onClick={downloadPdf}
            disabled={downloading}
            data-testid="download-receipt-pdf"
            className="border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? "..." : "PDF"}</span>
          </button>

          <button
            onClick={onClose}
            className="border border-slate-200 hover:bg-slate-100 bg-white text-slate-700 py-2.5 px-3 rounded-xl text-xs font-bold transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
