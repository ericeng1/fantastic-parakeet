# Quick Reference — Brand-Scoped Categories

## What Changed

### Three Code Changes Per Form

#### 1. Add BRAND_ID Constant
```javascript
const BRAND_ID = 1;  // for form-atwood.html
const BRAND_ID = 2;  // for form-horton.html
const BRAND_ID = 3;  // for form-steelflame.html
const BRAND_ID = 4;  // for form-zachwoods.html
```

#### 2. Pass brandId to loadChips (Categories Only)
```javascript
// BEFORE
const categoryChips = await loadChips({
  table: "categories",
  containerId: "category-chips",
  addChipId: "add-category-chip",
  onSelect: id => { selectedCategoryId = id; },
});

// AFTER
const categoryChips = await loadChips({
  table: "categories",
  containerId: "category-chips",
  addChipId: "add-category-chip",
  brandId: BRAND_ID,  // ← ADD THIS LINE
  onSelect: id => { selectedCategoryId = id; },
});
```

#### 3. Pass BRAND_ID to addNewLookup (Categories Only)
```javascript
// BEFORE
categoryChips.getAddChip().addEventListener("click", async () => {
  const result = await addNewLookup("categories");
  // ...
});

// AFTER
categoryChips.getAddChip().addEventListener("click", async () => {
  const result = await addNewLookup("categories", BRAND_ID);  // ← ADD BRAND_ID
  // ...
});
```

---

## Brand ID Mapping

| Brand | BRAND_ID | Form File |
|-------|----------|-----------|
| Atwood Knife and Tool | 1 | form-atwood.html |
| Jeremy Horton Knives | 2 | form-horton.html |
| Steel Flame | 3 | form-steelflame.html |
| Zach Woods Knives | 4 | form-zachwoods.html |

---

## What Loads By Brand Now

### Atwood (BRAND_ID = 1)
- Knife
- Pry bar
- Bead
- Spinner
- Tool

### Jeremy Horton (BRAND_ID = 2)
- Pry bar
- Bead
- Patch

### Steel Flame (BRAND_ID = 3)
- Tag
- Spinner
- Bead
- Pendant

### Zach Woods (BRAND_ID = 4)
- WMD Tag
- Tag
- Knife
- Pry bar
- Bead
- Falcon
- Spinner
- Carabiner

---

## Materials Still Global

Materials continue to load globally (not brand-scoped). All materials available on all forms.

---

## Key Behaviors

✅ **Each brand only sees its curated categories**
- Atwood sees 5 categories
- Horton sees 3 categories
- Steel Flame sees 4 categories
- Zach Woods sees 8 categories

✅ **Adding a new category**
- Automatically links to that brand
- Reuses existing category if duplicate
- Auto-assigns sort_order (appears at end of list)

✅ **Same category name, different brands**
- "Knife" exists globally (id: 2)
- Atwood links to it via brand_categories
- Zach Woods also links to it via brand_categories
- No duplication in categories table

✅ **Materials unchanged**
- Global fallback (no brandId parameter)
- All materials visible on all forms

---

## Database Queries

### User sees categories for their brand
```sql
SELECT c.id, c.name
FROM brand_categories bc
INNER JOIN categories c ON bc.category_id = c.id
WHERE bc.brand_id = 1
ORDER BY bc.sort_order ASC
```

### User adds new category to their brand
```sql
-- Step 1: Insert category (if not exists)
INSERT INTO categories (name) VALUES ('New Category')
RETURNING id;

-- Step 2: Link to brand
INSERT INTO brand_categories (brand_id, category_id, sort_order)
VALUES (1, 42, 6)
```

---

## Testing

Load each form and verify:

```
form-atwood.html → Only Atwood categories load
form-horton.html → Only Horton categories load
form-steelflame.html → Only Steel Flame categories load
form-zachwoods.html → Only Zach Woods categories load
```

Add a test category on Atwood → Appears only in Atwood list
Add same category name on Horton → Reuses it, appears only in Horton list

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Wrong categories showing | Verify BRAND_ID matches actual brand_id in database |
| No categories load | Hard refresh browser (Cmd+Shift+R) |
| New category doesn't appear | Reload page after adding |
| "Add category" button broken | Verify addNewLookup call includes BRAND_ID parameter |
| Materials don't show | Materials should be global — no brandId parameter |

---

## Files Changed

```
form-shared.js          ← Core functions updated
form-atwood.html        ← BRAND_ID=1, updated loadChips & addNewLookup
form-horton.html        ← BRAND_ID=2, updated loadChips & addNewLookup
form-steelflame.html    ← BRAND_ID=3, updated loadChips & addNewLookup
form-zachwoods.html     ← BRAND_ID=4, updated loadChips & addNewLookup
```

All files ready to deploy — no database schema changes required.

---

## Next Steps

1. Replace your current files with the updated versions
2. Test loading each form in your browser
3. Add a test category on one brand
4. Verify it doesn't appear on other brands
5. Add same category name on different brand
6. Verify it reuses the category

Deploy with confidence! 🚀
