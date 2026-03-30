# Showoffy

A community catalogue and provenance tracker for EDC (Every Day Carry) collectors. Built specifically for small-batch artisan makers — knives, pry bars, tags, beads, spinners, and falcons — where piece identity, maker history, and ownership lineage actually matter.

**Live:** [showoffy.com](https://showoffy.com)

---

## What It Does

Collectors log items by maker, photograph them, and publish them to a shared community feed. Each item has a full detail page with up to 10 photos, metadata, and a provenance history. Group shots let collectors photograph multiple pieces together and tag individual items. The ownership system tracks who currently holds a piece, with a transaction ledger built in for future transfer workflows.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript (ES modules, no framework) |
| Auth | Supabase Auth — email/password, Google OAuth, Facebook OAuth |
| Database | Supabase Postgres with Row Level Security |
| Storage | Supabase Storage (`item-images` bucket, public) |
| Hosting | showoffy.com |

No build step. No bundler. Files are deployed as-is.

---

## Project Structure

```
/
├── index.html              Legacy form (deprecated, still functional)
├── login.html              Sign in / create account / forgot password
├── reset-password.html     Password reset landing page (from email link)
├── home.html               Public community feed — post-login landing page
├── dashboard.html          Maker selection hub (4 brand cards)
├── account.html            User settings: display name, password, theme
│
├── form-atwood.html        Item entry form — Atwood Knife and Tool
├── form-horton.html        Item entry form — Jeremy Horton Knives
├── form-steelflame.html    Item entry form — Steel Flame
├── form-zachwoods.html     Item entry form — Zach Woods Knives
├── form-shared.js          All shared form logic (chips, upload, save, etc.)
├── form-brand.css          Shared form styles
│
├── my-items.html           Owner's collection, grouped by maker
├── item.html               Public item detail page (photos, metadata, provenance)
├── edit-item.html          Owner-only item edit page
├── maker.html              Public maker feed (all items for one maker)
├── group-shot.html         Group shot detail page (tagged items, lightbox)
│
├── theme.js                Theme utility (dark/light, per-user via user_metadata)
├── supabaseClient.js       Supabase client initialisation
└── style.css / form-shared.css / form-brand.css
```

---

## Database Schema

### Core Tables

**`brands`** — Maker/company records. Currently seeded with 4 makers.

**`categories`** — Item type taxonomy (Knife, Tag, Pry bar, Spinner, Bead, Falcon). User-extensible.

**`materials`** — Material taxonomy (S30V, 3V, A2, Titanium, Copper, etc.). User-extensible.

**`items`** — Central table. Key columns:
- `user_id` — who created the record
- `creator_id` — who created the record (never changes)
- `owner_id` — current physical owner (will change with transactions)
- `origin` — `user | maker | admin`
- `is_private` — soft visibility toggle
- `deleted_at` — soft delete timestamp
- `image_url1` … `image_url10` — up to 10 progressive photo uploads
- Full metadata: `category_id`, `material_id`, `maker_id`, `variant`, `size`, `msrp`, `born_on_date`, `extra`, `comments`

**`group_shots`** — Standalone group photos with junction table `group_shot_items` linking to individual items.

**`transactions`** — Ownership ledger (schema complete, UI pending). Tracks transfers with type, status, price, proof, and notes.

### Row Level Security

All tables have RLS enabled. Key policies on `items`:
- Public items (`is_private = false`, `deleted_at IS NULL`) are readable by everyone
- Private items are readable only by their owner
- Owners can see their own soft-deleted items
- Only authenticated users can insert; only owners can update or delete their own items

---

## Auth Flow

1. **Login** → `home.html` (community feed)
2. **OAuth** redirect target: `{origin}/home.html`
3. **Forgot password** → email link → `reset-password.html` → `supabase.auth.updateUser({ password })`
4. **Protected pages** call `requireAuth()` from `form-shared.js`, which saves the current URL to `sessionStorage` before redirecting to login, then restores it post-login
5. **Duplicate account** detection on signup — auto-switches to Sign In tab with a friendly message

---

## Theme System

Theme preference is stored in `user_metadata.theme` (Supabase) so it follows the user across devices and browsers. Default for new users is dark.

- **Anti-flash:** Each page has an inline `<script>` in `<head>` that reads `localStorage` synchronously before render
- **Sync:** After session loads, `supabase.auth.getUser()` fetches fresh `user_metadata` and `syncThemeFromUser()` applies the server value if it differs
- **Write:** Changing the toggle in Account Settings calls `supabase.auth.updateUser({ data: { theme } })` immediately

---

## Item Entry Forms

Each brand form is a two-step flow:

**Step 1 (required):** Category chips, material chips, up to 10 photos, privacy toggle. Photos upload to Supabase Storage immediately on selection. Photo URLs are persisted to `localStorage` only — no other field is autosaved. If the user navigates away, photos are recovered on return.

**Step 2 (optional/skippable):** Variant, size, MSRP, date acquired, extra notes, comments.

Material soft-defaults fire when a category is selected (e.g. selecting Knife auto-selects S30V) but only if the user hasn't manually chosen a material yet.

---

## Makers

| Maker | Form |
|---|---|
| Peter Atwood / Atwood Knife and Tool | `form-atwood.html` |
| Jeremy Horton / Jeremy Horton Knives | `form-horton.html` |
| Derrick Obatake / Steel Flame | `form-steelflame.html` |
| Zach Wood / Zach Woods Knives | `form-zachwoods.html` |

---

## Ownership & Provenance (Phase 1 Complete)

Every item has three ownership fields:

- `creator_id` — set at insert, never changes
- `owner_id` — current owner, will be updated by future transaction confirmations
- `origin` — how the record entered the system

The `transactions` table is fully migrated with type and status enums. Two-party transfer UI (Phase 2) is pending.

---

## Supabase Configuration

- **Project ID:** `vwyupivwafvhwyladpth` (us-east-1)
- **Storage bucket:** `item-images` (public)
- **Site URL:** `https://showoffy.com`
- **Redirect URLs:** `https://showoffy.com/home.html`, `https://showoffy.com/reset-password.html`
- **Auth providers:** Email/password, Google, Facebook

> The `reset-password.html` URL must be in the Supabase allowed redirect list under Authentication → URL Configuration.

---

## Local Development

There is no build step. Open the files directly or serve them with any static file server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Set your Supabase project URL and anon key in `supabaseClient.js`.

---

## Pending / Roadmap

- **Phase 2** — Transaction UI: two-party ownership transfer handshake, recipient lookup by email
- **Phase 3** — Maker verification: `verified_user_id` on brands, admin grant flow
- **Phase 4** — Public provenance display on item detail pages
- **Brand-scoped chips** — `brand_categories` and `brand_materials` join tables so each maker form shows only relevant categories and materials
- **Storage cleanup** — periodic job to remove orphaned uploaded files (photos uploaded but never saved to an item)
- **Custom SMTP** — replace Supabase default email sender with a branded domain for auth emails

---

## Notes for Future Development

- All form logic lives in `form-shared.js`. When adding a new maker, create a new `form-{maker}.html` copying the structure of an existing form and updating `MAKER_ID`.
- `CATEGORY_MATERIAL_DEFAULTS` in `form-shared.js` maps `category_id → [primary_material_id, ...fallbacks]`. Update this when adding new categories.
- `theme.js` is the single source of truth for dark/light mode. Import `syncThemeFromUser` and call it after session load on any new page.
- The `legacy/` forms (`index.html`, `app.js`) are deprecated but still functional. They have a sticky deprecation banner.
