import React, { useState } from "react";

/**
 * PharmacyLogo Component
 * Renders the custom pharmacy logo if uploaded, or the official universal
 * Green Pharmacy Cross (+) emblem by default.
 */
export default function PharmacyLogo({
  logoUrl,
  name = "Pharmacie",
  size = "md",
  className = "",
  showText = false,
}) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: "w-7 h-7 rounded-lg text-xs",
    sm: "w-10 h-10 rounded-xl text-sm",
    md: "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl text-base",
    lg: "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl text-xl",
    xl: "w-24 h-24 rounded-3xl text-2xl",
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;

  // Custom uploaded logo available and working
  if (logoUrl && !imageError) {
    return (
      <div className={`relative flex-shrink-0 flex items-center justify-center bg-white border border-slate-200 p-1 shadow-2xs overflow-hidden ${currentSizeClass} ${className}`}>
        <img
          src={logoUrl}
          alt={name}
          onError={() => setImageError(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  // Universal Official Green Pharmacy Cross (+) Emblem
  return (
    <div
      className={`relative flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-emerald-600 via-[#166534] to-emerald-950 text-white shadow-sm border border-emerald-500/40 p-2 overflow-hidden group ${currentSizeClass} ${className}`}
      title={name}
    >
      {/* Official Pharmacy Cross SVG (+) */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full text-white fill-current filter drop-shadow-xs transition-transform group-hover:scale-105"
        aria-label="Croix Verte Officielle de Pharmacie"
      >
        {/* Outer Cross with rounded corners */}
        <path
          d="M34 8 C34 4.7 36.7 2 40 2 H60 C63.3 2 66 4.7 66 8 V34 H92 C95.3 34 98 36.7 98 40 V60 C98 63.3 95.3 66 92 66 H66 V92 C66 95.3 63.3 98 60 98 H40 C36.7 98 34 95.3 34 92 V66 H8 C4.7 66 2 63.3 2 60 V40 C2 36.7 4.7 34 8 34 H34 V8 Z"
        />
        {/* Inner subtle concentric cross accent */}
        <path
          d="M44 20 H56 V44 H80 V56 H56 V80 H44 V56 H20 V44 H44 V20 Z"
          fill="rgba(255, 255, 255, 0.25)"
        />
      </svg>
    </div>
  );
}
