export const DEFAULT_THEME = {
  primary_color: "#0a84ff",
  secondary_color: "#93c5fd",
  button_color: "#0a84ff",
  background_color: "#f3f6fb",
  sidebar_color: "rgba(255,255,255,0.84)",
  mode: "light",
  radius_style: "rounded",
  shadows_enabled: 1
};

function mergeTheme(theme) {
  return {
    ...DEFAULT_THEME,
    ...(theme || {})
  };
}

export function applyTheme(themeInput) {
  const theme = mergeTheme(themeInput);
  const root = document.documentElement;

  root.style.setProperty("--primary-color", theme.primary_color);
  root.style.setProperty("--secondary-color", theme.secondary_color);
  root.style.setProperty("--button-color", theme.button_color);
  root.style.setProperty("--bg-color", theme.background_color);
  root.style.setProperty("--sidebar-color", theme.sidebar_color);

  const radius = theme.radius_style === "normal" ? "10px" : theme.radius_style === "pill" ? "22px" : "14px";
  const radiusXl = theme.radius_style === "normal" ? "16px" : theme.radius_style === "pill" ? "28px" : "20px";
  root.style.setProperty("--radius-md", radius);
  root.style.setProperty("--radius-xl", radiusXl);

  if (theme.shadows_enabled) {
    root.style.setProperty("--shadow", "0 12px 34px rgba(15, 23, 42, 0.10)");
  } else {
    root.style.setProperty("--shadow", "none");
  }

  if (theme.mode === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.setAttribute("data-theme", "light");
  }
}
