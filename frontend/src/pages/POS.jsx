import React, { useEffect, useMemo, useRef, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, FileText, Printer, X, Download,
  Coins, Banknote, CheckCircle, RotateCcw, AlertCircle, ArrowRight, ShieldAlert, History
} from "lucide-react";
import { toast } from "sonner";
import FEFOBadge from "@/components/FEFOBadge";
import ReceiptModal from "@/components/ReceiptModal";

const QUICK_DENOMINATIONS = [500, 1000, 2000, 5000, 10000];

export default function POS() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]); // {product, quantity}
  const [customer, setCustomer] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [prescription, setPrescription] = useState("");
  const [prescriptionImage, setPrescriptionImage] = useState(null); // base64
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data || [])).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!q) return products.slice(0, 30);
    const ql = q.toLowerCase();
    return products.filter((p) =>
      p.nom_commercial?.toLowerCase().includes(ql) ||
      p.dci?.toLowerCase().includes(ql) ||
      p.code_barre?.toLowerCase().includes(ql)
    ).slice(0, 30);
  }, [q, products]);

  const addToCart = (p, qty = 1) => {
    if ((p.stock_total || 0) === 0) {
      toast.error(`${p.nom_commercial}: ${t("no_stock")}`);
      return;
    }
    setCart((c) => {
      const ex = c.find((i) => i.product.id === p.id);
      if (ex) {
        if (ex.quantity + qty > p.stock_total) {
          toast.error(`${p.nom_commercial}: ${t("insufficient_stock")}`);
          return c;
        }
        return c.map((i) => (i.product.id === p.id ? { ...i, quantity: i.quantity + qty } : i));
      }
      return [...c, { product: p, quantity: qty }];
    });
  };

  // Barcode scanner auto-detect on Enter
  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!q.trim()) return;
      
      const exactBarcode = products.find((p) => p.code_barre?.toLowerCase() === q.trim().toLowerCase());
      if (exactBarcode) {
        addToCart(exactBarcode, 1);
        setQ("");
        toast.success(`Ajouté : ${exactBarcode.nom_commercial}`);
        return;
      }

      if (filtered.length === 1) {
        addToCart(filtered[0], 1);
        setQ("");
        toast.success(`Ajouté : ${filtered[0].nom_commercial}`);
      }
    }
  };

  const updateQty = (pid, delta) => setCart((c) => c.map((i) => {
    if (i.product.id !== pid) return i;
    const newQ = i.quantity + delta;
    if (newQ <= 0) return null;
    if (newQ > i.product.stock_total) {
      toast.error(t("insufficient_stock"));
      return i;
    }
    return { ...i, quantity: newQ };
  }).filter(Boolean));

  const setExactQty = (pid, val, maxStock) => {
    const parsed = parseInt(val) || 0;
    if (parsed <= 0) return;
    if (parsed > maxStock) {
      toast.error(t("insufficient_stock"));
      return;
    }
    setCart((c) => c.map((i) => (i.product.id === pid ? { ...i, quantity: parsed } : i)));
  };

  const removeItem = (pid) => setCart((c) => c.filter((i) => i.product.id !== pid));

  const clearCart = () => {
    setCart([]);
    setCustomer("");
    setPrescription("");
    setPrescriptionImage(null);
    setAmountReceived("");
    searchInputRef.current?.focus();
  };

  const total = cart.reduce((s, i) => s + i.quantity * (i.product.prix_vente || 0), 0);
  const needsPrescription = cart.some((i) => i.product.requires_prescription);

  // Change calculation
  const parsedReceived = parseFloat(amountReceived) || 0;
  const changeDue = parsedReceived > 0 ? parsedReceived - total : 0;

  const handleQuickAmount = (val) => {
    const current = parseFloat(amountReceived) || 0;
    setAmountReceived((current + val).toString());
  };

  const handleExactAmount = () => {
    setAmountReceived(total.toString());
  };

  const finalize = async () => {
    if (cart.length === 0) return;
    if (needsPrescription && !prescription.trim() && !prescriptionImage) {
      setShowPrescriptionModal(true);
      return;
    }
    setSubmitting(true);
    try {
      const items = cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity }));
      const { data } = await api.post("/sales", {
        items,
        payment_method: paymentMethod,
        customer_name: customer || null,
        prescription_ref: needsPrescription ? prescription : null,
        prescription_image: needsPrescription ? prescriptionImage : null,
      });
      toast.success(t("sale_success"));
      setLastSale({ ...data, _items: cart, _amountReceived: parsedReceived, _changeDue: changeDue });
      setCart([]);
      setCustomer("");
      setPrescription("");
      setPrescriptionImage(null);
      setAmountReceived("");
      setShowPrescriptionModal(false);
      api.get("/products").then((r) => setProducts(r.data));
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard shortcut inside POS (Ctrl+Enter to finalize)
  useEffect(() => {
    const handlePOSShortcuts = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        finalize();
      }
      if (e.key === "Escape" && lastSale) {
        setLastSale(null);
      }
    };
    window.addEventListener("keydown", handlePOSShortcuts);
    return () => window.removeEventListener("keydown", handlePOSShortcuts);
  }, [cart, prescription, prescriptionImage, customer, paymentMethod, lastSale]);

  const handlePrescriptionFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 2 Mo)");
      return;
    }
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
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-5rem)] -m-2" data-testid="pos-page">
      {/* Left: Product Catalog & Search */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="label-tiny mb-0.5 text-primary font-bold">{t("nav_pos")} · POINT DE VENTE</div>
            <h1 className="font-heading text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
              {t("new_sale")}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/sales")}
              className="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-950 border border-emerald-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Consulter le journal des ventes et réimprimer des tickets (F8)"
            >
              <History className="w-4 h-4 text-primary" />
              <span>Journal Ventes (F8)</span>
            </button>
            <div className="text-xs text-slate-500 font-medium hidden sm:flex items-center gap-2">
              <span>Validation :</span>
              <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">Ctrl + Entrée</kbd>
            </div>
          </div>
        </div>

        {/* Scan Barcode / Search Box */}
        <div className="bg-white border-2 border-emerald-500/40 focus-within:border-primary rounded-xl p-2.5 flex items-center gap-3 shadow-sm transition-all">
          <div className="w-9 h-9 bg-emerald-50 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <input
            ref={searchInputRef}
            autoFocus
            data-testid="pos-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Scannez un code-barres ou tapez nom / DCI (Appuyez sur Entrée)..."
            className="flex-1 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto max-h-[60vh] lg:max-h-[68vh] pr-1">
          {filtered.length === 0 && (
            <div className="col-span-full bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400">
              Aucun produit correspondant trouvé
            </div>
          )}
          {filtered.map((p) => {
            const oos = (p.stock_total || 0) === 0;
            const inCart = cart.find((i) => i.product.id === p.id);
            const isRx = p.requires_prescription;

            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={oos}
                data-testid={`pos-product-${p.id}`}
                className={`text-left bg-white border rounded-xl p-3.5 transition-all relative flex flex-col justify-between ${
                  oos
                    ? "opacity-45 bg-slate-50 border-slate-200 cursor-not-allowed"
                    : inCart
                    ? isRx
                      ? "border-red-500 ring-2 ring-red-400/30 bg-red-50/20 shadow-xs"
                      : "border-primary ring-2 ring-primary/20 shadow-xs hover:shadow-md"
                    : isRx
                    ? "border-red-300 bg-red-50/20 hover:border-red-500 hover:shadow-sm hover:-translate-y-0.5"
                    : "border-slate-200 hover:border-primary/60 hover:shadow-sm hover:-translate-y-0.5"
                }`}
              >
                {inCart && (
                  <span className={`absolute -top-2 -right-2 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md ${
                    isRx ? "bg-red-600" : "bg-primary"
                  }`}>
                    {inCart.quantity}
                  </span>
                )}

                <div>
                  <div className="flex justify-between items-start mb-1.5 gap-2">
                    <div className={`font-bold text-sm leading-tight ${isRx ? "text-red-950" : "text-slate-900"}`}>
                      {p.nom_commercial}
                    </div>
                    {isRx ? (
                      <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0 shadow-2xs" title="Ordonnance médicale obligatoire">
                        <FileText className="w-3 h-3" /> Rx Obligatoire
                      </span>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                        Libre
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-1 mb-1">
                    {p.dci || "—"} {p.forme_pharmaceutique ? `• ${p.forme_pharmaceutique}` : ""}
                  </div>

                  {/* FEFO Earliest Expiry Indicator */}
                  {p.earliest_expiry ? (
                    <div className="text-[10px] bg-emerald-50/80 border border-emerald-200/60 rounded px-1.5 py-0.5 text-emerald-900 font-mono flex items-center justify-between mt-1">
                      <span>FEFO : {p.earliest_batch || "Lot actif"}</span>
                      <span className="font-bold">Exp: {p.earliest_expiry}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic mt-1">
                      Aucun lot actif
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-end pt-2 border-t border-slate-100 mt-2">
                  <span className={`font-black text-base font-heading ${isRx ? "text-red-700" : "text-primary"}`}>
                    {formatXOF(p.prix_vente)}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    oos ? "bg-red-50 text-red-600" : (p.stock_total || 0) <= (p.seuil_alerte_stock || 10) ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    Stock: {p.stock_total || 0}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart & Checkout Panel */}
      <aside className="w-full lg:w-[420px] bg-white border border-slate-200/90 rounded-2xl flex flex-col shadow-lg shadow-slate-200/40">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-slate-900">{t("cart")}</h2>
              <div className="text-[11px] text-slate-500">{cart.reduce((s, i) => s + i.quantity, 0)} unité(s)</div>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
            >
              <RotateCcw className="w-3 h-3" /> Vider
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 max-h-[300px]" data-testid="pos-cart">
          {cart.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <div className="text-sm font-medium">Panier vide</div>
              <div className="text-xs text-slate-400 mt-0.5">Scannez ou sélectionnez un article</div>
            </div>
          )}

          {cart.map((i) => {
            const isRx = i.product.requires_prescription;

            return (
              <div
                key={i.product.id}
                className={`border rounded-xl p-3 transition-colors ${
                  isRx
                    ? "border-red-300 bg-red-50/30"
                    : "border-slate-200 bg-slate-50/40 hover:bg-white"
                }`}
                data-testid={`cart-item-${i.product.id}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <div className={`text-xs font-bold leading-tight pr-2 ${isRx ? "text-red-950" : "text-slate-900"}`}>
                      {i.product.nom_commercial}
                    </div>
                    {isRx && (
                      <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 mt-1">
                        Ordonnance Requise
                      </span>
                    )}
                    {i.product.earliest_expiry && (
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Sortie FEFO : <span className="font-semibold text-emerald-900">{i.product.earliest_batch || "Auto"}</span> (Exp: {i.product.earliest_expiry})
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(i.product.id)}
                    className="text-slate-400 hover:text-red-600 p-0.5"
                    title="Retirer l'article"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                    <button
                      onClick={() => updateQty(i.product.id, -1)}
                      data-testid={`cart-dec-${i.product.id}`}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-700 font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={i.product.stock_total}
                      value={i.quantity}
                      onChange={(e) => setExactQty(i.product.id, e.target.value, i.product.stock_total)}
                      data-testid={`cart-qty-${i.product.id}`}
                      className="w-10 text-center font-bold text-xs bg-transparent outline-none"
                    />
                    <button
                      onClick={() => updateQty(i.product.id, 1)}
                      data-testid={`cart-inc-${i.product.id}`}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-700 font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-xs ${isRx ? "text-red-700" : "text-slate-900"}`}>
                      {formatXOF(i.quantity * i.product.prix_vente)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {formatXOF(i.product.prix_vente)} / u
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Customer & Prescription & Payment */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-3 rounded-b-2xl">
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder={t("customer_name") + " (Optionnel)"}
            data-testid="pos-customer-input"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
          />

          {/* Prescription banner if controlled drugs are in cart */}
          {needsPrescription && (
            <div className="p-3 bg-red-50 border-2 border-red-300 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-900">
                  <ShieldAlert className="w-4 h-4 text-red-600 animate-pulse" />
                  <span>Ordonnance Requise</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrescriptionModal(true)}
                  className="text-[11px] font-bold text-red-700 hover:text-red-900 underline"
                >
                  {prescription || prescriptionImage ? "Modifier" : "Renseigner"}
                </button>
              </div>

              {prescription ? (
                <div className="text-[11px] font-semibold text-slate-700 bg-white p-2 rounded-lg border border-red-200 truncate">
                  Réf : <span className="text-red-900 font-bold">{prescription}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPrescriptionModal(true)}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Saisir la Réf. ou Photo d'Ordonnance</span>
                </button>
              )}

              {prescriptionImage && (
                <div className="flex items-center gap-2 text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                  <span>Photo d'ordonnance attachée</span>
                  <button
                    type="button"
                    onClick={() => setPrescriptionImage(null)}
                    className="text-red-600 hover:underline ml-auto font-bold"
                  >
                    Retirer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Payment Method */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "cash", label: t("cash"), icon: Coins },
              { key: "mobile", label: t("mobile"), icon: Banknote },
              { key: "card", label: t("card"), icon: CheckCircle },
            ].map((pm) => (
              <button
                key={pm.key}
                type="button"
                onClick={() => setPaymentMethod(pm.key)}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  paymentMethod === pm.key
                    ? "bg-primary text-white border-primary shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <pm.icon className="w-3.5 h-3.5" /> {pm.label}
              </button>
            ))}
          </div>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            data-testid="pos-payment-select"
            className="hidden"
          >
            <option value="cash">{t("cash")}</option>
            <option value="card">{t("card")}</option>
            <option value="mobile">{t("mobile")}</option>
          </select>

          {/* Cash Change Calculator for Cashier */}
          {paymentMethod === "cash" && total > 0 && (
            <div className="p-2.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-900">{t("amount_received")} (FCFA)</span>
                <button
                  type="button"
                  onClick={handleExactAmount}
                  className="text-[10px] font-bold text-emerald-700 hover:underline bg-white px-2 py-0.5 rounded border border-emerald-200"
                >
                  {t("exact_amount")}
                </button>
              </div>

              <input
                type="number"
                min="0"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder="Montant donné par le client..."
                className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-sm font-bold font-mono text-emerald-950 outline-none"
              />

              {/* Fast Denomination Buttons */}
              <div className="flex items-center gap-1 flex-wrap">
                {QUICK_DENOMINATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleQuickAmount(d)}
                    className="px-2 py-0.5 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold"
                  >
                    +{d}
                  </button>
                ))}
              </div>

              {/* Change Due Display */}
              {parsedReceived > 0 && (
                <div className={`p-2 rounded-lg text-xs flex justify-between items-center ${
                  parsedReceived >= total
                    ? "bg-emerald-100/90 text-emerald-900 font-bold"
                    : "bg-red-50 text-red-700 font-bold"
                }`}>
                  <span>{parsedReceived >= total ? t("change_due") : "Reste à payer"} :</span>
                  <span className="text-sm font-black font-mono">
                    {formatXOF(Math.abs(changeDue))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Total & Finalize Button */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("total")}</span>
              <span className="text-2xl font-black font-heading text-primary" data-testid="pos-total">
                {formatXOF(total)}
              </span>
            </div>

            <button
              onClick={finalize}
              disabled={cart.length === 0 || submitting}
              data-testid="pos-finalize-btn"
              className="w-full bg-primary hover:bg-[#14532D] text-white font-bold py-3.5 rounded-xl shadow-md shadow-emerald-900/10 disabled:opacity-50 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 text-sm"
            >
              <span>{submitting ? "Traitement en cours..." : t("finalize")}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Centered Modal for Prescription Required Alert */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border-2 border-red-500 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 p-5 text-white flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs flex-shrink-0">
                  <ShieldAlert className="w-7 h-7 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                    <span>🔴 Ordonnance Médicale Obligatoire</span>
                  </h3>
                  <p className="text-xs text-red-100 mt-0.5 font-medium">
                    Médicaments sous contrôle réglementaire strict
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Alert Callout */}
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-950 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-red-900">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>Délivrance réglementée en officine</span>
                </div>
                <p>
                  Ce panier contient des médicaments de liste (Tableau A, B ou stupéfiants).
                  Pour valider l'encaissement et imprimer le ticket, vous devez <strong>enregistrer la référence de l'ordonnance</strong> ou <strong>joindre sa photo</strong>.
                </p>
              </div>

              {/* List of Controlled Items in Cart */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Médicament(s) sous ordonnance dans ce panier :
                </label>
                <div className="max-h-28 overflow-y-auto space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  {cart
                    .filter((item) => item.product.requires_prescription)
                    .map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-white rounded-lg border border-red-200 shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded flex-shrink-0">
                            🔴 Rx
                          </span>
                          <span className="font-bold text-slate-900 truncate">
                            {item.product.nom_commercial}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-700 flex-shrink-0 ml-2 bg-slate-100 px-2 py-0.5 rounded">
                          Qté : {item.quantity}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Prescription Reference Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Numéro / Réf. Ordonnance ou Médecin Prescripteur *</span>
                  <span className="text-[10px] text-red-600 font-bold">(Requis si pas de photo)</span>
                </label>
                <input
                  autoFocus
                  required
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  placeholder="ex: ORD-2026-889 · Dr. Koffi (Clinique Espoir)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-red-300 focus:border-red-600 focus:bg-white rounded-xl text-xs font-semibold text-slate-900 outline-none transition-all shadow-inner placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>

              {/* Photo Upload Attachment */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Photo / Scan de l'Ordonnance</span>
                  <span className="text-[10px] text-slate-400 font-medium">Recommandé</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-3.5 py-2.5 border-2 border-dashed border-slate-300 hover:border-primary bg-slate-50 hover:bg-emerald-50/50 rounded-xl text-xs font-bold text-slate-700 transition-colors">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>{prescriptionImage ? "✓ Photo attachée avec succès" : "Prendre / Joindre une photo (Max 2 Mo)"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePrescriptionFile}
                      className="hidden"
                    />
                  </label>
                  {prescriptionImage && (
                    <button
                      type="button"
                      onClick={() => setPrescriptionImage(null)}
                      className="px-3 py-2.5 text-xs text-red-600 hover:bg-red-50 rounded-xl font-bold border border-red-200 transition-colors"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
                {prescriptionImage && (
                  <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 max-h-32 bg-slate-900/5">
                    <img
                      src={prescriptionImage}
                      alt="Aperçu ordonnance"
                      className="w-full h-32 object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Patient Name (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Nom du Patient / Client (Optionnel) :
                </label>
                <input
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="ex: M. KOFFI Jean-Pierre"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors"
              >
                Annuler / Modifier le panier
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!prescription.trim() && !prescriptionImage) {
                    toast.error("Veuillez saisir le N° d'ordonnance ou joindre une photo");
                    return;
                  }
                  finalize();
                }}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-lg shadow-emerald-900/20 flex items-center gap-2 transition-all transform active:scale-95"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{submitting ? "Encaissement..." : "Valider l'Ordonnance & Encaisser"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal Component */}
      {lastSale && (
        <ReceiptModal
          sale={lastSale}
          onClose={() => setLastSale(null)}
        />
      )}
    </div>
  );
}
