import React from "react";
import { useI18n } from "@/i18n";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center gap-1 text-xs font-bold" data-testid="language-switcher">
      <button
        data-testid="lang-fr-btn"
        onClick={() => setLang("fr")}
        className={`px-2 py-1 rounded ${lang === "fr" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
      >FR</button>
      <button
        data-testid="lang-en-btn"
        onClick={() => setLang("en")}
        className={`px-2 py-1 rounded ${lang === "en" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
      >EN</button>
    </div>
  );
}
