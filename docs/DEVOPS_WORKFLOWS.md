# DevOps Workflow Recommendations

This document contains recommended GitHub Actions workflows for improved CI/CD automation.

> **Note**: These workflows require repository admin permissions to create. 
> Copy the workflow content to `.github/workflows/` directory with appropriate permissions.

## 1. Branch Cleanup Workflow (`branch-cleanup.yml`)

**Purpose**: Automatically identify and help clean up stale branches.

**Schedule**: Weekly on Sundays at 00:00 UTC

**Features**:
- Identifies branches merged into main
- Finds stale branches older than configurable threshold (default: 30 days)
- Creates GitHub issues for cleanup tracking
- Dry-run mode by default for safety

**Workflow Content**:

```yaml
# Branch Cleanup Automation
# Identifies and helps clean up stale branches to maintain repository hygiene

name: Branch Cleanup

on:
  schedule:
    - cron: '0 0 * * 0'
  workflow_dispatch:
    inputs:
      dry_run:
        default: 'true'
        description: 'Dry run mode (only report, no deletions)'
        required: false
        type: boolean
      days_threshold:
        default: '30'
        description: 'Days threshold for stale branches'
        required: false
        type: string

permissions:
  contents: read
  issues: write
  pull-requests: read

jobs:
  analyze:
    name: Analyze Branches
    runs-on: ubuntu-latest
    timeout-minutes: 15
    outputs:
      stale_count: ${{ steps.main.outputs.stale_count }}
      merged_count: ${{ steps.main.outputs.merged_count }}
      protected_count: ${{ steps.main.outputs.protected_count }}

    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Analyze
        id: main
        run: |
          DAYS_THRESHOLD="${{ github.event.inputs.days_threshold || '30' }}"
          PROTECTED="main master develop dev staging production release"
          
          echo "## Branch Cleanup Analysis" >> $GITHUB_STEP_SUMMARY
          echo "**Threshold:** ${DAYS_THRESHOLD} days" >> $GITHUB_STEP_SUMMARY
          
          TOTAL=$(git branch -r | grep -v HEAD | wc -l)
          echo "- Total branches: ${TOTAL}" >> $GITHUB_STEP_SUMMARY
          
          MERGED=0
          STALE=0
          PROTECTED_COUNT=0
          
          for branch in $(git branch -r | grep -v HEAD | sed 's/origin\///'); do
            if echo "$PROTECTED" | grep -qw "$branch"; then
              PROTECTED_COUNT=$((PROTECTED_COUNT + 1))
              continue
            fi
            
            if git merge-base --is-ancestor "origin/$branch" origin/main 2>/dev/null; then
              MERGED=$((MERGED + 1))
              echo "$branch" >> /tmp/merged.txt
            fi
            
            LAST=$(git log -1 --format=%ct "origin/$branch" 2>/dev/null || echo 0)
            THRESH=$(date -d "-${DAYS_THRESHOLD} days" +%s 2>/dev/null || date -v-${DAYS_THRESHOLD}d +%s)
            if [ "$LAST" -lt "$THRESH" ] && [ "$LAST" -gt 0 ]; then
              STALE=$((STALE + 1))
              echo "$branch" >> /tmp/stale.txt
            fi
          done
          
          echo "- Merged branches: ${MERGED}" >> $GITHUB_STEP_SUMMARY
          echo "- Stale branches: ${STALE}" >> $GITHUB_STEP_SUMMARY
          echo "- Protected: ${PROTECTED_COUNT}" >> $GITHUB_STEP_SUMMARY
          
          echo "stale_count=${STALE}" >> $GITHUB_OUTPUT
          echo "merged_count=${MERGED}" >> $GITHUB_OUTPUT
          echo "protected_count=${PROTECTED_COUNT}" >> $GITHUB_OUTPUT

      - name: Upload Data
        uses: actions/upload-artifact@v4
        with:
          name: branch-data
          path: /tmp/*.txt
          retention-days: 7
          if-no-files-found: ignore

  report:
    name: Create Report
    runs-on: ubuntu-latest
    needs: analyze
    if: needs.analyze.outputs.stale_count > 0 || needs.analyze.outputs.merged_count > 0
    
    steps:
      - name: Download Data
        uses: actions/download-artifact@v4
        with:
          name: branch-data
          path: /tmp

      - name: Create Issue
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          STALE="${{ needs.analyze.outputs.stale_count }}"
          MERGED="${{ needs.analyze.outputs.merged_count }}"
          
          STALE_LIST=$(cat /tmp/stale.txt 2>/dev/null || echo "None")
          MERGED_LIST=$(cat /tmp/merged.txt 2>/dev/null || echo "None")
          
          EXISTING=$(gh issue list --state open --label "devops-engineer,branch-cleanup" --json number --jq '.[0].number // empty')
          
          cat > /tmp/body.md << 'ENDOFBODY'
          ## Branch Cleanup Report
          
          ### Summary
          - Stale Branches: STALE_COUNT
          - Merged Branches: MERGED_COUNT
          
          ### Stale Branches
          ```
          STALE_BRANCHES
          ```
          
          ### Merged Branches
          ```
          MERGED_BRANCHES
          ```
          
          Protected: main, master, develop, dev, staging, production, release
          
          Auto-generated by Branch Cleanup workflow.
          ENDOFBODY
          
          sed -i "s/STALE_COUNT/${STALE}/g" /tmp/body.md
          sed -i "s/MERGED_COUNT/${MERGED}/g" /tmp/body.md
          sed -i "s/STALE_BRANCHES/${STALE_LIST}/g" /tmp/body.md
          sed -i "s/MERGED_BRANCHES/${MERGED_LIST}/g" /tmp/body.md
          
          if [ -n "$EXISTING" ]; then
            gh issue edit "$EXISTING" --body-file /tmp/body.md
          else
            gh issue create \
              --title "Branch Cleanup Required - $(date -u +%Y-%m-%d)" \
              --label "devops-engineer,branch-cleanup,maintenance" \
              --body-file /tmp/body.md
          fi
```

---

## 2. Security Audit Workflow (`security-audit.yml`)

**Purpose**: Continuous security vulnerability monitoring.

**Schedule**: Daily at 06:00 UTC

**Features**:
- Production dependency security audit
- Development dependency security audit
- Trivy vulnerability scanner integration
- Security pattern analysis (hardcoded secrets, dangerous code)
- Automatic issue creation for vulnerabilities

---

## 3. CI/CD Health Workflow (`ci-health.yml`)

**Purpose**: Monitor pipeline health and report issues.

**Schedule**: Every 6 hours

**Features**:
- Workflow run success/failure tracking
- Build health verification
- Type check status
- Lint status
- Test suite health
- Success rate calculation

---

## 4. Stale Management Workflow (`stale-management.yml`)

**Purpose**: Automatically manage stale issues and PRs.

**Schedule**: Daily at 01:30 UTC

**Features**:
- Mark issues stale after 60 days of inactivity
- Close stale issues after 7 days
- Mark PRs stale after 30 days of inactivity
- Close stale PRs after 14 days
- Exempt labels for important items
- Find items needing attention

---

## Current Repository Status

### Branch Statistics
- **Total Remote Branches**: 103
- **Develop Branch**: 521 commits behind main (should be deleted)
- **Merged Branches**: Multiple stale branches from previous agent runs

### Security Status
- **Production Vulnerabilities**: 0
- **Dev Vulnerabilities**: 4 (minimatch, glob, rimraf, gaxios - acceptable for dev tools)

### CI/CD Status
- **Build**: ✅ 16.10s (successful)
- **Lint**: ✅ 0 errors, 656 warnings
- **TypeCheck**: ✅ 0 errors
- **Tests**: ✅ 427/427 passing (100%)

---

## Recommended Actions

1. **Branch Cleanup**: Delete the following stale branches:
   - `origin/develop` (521 commits behind main, protected)
   - All branches from previous agent runs older than 7 days

2. **Workflow Setup**: Copy the workflow files above to `.github/workflows/` with admin permissions

3. **Dependabot**: The dependabot configuration has been enhanced with:
   - Grouped dev dependencies
   - Added reviewers
   - Better security handling

---

*Generated by DevOps Engineer Agent - 2026-02-21*
