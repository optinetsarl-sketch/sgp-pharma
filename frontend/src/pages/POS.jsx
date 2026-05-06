import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Plus, Minus, Trash2, ShoppingCart, FileText, Printer, X, Download } from "lucide-react";
import { toast } from "sonner";
import FEFOBadge, { fefoStatus } from "@/components/FEFOBadge";

export default function POS() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]); // {product, quantity}
  const [customer, setCustomer] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [prescription, setPrescription] = useState("");
  const [prescriptionImage, setPrescriptionImage] = useState(null); // base64
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState(null);

  useEffect(() => { api.get("/products").then((r) => setProducts(r.data)); }, []);

  const filtered = useMemo(() => {
    if (!q) return products.slice(0, 30);
    const ql = q.toLowerCase();
    return products.filter((p) =>
      p.nom_commercial?.toLowerCase().includes(ql) ||
      p.dci?.toLowerCase().includes(ql) ||
      p.code_barre?.toLowerCase().includes(ql)
    ).slice(0, 30);
  }, [q, products]);

  const addToCart = (p) => {
    if ((p.stock_total || 0) === 0) { toast.error(t("no_stock")); return; }
    setCart((c) => {
      const ex = c.find((i) => i.product.id === p.id);
      if (ex) {
        if (ex.quantity + 1 > p.stock_total) { toast.error(t("insufficient_stock")); return c; }
        return c.map((i) => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...c, { product: p, quantity: 1 }];
    });
  };

  const updateQty = (pid, delta) => setCart((c) => c.map((i) => {
    if (i.product.id !== pid) return i;
    const newQ = i.quantity + delta;
    if (newQ <= 0) return null;
    if (newQ > i.product.stock_total) { toast.error(t("insufficient_stock")); return i; }
    return { ...i, quantity: newQ };
  }).filter(Boolean));

  const removeItem = (pid) => setCart((c) => c.filter((i) => i.product.id !== pid));

  const total = cart.reduce((s, i) => s + i.quantity * (i.product.prix_vente || 0), 0);
  const needsPrescription = cart.some((i) => i.product.requires_prescription);

  const finalize = async () => {
    if (cart.length === 0) return;
    if (needsPrescription && !prescription.trim() && !prescriptionImage) { toast.error("Référence ou photo d'ordonnance requise"); return; }
    setSubmitting(true);
    try {
      const items = cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity }));
      const { data } = await api.post("/sales", {
        items, payment_method: paymentMethod,
        customer_name: customer || null,
        prescription_ref: needsPrescription ? prescription : null,
        prescription_image: needsPrescription ? prescriptionImage : null,
      });
      toast.success(t("sale_success"));
      setLastSale({ ...data, _items: cart });
      setCart([]); setCustomer(""); setPrescription(""); setPrescriptionImage(null);
      api.get("/products").then((r) => setProducts(r.data));
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally { setSubmitting(false); }
  };

  const handlePrescriptionFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image trop volumineuse (max 2 Mo)"); return; }
    const reader = new FileReader();
    reader.onload = () => setPrescriptionImage(reader.result);
    reader.readAsDataURL(file);
  };

  const downloadReceipt = async () => {
    if (!lastSale) return;
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/sales/${lastSale.id}/receipt.pdf`;
    const token = localStorage.getItem("sgp_access_token");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ticket-${lastSale.id.slice(0, 8)}.pdf`;
    a.click();
  };

  const print = () => window.print();

  return (
    <div className="flex h-screen overflow-hidden" data-testid="pos-page">
      {/* Left: Product search */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="mb-4">
          <div className="label-tiny mb-1">{t("nav_pos")}</div>
          <h1 className="font-heading text-3xl font-black tracking-tight">{t("new_sale")}</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-3 flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            autoFocus
            data-testid="pos-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("barcode_search")}
            className="flex-1 outline-none text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const oos = (p.stock_total || 0) === 0;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={oos}
                data-testid={`pos-product-${p.id}`}
                className={`text-left bg-white border border-gray-200 rounded-md p-3 hover:border-primary hover:shadow-sm transition-all ${oos ? "opacity-40 cursor-not-allowed" : "hover:-translate-y-[1px]"}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-semibold text-sm leading-tight pr-2">{p.nom_commercial}</div>
                  {p.requires_prescription && <FileText className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                </div>
                <div className="text-xs text-muted-foreground mb-2">{p.dci}</div>
                <div className="flex justify-between items-end">
                  <span className="font-bold text-primary">{formatXOF(p.prix_vente)}</span>
                  <span className={`text-xs ${oos ? "text-red-600" : "text-muted-foreground"}`}>Stock: {p.stock_total || 0}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart */}
      <aside className="w-[380px] bg-white border-l border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-bold">{t("cart")}</h2>
          <span className="ml-auto text-sm text-muted-foreground">{cart.length} {t("items").toLowerCase()}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2" data-testid="pos-cart">
          {cart.length === 0 && <div className="text-center text-sm text-muted-foreground py-12">Panier vide</div>}
          {cart.map((i) => (
            <div key={i.product.id} className="border border-gray-200 rounded-md p-3" data-testid={`cart-item-${i.product.id}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-semibold leading-tight pr-2">{i.product.nom_commercial}</div>
                <button onClick={() => removeItem(i.product.id)} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(i.product.id, -1)} data-testid={`cart-dec-${i.product.id}`} className="w-7 h-7 border border-gray-200 rounded hover:bg-gray-50"><Minus className="w-3 h-3 mx-auto" /></button>
                  <span className="w-10 text-center font-bold" data-testid={`cart-qty-${i.product.id}`}>{i.quantity}</span>
                  <button onClick={() => updateQty(i.product.id, 1)} data-testid={`cart-inc-${i.product.id}`} className="w-7 h-7 border border-gray-200 rounded hover:bg-gray-50"><Plus className="w-3 h-3 mx-auto" /></button>
                </div>
                <span className="font-bold">{formatXOF(i.quantity * i.product.prix_vente)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 space-y-3">
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder={t("customer_name")} data-testid="pos-customer-input" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />

          {needsPrescription && (
            <div className="space-y-2">
              <label className="label-tiny block text-amber-700">⚠ {t("prescription_required")}</label>
              <input value={prescription} onChange={(e) => setPrescription(e.target.value)} data-testid="pos-prescription-input" placeholder="Réf. ordonnance (texte)" className="w-full px-3 py-2 border border-amber-300 bg-amber-50 rounded-md text-sm" />
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer text-xs px-3 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-md text-amber-800 text-center font-semibold">
                  📷 {prescriptionImage ? "Photo chargée ✓" : "Joindre photo ordonnance"}
                  <input type="file" accept="image/*" onChange={handlePrescriptionFile} data-testid="pos-prescription-file" className="hidden" />
                </label>
                {prescriptionImage && <button onClick={() => setPrescriptionImage(null)} className="text-xs text-red-600 hover:underline">Retirer</button>}
              </div>
              {prescriptionImage && (
                <img src={prescriptionImage} alt="ordonnance" className="w-full h-20 object-cover rounded border border-amber-300" />
              )}
            </div>
          )}

          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} data-testid="pos-payment-select" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
            <option value="cash">{t("cash")}</option>
            <option value="card">{t("card")}</option>
            <option value="mobile">{t("mobile")}</option>
          </select>

          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="label-tiny">{t("total")}</span>
            <span className="text-2xl font-black font-heading text-primary" data-testid="pos-total">{formatXOF(total)}</span>
          </div>

          <button
            onClick={finalize}
            disabled={cart.length === 0 || submitting}
            data-testid="pos-finalize-btn"
            className="w-full bg-primary hover:bg-[#14532D] text-white font-bold py-3 rounded-md disabled:opacity-50 transition-all hover:-translate-y-[1px]"
          >
            {submitting ? "..." : t("finalize")}
          </button>
        </div>
      </aside>

      {lastSale && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" data-testid="receipt-modal">
          <div className="bg-white rounded-md w-full max-w-sm border border-gray-200 printable">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 print:hidden">
              <h2 className="font-heading font-bold">{t("receipt_title")}</h2>
              <button onClick={() => setLastSale(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 font-mono text-xs">
              <div className="text-center mb-3">
                <div className="font-bold">SGP-Pharma</div>
                <div className="text-[10px]">OPTINET SARLU - Lomé, Togo</div>
              </div>
              <div className="border-t border-dashed border-gray-300 pt-2 mb-2">
                <div>Ticket #{lastSale.id.slice(0, 8)}</div>
                <div>{new Date(lastSale.date).toLocaleString("fr-FR")}</div>
                {lastSale.customer_name && <div>{t("customer_name")}: {lastSale.customer_name}</div>}
                <div>{t("served_by")}: {user?.name}</div>
              </div>
              <div className="border-t border-dashed border-gray-300 pt-2 space-y-1">
                {lastSale._items?.map((i) => (
                  <div key={i.product.id} className="flex justify-between">
                    <span className="flex-1">{i.product.nom_commercial} x{i.quantity}</span>
                    <span>{formatXOF(i.quantity * i.product.prix_vente)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-gray-300 mt-2 pt-2 flex justify-between font-bold text-sm">
                <span>{t("total")}</span>
                <span>{formatXOF(lastSale.total_amount)}</span>
              </div>
              <div className="text-center mt-4 text-[10px]">{t("thank_you")}</div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2 print:hidden">
              <button onClick={() => setLastSale(null)} className="flex-1 border border-gray-200 rounded-md py-2 text-sm">{t("cancel")}</button>
              <button onClick={downloadReceipt} data-testid="download-receipt-pdf" className="flex-1 bg-primary text-white rounded-md py-2 text-sm font-semibold flex items-center justify-center gap-1"><Download className="w-4 h-4" /> PDF</button>
              <button onClick={print} data-testid="print-receipt-btn" className="flex-1 bg-emerald-700 text-white rounded-md py-2 text-sm font-semibold flex items-center justify-center gap-1"><Printer className="w-4 h-4" /> Imprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
