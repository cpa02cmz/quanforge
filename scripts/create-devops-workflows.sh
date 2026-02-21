#!/bin/bash
# DevOps Workflow Creation Script
# This script creates the necessary CI/CD workflows for the repository
# Run this script with appropriate permissions

set -e

echo "=== DevOps Workflow Creation Script ==="
echo ""

# Create branch-cleanup.yml
echo "Creating branch-cleanup.yml..."
cat > .github/workflows/branch-cleanup.yml << 'WORKFLOW_EOF'
name: Branch Cleanup

on:
  schedule:
    # Run weekly on Sundays at 00:00 UTC
    - cron: '0 0 * * 0'
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Dry run mode (no actual deletions)'
        required: false
        default: 'true'
        type: boolean
      days_threshold:
        description: 'Days threshold for stale branches'
        required: false
        default: '14'
        type: string

permissions:
  contents: write
  actions: write

jobs:
  cleanup:
    name: Cleanup Stale Branches
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - name: Checkout Code
        uses: actions/checkout@v6
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Configure Git
        run: |
          git config --global user.name "devops-engineer"
          git config --global user.email "devops-engineer@bank-sampah.sulhi.workers.dev"

      - name: Analyze Branches
        id: analyze
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          DRY_RUN: ${{ github.event.inputs.dry_run || 'true' }}
          DAYS_THRESHOLD: ${{ github.event.inputs.days_threshold || '14' }}
        run: |
          echo "=== Branch Cleanup Analysis ==="
          echo "Dry Run: $DRY_RUN"
          echo "Days Threshold: $DAYS_THRESHOLD"
          echo ""
          
          current_date=$(date +%s)
          threshold_seconds=$((DAYS_THRESHOLD * 86400))
          protected_branches="main master develop dev staging production"
          
          git fetch --all --prune
          branches=$(git branch -r --format='%(refname:short)' | grep -v HEAD)
          
          merged_branches=""
          stale_branches=""
          
          for branch in $branches; do
            branch_name=$(echo "$branch" | sed 's/origin\///')
            if echo "$protected_branches" | grep -qw "$branch_name"; then
              echo "🛡️ Protected branch: $branch_name"
              continue
            fi
            
            if git merge-base --is-ancestor "origin/$branch_name" origin/main 2>/dev/null; then
              last_commit_date=$(git log -1 --format=%ct "origin/$branch_name" 2>/dev/null || echo "0")
              age_seconds=$((current_date - last_commit_date))
              age_days=$((age_seconds / 86400))
              
              if [ $age_days -gt $DAYS_THRESHOLD ]; then
                merged_branches="$merged_branches $branch_name"
                echo "✅ Merged & stale ($age_days days old): $branch_name"
              else
                echo "⏳ Merged but recent ($age_days days old): $branch_name"
              fi
            else
              last_commit_date=$(git log -1 --format=%ct "origin/$branch_name" 2>/dev/null || echo "0")
              age_seconds=$((current_date - last_commit_date))
              age_days=$((age_seconds / 86400))
              
              if [ $age_days -gt $DAYS_THRESHOLD ]; then
                stale_branches="$stale_branches $branch_name"
                echo "⚠️ Unmerged & stale ($age_days days old): $branch_name"
              fi
            fi
          done
          
          echo "merged_branches<<EOF" >> $GITHUB_OUTPUT
          echo "$merged_branches" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT
          echo "stale_branches<<EOF" >> $GITHUB_OUTPUT
          echo "$stale_branches" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT
          
          merged_count=$(echo "$merged_branches" | wc -w)
          stale_count=$(echo "$stale_branches" | wc -w)
          echo "merged_count=$merged_count" >> $GITHUB_OUTPUT
          echo "stale_count=$stale_count" >> $GITHUB_OUTPUT

      - name: Delete Merged Branches
        if: github.event.inputs.dry_run != 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          echo "Deleting merged stale branches..."
          merged_branches="${{ steps.analyze.outputs.merged_branches }}"
          
          for branch in $merged_branches; do
            echo "Deleting merged branch: $branch"
            git push origin --delete "$branch" 2>/dev/null || echo "Could not delete $branch"
          done

      - name: Create Issue for Stale Unmerged Branches
        if: steps.analyze.outputs.stale_count != '0'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          stale_branches="${{ steps.analyze.outputs.stale_branches }}"
          
          issue_body="## Stale Unmerged Branches Detected

The following branches have been inactive for more than 14 days:

\`\`\`
$stale_branches
\`\`\`

### Recommended Actions:
- Review each branch for completion status
- If work is complete, merge to main
- If abandoned, consider deleting
- If still active, merge recent changes from main

---
*This issue was automatically created by the branch-cleanup workflow.*
"
          
          gh issue create \
            --title "🧹 Stale Branch Cleanup Required" \
            --body "$issue_body" \
            --label "chore,P2,devops-engineer" || echo "Issue may already exist"

      - name: Summary
        run: |
          echo "=== Branch Cleanup Complete ==="
          echo "Merged stale branches: ${{ steps.analyze.outputs.merged_count }}"
          echo "Unmerged stale branches: ${{ steps.analyze.outputs.stale_count }}"
WORKFLOW_EOF

echo "✅ branch-cleanup.yml created"

# Create security-audit.yml
echo "Creating security-audit.yml..."
cat > .github/workflows/security-audit.yml << 'WORKFLOW_EOF'
name: Security Audit

on:
  schedule:
    # Run daily at 06:00 UTC
    - cron: '0 6 * * *'
  workflow_dispatch:

permissions:
  contents: write
  issues: write

jobs:
  audit:
    name: Security Vulnerability Audit
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - name: Checkout Code
        uses: actions/checkout@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci --prefer-offline --no-audit

      - name: Run Security Audit (Production)
        id: audit_prod
        run: |
          echo "=== Production Dependencies Security Audit ==="
          audit_output=$(npm audit --audit-level=info --omit=dev 2>&1 || true)
          echo "$audit_output"
          vuln_count=$(echo "$audit_output" | grep -c "vulnerability" || echo "0")
          echo "vuln_count=$vuln_count" >> $GITHUB_OUTPUT

      - name: Run Security Audit (Development)
        id: audit_dev
        continue-on-error: true
        run: |
          echo "=== Development Dependencies Security Audit ==="
          audit_output=$(npm audit --audit-level=info 2>&1 || true)
          echo "$audit_output"

      - name: Run Quality Gates
        run: |
          npm run build
          npm run typecheck
          npm run lint
          npm run test:run

      - name: Create Security Issue (if vulnerabilities found)
        if: steps.audit_prod.outputs.vuln_count != '0'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh issue create \
            --title "🔒 Security Vulnerabilities Detected" \
            --body "Security vulnerabilities found in production dependencies. Run \`npm audit\` for details." \
            --label "security,P1,devops-engineer" || echo "Issue may already exist"
WORKFLOW_EOF

echo "✅ security-audit.yml created"

# Create dependency-update.yml
echo "Creating dependency-update.yml..."
cat > .github/workflows/dependency-update.yml << 'WORKFLOW_EOF'
name: Dependency Update Check

on:
  schedule:
    # Run weekly on Mondays at 02:00 UTC
    - cron: '0 2 * * 1'
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  check:
    name: Check for Outdated Dependencies
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - name: Checkout Code
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci --prefer-offline --no-audit

      - name: Check Outdated Dependencies
        id: outdated
        run: |
          echo "=== Checking for Outdated Dependencies ==="
          outdated_output=$(npm outdated --json 2>/dev/null || echo "{}")
          
          outdated_count=$(echo "$outdated_output" | jq 'length' 2>/dev/null || echo "0")
          echo "outdated_count=$outdated_count" >> $GITHUB_OUTPUT
          
          if [ "$outdated_count" -gt 0 ]; then
            echo "### Outdated Packages Found: $outdated_count"
            echo "$outdated_output" | jq -r 'to_entries[] | "- \(.key): \(.value.current) -> \(.value.latest)"' 2>/dev/null || true
            
            echo "outdated_list<<EOF" >> $GITHUB_OUTPUT
            echo "$outdated_output" | jq -r 'to_entries[] | "- \(.key): \(.value.current) -> \(.value.latest)"' 2>/dev/null >> $GITHUB_OUTPUT
            echo "EOF" >> $GITHUB_OUTPUT
          else
            echo "All dependencies are up to date!"
          fi

      - name: Run Quality Gates
        run: |
          npm run build
          npm run typecheck
          npm run lint
          npm run test:run

      - name: Create Update Issue (if outdated packages found)
        if: steps.outdated.outputs.outdated_count != '0'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          outdated_count="${{ steps.outdated.outputs.outdated_count }}"
          outdated_list="${{ steps.outdated.outputs.outdated_list }}"
          
          existing=$(gh issue list --state open --label chore --json title --jq '.[].title' 2>/dev/null | grep -i "outdated" || echo "")
          
          if [ -z "$existing" ]; then
            gh issue create \
              --title "Outdated Dependencies Detected ($outdated_count packages)" \
              --body "## Dependency Update Required

### Outdated Packages
$outdated_list

### Actions Required
1. Review each outdated package for breaking changes
2. Update packages incrementally
3. Run tests after each update
4. Check for security vulnerabilities with npm audit

### Quality Gates Status
- Build: Passed
- TypeCheck: Passed
- Lint: Passed
- Tests: Passed

---
*This issue was automatically created by the dependency-update workflow.*" \
              --label "chore,P2,devops-engineer"
            echo "Created dependency update issue"
          else
            echo "Similar issue already exists"
          fi

      - name: Summary
        run: |
          echo "=== Dependency Update Check Complete ==="
          echo "Outdated packages: ${{ steps.outdated.outputs.outdated_count }}"
WORKFLOW_EOF

echo "✅ dependency-update.yml created"

echo ""
echo "=== Workflow Creation Complete ==="
echo "Files created:"
echo "  - .github/workflows/branch-cleanup.yml"
echo "  - .github/workflows/security-audit.yml"
echo "  - .github/workflows/dependency-update.yml"
echo ""
echo "Next steps:"
echo "  1. Review the workflow files"
echo "  2. Commit and push to main branch"
echo "  3. Workflows will activate automatically"
