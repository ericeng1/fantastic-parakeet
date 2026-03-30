/**
 * form-shared.js
 * Shared logic for brand-centric forms:
 *  - Auth gate
 *  - Progressive image upload (upload on select, not on submit)
 *  - Draft persistence to localStorage
 *  - Haptic + visual feedback
 *  - Two-step flow (step 1: essentials, step 2: optional details)
 *  - Final DB insert
 */

import { supabase } from "./supabaseClient.js";

const BUCKET   = "item-images";
const MAX_PHOTOS = 10;
// ── CATEGORY → MATERIAL DEFAULTS ─────────────────────────────────────────────
// Maps category_id → [primary_default_material_id, ...also_common]
// First entry is the soft default that gets pre-selected.
// Edit this object anytime to change or add mappings — no DB changes needed.
export const CATEGORY_MATERIAL_DEFAULTS = {
  2: [2, 8, 4],       // Knife    → S30V, 3V, D2
  3: [8, 1, 4, 10, 3], // Pry bar  → 3V, A2, D2, Z-wear, Titanium
  4: [9, 14, 2],      // Spinner  → Bronze, Brass, S30V
  1: [5, 1, 3],       // Tag      → Copper, A2, Titanium
  5: [3, 14, 9, 6],   // Bead     → Titanium, Brass, Bronze, Delrin
  7: [8, 1, 4, 2, 10, 3], // Falcon → 3V, A2, D2, S30V, Z-wear, Titanium
};

// ── LEVENSHTEIN DISTANCE ──────────────────────────────────────────────────────
// Computes edit distance between two strings (case-insensitive).
function levenshtein(a, b) {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// Returns the closest existing name if within threshold, else null.
function findSimilar(name, existingNames, threshold = 2) {
  let best = null, bestDist = Infinity;
  for (const existing of existingNames) {
    const d = levenshtein(name, existing);
    if (d > 0 && d <= threshold && d < bestDist) {
      best = existing;
      bestDist = d;
    }
  }
  return best;
}



// ── AUTH ─────────────────────────────────────────────────────────────────────
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // Preserve the full URL so prefill params survive the login round-trip
    try { sessionStorage.setItem("auth_redirect", window.location.href); } catch {}
    window.location.href = "login.html";
    return null;
  }
  return session.user;
}

// ── HAPTIC FEEDBACK ───────────────────────────────────────────────────────────
export function haptic(style = "light") {
  if ("vibrate" in navigator) {
    const patterns = { light: [10], medium: [20], success: [10, 60, 10], error: [40, 30, 40] };
    navigator.vibrate(patterns[style] || patterns.light);
  }
}

// ── VISUAL TOAST ──────────────────────────────────────────────────────────────
let toastTimer = null;

export function showToast(msg, type = "info") {
  let toast = document.getElementById("shared-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "shared-toast";
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "calc(24px + env(safe-area-inset-bottom))",
      left: "50%",
      transform: "translateX(-50%) translateY(20px)",
      padding: "12px 20px",
      borderRadius: "40px",
      fontSize: "14px",
      fontFamily: "'Lato', sans-serif",
      fontWeight: "400",
      letterSpacing: "0.02em",
      zIndex: "9999",
      pointerEvents: "none",
      transition: "opacity 0.25s ease, transform 0.25s ease",
      opacity: "0",
      whiteSpace: "nowrap",
      maxWidth: "90vw",
      textAlign: "center",
    });
    document.body.appendChild(toast);
  }

  const themes = {
    info:    { bg: "#1e2a36", color: "#8dbbd1", border: "1px solid rgba(141,187,209,0.25)" },
    success: { bg: "#1a2e22", color: "#5fa87a", border: "1px solid rgba(95,168,122,0.3)" },
    error:   { bg: "#2e1a1a", color: "#c07070", border: "1px solid rgba(192,112,112,0.3)" },
    upload:  { bg: "#2a2108", color: "#c8964a", border: "1px solid rgba(200,150,74,0.3)" },
  };

  const theme = themes[type] || themes.info;
  toast.textContent = msg;
  Object.assign(toast.style, { background: theme.bg, color: theme.color, border: theme.border });

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(10px)";
  }, type === "success" ? 3000 : 2200);
}

// ── PROGRESSIVE UPLOAD ────────────────────────────────────────────────────────
/**
 * Uploads a single file immediately on selection.
 * Returns the public URL, or throws on error.
 */
export async function uploadFileNow(file, userId) {
  const ext      = file.name.split(".").pop();
  const filename = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, { cacheControl: "3600", upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

// ── PROGRESSIVE IMAGE INPUT MANAGER ──────────────────────────────────────────
/**
 * Attaches progressive upload behaviour to a file input + preview container.
 *
 * @param {object} opts
 *   inputEl      — <input type="file" multiple accept="image/*">
 *   previewEl    — container div for thumbnails
 *   userId       — current user id
 *   onUrlsChange — callback(urls: string[]) called whenever url list changes
 */
export function initProgressiveUpload({ inputEl, previewEl, userId, onUrlsChange }) {
  let urls = []; // uploaded public URLs in order

  function render() {
    previewEl.innerHTML = "";

    urls.forEach((url, i) => {
      const wrap = document.createElement("div");
      wrap.className = "thumb-wrap";

      const img = document.createElement("img");
      img.src = url;
      img.className = "thumb-img";
      img.alt = "";

      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "thumb-rm";
      rm.innerHTML = "✕";
      rm.setAttribute("aria-label", "Remove photo");
      rm.addEventListener("click", () => {
        urls.splice(i, 1);
        render();
        onUrlsChange(urls);
      });

      wrap.appendChild(img);
      wrap.appendChild(rm);
      previewEl.appendChild(wrap);
    });

    // Add-more tile if under limit
    if (urls.length < MAX_PHOTOS) {
      const addTile = document.createElement("div");
      addTile.className = "thumb-add-tile";
      addTile.innerHTML = `<span class="plus-icon">＋</span><span class="add-label">${MAX_PHOTOS - urls.length} left</span>`;
      addTile.addEventListener("click", () => { inputEl.value = ""; inputEl.click(); });
      previewEl.appendChild(addTile);
    }

    // Count badge
    if (urls.length > 0) {
      const count = document.createElement("p");
      count.className = "photo-count";
      count.textContent = `${urls.length} / ${MAX_PHOTOS} photo${urls.length !== 1 ? "s" : ""}`;
      previewEl.appendChild(count);
    }
  }

  inputEl.addEventListener("change", async () => {
    const files = Array.from(inputEl.files).slice(0, MAX_PHOTOS - urls.length);
    if (!files.length) return;
    inputEl.value = "";

    for (const file of files) {
      // Optimistic: show loading thumb immediately
      const loadingId = `loading-${Date.now()}-${Math.random()}`;
      const wrap = document.createElement("div");
      wrap.className = "thumb-wrap loading";
      wrap.id = loadingId;
      wrap.innerHTML = `<div class="thumb-spinner"></div>`;
      // Insert before add tile
      const addTile = previewEl.querySelector(".thumb-add-tile");
      if (addTile) previewEl.insertBefore(wrap, addTile);
      else previewEl.appendChild(wrap);

      haptic("light");
      showToast("Uploading photo…", "upload");

      try {
        const url = await uploadFileNow(file, userId);
        urls.push(url);
        onUrlsChange(urls);
        // Save urls to draft immediately
  
        haptic("success");
        showToast("Photo uploaded ✓", "success");
      } catch (err) {
        haptic("error");
        showToast("Upload failed — check connection", "error");
      } finally {
        document.getElementById(loadingId)?.remove();
        render();
      }
    }
  });

  // Initial render — shows the add tile immediately on load
  render();

  // Expose method to set initial urls (for draft restore)
  return {
    setUrls(initial) { urls = [...initial]; render(); onUrlsChange(urls); },
    getUrls()        { return [...urls]; },
    render,
  };
}

// ── DB INSERT ─────────────────────────────────────────────────────────────────
export async function saveItem({ makerId, step1, step2, imageUrls, userId }) {
  const imageFields = {};
  for (let i = 0; i < MAX_PHOTOS; i++) {
    imageFields[`image_url${i + 1}`] = imageUrls[i] ?? null;
  }

  const item = {
    user_id:      userId,
    creator_id:   userId,   // Phase 1: who created the record — never changes
    owner_id:     userId,   // Phase 1: current owner — updated by transactions later
    maker_id:     makerId,
    is_private:   step1.is_private || false,
    category_id:  step1.category_id || null,
    material_id:  step1.material_id || null,
    born_on_date: step2?.born_on_date || null,
    msrp:         step2?.msrp        || null,
    size:         step2?.size        || null,
    variant:      step2?.variant     || null,
    extra:        step2?.extra       || null,
    comments:     step2?.comments    || null,
    ...imageFields,
  };

  const { error } = await supabase.from("items").insert([item]);
  if (error) throw new Error(error.message);
}

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
/**
 * Mobile-friendly promise-based confirmation dialog.
 * Resolves true (confirm) or false (cancel).
 * Optionally shows an input field when inputLabel is provided,
 * in which case it resolves the trimmed string or null on cancel.
 */
export function showConfirmDialog({ title, message, inputLabel = null, inputPlaceholder = "", confirmText = "Confirm", cancelText = "Cancel" }) {
  return new Promise((resolve) => {

    // Overlay
    const overlay = document.createElement("div");
    overlay.id = "confirm-overlay";
    Object.assign(overlay.style, {
      position: "fixed", inset: "0",
      background: "rgba(0,0,0,0.72)",
      zIndex: "10000",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      padding: "0 0 env(safe-area-inset-bottom)",
      animation: "overlayIn 0.2s ease both",
    });

    // Sheet
    const sheet = document.createElement("div");
    Object.assign(sheet.style, {
      background: "#1e1e22",
      border: "1px solid #2a2a2e",
      borderRadius: "20px 20px 0 0",
      padding: "24px 24px 32px",
      width: "100%",
      maxWidth: "520px",
      animation: "sheetIn 0.25s cubic-bezier(0.34,1.1,0.64,1) both",
      fontFamily: "'Lato', sans-serif",
    });

    // Inject keyframes once
    if (!document.getElementById("dialog-keyframes")) {
      const style = document.createElement("style");
      style.id = "dialog-keyframes";
      style.textContent = `
        @keyframes overlayIn { from{opacity:0} to{opacity:1} }
        @keyframes sheetIn { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
      `;
      document.head.appendChild(style);
    }

    // Title
    const titleEl = document.createElement("div");
    titleEl.textContent = title;
    Object.assign(titleEl.style, {
      fontFamily: "'Bebas Neue', sans-serif",
      fontSize: "22px",
      letterSpacing: "0.06em",
      color: "#f0ede8",
      marginBottom: "8px",
    });

    // Message
    const msgEl = document.createElement("div");
    msgEl.textContent = message;
    Object.assign(msgEl.style, {
      fontSize: "14px", color: "#737278",
      marginBottom: inputLabel ? "18px" : "24px",
      lineHeight: "1.5",
    });

    // Optional text input
    let inputEl = null;
    if (inputLabel) {
      const labelEl = document.createElement("label");
      labelEl.textContent = inputLabel;
      Object.assign(labelEl.style, {
        display: "block", fontSize: "10px", fontWeight: "700",
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: "#737278", marginBottom: "8px",
      });

      inputEl = document.createElement("input");
      inputEl.type = "text";
      inputEl.placeholder = inputPlaceholder;
      Object.assign(inputEl.style, {
        width: "100%", background: "#111213",
        border: "1px solid #2a2a2e", borderRadius: "10px",
        color: "#f0ede8", fontFamily: "'Lato', sans-serif",
        fontSize: "16px", fontWeight: "300",
        padding: "13px 14px", outline: "none",
        marginBottom: "20px", boxSizing: "border-box",
        WebkitAppearance: "none",
      });

      inputEl.addEventListener("focus", () => { inputEl.style.borderColor = "#c8964a"; inputEl.style.boxShadow = "0 0 0 3px rgba(200,150,74,0.12)"; });
      inputEl.addEventListener("blur",  () => { inputEl.style.borderColor = "#2a2a2e"; inputEl.style.boxShadow = "none"; });

      sheet.appendChild(labelEl);
      sheet.appendChild(inputEl);
    }

    // Button row
    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, { display: "flex", gap: "10px" });

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = cancelText;
    Object.assign(cancelBtn.style, {
      flex: "1", padding: "14px", borderRadius: "10px",
      background: "none", border: "1px solid #2a2a2e",
      color: "#737278", fontFamily: "'Lato', sans-serif",
      fontSize: "15px", cursor: "pointer",
    });

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = confirmText;
    Object.assign(confirmBtn.style, {
      flex: "2", padding: "14px", borderRadius: "10px",
      background: "#c8964a", border: "none",
      color: "#111", fontFamily: "'Lato', sans-serif",
      fontSize: "15px", fontWeight: "700", cursor: "pointer",
    });

    const close = (result) => {
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.18s ease";
      setTimeout(() => overlay.remove(), 180);
      resolve(result);
    };

    cancelBtn.addEventListener("click",  () => close(inputLabel ? null : false));
    confirmBtn.addEventListener("click", () => {
      if (inputLabel) {
        const val = inputEl?.value.trim();
        if (!val) { inputEl.style.borderColor = "#c07070"; inputEl.focus(); return; }
        close(val);
      } else {
        close(true);
      }
    });

    // Enter key submits
    if (inputEl) {
      inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") confirmBtn.click(); });
    }

    // Tap overlay to cancel
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(inputLabel ? null : false); });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);

    sheet.insertBefore(titleEl, sheet.firstChild);
    sheet.insertBefore(msgEl,   titleEl.nextSibling);
    sheet.appendChild(btnRow);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    // Auto-focus input on open
    setTimeout(() => inputEl?.focus(), 280);
  });
}

// ── ADD NEW CATEGORY OR MATERIAL ──────────────────────────────────────────────
/**
 * Prompts user for a new name via the confirm dialog,
 * inserts it into Supabase, and returns { id, name } or null on cancel.
 *
 * @param {string} table  — "categories" or "materials"
 */
export async function addNewLookup(table, brandId = null) {
  const label = table === "categories" ? "Category" : "Material";

  // Fetch existing names for similarity check
  const { data: existing } = await supabase.from(table).select("name");
  const existingNames = (existing || []).map(r => r.name);

  const name = await showConfirmDialog({
    title:            `New ${label}`,
    message:          `Enter a name for the new ${label.toLowerCase()}. It will be saved to the database and available to all users.`,
    inputLabel:       `${label} name`,
    inputPlaceholder: `e.g. ${table === "categories" ? "Prybar, Bead…" : "CPM-S45VN, Brass…"}`,
    confirmText:      `Add ${label}`,
    cancelText:       "Cancel",
  });

  if (!name) return null;  // user cancelled

  // ── Fuzzy similarity check ──
  const similar = findSimilar(name, existingNames, 2);
  if (similar) {
    // Build a warning dialog — user can still proceed or go back to select existing
    const proceed = await showConfirmDialog({
      title:       "Similar entry exists",
      message:     `"${similar}" already exists and looks very similar. Are you sure "${name}" is a different ${label.toLowerCase()}?`,
      confirmText: `Yes, add "${name}"`,
      cancelText:  `Use "${similar}" instead`,
    });
    if (!proceed) {
      // Return the existing entry so the form can select it
      const match = (existing || []).find(r => r.name.toLowerCase().trim() === similar.toLowerCase().trim());
      if (match) {
        showToast(`Selected existing: ${match.name}`, "info");
        haptic("light");
        return { id: match.id, name: match.name };
      }
      return null;
    }
  }

  const { data, error } = await supabase
    .from(table)
    .insert([{ name }])
    .select()
    .single();

  if (error) {
    // Unique constraint violation — entry already exists
    if (error.code === "23505") {
      showToast(`"${name}" already exists — select it from the list`, "error");
      haptic("error");
    } else {
      showToast(`Failed to add ${label.toLowerCase()}: ${error.message}`, "error");
    }
    return null;
  }

  // ── If brandId provided and table is categories, link to brand_categories ──
  if (brandId && table === "categories") {
    try {
      // Check if link already exists
      const { data: existingLink } = await supabase
        .from("brand_categories")
        .select("id")
        .eq("brand_id", brandId)
        .eq("category_id", data.id)
        .single();

      if (!existingLink) {
        // Find max sort_order for this brand
        const { data: maxSort } = await supabase
          .from("brand_categories")
          .select("sort_order")
          .eq("brand_id", brandId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .single();

        const nextSort = (maxSort?.sort_order || 0) + 1;

        const { error: linkError } = await supabase
          .from("brand_categories")
          .insert({
            brand_id: brandId,
            category_id: data.id,
            sort_order: nextSort
          });

        if (linkError) {
          console.warn("Failed to link category to brand:", linkError);
        }
      }
    } catch (e) {
      console.warn("Error linking category to brand:", e);
    }
  }

  showToast(`${label} "${data.name}" added ✓`, "success");
  haptic("success");
  return { id: data.id, name: data.name };
}

// ── DYNAMIC CHIP LOADER ───────────────────────────────────────────────────────
/**
 * Fetches rows from `table` and renders them as selectable chips inside `containerId`.
 * If `brandId` is provided and `table === "categories"`, fetches ONLY categories
 * linked to that brand via brand_categories table (brand-scoped curation).
 * Otherwise, fetches all rows from the table (global fallback).
 *
 * @param {Object} options
 * @param {string} options.table - "categories" or "materials"
 * @param {string} options.containerId - DOM element ID for the chip container
 * @param {string} options.addChipId - DOM element ID for the "+ Add" chip
 * @param {Function} options.onSelect - Callback when a chip is selected
 * @param {number} [options.brandId] - Optional brand ID for category filtering
 * @returns the selected id (updated via closure), and a setter for draft restore.
 */
export async function loadChips({ table, containerId, addChipId, onSelect, brandId }) {
  const container = document.getElementById(containerId);

  // Show a subtle loading state
  container.innerHTML = `<span style="font-size:13px;color:var(--muted,#737278);letter-spacing:0.04em;">Loading…</span>`;

  let data = [];
  let error = null;

  // Brand-scoped categories: join brand_categories with categories table
  if (table === "categories" && brandId) {
    const result = await supabase
      .from("brand_categories")
      .select(`
        category_id,
        sort_order,
        categories!inner (
          id,
          name
        )
      `)
      .eq("brand_id", brandId)
      .order("sort_order", { ascending: true });

    error = result.error;
    if (result.data) {
      // Flatten nested structure: { categories: { id, name }, ... } → { id, name }
      data = result.data.map(row => ({
        id: row.categories.id,
        name: row.categories.name
      }));
    }
  } else {
    // Global fallback: fetch all from table
    const result = await supabase
      .from(table)
      .select("id, name")
      .order("name");

    error = result.error;
    data = result.data || [];
  }

  if (error) {
    container.innerHTML = `<span style="font-size:13px;color:#c07070;">Failed to load — reload page</span>`;
    return { getSelected: () => null, setSelected: () => {} };
  }

  container.innerHTML = "";

  // Render a chip and wire its click handler
  function renderChip(id, name) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.dataset.id = String(id);
    chip.textContent = name;
    chip.addEventListener("click", () => {
      container.querySelectorAll(".chip:not(.chip-add)").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      haptic("light");
      try { onSelect(id); } catch(e) { console.warn("loadChips onSelect error:", e); }
    });
    return chip;
  }

  data.forEach(row => container.appendChild(renderChip(row.id, row.name)));

  // "+ Add" chip at the end
  const addChip = document.createElement("div");
  addChip.className = "chip chip-add";
  addChip.id = addChipId;
  addChip.textContent = "＋ Add";
  container.appendChild(addChip);

  // Return helpers for draft restore and external new-chip injection
  return {
    getSelected() {
      const sel = container.querySelector(".chip.selected:not(.chip-add)");
      return sel ? parseInt(sel.dataset.id) : null;
    },
    setSelected(id) {
      container.querySelectorAll(".chip:not(.chip-add)").forEach(c => {
        c.classList.toggle("selected", String(c.dataset.id) === String(id));
      });
    },
    addAndSelect(id, name) {
      // Insert new chip before the add chip
      const newChip = renderChip(id, name);
      container.insertBefore(newChip, addChip);
      container.querySelectorAll(".chip:not(.chip-add)").forEach(c => c.classList.remove("selected"));
      newChip.classList.add("selected");
      onSelect(id);
    },
    getAddChip() { return addChip; },
  };
}

// ── DATE PICKER HELPER ────────────────────────────────────────────────────────
/**
 * Attaches a calendar icon button to a date input that triggers the native
 * date picker. Also injects a "Today" shortcut.
 *
 * @param {string} inputId   — id of the <input type="date"> element
 * @param {string} btnId     — id of the calendar trigger button
 */
export function initDatePicker(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  if (!input || !btn) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    // showPicker() is the modern spec; fallback to focus+click
    if (typeof input.showPicker === "function") {
      try { input.showPicker(); return; } catch {}
    }
    input.focus();
    input.click();
  });
}

/**
 * Sets a date input to today's local date (YYYY-MM-DD).
 */
export function setToday(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const dd   = String(now.getDate()).padStart(2, "0");
  input.value = `${yyyy}-${mm}-${dd}`;
}

// ── PREFILL FROM URL PARAMS ───────────────────────────────────────────────────
/**
 * Reads ?prefill=1&category_id=X&material_id=Y&variant=Z… from the URL
 * and returns a prefill object (or null if no prefill param).
 * Photos, comments, and born_on_date are intentionally excluded.
 */
export function readPrefillParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get("prefill")) return null;

  return {
    category_id:  params.get("category_id")  ? parseInt(params.get("category_id"))  : null,
    material_id:  params.get("material_id")   ? parseInt(params.get("material_id"))  : null,
    variant:      params.get("variant")       || null,
    size:         params.get("size")          || null,
    msrp:         params.get("msrp")          || null,
    extra:        params.get("extra")         || null,
    is_private:   params.get("is_private") === "true",
  };
}

/**
 * Builds an "Add Similar" URL for a given item, pointing to the correct
 * brand form based on maker_id. Excludes photos, comments, born_on_date.
 */
export function buildAddSimilarUrl(item) {
  const formMap = { 1: "form-atwood.html", 2: "form-horton.html", 3: "form-steelflame.html", 4: "form-zachwoods.html" };
  const base = formMap[item.maker_id];
  if (!base) return null;

  const p = new URLSearchParams({ prefill: "1" });
  if (item.category_id)  p.set("category_id",  item.category_id);
  if (item.material_id)  p.set("material_id",   item.material_id);
  if (item.variant && item.variant !== "none") p.set("variant", item.variant);
  if (item.size)         p.set("size",          item.size);
  if (item.msrp)         p.set("msrp",          item.msrp);
  if (item.extra)        p.set("extra",         item.extra);
  if (item.is_private)   p.set("is_private",    "true");

  return `${base}?${p.toString()}`;
}
