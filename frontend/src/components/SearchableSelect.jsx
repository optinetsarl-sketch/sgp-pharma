import React, { useState, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { Search, ChevronDown, Check, X, Plus } from "lucide-react";

// Normalize string for fuzzy accent-insensitive search (e.g. "paracétamol" matches "paracetamol")
function normalizeStr(str) {
  if (!str) return "";
  return str
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Sélectionner ou rechercher...",
  searchPlaceholder = "Taper pour filtrer ou saisir...",
  className = "",
  disabled = false,
  required = false,
  allowCustom = false, // If true, allows typing and selecting any custom text
  "data-testid": testId,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, isDropUp: false });
  
  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options array
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === "string" || typeof opt === "number") {
        return { value: opt, label: String(opt) };
      }
      return opt;
    });
  }, [options]);

  // Find currently selected option (supports custom synthesized option if allowCustom)
  const selectedOption = useMemo(() => {
    if (!value && value !== 0) return null;
    const found = normalizedOptions.find((opt) => String(opt.value) === String(value));
    if (found) return found;
    if (allowCustom && String(value).trim()) {
      return { value: value, label: String(value) };
    }
    return null;
  }, [normalizedOptions, value, allowCustom]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = normalizeStr(searchQuery);
    return normalizedOptions.filter((opt) => {
      const label = normalizeStr(opt.label);
      const sublabel = normalizeStr(opt.sublabel);
      const extra = normalizeStr(opt.extra);
      return label.includes(q) || sublabel.includes(q) || extra.includes(q);
    });
  }, [normalizedOptions, searchQuery]);

  // Check if searchQuery is an exact match with an existing option
  const isExactMatch = useMemo(() => {
    if (!searchQuery.trim()) return true;
    const q = normalizeStr(searchQuery.trim());
    return normalizedOptions.some(
      (opt) => normalizeStr(opt.label) === q || normalizeStr(opt.value) === q
    );
  }, [normalizedOptions, searchQuery]);

  // Calculate coordinates for floating portal
  const updateCoords = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const isDropUp = spaceBelow < 260 && rect.top > 260;

    setCoords({
      top: isDropUp ? rect.top - 4 : rect.bottom + 4,
      left: Math.max(10, rect.left),
      width: Math.max(rect.width, 280),
      isDropUp,
    });
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      const isInsideContainer = containerRef.current && containerRef.current.contains(e.target);
      const isInsidePopover = popoverRef.current && popoverRef.current.contains(e.target);
      if (!isInsideContainer && !isInsidePopover) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Update position on open, scroll, or resize
  useEffect(() => {
    if (isOpen) {
      updateCoords();
      setHighlightedIndex(0);

      const handlePositionUpdate = () => updateCoords();
      window.addEventListener("scroll", handlePositionUpdate, true);
      window.addEventListener("resize", handlePositionUpdate);

      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);

      return () => {
        window.removeEventListener("scroll", handlePositionUpdate, true);
        window.removeEventListener("resize", handlePositionUpdate);
      };
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex];
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Keyboard navigation inside the dropdown
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      } else if (allowCustom && searchQuery.trim()) {
        handleSelect(searchQuery.trim());
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const handleSelect = (val) => {
    onChange && onChange(val);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange && onChange("");
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full text-xs ${className}`}
      onKeyDown={handleKeyDown}
      data-testid={testId}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full px-3 py-2 bg-slate-50 border rounded-xl flex items-center justify-between text-left transition-all ${
          isOpen
            ? "border-primary ring-2 ring-primary/20 bg-white shadow-xs"
            : "border-slate-200 hover:border-slate-300 hover:bg-white"
        } ${disabled ? "opacity-50 cursor-not-allowed bg-slate-100" : "cursor-pointer"}`}
      >
        <div className="flex-1 truncate pr-2">
          {selectedOption ? (
            <div className="flex items-center gap-1.5 truncate">
              {selectedOption.isRx && (
                <span className="text-[9px] bg-red-600 text-white font-extrabold px-1 rounded flex-shrink-0">
                  🔴 Rx
                </span>
              )}
              <span className="font-semibold text-slate-900 truncate">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && (
                <span className="text-[10px] text-slate-400 font-normal truncate">
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-medium">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedOption && !disabled && (
            <span
              role="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60"
              title="Effacer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
              isOpen ? "rotate-180 text-primary" : ""
            }`}
          />
        </div>
      </button>

      {/* Hidden input for native form validation if required */}
      {required && (
        <input
          tabIndex={-1}
          required={required}
          value={value || ""}
          onChange={() => {}}
          className="opacity-0 absolute pointer-events-none w-0 h-0"
        />
      )}

      {/* Dropdown Popover using React Portal to prevent clipping by table overflow-hidden */}
      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: coords.isDropUp ? "auto" : `${coords.top}px`,
              bottom: coords.isDropUp ? `${window.innerHeight - coords.top + 4}px` : "auto",
              left: `${Math.min(coords.left, window.innerWidth - coords.width - 12)}px`,
              width: `${coords.width}px`,
              zIndex: 999999,
            }}
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-slate-900/10"
            onKeyDown={handleKeyDown}
          >
            {/* Live Search Input */}
            <div className="p-2.5 border-b border-slate-100 bg-slate-50/90 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Custom Input Option if allowCustom is enabled */}
            {allowCustom && searchQuery.trim() && !isExactMatch && (
              <div className="p-1.5 border-b border-slate-100 bg-emerald-50/50">
                <button
                  type="button"
                  onClick={() => handleSelect(searchQuery.trim())}
                  className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    Utiliser la valeur personnalisée : <strong className="underline font-black">"{searchQuery.trim()}"</strong>
                  </span>
                </button>
              </div>
            )}

            {/* Options List */}
            <div ref={listRef} className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
              {filteredOptions.length === 0 && (!allowCustom || !searchQuery.trim()) ? (
                <div className="p-4 text-center text-xs text-slate-400 font-medium">
                  Aucun résultat correspondant
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = String(opt.value) === String(value);
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <button
                      key={opt.value || idx}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between text-xs transition-colors ${
                        isSelected
                          ? "bg-primary text-white font-bold shadow-xs"
                          : isHighlighted
                          ? "bg-slate-100 text-slate-900 font-medium"
                          : "text-slate-700 hover:bg-slate-50 font-medium"
                      }`}
                    >
                      <div className="flex-1 truncate pr-2">
                        <div className="flex items-center gap-1.5 truncate">
                          {opt.isRx && (
                            <span
                              className={`text-[9px] font-extrabold px-1 rounded flex-shrink-0 ${
                                isSelected ? "bg-red-500 text-white" : "bg-red-600 text-white"
                              }`}
                            >
                              🔴 Rx
                            </span>
                          )}
                          <span className="truncate">{opt.label}</span>
                        </div>
                        {opt.sublabel && (
                          <div
                            className={`text-[10px] truncate mt-0.5 ${
                              isSelected ? "text-emerald-100" : "text-slate-400"
                            }`}
                          >
                            {opt.sublabel}
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 flex-shrink-0 ml-1 text-white" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
