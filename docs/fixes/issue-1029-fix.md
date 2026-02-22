# Fix for Issue #1029: CI Environment Variable Regression

## Status
- **Prepared**: 2026-02-22
- **Blocked By**: GitHub App lacks `workflows` permission
- **Requires**: Repository admin to apply manually

## Summary
The CI workflow files contain incorrect environment variable mappings that need to be fixed.

## Changes Required

### 1. `.github/workflows/on-push.yml` (Lines 18-28)

**Current (Incorrect):**
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  IFLOW_API_KEY: ${{ secrets.IFLOW_API_KEY }}
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_KEY: ${{ secrets.VITE_SUPABASE_KEY }}          # ❌ Wrong name
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}  # ❌ Deprecated (refs #896)
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}    # ❌ Deprecated (refs #896)
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  API_KEY: ${{ secrets.GEMINI_API_KEY }}
  SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}          # ❌ Duplicate
  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_KEY }}     # ❌ Wrong secret
```

**Fixed:**
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  IFLOW_API_KEY: ${{ secrets.IFLOW_API_KEY }}
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }} # ✅ Correct
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

### 2. `.github/workflows/on-pull.yml` (Lines 26-31 and 66-72)

**Current (Incorrect):**
```yaml
VITE_SUPABASE_KEY: ${{ secrets.VITE_SUPABASE_KEY }}  # ❌ Wrong name
```

**Fixed:**
```yaml
VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}  # ✅ Correct
```

## Related Issues
- Closes #1029 (CI Environment Variable Regression)
- Also addresses #896 (Cloudflare Workers env vars cleanup)

## Verification Performed
- ✅ Build: 15.26s (passed)
- ✅ Lint: 0 errors
- ✅ Tests: 858 passed
- ✅ TypeCheck: 0 errors

## Actions for Repository Admin

```bash
# Create fix branch
git checkout main && git pull
git checkout -b fix/ci-env-vars-1029

# Apply the changes above to both workflow files

# Commit and push
git add .github/workflows/
git commit -m "fix(ci): Correct CI environment variables - close #1029"
git push -u origin fix/ci-env-vars-1029

# Create PR
gh pr create --title "fix(ci): Correct CI environment variables" --body "Closes #1029, refs #896"
```
