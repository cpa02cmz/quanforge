#!/bin/bash
# DevOps CI/CD Fix Script
# This script applies the required workflow fixes for issues #1029 and #896
# Run this script with admin permissions to update workflow files

set -e

echo "=== DevOps CI/CD Fix Script ==="
echo "This script fixes:"
echo "  - Issue #1029: CI Environment Variable Regression"
echo "  - Issue #896: Cloudflare Workers Environment Variables Cleanup"
echo ""

# Check if we're in the repository root
if [ ! -d ".github/workflows" ]; then
    echo "Error: .github/workflows directory not found"
    echo "Please run this script from the repository root"
    exit 1
fi

echo "Applying fixes to .github/workflows/on-push.yml..."

# Fix on-push.yml - Replace VITE_SUPABASE_KEY with VITE_SUPABASE_ANON_KEY
sed -i 's/VITE_SUPABASE_KEY: \${{ secrets.VITE_SUPABASE_KEY }}/VITE_SUPABASE_ANON_KEY: \${{ secrets.VITE_SUPABASE_ANON_KEY }}/g' .github/workflows/on-push.yml

# Remove Cloudflare variables
sed -i '/CLOUDFLARE_ACCOUNT_ID:/d' .github/workflows/on-push.yml
sed -i '/CLOUDFLARE_API_TOKEN:/d' .github/workflows/on-push.yml

# Remove duplicate VITE_SUPABASE_ANON_KEY line that maps to wrong secret
sed -i '/VITE_SUPABASE_ANON_KEY: \${{ secrets.VITE_SUPABASE_KEY }}/d' .github/workflows/on-push.yml

echo "Applying fixes to .github/workflows/on-pull.yml..."

# Fix on-pull.yml - Replace VITE_SUPABASE_KEY with VITE_SUPABASE_ANON_KEY
sed -i 's/VITE_SUPABASE_KEY: \${{ secrets.VITE_SUPABASE_KEY }}/VITE_SUPABASE_ANON_KEY: \${{ secrets.VITE_SUPABASE_ANON_KEY }}/g' .github/workflows/on-pull.yml

echo ""
echo "=== Verification ==="
echo "Checking for remaining issues..."

# Check for remaining VITE_SUPABASE_KEY references
if grep -q "VITE_SUPABASE_KEY:" .github/workflows/*.yml; then
    echo "Warning: VITE_SUPABASE_KEY still found in workflows"
    grep "VITE_SUPABASE_KEY:" .github/workflows/*.yml
else
    echo "✅ No VITE_SUPABASE_KEY references found (correct)"
fi

# Check for remaining Cloudflare references
if grep -q "CLOUDFLARE_ACCOUNT_ID:\|CLOUDFLARE_API_TOKEN:" .github/workflows/*.yml; then
    echo "Warning: Cloudflare variables still found in workflows"
    grep "CLOUDFLARE_ACCOUNT_ID:\|CLOUDFLARE_API_TOKEN:" .github/workflows/*.yml
else
    echo "✅ No Cloudflare variable references found (correct)"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Review the changes: git diff .github/workflows/"
echo "2. Commit the changes: git add .github/workflows/ && git commit -m 'fix(ci): Resolve CI environment variable regressions'"
echo "3. Push the changes: git push"
echo "4. Close issues #1029 and #896"
echo ""
echo "Done!"
