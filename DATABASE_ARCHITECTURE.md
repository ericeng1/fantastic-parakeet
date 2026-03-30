# Database Query Flow & Architecture

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User Opens form-atwood.html                                 │
│ (BRAND_ID = 1)                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ loadChips({                                                 │
│   table: "categories",                                      │
│   brandId: 1         ← KEY: Pass BRAND_ID                   │
│ })                                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Supabase Query:                                             │
│                                                             │
│ SELECT c.id, c.name                                         │
│ FROM brand_categories bc                                    │
│ INNER JOIN categories c                                     │
│   ON bc.category_id = c.id                                  │
│ WHERE bc.brand_id = 1   ← Filter by brand                   │
│ ORDER BY bc.sort_order ASC                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Database Returns:                                           │
│                                                             │
│ id  │ name                                                  │
│ ────┼──────────────                                         │
│ 2   │ Knife       (sort_order: 1)                           │
│ 3   │ Pry bar     (sort_order: 2)                           │
│ 4   │ Bead        (sort_order: 3)                           │
│ 9   │ Spinner     (sort_order: 4)                           │
│ 11  │ Tool        (sort_order: 5)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Form Renders Category Chips:                                │
│                                                             │
│  [Knife] [Pry bar] [Bead] [Spinner] [Tool] [+ Add]          │
│                                                             │
│ Only Atwood's categories shown!                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Table Relationships

```
┌─────────────────────┐
│      brands         │
├─────────────────────┤
│ id (PK)      ◄──┐   │
│ company      │   │   │
│ first_name   │   │   │
│ last_name    │   │   │
└─────────────────────┘
                 │
                 │ 1:N
                 │
        ┌────────┘
        │
        ▼
┌──────────────────────────────┐       ┌──────────────────────┐
│   brand_categories           │       │    categories        │
├──────────────────────────────┤       ├──────────────────────┤
│ id (PK)                      │       │ id (PK)        ◄─────┤──┐
│ brand_id (FK) ───────────┐   │       │ name                 │  │
│ category_id (FK) ────────┼───────► │                      │  │
│ sort_order               │   │       │                      │  │
└──────────────────────────────┘       └──────────────────────┘  │
                                                                  │
        ┌─────────────────────────────────────────────────────────┘
        │
        │ M:N Relationship
        │
        ▼
   (categories shown to multiple brands)
```

---

## Example: Adding a New Category

### Before Addition
```
brand_categories table:
brand_id │ category_id │ sort_order
──────────────────────────────────
   1     │      2      │    1       (Atwood → Knife)
   1     │      3      │    2       (Atwood → Pry bar)
   1     │      4      │    3       (Atwood → Bead)
   1     │      9      │    4       (Atwood → Spinner)
   1     │     11      │    5       (Atwood → Tool)
```

### User Action
**User on form-atwood.html clicks "+ Add Category" and enters "Axe Head"**

### Database Operations (Automatic)

**Step 1: Insert into categories table**
```sql
INSERT INTO categories (name) 
VALUES ('Axe Head')
RETURNING id;
→ Returns: id = 42
```

**Step 2: Find max sort_order for brand 1**
```sql
SELECT MAX(sort_order) as max_sort
FROM brand_categories
WHERE brand_id = 1;
→ Returns: max_sort = 5
```

**Step 3: Link new category to brand with next sort_order**
```sql
INSERT INTO brand_categories 
  (brand_id, category_id, sort_order)
VALUES (1, 42, 6)
```

### After Addition
```
brand_categories table:
brand_id │ category_id │ sort_order
──────────────────────────────────
   1     │      2      │    1       (Atwood → Knife)
   1     │      3      │    2       (Atwood → Pry bar)
   1     │      4      │    3       (Atwood → Bead)
   1     │      9      │    4       (Atwood → Spinner)
   1     │     11      │    5       (Atwood → Tool)
   1     │     42      │    6       (Atwood → Axe Head) ← NEW

categories table now has:
id │ name
─────────────────
42 │ Axe Head    ← NEW
```

### Result
✅ New "Axe Head" category appears in Atwood's list
✅ Not visible on Horton, Steel Flame, or Zach Woods forms
✅ Can be added to other brands later

---

## Example: Reusing Category Across Brands

### Scenario
**Same "Axe Head" category added on form-horton.html**

### Database Operations

**Step 1: Insert into categories table**
```sql
INSERT INTO categories (name) 
VALUES ('Axe Head')
RETURNING id;
→ ERROR: Duplicate key violation!
→ Category already exists, use existing id: 42
```

**Step 2: Check if link exists**
```sql
SELECT id FROM brand_categories
WHERE brand_id = 2 AND category_id = 42;
→ Returns: NULL (no link yet)
```

**Step 3: Link existing category to Horton**
```sql
INSERT INTO brand_categories 
  (brand_id, category_id, sort_order)
VALUES (2, 42, 4)  ← Horton's next sort_order
```

### Result
```
brand_categories table:
brand_id │ category_id │ sort_order
──────────────────────────────────
   1     │     42      │    6       (Atwood → Axe Head)
   2     │     42      │    4       (Horton → Axe Head) ← NEW

categories table:
id │ name
─────────────────
42 │ Axe Head  ← Same row, two brands linked to it!
```

✅ "Axe Head" now appears in both Atwood AND Horton lists
✅ No duplication in categories table
✅ Each brand has its own sort_order

---

## Query Patterns

### Pattern 1: Load Categories for a Brand
```javascript
// In form-atwood.html
await loadChips({
  table: "categories",
  brandId: 1
})

// Generates:
SELECT c.id, c.name
FROM brand_categories bc
INNER JOIN categories c ON bc.category_id = c.id
WHERE bc.brand_id = 1
ORDER BY bc.sort_order ASC
```

### Pattern 2: Load All Categories (Global)
```javascript
// In any helper/admin code
await loadChips({
  table: "categories"
  // No brandId = global fallback
})

// Generates:
SELECT id, name
FROM categories
ORDER BY name ASC
```

### Pattern 3: Add Category to Brand
```javascript
// In form handler
await addNewLookup("categories", 1)

// Does:
1. INSERT INTO categories (name) VALUES (...)
2. INSERT INTO brand_categories (brand_id, category_id, sort_order) VALUES (1, ...)
```

### Pattern 4: Add Category Global
```javascript
// In admin code
await addNewLookup("categories")

// Does:
1. INSERT INTO categories (name) VALUES (...)
// No brand link
```

---

## Sort Order Management

### How sort_order Works
```
Each brand has its own ordering:

Atwood (brand_id = 1):          Horton (brand_id = 2):
sort_order │ category           sort_order │ category
──────────────────────          ──────────────────────
     1     │ Knife                   1     │ Pry bar
     2     │ Pry bar                 2     │ Bead
     3     │ Bead                    3     │ Patch
     4     │ Spinner
     5     │ Tool
     6     │ (new ones added here)
```

### Automatic Sort Order Assignment
```javascript
// When adding new category to Atwood:
1. Find current max: SELECT MAX(sort_order) FROM brand_categories WHERE brand_id = 1
   → Returns: 6
2. New sort_order = 6 + 1 = 7
3. Insert with sort_order = 7
4. User sees new category at end of list
```

---

## Query Execution Flow

### Diagram: Query Path for Categories
```
┌─────────────────────────────────────────────┐
│ Form loads: loadChips({                     │
│   table: "categories",                      │
│   brandId: 1                                │
│ })                                          │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
          ┌─────────────────────────────┐
          │ Check: brandId provided?    │
          │ AND table === "categories"? │
          └─────┬───────────────────┬───┘
                │ YES               │ NO
                ▼                   ▼
    ┌──────────────────────┐  ┌───────────────────┐
    │ Query brand_categories│  │ Query categories  │
    │ JOIN categories      │  │ (all rows)        │
    │ WHERE brand_id = 1   │  │ ORDER BY name     │
    │ ORDER BY sort_order  │  │                   │
    └──────────┬───────────┘  └──────────┬────────┘
               │                         │
               ▼                         ▼
    ┌──────────────────────┐  ┌───────────────────┐
    │ Atwood's 5 categories│  │ All categories    │
    │ (filtered & ordered) │  │ (global fallback) │
    └──────────────────────┘  └───────────────────┘
```

---

## Transaction Safety

### Scenario: Add "Knife" to Horton when it already exists for Atwood

```
┌─────────────────────────────────────────────────────────┐
│ User enters "Knife" on form-horton.html                 │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Step 1: Try to INSERT into categories (name = "Knife")  │
│                                                         │
│ INSERT INTO categories (name) VALUES ('Knife')          │
│                                                         │
│ ❌ CONSTRAINT VIOLATION: UNIQUE(name)                   │
│    Category "Knife" already exists (id = 2)             │
│                                                         │
│ ✅ Handle gracefully: Reuse existing id = 2             │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Check if Horton already linked to "Knife"      │
│                                                         │
│ SELECT id FROM brand_categories                         │
│ WHERE brand_id = 2 AND category_id = 2                  │
│                                                         │
│ ✅ Link doesn't exist (would have no result)            │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: INSERT link into brand_categories               │
│                                                         │
│ INSERT INTO brand_categories                            │
│ (brand_id, category_id, sort_order)                     │
│ VALUES (2, 2, 4)                                        │
│                                                         │
│ ✅ Success: Link created                                │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Result: "Knife" now in both brands' lists               │
│                                                         │
│ categories table: Single "Knife" row (id=2)             │
│ brand_categories: Two rows linking brands to id=2       │
│                                                         │
│ ✅ No duplication, clean state                          │
└─────────────────────────────────────────────────────────┘
```

---

## Performance Notes

### Query Performance

**Query 1: Load categories for Atwood (BRAND_ID=1)**
```sql
SELECT c.id, c.name
FROM brand_categories bc
INNER JOIN categories c ON bc.category_id = c.id
WHERE bc.brand_id = 1
ORDER BY bc.sort_order ASC
```
- **Indexes needed:** `brand_categories(brand_id)`, `categories(id)`
- **Expected execution:** < 10ms
- **Result set size:** 3-8 rows (small)

**Query 2: Load all categories (global)**
```sql
SELECT id, name
FROM categories
ORDER BY name ASC
```
- **Indexes needed:** `categories(id)`
- **Expected execution:** < 5ms
- **Result set size:** ~100 rows (still small)

### Caching Strategy

```javascript
// Categories loaded once on form init
const categoryChips = await loadChips({...})

// Not refetched unless:
// - User clicks "+ Add Category"
// - User manually reloads page
// - Cache expires (in real app)

// Adding category refetches and re-renders:
const result = await addNewLookup(...)
if (result) {
  await loadChips({...}) // Refresh list
}
```

---

## Database Index Recommendations

For optimal performance, ensure these indexes exist:

```sql
-- Index for filtering by brand_id
CREATE INDEX idx_brand_categories_brand_id 
  ON brand_categories(brand_id);

-- Index for checking existing links
CREATE INDEX idx_brand_categories_brand_category 
  ON brand_categories(brand_id, category_id);

-- Index for sorting by sort_order
CREATE INDEX idx_brand_categories_sort 
  ON brand_categories(brand_id, sort_order);

-- Index on categories for uniqueness
CREATE UNIQUE INDEX idx_categories_name 
  ON categories(name);
```

These indexes ensure:
- ✅ Fast filtering by brand
- ✅ Fast duplicate checking
- ✅ Fast ordering by sort_order
- ✅ Fast category lookups

---

## Summary

```
Query Flow:
  loadChips(brandId=1)
    └─→ Query brand_categories JOIN categories
        └─→ WHERE brand_id = 1
            └─→ ORDER BY sort_order
                └─→ Returns Atwood's 5 categories

Adding Category Flow:
  addNewLookup("categories", brandId=1)
    └─→ Try INSERT into categories
        ├─→ If exists: Reuse ID
        └─→ If new: Get new ID
            └─→ Link to brand: INSERT into brand_categories
                └─→ New category appears in Atwood's list

Reusing Category Flow:
  addNewLookup("categories", brandId=2)
    └─→ Try INSERT into categories
        └─→ Already exists: Reuse ID (no duplicate)
            └─→ Link to Horton: INSERT into brand_categories
                └─→ Existing category now in Horton's list too
```

This architecture ensures clean data, prevents duplication, and maintains brand-specific curation.
