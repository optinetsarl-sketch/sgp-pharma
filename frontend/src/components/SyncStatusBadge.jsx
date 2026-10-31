import React, { useEffect, useState, useRef } from "react";
import { Cloud, CloudOff, RefreshCw, Database, CheckCircle2, AlertCircle, Server } from "lucide-react";
import api from "@/lib/api";

export default function SyncStatusBadge() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchStatus = async () => {
    try {
      const res = await api.get("/sync/status");
      setStatus(res.data);
    } catch (err) {
      // Si la requête échoue, marquer hors-ligne
      setStatus((prev) => ({
        ...(prev || {}),
        connected: false,
        last_error: "Impossible de joindre le service de synchronisation",
      }));
    }
  };

  useEffect(() => {
    fetchStatus();
    // Rafraîchir toutes les 10 secondes
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fermer le popover si clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleManualSync = async () => {
    setLoading(true);
    try {
      const res = await api.post("/sync/trigger");
      if (res.data?.status) {
        setStatus(res.data.status);
      } else {
        await fetchStatus();
      }
    } catch (err) {
      console.error("Erreur lors du déclenchement de la sync:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!status || !status.enabled) {
    return null;
  }

  const isOnline = status.connected;
  const isSyncing = status.is_syncing || loading;
  const pendingCount = status.pending_count || 0;

  // Format de l'heure du dernier sync
  const formatTime = (isoStr) => {
    if (!isoStr) return "Aucun transfert récent";
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton Pill */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all shadow-2xs ${
          isOnline
            ? pendingCount > 0
              ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
              : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
            : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
        }`}
        title="État de la synchronisation avec MongoDB Atlas"
      >
        {isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
        ) : isOnline ? (
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                pendingCount > 0 ? "bg-amber-400" : "bg-emerald-400"
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                pendingCount > 0 ? "bg-amber-500" : "bg-emerald-500"
              }`}
            ></span>
          </span>
        ) : (
          <CloudOff className="w-3.5 h-3.5 text-slate-500" />
        )}

        <span className="hidden md:inline font-medium text-[11px]">
          {isSyncing
            ? "Synchronisation..."
            : isOnline
            ? pendingCount > 0
              ? `${pendingCount} en attente Cloud`
              : "Cloud Atlas Sync"
            : "Mode Local (Hors-ligne)"}
        </span>
      </button>

      {/* Popover Panneau de Détails */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-3 px-4 z-50 text-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <span className="font-heading font-bold text-slate-800">Synchronisation MongoDB Atlas</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isOnline ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
              }`}
            >
              {isOnline ? "Connecté au Cloud" : "Hors-ligne"}
            </span>
          </div>

          <div className="py-2.5 space-y-2 text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" /> Cluster Atlas :
              </span>
              <span className="font-mono font-semibold text-slate-800 truncate max-w-[150px]" title={status.cluster}>
                {status.cluster || "Cluster Atlas"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> Base Cloud :
              </span>
              <span className="font-mono font-bold text-primary">{status.database}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Données en attente :
              </span>
              <span className={`font-bold ${pendingCount > 0 ? "text-amber-600" : "text-slate-700"}`}>
                {pendingCount} document(s)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Données synchronisées :
              </span>
              <span className="font-bold text-emerald-700">{status.synced_count || 0} document(s)</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              <span>Dernier transfert réussi :</span>
              <span className="font-medium text-slate-700">{formatTime(status.last_sync_time)}</span>
            </div>

            {status.last_error && !isOnline && (
              <div className="p-2 bg-red-50 text-red-700 rounded-lg text-[10px] leading-tight border border-red-100">
                ⚠️ Connexion Internet coupée. Vos saisies locales sont protégées et seront synchronisées au rétablissement.
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full py-2 px-3 bg-primary hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Synchronisation en cours..." : "Synchroniser maintenant"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
