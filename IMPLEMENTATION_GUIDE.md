# Brand-Scoped Category Curation — Implementation Guide

## Overview

Your Showoffy brand forms now load categories **curated by brand** instead of showing all global categories. This gives each brand (Atwood, Horton, Steel Flame, Zach Woods) its own set of relevant categories.

---

## What Changed

### 1. **form-shared.js** — Core Logic Updates

#### `loadChips()` Function
**Before:** Always loaded all categories from the `categories` table
```javascript
const { data } = await supabase
  .from(table)
  .select("id, name")
  .order("name");
```

**After:** Supports brand-scoped filtering
```javascript
if (table === "categories" && brandId) {
  // Query brand_categories JOIN categories, ordered by sort_order
  const result = await supabase
    .from("brand_categories")
    .select(`
      category_id,
      sort_order,
      categories!inner (id, name)
    `)
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true });
    
  data = result.data.map(row => ({
    id: row.categories.id,
    name: row.categories.name
  }));
} else {
  // Fallback: load all categories (global)
}
```

**Usage:**
```javascript
// Brand-scoped: only Atwood's categories
await loadChips({
  table: "categories",
  containerId: "category-chips",
  brandId: 1,  // ← NEW parameter
  onSelect: id => { selectedCategoryId = id; }
});

// Global fallback: all materials
await loadChips({
  table: "materials",
  containerId: "material-chips",
  // No brandId = load all globally
  onSelect: id => { selectedMaterialId = id; }
});
```

#### `addNewLookup()` Function
**Before:** Created a new category but didn't link it to any brand
```javascript
const { data } = await supabase
  .from("categories")
  .insert([{ name }])
  .select()
  .single();
```

**After:** Optionally links new category to a brand
```javascript
export async function addNewLookup(table, brandId = null) {
  // ... create category ...
  
  // If brandId provided and table is "categories", link to brand_categories
  if (brandId && table === "categories") {
    // Find next sort_order for this brand
    const nextSort = (maxSort?.sort_order || 0) + 1;
    
    // Insert link in brand_categories table
    await supabase
      .from("brand_categories")
      .insert({
        brand_id: brandId,
        category_id: data.id,
        sort_order: nextSort
      });
  }
}
```

**Usage:**
```javascript
// Add category linked to Atwood
const result = await addNewLookup("categories", 1);

// Add material (globally, no link)
const result = await addNewLookup("materials");
```

---

### 2. **Brand Forms** — Four Files Updated

Each form now:
1. Declares its `BRAND_ID` constant
2. Passes `brandId` to `loadChips()` for categories only
3. Passes `BRAND_ID` to `addNewLookup("categories", BRAND_ID)`

#### form-atwood.html (BRAND_ID = 1)
```javascript
const BRAND_ID = 1;  // Atwood Knife and Tool

// Load categories: brand-scoped
const categoryChips = await loadChips({
  table: "categories",
  containerId: "category-chips",
  brandId: BRAND_ID,  // ← Pass BRAND_ID
  onSelect: id => { selectedCategoryId = id; }
});

// Add new category: links to Atwood
categoryChips.getAddChip().addEventListener("click", async () => {
  const result = await addNewLookup("categories", BRAND_ID);  // ← Pass BRAND_ID
  // ...
});
```

#### form-horton.html (BRAND_ID = 2)
```javascript
const BRAND_ID = 2;  // Jeremy Horton Knives
// Same pattern as Atwood, with BRAND_ID = 2
```

#### form-steelflame.html (BRAND_ID = 3)
```javascript
const BRAND_ID = 3;  // Steel Flame
// Same pattern as Atwood, with BRAND_ID = 3
```

#### form-zachwoods.html (BRAND_ID = 4)
```javascript
const BRAND_ID = 4;  // Zach Woods Knives
// Same pattern as Atwood, with BRAND_ID = 4
```

---

## How It Works

### User Flow: Adding an Item to Atwood

1. **Form loads** → `form-atwood.html` initializes
2. **loadChips(categories, brandId=1)** is called
3. **Query executes:**
   ```sql
   SELECT bc.category_id, bc.sort_order, c.id, c.name
   FROM brand_categories bc
   INNER JOIN categories c ON bc.category_id = c.id
   WHERE bc.brand_id = 1
   ORDER BY bc.sort_order ASC
   ```
4. **Result:** Only Atwood's categories display (Knife, Pry bar, Bead, Spinner, Tool)
5. **User clicks "+ Add Category"** and enters "Custom Axe Head"
6. **addNewLookup("categories", 1)** is called
7. **Database operations:**
   - Insert "Custom Axe Head" into `categories` table → gets `id: 42`
   - Insert `{ brand_id: 1, category_id: 42, sort_order: 6 }` into `brand_categories`
8. **Result:** New chip appears in Atwood's category list, linked to Atwood only

### User Flow: Same Category on Different Brand

1. User is on **form-horton.html** (Jeremy Horton Knives)
2. Horton's current categories: Pry bar, Bead, Patch (no "Knife")
3. User adds "Knife" via "+ Add Category"
4. **addNewLookup("categories", 2)** is called
5. **Database operations:**
   - Insert "Knife" into `categories` table → **reuses existing id: 2** (duplicate check prevents new insert)
   - Insert `{ brand_id: 2, category_id: 2, sort_order: 4 }` into `brand_categories`
6. **Result:** "Knife" now appears in Horton's category list too, without duplicating the category

---

## Database Schema Requirements

Ensure these tables exist with proper RLS:

### `categories` (Global)
```sql
CREATE TABLE categories (
  id BIGINT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- RLS: public READ, authenticated INSERT
```

### `brand_categories` (Junction)
```sql
CREATE TABLE brand_categories (
  id BIGINT PRIMARY KEY,
  brand_id BIGINT REFERENCES brands(id),
  category_id BIGINT REFERENCES categories(id),
  sort_order INT DEFAULT 0,
  UNIQUE(brand_id, category_id)
);

-- RLS: public READ, authenticated INSERT
```

### Current Brand → Category Mappings

| Brand | BRAND_ID | Categories |
|-------|----------|-----------|
| Atwood | 1 | Knife, Pry bar, Bead, Spinner, Tool |
| Jeremy Horton | 2 | Pry bar, Bead, Patch |
| Steel Flame | 3 | Tag, Spinner, Bead, Pendant |
| Zach Woods | 4 | WMD Tag, Tag, Knife, Pry bar, Bead, Falcon, Spinner, Carabiner |

---

## Testing Checklist

- [ ] Load `form-atwood.html` → only see Atwood's 5 categories
- [ ] Load `form-horton.html` → only see Horton's 3 categories
- [ ] Load `form-steelflame.html` → only see Steel Flame's 4 categories
- [ ] Load `form-zachwoods.html` → only see Zach Woods' 8 categories
- [ ] Add new category on Atwood form → appears in Atwood's list, not others
- [ ] Add same category name on Horton form → reuses existing category, links to Horton
- [ ] Materials load globally (all materials visible on every form)
- [ ] Hard refresh (Cmd+Shift+R) to clear cache and verify fresh load

---

## Debugging

### Categories not loading?
1. Hard refresh browser: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows/Linux)
2. Check browser console for errors
3. Verify `BRAND_ID` constant is set in form file
4. Verify `brandId` parameter is passed to `loadChips()` call
5. Check Supabase logs: ensure `brand_categories` table has rows for the brand

### New category doesn't appear after adding?
1. Reload the form page
2. Check Supabase:
   - Did the category insert into `categories` table?
   - Did the link insert into `brand_categories` table?
3. Verify RLS policy on `brand_categories` allows authenticated INSERT

### Wrong categories showing?
1. Verify the BRAND_ID constant matches the actual `brand_id` in your database
2. Check `brand_categories` table for the correct brand_id / category_id links
3. Ensure `sort_order` is set correctly (visible in the UI order)

---

## Future: Brand-Scoped Materials

When ready, implement brand-scoped materials using the same pattern:

1. Create `brand_materials` table (like `brand_categories`)
2. Update `loadChips()` to handle `table === "materials" && brandId`
3. Update forms to pass `brandId` to materials `loadChips()` call
4. Update `addNewLookup("materials", BRAND_ID)` calls

---

## Key Implementation Details

### Why JOIN Instead of Subquery?
```javascript
// ✅ Recommended: Simple JOIN, ordered by sort_order
const { data } = await supabase
  .from("brand_categories")
  .select(`
    category_id,
    sort_order,
    categories!inner (id, name)
  `)
  .eq("brand_id", brandId)
  .order("sort_order", { ascending: true });
```

### Why Duplicate Check?
```javascript
// Prevent inserting "Knife" into brand_categories twice for same brand
const { data: existingLink } = await supabase
  .from("brand_categories")
  .select("id")
  .eq("brand_id", brandId)
  .eq("category_id", data.id)
  .single();

if (!existingLink) {
  // Safe to insert new link
}
```

### Why Automatic sort_order?
```javascript
// Assign next sort_order automatically
const { data: maxSort } = await supabase
  .from("brand_categories")
  .select("sort_order")
  .eq("brand_id", brandId)
  .order("sort_order", { ascending: false })
  .limit(1)
  .single();

const nextSort = (maxSort?.sort_order || 0) + 1;
```
This keeps new categories at the end without manual intervention.

---

## Files Modified

1. **form-shared.js** — `loadChips()` and `addNewLookup()` updated
2. **form-atwood.html** — Added BRAND_ID, updated loadChips & addNewLookup calls
3. **form-horton.html** — Added BRAND_ID, updated loadChips & addNewLookup calls
4. **form-steelflame.html** — Added BRAND_ID, updated loadChips & addNewLookup calls
5. **form-zachwoods.html** — Added BRAND_ID, updated loadChips & addNewLookup calls

---

## Rollback

If you need to revert to global categories for any reason:

1. Remove `brandId` parameter from `loadChips()` calls in forms
2. Remove `BRAND_ID` parameter from `addNewLookup("categories", ...)` calls
3. Functions will fall back to global behavior automatically

---

## Questions?

Refer to the original specifications in your project docs under "BRAND → CATEGORY MAPPINGS" for the current curated lists per brand.
