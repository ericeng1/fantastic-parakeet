# Setting Up Git Version Control for Showoffy

This guide walks through initialising a local git repository, protecting your
credentials, and pushing to GitHub. No build tools required — the project is
plain HTML/CSS/JS files.

---

## Prerequisites

- Git installed — check with `git --version`. If missing, download from git-scm.com
- A GitHub account at github.com
- Your Showoffy project folder on your local machine with all the files deployed

---

## Step 1 — Make sure supabaseClient.js is safe

Your `supabaseClient.js` contains your Supabase project URL and anon key. These
must never be committed. Before touching git:

1. Open your project folder in a terminal
2. Confirm `supabaseClient.js` exists and contains your real credentials
3. The `.gitignore` file you received already lists `supabaseClient.js` — do not
   remove it from there

**Commit the example file instead:**

The repo should contain `supabaseClient.example.js` (safe to commit — it has
placeholder values only). Anyone cloning the repo will copy it and fill in their
own credentials. Your real `supabaseClient.js` will never appear in git history.

---

## Step 2 — Initialise the local repository

Open a terminal in your project root folder (where index.html, home.html, etc. live):

```bash
git init
git add .
git status
```

`git status` will show every file staged for the first commit. Verify that
`supabaseClient.js` is **not** in the list. If it appears, stop and check your
`.gitignore` — the file must be in the project root, not a subfolder.

```bash
# If supabaseClient.js appeared in git status, unstage it:
git rm --cached supabaseClient.js
```

Once you've confirmed credentials are excluded:

```bash
git commit -m "Initial commit — Showoffy EDC collector platform"
```

---

## Step 3 — Create a repository on GitHub

1. Go to github.com → click the **+** → **New repository**
2. Name it `showoffy` (or whatever you prefer)
3. Set visibility to **Private** for now — you can make it public later
4. **Do not** initialise with a README, .gitignore, or licence — you already have these
5. Click **Create repository**

GitHub will show you a page with setup commands. You want the section labelled
**"…or push an existing repository from the command line"**.

---

## Step 4 — Connect local repo to GitHub and push

```bash
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/showoffy.git
git branch -M main
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

After this, your code is on GitHub. Go to the repo page and confirm:
- `supabaseClient.js` is **absent** from the file list
- `supabaseClient.example.js` is **present**
- `.gitignore` is **present**
- `README.md` is **present** and renders as the repo description

---

## Step 5 — Ongoing workflow

Every time you update a file and want to save that version:

```bash
# See what changed
git status
git diff

# Stage the files you want to commit
git add home.html form-shared.js
# Or stage everything:
git add .

# Commit with a descriptive message
git commit -m "Fix theme sync across pages"

# Push to GitHub
git push
```

---

## Useful commit message conventions

Keep messages short and in the present tense:

```
Add forgot password link to login page
Fix owner_id null bug on new item inserts
Remove draft autosave — keep photo URL persistence only
Update README with Phase 1 provenance schema
```

---

## If you accidentally commit supabaseClient.js

If it ever slips through, act immediately:

```bash
# Remove it from the repo but keep the local file
git rm --cached supabaseClient.js
git commit -m "Remove supabaseClient.js from tracking"
git push
```

Then go to your Supabase Dashboard → Project Settings → API → **rotate your
anon key**. A key that has been pushed to a public repo — even briefly — should
be considered compromised. The anon key has limited permissions (RLS protects
your data), but rotating it is the safe move.

---

## Branch strategy (optional, for later)

Once you start working on Phase 2 (transaction UI), consider a simple branch
workflow:

```bash
# Create a feature branch
git checkout -b feature/transaction-ui

# ... make changes, commit ...

# Merge back to main when done
git checkout main
git merge feature/transaction-ui
git push
```

This keeps `main` always deployable and your in-progress work isolated.

---

## Verifying nothing sensitive is tracked

At any point you can audit what git knows about:

```bash
# List every tracked file
git ls-files

# Check git history for any mention of your key (replace with first few chars)
git log --all --full-history -- supabaseClient.js
```

If the second command returns nothing, the file has never been committed.
