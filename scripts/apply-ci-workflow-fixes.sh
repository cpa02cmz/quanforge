#!/bin/bash
#
# CI Workflow Environment Variable Fixes
# Issues: #1029, #896
# Date: 2026-02-22
#
# This script applies the necessary fixes to CI workflow files.
# Run this script with appropriate permissions to modify workflow files.
#

set -e

echo "=========================================="
echo "CI Workflow Environment Variable Fixes"
echo "Issues: #1029, #896"
echo "=========================================="

# Check if we're in the repository root
if [ ! -d ".github/workflows" ]; then
    echo "Error: .github/workflows directory not found"
    echo "Please run this script from the repository root"
    exit 1
fi

# Backup original files
echo ""
echo "Creating backups..."
cp .github/workflows/on-push.yml .github/workflows/on-push.yml.bak
cp .github/workflows/on-pull.yml .github/workflows/on-pull.yml.bak
echo "✓ Backups created"

# Fix on-push.yml
echo ""
echo "Fixing on-push.yml..."
sed -i 's/VITE_SUPABASE_KEY: \${{ secrets.VITE_SUPABASE_KEY }}/VITE_SUPABASE_ANON_KEY: \${{ secrets.VITE_SUPABASE_ANON_KEY }}/g' .github/workflows/on-push.yml
sed -i '/CLOUDFLARE_ACCOUNT_ID/d' .github/workflows/on-push.yml
sed -i '/CLOUDFLARE_API_TOKEN/d' .github/workflows/on-push.yml
sed -i 's/VITE_SUPABASE_ANON_KEY: \${{ secrets.VITE_SUPABASE_KEY }}/VITE_SUPABASE_ANON_KEY: \${{ secrets.VITE_SUPABASE_ANON_KEY }}/g' .github/workflows/on-push.yml
echo "✓ on-push.yml fixed"

# Fix on-pull.yml
echo ""
echo "Fixing on-pull.yml..."
sed -i 's/VITE_SUPABASE_KEY: \${{ secrets.VITE_SUPABASE_KEY }}/VITE_SUPABASE_ANON_KEY: \${{ secrets.VITE_SUPABASE_ANON_KEY }}/g' .github/workflows/on-pull.yml
echo "✓ on-pull.yml fixed"

# Verification
echo ""
echo "=========================================="
echo "Verification"
echo "=========================================="

echo ""
echo "Checking for remaining deprecated variables..."
if grep -q "VITE_SUPABASE_KEY:" .github/workflows/*.yml 2>/dev/null; then
    echo "⚠️  Warning: VITE_SUPABASE_KEY still found in workflow files"
else
    echo "✓ VITE_SUPABASE_KEY removed from all workflow files"
fi

if grep -q "CLOUDFLARE_ACCOUNT_ID:" .github/workflows/*.yml 2>/dev/null; then
    echo "⚠️  Warning: CLOUDFLARE_ACCOUNT_ID still found in workflow files"
else
    echo "✓ CLOUDFLARE_ACCOUNT_ID removed from all workflow files"
fi

if grep -q "CLOUDFLARE_API_TOKEN:" .github/workflows/*.yml 2>/dev/null; then
    echo "⚠️  Warning: CLOUDFLARE_API_TOKEN still found in workflow files"
else
    echo "✓ CLOUDFLARE_API_TOKEN removed from all workflow files"
fi

echo ""
echo "=========================================="
echo "Fixes Applied Successfully!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review the changes: git diff .github/workflows/"
echo "2. Commit the changes: git add .github/workflows/ && git commit -m 'fix(ci): Apply environment variable fixes'"
echo "3. Push the changes: git push"
echo "4. Close issues #1029 and #896"
echo ""
echo "If something goes wrong, restore from backups:"
echo "  mv .github/workflows/on-push.yml.bak .github/workflows/on-push.yml"
echo "  mv .github/workflows/on-pull.yml.bak .github/workflows/on-pull.yml"
echo ""
