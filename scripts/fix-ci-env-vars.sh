#!/bin/bash
# CI Environment Variable Fixes - Issue #1029
# Run this script with appropriate permissions to apply workflow fixes

set -e

echo "=========================================="
echo "CI Environment Variable Fix Script"
echo "Issue #1029: CI Environment Variable Regression"
echo "=========================================="

# Check if we're in the repository root
if [ ! -f "package.json" ]; then
    echo "Error: Run this script from the repository root"
    exit 1
fi

# Backup original files
echo "Creating backups..."
cp .github/workflows/on-push.yml .github/workflows/on-push.yml.bak
cp .github/workflows/on-pull.yml .github/workflows/on-pull.yml.bak

# Fix on-push.yml
echo "Fixing .github/workflows/on-push.yml..."
sed -i 's/VITE_SUPABASE_KEY: \${{ secrets.VITE_SUPABASE_KEY }}/VITE_SUPABASE_ANON_KEY: \${{ secrets.VITE_SUPABASE_ANON_KEY }}/g' .github/workflows/on-push.yml
sed -i '/CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}/d' .github/workflows/on-push.yml
sed -i '/CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}/d' .github/workflows/on-push.yml
sed -i '/SUPABASE_ANON_KEY: \${{ secrets.SUPABASE_ANON_KEY }}/d' .github/workflows/on-push.yml
sed -i '/VITE_SUPABASE_ANON_KEY: \${{ secrets.VITE_SUPABASE_KEY }}/d' .github/workflows/on-push.yml

# Fix on-pull.yml
echo "Fixing .github/workflows/on-pull.yml..."
sed -i 's/VITE_SUPABASE_KEY: \${{ secrets.VITE_SUPABASE_KEY }}/VITE_SUPABASE_ANON_KEY: \${{ secrets.VITE_SUPABASE_ANON_KEY }}/g' .github/workflows/on-pull.yml

# Verify changes
echo ""
echo "=========================================="
echo "Verification Results:"
echo "=========================================="

echo ""
echo "VITE_SUPABASE environment variables:"
grep -n "VITE_SUPABASE" .github/workflows/*.yml

echo ""
echo "Cloudflare environment variables (should be empty):"
grep -n "CLOUDFLARE_" .github/workflows/*.yml || echo "None found (expected)"

echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo "1. Review the changes above"
echo "2. Commit and push: git add .github/workflows/ && git commit -m 'fix(ci): Resolve environment variable regression' && git push"
echo "3. Close Issue #1029"
echo ""
echo "Backups saved as:"
echo "  - .github/workflows/on-push.yml.bak"
echo "  - .github/workflows/on-pull.yml.bak"
