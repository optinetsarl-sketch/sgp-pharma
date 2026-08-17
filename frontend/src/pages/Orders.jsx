import React, { useEffect, useMemo, useState } from "react";
import api, { formatXOF, formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n";
import {
  Plus, Trash2, X, Download, ClipboardList, Filter, Search, FileText,
  MapPin, Building2, Sparkles, Navigation, Phone, Mail
} from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";
import { CAMEG_PRA_LIST, TOGO_REGIONS, getNearestPra } from "@/lib/praConfig";

export default function Orders() {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pharmacyInfo, setPharmacyInfo] = useState(null);
  const [targetPraId, setTargetPraId] = useState("cameg-lome-centrale");
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lines, setLines] = useState([{ product_id: "", quantity: 1, unit_price: 0 }]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reload = () => api.get("/purchase-orders").then((r) => setOrders(r.data || [])).catch(() => {});

  useEffect(() => {
    reload();
    api.get("/products").then((r) => setProducts(r.data || [])).catch(() => {});
    api.get("/suppliers").then((r) => setSuppliers(r.data || [])).catch(() => {});
    api.get("/pharmacy/current").then((r) => {
      if (r.data) {
        setPharmacyInfo(r.data);
        const nearest = getNearestPra(r.data.city || r.data.region || r.data.address);
        setTargetPraId(r.data.default_pra_id || nearest.id);
      }
    }).catch(() => {});
  }, []);

  const total = lines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseInt(l.quantity) || 0), 0);

  const selectedPra = useMemo(() => {
    return CAMEG_PRA_LIST.find((p) => p.id === targetPraId) || CAMEG_PRA_LIST[0];
  }, [targetPraId]);

  const openNewOrder = () => {
    const nearest = getNearestPra(pharmacyInfo?.city || pharmacyInfo?.region || pharmacyInfo?.address);
    setTargetPraId(pharmacyInfo?.default_pra_id || nearest.id);
    const cameg = suppliers.find((s) => s.raison_sociale?.toLowerCase().includes("cameg"));
    if (cameg) {
      setSupplierId(cameg.id);
    } else if (suppliers.length > 0) {
      setSupplierId(suppliers[0].id);
    }
    setLines([{ product_id: "", quantity: 1, unit_price: 0 }]);
    setNotes("");
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Veuillez sélectionner un fournisseur");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        supplier_id: supplierId,
        target_pra_id: selectedPra.id,
        target_pra_name: selectedPra.name,
        target_pra_city: selectedPra.city,
        delivery_city: pharmacyInfo?.city || "Togo",
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: parseInt(l.quantity),
          unit_price: parseFloat(l.unit_price),
        })),
        notes,
      };
      await api.post("/purchase-orders", payload);
      toast.success(t("saved"));
      setShowForm(false);
      setSupplierId("");
      setLines([{ product_id: "", quantity: 1, unit_price: 0 }]);
      setNotes("");
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (oid, status) => {
    try {
      await api.put(`/purchase-orders/${oid}/status`, null, { params: { status } });
      toast.success("Statut de la commande mis à jour");
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const supplierName = (sid) => suppliers.find((s) => s.id === sid)?.raison_sociale || "?";

  const downloadPdf = async (oid) => {
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/purchase-orders/${oid}/pdf`;
    const token = localStorage.getItem("sgp_access_token");
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Erreur PDF");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `bon-commande-${oid.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Téléchargement du bon de commande démarré");
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const getStatusBadge = (st) => {
    switch (st) {
      case "draft":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "validated":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "received":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "cancelled":
        return "bg-red-50 text-red-800 border-red-200";
      default:
        return "bg-amber-50 text-amber-800 border-amber-200";
    }
  };

  return (
    <div className="space-y-6" data-testid="orders-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="label-tiny mb-1 text-primary font-bold">{t("nav_orders")} · APPROVISIONNEMENT</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Bons de Commande Fournisseurs
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Génération et suivi des commandes d'achat avec export PDF A4 certifié
          </p>
        </div>

        <button
          onClick={openNewOrder}
          data-testid="add-order-btn"
          className="bg-primary hover:bg-[#14532D] text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-md shadow-emerald-900/10 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> {t("create_order")}
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 bg-white border border-slate-200 rounded-xl p-1.5 shadow-2xs">
        {[
          { id: "all", label: "Toutes" },
          { id: "draft", label: "Brouillons" },
          { id: "validated", label: "Validées" },
          { id: "received", label: "Reçues" },
          { id: "cancelled", label: "Annulées" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === tab.id
                ? "bg-primary text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">{t("date")}</th>
                <th className="px-4 py-3">{t("supplier")} & Destination PRA</th>
                <th className="px-4 py-3 text-right">{t("items_count")}</th>
                <th className="px-4 py-3 text-right">{t("total")}</th>
                <th className="px-4 py-3">{t("status")}</th>
                <th className="px-4 py-3 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <div>{t("no_data")}</div>
                  </td>
                </tr>
              )}

              {filteredOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600 font-semibold">
                    {new Date(o.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">
                      {supplierName(o.supplier_id)}
                    </div>
                    {o.target_pra_name ? (
                      <div className="text-[10px] text-emerald-800 font-bold flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <span>{o.target_pra_name}</span>
                      </div>
                    ) : (
                      o.delivery_city && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          Livraison : {o.delivery_city}
                        </div>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-slate-700">
                    {o.items.length} réf.
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                    {formatXOF(o.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(o.status)}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => downloadPdf(o.id)}
                        data-testid={`download-order-pdf-${o.id}`}
                        aria-label="Télécharger PDF"
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                        title="Télécharger le bon de commande en PDF"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>

                      <select
                        value={o.status}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                        data-testid={`order-status-${o.id}`}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 focus:bg-white"
                      >
                        <option value="draft">Brouillon (draft)</option>
                        <option value="validated">Validé (validated)</option>
                        <option value="partial">Partiel (partial)</option>
                        <option value="received">Reçu (received)</option>
                        <option value="closed">Clôturé (closed)</option>
                        <option value="cancelled">Annulé (cancelled)</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Order Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl border border-slate-200 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h2 className="font-heading text-lg font-bold text-slate-900">{t("create_order")}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                  {t("supplier")}
                </label>
                <SearchableSelect
                  required
                  value={supplierId}
                  onChange={(val) => setSupplierId(val)}
                  placeholder="— Sélectionner ou rechercher un fournisseur —"
                  searchPlaceholder="Rechercher par nom, contact..."
                  data-testid="order-supplier-select"
                  options={suppliers.map((s) => ({
                    value: s.id,
                    label: s.raison_sociale,
                    sublabel: s.contact ? `Contact : ${s.contact}` : (s.telephone || ""),
                  }))}
                />
              </div>

              {/* Regional PRA Routing Selector */}
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-2xs">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                        <span>Pharmacie Régionale d'Approvisionnement (PRA) CAMEG</span>
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium">
                        Rattachement automatique selon votre ville (<strong>{pharmacyInfo?.city || "Lomé"}</strong>). Vous pouvez choisir une autre agence au choix.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-200/80 text-emerald-950 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                    {selectedPra.region}
                  </span>
                </div>

                <div>
                  <SearchableSelect
                    value={targetPraId}
                    onChange={(val) => setTargetPraId(val)}
                    placeholder="— Choisir la PRA de destination —"
                    searchPlaceholder="Rechercher PRA, ville, région..."
                    options={CAMEG_PRA_LIST.map((pra) => ({
                      value: pra.id,
                      label: pra.name,
                      sublabel: `Tél: ${pra.telephone} · ${pra.address}`,
                    }))}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-emerald-800 font-medium pt-1.5 border-t border-emerald-200/70 gap-2">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-700" /> Adresse agence : <strong className="ml-0.5">{selectedPra.address}</strong></span>
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-emerald-700" /> {selectedPra.telephone}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-emerald-700" /> {selectedPra.email}</span>
                  </span>
                </div>
              </div>

              {/* Order Lines */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100/80 text-left text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Médicament</th>
                      <th className="px-3 py-2.5 w-24 text-right">Qté</th>
                      <th className="px-3 py-2.5 w-32 text-right">Prix d'achat unitaire</th>
                      <th className="px-2 py-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2">
                          <SearchableSelect
                            required
                            value={l.product_id}
                            onChange={(val) =>
                              setLines(
                                lines.map((x, idx) =>
                                  idx === i ? { ...x, product_id: val } : x
                                )
                              )
                            }
                            placeholder="— Sélectionner ou rechercher médicament —"
                            searchPlaceholder="Rechercher médicament..."
                            data-testid={`order-line-product-${i}`}
                            options={products.map((p) => ({
                              value: p.id,
                              label: p.nom_commercial,
                              sublabel: p.dci || "",
                              isRx: p.requires_prescription,
                            }))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            required
                            type="number"
                            min="1"
                            value={l.quantity}
                            onChange={(e) =>
                              setLines(
                                lines.map((x, idx) =>
                                  idx === i ? { ...x, quantity: e.target.value } : x
                                )
                              )
                            }
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-mono font-bold text-xs text-slate-900"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.unit_price}
                            onChange={(e) =>
                              setLines(
                                lines.map((x, idx) =>
                                  idx === i ? { ...x, unit_price: e.target.value } : x
                                )
                              )
                            }
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-mono font-bold text-xs text-slate-900"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                              className="text-slate-400 hover:text-red-600 p-1"
                              title="Supprimer la ligne"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => setLines([...lines, { product_id: "", quantity: 1, unit_price: 0 }])}
                className="text-xs text-primary font-bold flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> {t("add_line")}
              </button>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                  Notes / Instructions de livraison
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ex: Livraison urgente sous 48h..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  rows={2}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase">{t("total")} Commande : </span>
                  <span className="font-heading font-black text-xl text-primary">{formatXOF(total)}</span>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    data-testid="submit-order"
                    className="flex-1 sm:flex-none bg-primary hover:bg-[#14532D] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 disabled:opacity-50"
                  >
                    {submitting ? "Enregistrement..." : t("save")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
