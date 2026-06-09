import { useEffect, useId, useMemo, useRef, useState } from "react";

export default function SearchSelect({
  value,
  onChange,
  options = [],
  placeholder = "Choisir",
  searchPlaceholder = "Rechercher...",
  emptyText = "Aucun resultat",
  className = "",
  disabled = false
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listboxId = useId();

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)) || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      `${option.label} ${option.description || ""} ${option.meta || ""}`.toLowerCase().includes(needle)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    function handlePointer(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`ui-select ui-search-select ${open ? "is-open" : ""} ${className}`.trim()}>
      <button
        type="button"
        className="ui-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`ui-select__value ${selectedOption ? "" : "is-placeholder"}`.trim()}>
          <span className="ui-select__icon">⌕</span>
          <span>{selectedOption?.label || placeholder}</span>
        </span>
        <span className="ui-select__chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="ui-select__menu ui-search-select__menu" id={listboxId} role="listbox">
          <div className="ui-search-select__search">
            <span className="ui-select__icon">⌕</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>

          <div className="ui-search-select__options">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const active = String(option.value) === String(value);
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`ui-search-select__option ${active ? "is-selected" : ""}`}
                    onClick={() => {
                      onChange?.(option.value);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="ui-search-select__avatar">{option.avatar || option.label?.slice(0, 2) || "?"}</span>
                    <span className="ui-search-select__content">
                      <strong>{option.label}</strong>
                      {option.description ? <small>{option.description}</small> : null}
                    </span>
                    {option.meta ? <span className="ui-search-select__meta">{option.meta}</span> : null}
                  </button>
                );
              })
            ) : (
              <div className="ui-search-select__empty">{emptyText}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
