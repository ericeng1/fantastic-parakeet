/**
 * theme.js — Showoffy shared theme utility
 *
 * Theme priority order:
 *   1. user_metadata.theme (Supabase) — synced across devices per user
 *   2. localStorage (showoffy_theme)  — device fallback / logged-out default
 *   3. "dark"                         — hardcoded default
 *
 * The anti-flash inline script in each page's <head> reads localStorage
 * synchronously before any render. After the module loads, syncThemeFromUser()
 * can be called (e.g. in account.html) to override with the server value.
 */

const STORAGE_KEY = "showoffy_theme";

/** Returns the current theme preference: "dark" | "light" */
export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || "dark";
}

/** Applies the stored theme to <html data-theme="..."> */
export function applyTheme(override) {
  const theme = override || getTheme();
  document.documentElement.setAttribute("data-theme", theme);
}

/** Persists a theme choice to localStorage and applies it immediately */
export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * If the logged-in user has a saved theme in user_metadata,
 * sync it to localStorage and apply it. Call after auth session is available.
 * This ensures the user's preference follows them across devices.
 */
export function syncThemeFromUser(userMetadata) {
  const serverTheme = userMetadata?.theme;
  if (serverTheme && serverTheme !== getTheme()) {
    setTheme(serverTheme); // updates localStorage + html attribute
  }
}

/** Flips between light and dark */
export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

// Auto-apply on module load (uses localStorage, fast, no flash)
applyTheme();
