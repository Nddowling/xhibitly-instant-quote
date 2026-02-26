# Git Workflow Guide for Base44 Development

## The Problem

When you make changes in Base44 (the deployed environment) and also make local changes, git can get "weird" because:
1. Base44 auto-commits changes you make in the cloud editor
2. Your local changes conflict with remote commits
3. No clear sync strategy

## The Solution: Proper Workflow

### 🔄 Standard Development Flow

```
Local Dev → Commit → Push → Base44 Deploys
  ↓                           ↓
Test                     Test in Base44
  ↓                           ↓
Merge                    Works? → Done
```

### ⚠️ When You Edit in Base44

If you make changes directly in Base44:

```
Base44 Edit → Auto-commits → Remote ahead of local
                                  ↓
                            Pull before editing locally!
```

---

## Step-by-Step Workflows

### Scenario 1: Normal Local Development

```bash
# 1. Always start by pulling latest
git pull origin main

# 2. Make your changes locally
# ... edit files ...

# 3. Test locally
npm run dev

# 4. Commit and push
git add .
git commit -m "Add booth rendering validation"
git push origin main

# 5. Base44 auto-deploys your changes
```

### Scenario 2: You Edited in Base44

```bash
# 1. Check if remote has new commits
git fetch origin
git status
# Shows: "Your branch is behind 'origin/main' by X commits"

# 2. Stash any local changes
git stash push -m "WIP: local changes before pull"

# 3. Pull Base44 changes
git pull origin main

# 4. Restore your local changes
git stash pop

# 5. Resolve any conflicts
# ... if conflicts, edit files and choose what to keep ...

# 6. Commit merged changes
git add .
git commit -m "Merge Base44 changes with local work"
git push origin main
```

### Scenario 3: Lots of Base44 Changes (Like Today)

```bash
# When Base44 has made many commits (like your 110 commits today)

# 1. Save your work
git add .
git commit -m "WIP: Catalog import work"

# 2. Create a feature branch for your work
git checkout -b feature/catalog-system

# 3. Go back to main and update
git checkout main
git pull origin main

# 4. Merge main into your feature branch
git checkout feature/catalog-system
git merge main

# 5. Resolve conflicts, then merge back
git checkout main
git merge feature/catalog-system
git push origin main
```

### Scenario 4: Reset to Base44 State

```bash
# If you want to discard local changes and match Base44 exactly

# 1. Check what you're losing
git status
git diff

# 2. Backup your local work
git stash push -m "Backup before reset"

# 3. Hard reset to remote
git fetch origin
git reset --hard origin/main

# 4. Verify you're synced
git status
# Should say: "Your branch is up to date with 'origin/main'"
```

---

## Best Practices

### ✅ DO

1. **Always pull before editing**
   ```bash
   git pull origin main  # Start every session with this
   ```

2. **Commit frequently with good messages**
   ```bash
   git commit -m "Add: Product import validation"
   git commit -m "Fix: Booth render branding issue"
   git commit -m "Update: Catalog page mappings"
   ```

3. **Use stash for temporary saves**
   ```bash
   git stash push -m "WIP: Testing import"
   # ... do something else ...
   git stash pop
   ```

4. **Check status before committing**
   ```bash
   git status          # What changed?
   git diff            # Show changes
   git add -p          # Add changes interactively
   ```

5. **Use branches for big features**
   ```bash
   git checkout -b feature/booth-designer
   # ... work on feature ...
   git checkout main
   git merge feature/booth-designer
   ```

### ❌ DON'T

1. **Don't force push** (unless you know what you're doing)
   ```bash
   git push --force  # ❌ Can lose Base44 changes!
   ```

2. **Don't ignore conflicts**
   ```bash
   # When you see:
   # "CONFLICT (content): Merge conflict in src/pages/BoothDesigner.jsx"
   # Must resolve before committing!
   ```

3. **Don't commit generated files**
   ```bash
   # These should be in .gitignore:
   node_modules/
   .env
   dist/
   build/
   .DS_Store
   ```

4. **Don't edit in Base44 and locally at the same time**
   - Pick one: either Base44 OR local
   - If you must: Pull → Edit locally → Push → Then edit in Base44

---

## Handling "Weird" Situations

### Problem: "divergent branches"

```
git pull
# Error: "hint: You have divergent branches and need to specify how to reconcile them"
```

**Solution:**
```bash
# Option A: Merge (recommended)
git pull origin main --no-rebase

# Option B: Rebase (cleaner history)
git pull origin main --rebase

# Option C: Set default behavior
git config pull.rebase false  # Always merge
```

### Problem: Merge conflicts

```
Auto-merging src/pages/BoothDesigner.jsx
CONFLICT (content): Merge conflict in src/pages/BoothDesigner.jsx
```

**Solution:**
```bash
# 1. Open conflicted file
# Look for markers:
<<<<<<< HEAD
// Your local changes
=======
// Base44 changes
>>>>>>> origin/main

# 2. Edit file to keep what you want

# 3. Mark as resolved
git add src/pages/BoothDesigner.jsx

# 4. Complete merge
git commit -m "Merge Base44 changes with local work"
```

### Problem: Accidentally committed secrets

```bash
# If you committed .env or API keys:

# 1. Remove from history (DANGER)
git rm --cached .env
git commit -m "Remove .env from tracking"

# 2. Add to .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Add .env to gitignore"

# 3. Rotate the exposed secrets!
```

---

## Your Catalog Work - Recommended Workflow

For your current catalog import work:

```bash
# 1. Commit your catalog work
git add orbus_catalog/ scripts/ src/lib/catalogSearch.js
git add functions/importOrbusProducts.ts
git add BASE44_PRODUCT_SCHEMA.md GIT_WORKFLOW_GUIDE.md
git commit -m "Add: Orbus catalog scraping and import system

- Scraped 364 products with images, templates, instructions
- Created product-to-catalog-page mapping (72% match rate)
- Built Base44 import function
- Documentation for schema and workflow"

# 2. Push to GitHub
git push origin main

# 3. In Base44, deploy the function
# Go to Functions → Deploy → importOrbusProducts

# 4. Run preview first
# Call function with: { "mode": "preview" }

# 5. If preview looks good, import
# Call function with: { "mode": "import", "skip_existing": true }
```

---

## Quick Reference

```bash
# Daily workflow
git pull origin main              # Start of day
# ... make changes ...
git add .
git commit -m "Descriptive message"
git push origin main              # End of task

# Check sync status
git fetch origin                  # Check remote
git status                        # Am I behind/ahead?

# Save work temporarily
git stash                         # Save changes
git stash pop                     # Restore changes
git stash list                    # See all stashes

# Undo mistakes
git restore file.js               # Discard changes to file
git reset HEAD~1                  # Undo last commit (keep changes)
git reset --hard HEAD~1           # Undo last commit (lose changes)

# Branch management
git checkout -b feature/name      # Create & switch to branch
git checkout main                 # Switch back to main
git merge feature/name            # Merge branch into current
git branch -d feature/name        # Delete branch
```

---

## When to Ask for Help

If you see:
- `fatal: refusing to merge unrelated histories`
- `error: failed to push some refs`
- Multiple conflicting commits
- Lost work after git command

**Don't panic!** Git rarely loses data permanently. It's usually recoverable with `git reflog`.
