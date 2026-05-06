import React from "react";
import { differenceInDays, parseISO } from "date-fns";
import { useI18n } from "@/i18n";

export function fefoStatus(expiryDate) {
  const today = new Date();
  const exp = typeof expiryDate === "string" ? parseISO(expiryDate) : expiryDate;
  const days = differenceInDays(exp, today);
  if (days < 0) return { level: "expired", days };
  if (days <= 90) return { level: "warn", days };
  return { level: "safe", days };
}

export default function FEFOBadge({ expiryDate, compact = false }) {
  const { t } = useI18n();
  const { level, days } = fefoStatus(expiryDate);
  const map = {
    safe: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    expired: "bg-red-50 text-red-700 border-red-200",
  };
  const label = level === "expired" ? t("fefo_expired") : level === "warn" ? t("fefo_warn") : t("fefo_safe");
  return (
    <span
      data-testid={`fefo-badge-${level}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${map[level]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {compact ? label : (
        <>
          {label} · {level === "expired" ? `${Math.abs(days)} ${t("days_expired")}` : `${days} ${t("days_remaining")}`}
        </>
      )}
    </span>
  );
}
