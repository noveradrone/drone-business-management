const THEME_IDS = ["ocean", "forest", "sunset", "graphite", "violet"];

export const THEME_PRESETS = {
  ocean: {
    label: "Ocean",
    light: {
      primary: "#0a84ff",
      secondary: "#9ec7ff",
      accent: "#0a84ff",
      bg: "#eef4ff",
      surface: "rgba(255,255,255,0.78)",
      surfaceStrong: "#ffffff",
      sidebar: "rgba(255,255,255,0.88)",
      border: "rgba(15,23,42,0.12)",
      text: "#0f172a",
      textMuted: "#5b6473",
      buttonText: "#ffffff",
      inputBg: "rgba(255,255,255,0.94)",
      inputText: "#0f172a",
      inputPlaceholder: "#75839b",
      tableHeaderBg: "#f5f8ff",
      tableRowHover: "#f1f6ff",
      overlay: "rgba(15,23,42,0.35)",
      success: "#1f9d55",
      warning: "#c37b07",
      danger: "#c62828",
      focusRing: "rgba(10,132,255,0.28)"
    },
    dark: {
      primary: "#4da3ff",
      secondary: "#2966b3",
      accent: "#62afff",
      bg: "#0b111c",
      surface: "rgba(18,28,43,0.88)",
      surfaceStrong: "#131f31",
      sidebar: "rgba(16,25,40,0.96)",
      border: "rgba(188,206,229,0.18)",
      text: "#eaf2ff",
      textMuted: "#a7bbd9",
      buttonText: "#09111d",
      inputBg: "#0f1a2a",
      inputText: "#eaf2ff",
      inputPlaceholder: "#88a0c4",
      tableHeaderBg: "#152338",
      tableRowHover: "#182a43",
      overlay: "rgba(2,6,12,0.64)",
      success: "#46c985",
      warning: "#f2ad41",
      danger: "#ff7c7c",
      focusRing: "rgba(77,163,255,0.4)"
    }
  },
  forest: {
    label: "Forest",
    light: {
      primary: "#1f8f5f",
      secondary: "#8fd3b7",
      accent: "#1f8f5f",
      bg: "#edf7f2",
      surface: "rgba(255,255,255,0.8)",
      surfaceStrong: "#ffffff",
      sidebar: "rgba(248,255,251,0.9)",
      border: "rgba(16,74,47,0.16)",
      text: "#10211a",
      textMuted: "#4e665a",
      buttonText: "#ffffff",
      inputBg: "rgba(255,255,255,0.95)",
      inputText: "#10211a",
      inputPlaceholder: "#70897d",
      tableHeaderBg: "#f1fbf6",
      tableRowHover: "#ebf7f1",
      overlay: "rgba(12,34,22,0.35)",
      success: "#1f9d55",
      warning: "#b57912",
      danger: "#bb3b3b",
      focusRing: "rgba(31,143,95,0.3)"
    },
    dark: {
      primary: "#46c089",
      secondary: "#2f7758",
      accent: "#57ca94",
      bg: "#0b1511",
      surface: "rgba(18,33,27,0.9)",
      surfaceStrong: "#14271f",
      sidebar: "rgba(16,30,24,0.96)",
      border: "rgba(170,212,190,0.2)",
      text: "#e7f7ee",
      textMuted: "#9ec4ae",
      buttonText: "#07100c",
      inputBg: "#11231b",
      inputText: "#e7f7ee",
      inputPlaceholder: "#7fa692",
      tableHeaderBg: "#183226",
      tableRowHover: "#1a382a",
      overlay: "rgba(2,8,5,0.62)",
      success: "#4ed591",
      warning: "#eab85d",
      danger: "#ff8c8c",
      focusRing: "rgba(70,192,137,0.4)"
    }
  },
  sunset: {
    label: "Sunset",
    light: {
      primary: "#d97706",
      secondary: "#f3c284",
      accent: "#d97706",
      bg: "#fff5ea",
      surface: "rgba(255,255,255,0.82)",
      surfaceStrong: "#ffffff",
      sidebar: "rgba(255,250,244,0.92)",
      border: "rgba(127,74,16,0.18)",
      text: "#2a1a10",
      textMuted: "#7f6148",
      buttonText: "#ffffff",
      inputBg: "rgba(255,255,255,0.95)",
      inputText: "#2a1a10",
      inputPlaceholder: "#9b7b62",
      tableHeaderBg: "#fff8ef",
      tableRowHover: "#fff2e2",
      overlay: "rgba(42,26,16,0.34)",
      success: "#1f9d55",
      warning: "#c78014",
      danger: "#b83b3b",
      focusRing: "rgba(217,119,6,0.3)"
    },
    dark: {
      primary: "#ffad48",
      secondary: "#8f5d24",
      accent: "#ffb258",
      bg: "#16100c",
      surface: "rgba(36,26,20,0.9)",
      surfaceStrong: "#2a1f18",
      sidebar: "rgba(32,23,17,0.96)",
      border: "rgba(245,189,120,0.2)",
      text: "#fff1e5",
      textMuted: "#d9b79a",
      buttonText: "#211206",
      inputBg: "#291d16",
      inputText: "#fff1e5",
      inputPlaceholder: "#b69378",
      tableHeaderBg: "#36271f",
      tableRowHover: "#3f2e24",
      overlay: "rgba(10,7,5,0.62)",
      success: "#51ce93",
      warning: "#ffbe66",
      danger: "#ff8f8f",
      focusRing: "rgba(255,173,72,0.44)"
    }
  },
  graphite: {
    label: "Graphite",
    light: {
      primary: "#334155",
      secondary: "#c2c9d3",
      accent: "#334155",
      bg: "#f1f4f8",
      surface: "rgba(255,255,255,0.82)",
      surfaceStrong: "#ffffff",
      sidebar: "rgba(250,252,255,0.9)",
      border: "rgba(30,41,59,0.16)",
      text: "#111827",
      textMuted: "#596476",
      buttonText: "#ffffff",
      inputBg: "rgba(255,255,255,0.95)",
      inputText: "#111827",
      inputPlaceholder: "#768295",
      tableHeaderBg: "#f6f8fb",
      tableRowHover: "#eff3f8",
      overlay: "rgba(15,23,42,0.36)",
      success: "#1f9d55",
      warning: "#b7791f",
      danger: "#be3b3b",
      focusRing: "rgba(51,65,85,0.3)"
    },
    dark: {
      primary: "#b9c1cc",
      secondary: "#5d6776",
      accent: "#d2dae5",
      bg: "#0d1117",
      surface: "rgba(21,27,36,0.92)",
      surfaceStrong: "#151b24",
      sidebar: "rgba(20,26,34,0.96)",
      border: "rgba(188,196,207,0.2)",
      text: "#e9edf4",
      textMuted: "#a4afbf",
      buttonText: "#0d1117",
      inputBg: "#121925",
      inputText: "#e9edf4",
      inputPlaceholder: "#8592a5",
      tableHeaderBg: "#1a2230",
      tableRowHover: "#1f2938",
      overlay: "rgba(3,6,10,0.66)",
      success: "#54d193",
      warning: "#f0b35d",
      danger: "#ff9393",
      focusRing: "rgba(185,193,204,0.38)"
    }
  },
  violet: {
    label: "Violet",
    light: {
      primary: "#6d5efc",
      secondary: "#c8c0ff",
      accent: "#6d5efc",
      bg: "#f4f3ff",
      surface: "rgba(255,255,255,0.82)",
      surfaceStrong: "#ffffff",
      sidebar: "rgba(250,248,255,0.92)",
      border: "rgba(74,58,165,0.18)",
      text: "#1c1539",
      textMuted: "#675f89",
      buttonText: "#ffffff",
      inputBg: "rgba(255,255,255,0.95)",
      inputText: "#1c1539",
      inputPlaceholder: "#837aa8",
      tableHeaderBg: "#f7f5ff",
      tableRowHover: "#f1eeff",
      overlay: "rgba(21,16,43,0.36)",
      success: "#1f9d55",
      warning: "#ad7c11",
      danger: "#bc3f69",
      focusRing: "rgba(109,94,252,0.34)"
    },
    dark: {
      primary: "#9f94ff",
      secondary: "#5c4bb3",
      accent: "#b0a8ff",
      bg: "#0f0d1e",
      surface: "rgba(28,23,48,0.9)",
      surfaceStrong: "#211a39",
      sidebar: "rgba(24,20,43,0.96)",
      border: "rgba(187,176,255,0.22)",
      text: "#efeaff",
      textMuted: "#b8afda",
      buttonText: "#120d26",
      inputBg: "#221a3f",
      inputText: "#efeaff",
      inputPlaceholder: "#9e94c8",
      tableHeaderBg: "#2b214a",
      tableRowHover: "#322757",
      overlay: "rgba(4,2,9,0.66)",
      success: "#52cf96",
      warning: "#f0be65",
      danger: "#ff93b8",
      focusRing: "rgba(159,148,255,0.44)"
    }
  }
};

export const DEFAULT_THEME = {
  theme_id: "ocean",
  mode: "light",
  density: "comfortable",
  radius_style: "rounded",
  shadows_enabled: 1,
  primary_color: THEME_PRESETS.ocean.light.primary,
  secondary_color: THEME_PRESETS.ocean.light.secondary,
  button_color: THEME_PRESETS.ocean.light.primary,
  background_color: THEME_PRESETS.ocean.light.bg,
  sidebar_color: THEME_PRESETS.ocean.light.sidebar
};

function safeThemeId(value) {
  return THEME_IDS.includes(value) ? value : DEFAULT_THEME.theme_id;
}

function safeMode(value) {
  return value === "dark" ? "dark" : "light";
}

function safeDensity(value) {
  return value === "compact" ? "compact" : "comfortable";
}

export function getThemeTokens(themeIdInput, modeInput) {
  const themeId = safeThemeId(themeIdInput);
  const mode = safeMode(modeInput);
  return THEME_PRESETS[themeId][mode];
}

function mergeTheme(theme) {
  const merged = { ...DEFAULT_THEME, ...(theme || {}) };
  merged.theme_id = safeThemeId(merged.theme_id);
  merged.mode = safeMode(merged.mode);
  merged.density = safeDensity(merged.density);

  // Backward compatibility: if an old saved theme has no theme_id,
  // keep legacy colors but map it to a known preset identity.
  if (!theme?.theme_id && theme?.primary_color) {
    merged.theme_id = DEFAULT_THEME.theme_id;
  }

  return merged;
}

function shadowValue(enabled) {
  return enabled ? "0 12px 34px rgba(15, 23, 42, 0.10)" : "none";
}

export function applyTheme(themeInput) {
  const theme = mergeTheme(themeInput);
  const tokens = getThemeTokens(theme.theme_id, theme.mode);
  const root = document.documentElement;

  root.dataset.themeId = theme.theme_id;
  root.dataset.mode = theme.mode;
  root.dataset.theme = theme.mode; // Keep legacy selector compatibility.
  root.dataset.density = theme.density;

  root.style.setProperty("--primary-color", tokens.primary);
  root.style.setProperty("--secondary-color", tokens.secondary);
  root.style.setProperty("--button-color", tokens.primary);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--bg-color", tokens.bg);
  root.style.setProperty("--sidebar-color", tokens.sidebar);
  root.style.setProperty("--surface", tokens.surface);
  root.style.setProperty("--surface-strong", tokens.surfaceStrong);
  root.style.setProperty("--border", tokens.border);
  root.style.setProperty("--text", tokens.text);
  root.style.setProperty("--muted", tokens.textMuted);
  root.style.setProperty("--danger", tokens.danger);
  root.style.setProperty("--warning", tokens.warning);
  root.style.setProperty("--success", tokens.success);
  root.style.setProperty("--button-text", tokens.buttonText);
  root.style.setProperty("--input-bg", tokens.inputBg);
  root.style.setProperty("--input-text", tokens.inputText);
  root.style.setProperty("--input-placeholder", tokens.inputPlaceholder);
  root.style.setProperty("--table-header-bg", tokens.tableHeaderBg);
  root.style.setProperty("--table-row-hover", tokens.tableRowHover);
  root.style.setProperty("--overlay-color", tokens.overlay);
  root.style.setProperty("--focus-ring", tokens.focusRing);
  root.style.setProperty("--shadow", shadowValue(Boolean(theme.shadows_enabled)));

  const radius = theme.radius_style === "normal" ? "10px" : theme.radius_style === "pill" ? "22px" : "14px";
  const radiusXl = theme.radius_style === "normal" ? "16px" : theme.radius_style === "pill" ? "28px" : "20px";
  root.style.setProperty("--radius-md", radius);
  root.style.setProperty("--radius-xl", radiusXl);
}
