import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, FileText, Printer, X, Download,
  Coins, Banknote, CheckCircle, RotateCcw, AlertCircle, ArrowRight, ShieldAlert, History,
  Send, Ticket, Clock, UserCheck, RefreshCw, Layers, Link as LinkIcon, Unlink, Sparkles, QrCode
} from "lucide-react";
import { toast } from "sonner";
import FEFOBadge from "@/components/FEFOBadge";
import ReceiptModal from "@/components/ReceiptModal";

const QUICK_DENOMINATIONS = [500, 1000, 2000, 5000, 10000];

export default function POS() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOperator = user?.role === "operator";

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

  // Pre-sales / Live Queue State
  const [pendingPresales, setPendingPresales] = useState([]);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [ticketSearchCode, setTicketSearchCode] = useState("");
  const [activePresale, setActivePresale] = useState(null); // { id, ticket_number, operator_name, ... }
  const [presaleSuccessModal, setPresaleSuccessModal] = useState(null); // { ticket_number, total_amount, ... }
  const [loadingQueue, setLoadingQueue] = useState(false);

  const searchInputRef = useRef(null);
  const ticketInputRef = useRef(null);

  // Fetch product catalog
  const loadProducts = useCallback(() => {
    api.get("/products").then((r) => setProducts(r.data || [])).catch(() => {});
  }, []);

  // Fetch pending pre-sales queue
  const loadPendingPresales = useCallback(() => {
    if (isOperator) return;
    setLoadingQueue(true);
    api.get("/presales/pending")
      .then((r) => setPendingPresales(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingQueue(false));
  }, [isOperator]);

  useEffect(() => {
    loadProducts();
    if (!isOperator) {
      loadPendingPresales();
      const interval = setInterval(loadPendingPresales, 10000);
      return () => clearInterval(interval);
    }
  }, [loadProducts, loadPendingPresales, isOperator]);

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

  // Barcode scanner auto-detect on Enter in search box
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
    setActivePresale(null);
    searchInputRef.current?.focus();
  };

  const total = cart.reduce((s, i) => s + i.quantity * (i.product.prix_vente || 0), 0);
  const needsPrescription = cart.some((i) => i.product.requires_prescription);

  // Change calculation (Cashier only)
  const parsedReceived = parseFloat(amountReceived) || 0;
  const changeDue = parsedReceived > 0 ? parsedReceived - total : 0;

  const handleQuickAmount = (val) => {
    const current = parseFloat(amountReceived) || 0;
    setAmountReceived((current + val).toString());
  };

  const handleExactAmount = () => {
    setAmountReceived(total.toString());
  };

  // --- RECALL PRE-SALE CART (CASHIER) ---
  const recallPresale = (ps) => {
    if (!ps || !ps.items) return;

    const rebuiltCart = [];
    let hasMissing = false;

    for (const item of ps.items) {
      const prod = products.find((p) => p.id === item.product_id);
      if (prod) {
        rebuiltCart.push({
          product: prod,
          quantity: item.quantity,
        });
      } else {
        // Fallback reconstructed product
        rebuiltCart.push({
          product: {
            id: item.product_id,
            nom_commercial: item.product_name,
            dci: item.dci || "",
            code_barre: item.code_barre || "",
            prix_vente: item.unit_price,
            stock_total: item.quantity,
            requires_prescription: item.requires_prescription || false,
          },
          quantity: item.quantity,
        });
        hasMissing = true;
      }
    }

    setCart(rebuiltCart);
    setCustomer(ps.customer_name || "");
    setPrescription(ps.prescription_ref || "");
    setPrescriptionImage(ps.prescription_image || null);
    setActivePresale(ps);
    setShowQueueModal(false);
    setTicketSearchCode("");

    toast.success(`Panier #${ps.ticket_number} rappelé avec succès ! (Vendeur : ${ps.operator_name})`);
    if (hasMissing) {
      loadProducts();
    }
  };

  // Fast recall by ticket code input or barcode scanner
  const handleRecallByCode = async (e) => {
    e?.preventDefault();
    const code = ticketSearchCode.trim();
    if (!code) return;

    try {
      const { data } = await api.get(`/presales/${encodeURIComponent(code)}`);
      recallPresale(data);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || `Ticket #${code} introuvable ou déjà encaissé`);
    }
  };

  // --- SUBMIT PRE-SALE (OPERATOR) ---
  const submitPresale = async () => {
    if (cart.length === 0) return;
    if (needsPrescription && !prescription.trim() && !prescriptionImage) {
      setShowPrescriptionModal(true);
      return;
    }
    setSubmitting(true);
    try {
      const items = cart.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: i.product.prix_vente,
        product_name: i.product.nom_commercial,
      }));

      const { data } = await api.post("/presales", {
        items,
        customer_name: customer || null,
        prescription_ref: needsPrescription ? prescription : null,
        prescription_image: needsPrescription ? prescriptionImage : null,
      });

      const ps = data.presale;
      setPresaleSuccessModal(ps);
      toast.success(`Ticket #${ps.ticket_number} transmis à la caisse !`);

      // Reset cart for next customer
      setCart([]);
      setCustomer("");
      setPrescription("");
      setPrescriptionImage(null);
      setShowPrescriptionModal(false);
      loadProducts();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  // --- FINALIZE SALE (CASHIER) ---
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
        presale_id: activePresale?.id || null,
      });

      toast.success(t("sale_success"));
      setLastSale({
        ...data,
        _items: cart,
        _amountReceived: parsedReceived,
        _changeDue: changeDue,
        _operatorName: activePresale?.operator_name || data.operator_name || null,
      });

      setCart([]);
      setCustomer("");
      setPrescription("");
      setPrescriptionImage(null);
      setAmountReceived("");
      setActivePresale(null);
      setShowPrescriptionModal(false);
      loadProducts();
      loadPendingPresales();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handlePOSShortcuts = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (isOperator) {
          submitPresale();
        } else {
          finalize();
        }
      }
      if (e.key === "Escape") {
        if (presaleSuccessModal) setPresaleSuccessModal(null);
        if (lastSale) setLastSale(null);
        if (showQueueModal) setShowQueueModal(false);
      }
      if (e.key === "F6" && !isOperator) {
        e.preventDefault();
        ticketInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handlePOSShortcuts);
    return () => window.removeEventListener("keydown", handlePOSShortcuts);
  }, [cart, prescription, prescriptionImage, customer, paymentMethod, lastSale, presaleSuccessModal, isOperator, showQueueModal]);

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

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-5rem)] -m-2" data-testid="pos-page">
      {/* Left: Product Catalog & Search & Live Queue */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="label-tiny mb-0.5 text-primary font-bold">
              {isOperator ? "GUICHET DE SAISIE & CONSEIL CLIENT · PRÉ-VENTE" : `${t("nav_pos")} · CAISSE ENREGISTREUSE`}
            </div>
            <h1 className="font-heading text-2xl lg:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <span>{isOperator ? "Préparation de Panier (Devis)" : t("new_sale")}</span>
              {isOperator && (
                <span className="text-xs bg-teal-100 text-teal-900 font-bold px-2.5 py-1 rounded-full border border-teal-300">
                  Opérateur Saisie
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Queue Button for Cashiers */}
            {!isOperator && (
              <button
                onClick={() => setShowQueueModal(true)}
                data-testid="open-queue-btn"
                className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-2xs border ${
                  pendingPresales.length > 0
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 animate-pulse"
                    : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                }`}
                title="Consulter les paniers en attente transmis par les opérateurs"
              >
                <Ticket className="w-4 h-4" />
                <span>Paniers en attente</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  pendingPresales.length > 0 ? "bg-white text-emerald-800" : "bg-slate-100 text-slate-600"
                }`}>
                  {pendingPresales.length}
                </span>
              </button>
            )}

            {!isOperator && (
              <button
                onClick={() => navigate("/sales")}
                className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                title="Consulter le journal des ventes et réimprimer des tickets (F8)"
              >
                <History className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">Journal Ventes (F8)</span>
              </button>
            )}

            <div className="text-xs text-slate-500 font-medium hidden md:flex items-center gap-2">
              <span>Valider :</span>
              <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">Ctrl + Entrée</kbd>
            </div>
          </div>
        </div>

        {/* Quick Ticket Recall Bar (For Cashier) */}
        {!isOperator && (
          <form
            onSubmit={handleRecallByCode}
            className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2 flex items-center gap-2 shadow-2xs"
          >
            <div className="w-7 h-7 bg-white text-emerald-800 rounded-lg flex items-center justify-center flex-shrink-0 shadow-2xs">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-emerald-950 whitespace-nowrap hidden sm:inline">
              Rappeler Ticket (F6) :
            </div>
            <input
              ref={ticketInputRef}
              value={ticketSearchCode}
              onChange={(e) => setTicketSearchCode(e.target.value)}
              placeholder="ex: PV-01, 1 ou scannez le coupon..."
              className="flex-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none uppercase font-mono"
            />
            <button
              type="submit"
              className="bg-primary hover:bg-[#14532D] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
            >
              <span>Charger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

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
                data-testid={`product-card-${p.id}`}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all relative group ${
                  oos
                    ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                    : inCart
                    ? "bg-emerald-50/50 border-primary shadow-xs ring-1 ring-emerald-500/30"
                    : "bg-white border-slate-200/90 hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-bold text-sm text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
                      {p.nom_commercial}
                    </span>
                    {isRx && (
                      <span className="text-[9px] font-extrabold bg-red-600 text-white px-1.5 py-0.5 rounded shadow-2xs flex-shrink-0">
                        🔴 Rx
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-1 italic mb-2">
                    {p.dci || p.forme || "—"}
                  </div>
                </div>

                <div className="flex items-end justify-between pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Prix public</span>
                    <span className="font-black font-heading text-sm text-slate-900">
                      {formatXOF(p.prix_vente)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">Dispo</span>
                    <span className={`text-xs font-bold ${
                      oos ? "text-red-600" : p.stock_total <= (p.seuil_alerte || 10) ? "text-amber-600" : "text-emerald-700"
                    }`}>
                      {oos ? "Épuisé" : `${p.stock_total} u.`}
                    </span>
                  </div>
                </div>

                {inCart && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-black shadow-md border-2 border-white">
                    {inCart.quantity}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart & Actions */}
      <aside className="w-full lg:w-96 flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden h-fit sticky top-20">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm text-slate-900">
              {isOperator ? "Panier de Pré-Vente" : t("cart")} ({cart.reduce((s, i) => s + i.quantity, 0)})
            </h2>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-slate-400 hover:text-red-600 flex items-center gap-1 font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Vider
            </button>
          )}
        </div>

        {/* Linked Ticket Banner (If recalled by Cashier) */}
        {!isOperator && activePresale && (
          <div className="p-3 bg-teal-50 border-b border-teal-200 text-xs text-teal-950 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <LinkIcon className="w-4 h-4 text-teal-700 flex-shrink-0" />
              <div className="truncate">
                <span className="font-black text-teal-900">Ticket #{activePresale.ticket_number}</span>
                <span className="text-[10px] text-teal-700 block truncate">Vendeur : {activePresale.operator_name}</span>
              </div>
            </div>
            <button
              onClick={() => setActivePresale(null)}
              className="text-[10px] text-teal-700 hover:text-red-600 font-bold bg-white px-2 py-1 rounded border border-teal-200 flex items-center gap-1 flex-shrink-0"
              title="Délier ce panier du ticket de pré-vente"
            >
              <Unlink className="w-3 h-3" /> Délier
            </button>
          </div>
        )}

        {/* Cart Lines */}
        <div className="p-3 space-y-2 max-h-[35vh] lg:max-h-[42vh] overflow-y-auto divide-y divide-slate-100">
          {cart.length === 0 && (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <ShoppingCart className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs">{isOperator ? "Sélectionnez des produits pour le client" : "Le panier est vide"}</p>
            </div>
          )}

          {cart.map((item) => (
            <div key={item.product.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs text-slate-900 truncate">
                    {item.product.nom_commercial}
                  </span>
                  {item.product.requires_prescription && (
                    <span className="text-[8px] bg-red-600 text-white font-extrabold px-1 rounded">
                      Rx
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {formatXOF(item.product.prix_vente)} × {item.quantity} ={" "}
                  <span className="font-bold text-slate-900">
                    {formatXOF(item.quantity * item.product.prix_vente)}
                  </span>
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => updateQty(item.product.id, -1)}
                  className="w-6 h-6 rounded-md bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min="1"
                  max={item.product.stock_total}
                  value={item.quantity}
                  onChange={(e) => setExactQty(item.product.id, e.target.value, item.product.stock_total)}
                  className="w-8 text-center text-xs font-bold bg-transparent outline-none"
                />
                <button
                  onClick={() => updateQty(item.product.id, 1)}
                  className="w-6 h-6 rounded-md bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={() => removeItem(item.product.id)}
                className="text-slate-300 hover:text-red-600 p-1 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Customer & Prescription Info */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {t("customer_name")} (Optionnel)
            </label>
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="ex: M. KOFFI Yao..."
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 outline-none focus:border-primary"
            />
          </div>

          {/* Prescription Alert if Rx in cart */}
          {needsPrescription && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-900">
                <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>Ordonnance requise (Rx)</span>
              </div>
              <input
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                placeholder="Réf. ordonnance / Dr..."
                className="w-full px-2 py-1 bg-white border border-red-300 rounded text-xs font-medium text-slate-900 outline-none"
              />
              <label className="cursor-pointer text-[10px] font-bold text-red-700 hover:underline flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>{prescriptionImage ? "✓ Photo attachée" : "+ Joindre photo ordonnance"}</span>
                <input type="file" accept="image/*" onChange={handlePrescriptionFile} className="hidden" />
              </label>
            </div>
          )}

          {/* Payment Method & Denominations (CASHIER ONLY) */}
          {!isOperator && (
            <>
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
            </>
          )}

          {/* Total & Action Button */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("total")}</span>
              <span className="text-2xl font-black font-heading text-primary" data-testid="pos-total">
                {formatXOF(total)}
              </span>
            </div>

            {isOperator ? (
              /* OPERATOR: SEND TO CASHIER BUTTON */
              <button
                onClick={submitPresale}
                disabled={cart.length === 0 || submitting}
                data-testid="pos-presale-btn"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-md shadow-teal-900/20 disabled:opacity-50 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 text-sm"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? "Transmission..." : "Valider & Envoyer en Caisse (F2)"}</span>
              </button>
            ) : (
              /* CASHIER: FINALIZE SALE BUTTON */
              <button
                onClick={finalize}
                disabled={cart.length === 0 || submitting}
                data-testid="pos-finalize-btn"
                className="w-full bg-primary hover:bg-[#14532D] text-white font-bold py-3.5 rounded-xl shadow-md shadow-emerald-900/10 disabled:opacity-50 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 text-sm"
              >
                <span>{submitting ? "Traitement en cours..." : t("finalize")}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* --- MODAL: LIVE QUEUE OF PENDING PRE-SALES (FOR CASHIER) --- */}
      {showQueueModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl">
                  <Ticket className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-heading text-lg font-black tracking-tight">
                    Paniers en Attente d'Encaissement
                  </h2>
                  <p className="text-xs text-emerald-200">
                    Paniers préparés aux guichets par les opérateurs de saisie
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQueueModal(false)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>{pendingPresales.length} panier(s) actif(s)</span>
                <button
                  onClick={loadPendingPresales}
                  className="text-primary hover:underline flex items-center gap-1 font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingQueue ? "animate-spin" : ""}`} /> Actualiser
                </button>
              </div>

              {pendingPresales.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Ticket className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="font-medium text-sm">Aucun panier en attente pour le moment</p>
                  <p className="text-xs text-slate-400">Les paniers validés par les opérateurs apparaîtront ici en direct.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingPresales.map((ps) => (
                    <div
                      key={ps.id}
                      className="p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 transition-all flex flex-col justify-between space-y-3 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg">
                              #{ps.ticket_number}
                            </span>
                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(ps.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {ps.customer_name && (
                            <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                              Client : {ps.customer_name}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Saisi par : <span className="font-semibold text-slate-700">{ps.operator_name}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black font-heading text-primary block">
                            {formatXOF(ps.total_amount)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {ps.items?.length || 0} article(s)
                          </span>
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100 max-h-20 overflow-y-auto space-y-0.5 text-slate-600">
                        {ps.items?.map((it, idx) => (
                          <div key={idx} className="flex justify-between truncate">
                            <span className="truncate">{it.quantity}x {it.product_name}</span>
                            <span className="font-mono text-slate-800 font-semibold ml-2">{formatXOF(it.subtotal)}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => recallPresale(ps)}
                        className="w-full bg-primary hover:bg-[#14532D] text-white py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-900/10"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Encaisser ce panier (1 clic)</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowQueueModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: OPERATOR PRESALE SUCCESS (TICKET NUMBER CONFIRMATION) --- */}
      {presaleSuccessModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border-2 border-teal-500 overflow-hidden text-center p-6 space-y-5 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle className="w-9 h-9 text-teal-700" />
            </div>

            <div>
              <div className="label-tiny text-teal-700 font-bold uppercase tracking-wider mb-1">
                Panier validé & transmis à la caisse
              </div>
              <h2 className="text-base font-bold text-slate-600">Numéro de Ticket Client :</h2>
              <div className="text-4xl sm:text-5xl font-black font-mono text-teal-900 bg-teal-50 border-2 border-teal-300 py-3 px-6 rounded-2xl my-3 inline-block shadow-inner">
                #{presaleSuccessModal.ticket_number}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Indiquez ce numéro au client pour qu'il effectue son règlement à la caisse.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Total à régler :</span>
                <span className="font-bold text-base font-heading text-primary font-mono">
                  {formatXOF(presaleSuccessModal.total_amount)}
                </span>
              </div>
              {presaleSuccessModal.customer_name && (
                <div className="flex justify-between text-slate-600">
                  <span>Client :</span>
                  <span className="font-bold text-slate-900">{presaleSuccessModal.customer_name}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Articles :</span>
                <span>{presaleSuccessModal.items?.length || 0} référence(s)</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer Coupon</span>
              </button>
              <button
                autoFocus
                onClick={() => {
                  setPresaleSuccessModal(null);
                  searchInputRef.current?.focus();
                }}
                className="flex-1 px-4 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-teal-900/20 transition-all hover:scale-[1.02]"
              >
                <span>Nouveau Client (F1)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Centered Modal for Prescription Required Alert */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border-2 border-red-500 overflow-hidden animate-in zoom-in-95 duration-150">
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

            <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-950 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-red-900">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>Délivrance réglementée en officine</span>
                </div>
                <p>
                  Ce panier contient des médicaments de liste. Vous devez enregistrer la référence de l'ordonnance ou joindre sa photo.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Numéro / Réf. Ordonnance ou Médecin Prescripteur *</span>
                </label>
                <input
                  autoFocus
                  required
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  placeholder="ex: ORD-2026-889 · Dr. Koffi (Clinique Espoir)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-red-300 focus:border-red-600 focus:bg-white rounded-xl text-xs font-semibold text-slate-900 outline-none transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Photo / Scan de l'Ordonnance</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-3.5 py-2.5 border-2 border-dashed border-slate-300 hover:border-primary bg-slate-50 hover:bg-emerald-50/50 rounded-xl text-xs font-bold text-slate-700 transition-colors">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>{prescriptionImage ? "✓ Photo attachée" : "Prendre / Joindre une photo"}</span>
                    <input type="file" accept="image/*" onChange={handlePrescriptionFile} className="hidden" />
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
              </div>
            </div>

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
                  if (isOperator) {
                    submitPresale();
                  } else {
                    finalize();
                  }
                }}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-lg shadow-emerald-900/20 flex items-center gap-2 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{submitting ? "Validation..." : "Valider l'Ordonnance & Continuer"}</span>
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
