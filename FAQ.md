# Frequently Asked Questions (FAQ)

## General Questions

### Q: Do I need to make any database schema changes?
**A:** No. Your existing `brand_categories` table is used as-is. No migrations needed.

### Q: Will this break any existing functionality?
**A:** No. All changes are backward compatible. The `brandId` parameter is optional.

### Q: How long will deployment take?
**A:** ~15 minutes total:
- 5 min: Replace files
- 5 min: Test
- 5 min: Deploy to production

### Q: Can I roll back if something goes wrong?
**A:** Yes, easily. Restore your backed-up files and the system falls back to global behavior.

### Q: Do I need to update any documentation?
**A:** Only internal docs. No public API changes or documentation updates needed.

---

## Technical Questions

### Q: What if my brand doesn't have any categories configured?
**A:** The form will show an empty state ("Loading..."). Configure categories in `brand_categories` table first.

**Solution:**
```sql
-- Add categories for a brand
INSERT INTO brand_categories (brand_id, category_id, sort_order)
VALUES 
  (1, 2, 1),   -- Atwood → Knife
  (1, 3, 2),   -- Atwood → Pry bar
  (1, 4, 3);   -- Atwood → Bead
```

### Q: Why are materials still global, not brand-scoped?
**A:** Your business logic treats materials as global. Same implementation pattern can be applied to materials later (see IMPLEMENTATION_GUIDE.md).

### Q: Can a category belong to multiple brands?
**A:** Yes! That's the whole point. The same "Knife" category (database row) can link to multiple brands via separate `brand_categories` rows.

### Q: What happens if I add the same category name on two brands?
**A:** The second one reuses the existing category ID. No duplication in the `categories` table.

**Example:**
```
categories table:
id │ name
────────
2  │ Knife

brand_categories table:
brand_id │ category_id
──────────────────────
1        │ 2        (Atwood → Knife)
4        │ 2        (Zach Woods → Knife, added later)
```

### Q: How is the display order determined?
**A:** By `sort_order` in the `brand_categories` table:
```
sort_order │ category
──────────────────────
1          │ Knife
2          │ Pry bar
3          │ Bead
```

Lower numbers display first.

### Q: What if I want to reorder categories?
**A:** Update `sort_order` in the `brand_categories` table:
```sql
UPDATE brand_categories
SET sort_order = 2
WHERE brand_id = 1 AND category_id = 3;
```

The form will display in the new order on next load.

### Q: How does the similarity check work?
**A:** When adding a new category, the system uses Levenshtein distance to find similar names and warn the user. This prevents accidental duplicates.

**Example:** If "Knife" exists and user types "Knive", they get a warning.

### Q: Can I add a category that already exists?
**A:** Yes. The system detects it's already in the database and reuses it. No duplicate INSERT.

---

## Deployment Questions

### Q: What if deployment fails halfway?
**A:** 
1. Your backed-up old files still work
2. Restore them
3. System falls back to global behavior
4. Investigate issue in dev/staging before retrying

### Q: Do I need to clear browser caches?
**A:** Users should hard-refresh (Cmd+Shift+R / Ctrl+Shift+R) after deployment.

### Q: What about CDN cache?
**A:** If you use a CDN:
1. Invalidate cache for form-*.html files
2. Invalidate cache for form-shared.js
3. Deploy new files

### Q: Should I deploy all files at once?
**A:** Yes. All five files are interdependent. Deploy them together.

### Q: Can I deploy to staging first?
**A:** Absolutely recommended! Use DEPLOYMENT_CHECKLIST.md on staging before production.

### Q: What if users are using the forms during deployment?
**A:** Brief outage possible while files are uploading. Recommend deploying during off-hours.

---

## Testing Questions

### Q: How do I test this locally?
**A:** 
1. Copy new files to your local project
2. Run local server (`python -m http.server`)
3. Follow DEPLOYMENT_CHECKLIST.md testing section

### Q: What should I test?
**A:** 
1. Each form loads correct categories
2. Add a test category on one form
3. Verify it doesn't appear on other forms
4. Add same category on different form
5. Verify it reuses the category

### Q: How do I test with real data?
**A:** 
1. Add test categories to `brand_categories` table
2. Load forms in browser
3. Verify they appear

### Q: What if tests fail?
**A:** 
1. Hard refresh browser (Cmd+Shift+R)
2. Check Supabase logs for query errors
3. Verify BRAND_ID constant in form file
4. Check that `brand_categories` has rows for the brand

---

## Performance Questions

### Q: Will this slow down the application?
**A:** No. The JOIN query is fast (~10ms) with proper indexes.

### Q: Are there query optimizations I should know about?
**A:** 
- Ensure indexes exist on `brand_categories(brand_id)` and `categories(id)`
- Indexes already recommended in DATABASE_ARCHITECTURE.md
- Query uses INNER JOIN (efficient)

### Q: How many categories can each brand have?
**A:** Unlimited. System handles 100+ categories fine.

### Q: Does this affect item creation/loading performance?
**A:** No. This only affects the category chip loading on forms. Item save/load unchanged.

---

## Data Consistency Questions

### Q: What if a category is deleted?
**A:** Deleting the category will cascade-delete its `brand_categories` links (if configured). Forms will show one fewer category.

**Recommendation:** Soft-delete (add `deleted_at` timestamp) instead of hard delete to preserve history.

### Q: What if a brand is deleted?
**A:** All `brand_categories` rows for that brand will be deleted (if cascade configured). Orphaned items remain (can be reassigned).

### Q: Can I have duplicate category/brand links?
**A:** No. The `UNIQUE(brand_id, category_id)` constraint prevents duplicates.

### Q: What if the same category is added twice?
**A:** System detects it's already added and skips the second insert.

---

## Troubleshooting Questions

### Q: Categories show but they're wrong categories
**A:** 
1. Verify BRAND_ID constant matches your database
2. Check `brand_categories` has correct rows
3. Hard refresh browser

### Q: No categories load at all
**A:** 
1. Check browser console for errors
2. Check Supabase logs
3. Verify `brand_categories` table has rows for that brand_id
4. Hard refresh browser

### Q: New category added but doesn't appear
**A:** 
1. Reload the page
2. Check Supabase that category was inserted
3. Check `brand_categories` link was created
4. Verify RLS allows INSERT

### Q: Category appears on wrong brand
**A:** 
1. Check `brand_categories` table
2. Verify each brand has correct category links
3. Delete incorrect link from `brand_categories`
4. Reload form

### Q: Add category button doesn't work
**A:** 
1. Check browser console for errors
2. Verify `addNewLookup` is called with BRAND_ID parameter
3. Check RLS on `categories` table allows INSERT
4. Check RLS on `brand_categories` table allows INSERT

### Q: Materials aren't loading
**A:** 
1. Materials are global (not brand-scoped)
2. Should show same materials on all forms
3. If not loading, check Supabase logs
4. Verify `materials` table has rows

---

## Business Logic Questions

### Q: Why brand-scope categories but not materials?
**A:** 
- Categories: Meaningful organization varies by brand
  - "Knife", "Pry bar", "Bead" make sense for some brands
  - Not for others
- Materials: Universal across all brands
  - "S30V", "Titanium", "Brass" relevant everywhere

### Q: Can I change this later?
**A:** Yes. Same pattern can be applied to materials later (see IMPLEMENTATION_GUIDE.md for future roadmap).

### Q: What's the business value?
**A:** 
- Reduced cognitive load: users see only relevant categories
- Cleaner UI: fewer chips to scroll through
- Better data quality: categories curated by brand
- Guided experience: helps users pick correct category

---

## Integration Questions

### Q: Does this affect the item detail page?
**A:** No. Item pages display all items regardless of category filtering.

### Q: Does this affect search/filtering?
**A:** No. Search and filter use the global `categories` table, not brand-scoped view.

### Q: Does this affect the admin interface?
**A:** Only if you have category management UI. That would need updates to respect brand_categories.

### Q: Can I use this pattern elsewhere?
**A:** Yes! Same pattern can be applied to materials, colors, finishes, etc.

---

## Support Questions

### Q: What if I find a bug?
**A:** 
1. Document the bug (steps to reproduce)
2. Check if it's a local caching issue (hard refresh)
3. Check browser console for errors
4. Check Supabase logs for query errors
5. Escalate with documentation

### Q: Where do I get help?
**A:** 
1. Check IMPLEMENTATION_GUIDE.md (Debugging section)
2. Review DATABASE_ARCHITECTURE.md (data flow)
3. Check browser console for specific error messages
4. Review Supabase logs for database errors

### Q: What if something goes wrong in production?
**A:** 
1. Restore backed-up old files immediately
2. Deploy rollback
3. Forms go back to global categories
4. Investigate in dev/staging
5. Retry deployment

### Q: How do I report issues?
**A:** 
- Document:
  1. What you did
  2. What you expected
  3. What actually happened
  4. Browser/device info
  5. Screenshot of error

---

## Upgrade/Future Questions

### Q: What about future updates to this code?
**A:** Changes will maintain backward compatibility. Test in staging first.

### Q: Can I customize the category chip styling?
**A:** Yes. Styling is in `form-brand.css`. Not affected by this change.

### Q: Can I add more brands in the future?
**A:** Yes. Just:
1. Add brand to `brands` table
2. Add links to `brand_categories` table
3. Create new form-brandname.html with BRAND_ID
4. Deploy

### Q: What about other databases (not Supabase)?
**A:** Same pattern works with any SQL database with JOIN support.

---

## Questions Not Answered Here?

Check the documentation in this order:
1. **Quick issue?** → QUICK_REFERENCE.md
2. **Deployment issue?** → DEPLOYMENT_SUMMARY.md or DEPLOYMENT_CHECKLIST.md
3. **Technical deep-dive?** → IMPLEMENTATION_GUIDE.md
4. **Want to understand data flow?** → DATABASE_ARCHITECTURE.md
5. **Want to see the code changes?** → BEFORE_AND_AFTER.md

---

## Quick Checklist for Common Issues

### Categories not showing
- [ ] Hard refresh browser (Cmd+Shift+R)
- [ ] Check BRAND_ID constant is set
- [ ] Check brand_categories table has rows
- [ ] Check Supabase logs

### Wrong categories showing
- [ ] Verify BRAND_ID matches database brand_id
- [ ] Check brand_categories for correct links
- [ ] Hard refresh browser

### New category not appearing
- [ ] Reload page
- [ ] Check category inserted in database
- [ ] Check link created in brand_categories
- [ ] Verify RLS permissions

### Form not loading at all
- [ ] Check browser console for errors
- [ ] Check Supabase logs
- [ ] Hard refresh browser
- [ ] Check network tab in DevTools

---

## Support Escalation Path

**Issue Type → First Check → If Still Broken**

| Issue | First Check | Escalate To |
|-------|------------|-------------|
| Categories wrong | Hard refresh | Verify BRAND_ID, check database |
| Categories not loading | Browser console | Supabase logs |
| Add category broken | RLS permissions | Check auth |
| Deployment failed | Rollback procedure | Debug in staging |
| Performance issue | Index existence | Query profiling |
| Data inconsistency | brand_categories table | Database audit |

---

If your question isn't here, check the index in README.md for the right documentation file!
