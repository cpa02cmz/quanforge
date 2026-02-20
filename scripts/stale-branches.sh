#!/usr/bin/env bash

# Stale Branch Identification Script
# Identifies branches that can be safely deleted
# Usage: ./scripts/stale-branches.sh [options]
#
# Options:
#   --days N        Days threshold for stale branches (default: 30)
#   --merged-only   Only show merged branches
#   --dry-run       Show what would be deleted without deleting
#   --delete        Actually delete merged branches
#   --help          Show this help message

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DAYS_THRESHOLD=30
MERGED_ONLY=false
DRY_RUN=true
DELETE=false

# Protected branches (never delete)
PROTECTED_BRANCHES=("main" "master" "develop" "dev" "staging" "production")

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --days)
      DAYS_THRESHOLD="$2"
      shift 2
      ;;
    --merged-only)
      MERGED_ONLY=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      DELETE=false
      shift
      ;;
    --delete)
      DELETE=true
      DRY_RUN=false
      shift
      ;;
    --help)
      echo "Stale Branch Identification Script"
      echo ""
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --days N        Days threshold for stale branches (default: 30)"
      echo "  --merged-only   Only show merged branches"
      echo "  --dry-run       Show what would be deleted without deleting (default)"
      echo "  --delete        Actually delete merged branches"
      echo "  --help          Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0 --days 14                    # Show branches older than 14 days"
      echo "  $0 --merged-only --dry-run      # Show only merged branches (safe to delete)"
      echo "  $0 --merged-only --delete       # Delete all merged branches"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Stale Branch Identification Report${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Date: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo -e "Days Threshold: ${DAYS_THRESHOLD}"
echo -e "Mode: $([ "$DELETE" = true ] && echo "DELETE" || echo "DRY RUN")"
echo ""

# Fetch latest
echo -e "${YELLOW}Fetching latest branches...${NC}"
git fetch --all --prune 2>/dev/null || true

# Current timestamp
CURRENT_TIMESTAMP=$(date +%s)
THRESHOLD_SECONDS=$((DAYS_THRESHOLD * 86400))

# Arrays for results
declare -a MERGED_BRANCHES
declare -a STALE_UNMERGED
declare -a PROTECTED_FOUND

# Counters
TOTAL_BRANCHES=0
MERGED_COUNT=0
UNMERGED_COUNT=0

echo ""
echo -e "${YELLOW}Analyzing branches...${NC}"
echo ""

# Get all remote branches
for branch in $(git branch -r --format='%(refname:short)' | grep -v HEAD); do
  ((TOTAL_BRANCHES++))
  
  # Extract branch name without origin/
  BRANCH_NAME=$(echo "$branch" | sed 's/origin\///')
  
  # Check if protected
  IS_PROTECTED=false
  for protected in "${PROTECTED_BRANCHES[@]}"; do
    if [ "$BRANCH_NAME" = "$protected" ]; then
      IS_PROTECTED=true
      PROTECTED_FOUND+=("$BRANCH_NAME")
      break
    fi
  done
  
  if [ "$IS_PROTECTED" = true ]; then
    continue
  fi
  
  # Get last commit timestamp
  LAST_COMMIT=$(git log -1 --format=%ct "$branch" 2>/dev/null || echo "0")
  if [ "$LAST_COMMIT" = "0" ]; then
    continue
  fi
  
  # Calculate age
  AGE_SECONDS=$((CURRENT_TIMESTAMP - LAST_COMMIT))
  AGE_DAYS=$((AGE_SECONDS / 86400))
  
  # Check if merged to main
  if git merge-base --is-ancestor "$branch" origin/main 2>/dev/null; then
    if [ $AGE_DAYS -gt $DAYS_THRESHOLD ]; then
      MERGED_BRANCHES+=("$BRANCH_NAME ($AGE_DAYS days)")
      ((MERGED_COUNT++))
    fi
  else
    if [ "$MERGED_ONLY" = false ] && [ $AGE_DAYS -gt $DAYS_THRESHOLD ]; then
      STALE_UNMERGED+=("$BRANCH_NAME ($AGE_DAYS days)")
      ((UNMERGED_COUNT++))
    fi
  fi
done

# Print results
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PROTECTED BRANCHES${NC}"
echo -e "${GREEN}========================================${NC}"
for branch in "${PROTECTED_FOUND[@]}"; do
  echo -e "  ${GREEN}✓${NC} $branch (protected)"
done

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  MERGED BRANCHES (SAFE TO DELETE)${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "Found ${MERGED_COUNT} merged branches older than ${DAYS_THRESHOLD} days"
echo ""
if [ ${#MERGED_BRANCHES[@]} -gt 0 ]; then
  for branch in "${MERGED_BRANCHES[@]}"; do
    echo -e "  ${YELLOW}•${NC} $branch"
  done
else
  echo -e "  ${GREEN}No stale merged branches found${NC}"
fi

if [ "$MERGED_ONLY" = false ]; then
  echo ""
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}  STALE UNMERGED BRANCHES (REVIEW REQUIRED)${NC}"
  echo -e "${RED}========================================${NC}"
  echo -e "Found ${UNMERGED_COUNT} unmerged branches older than ${DAYS_THRESHOLD} days"
  echo ""
  if [ ${#STALE_UNMERGED[@]} -gt 0 ]; then
    for branch in "${STALE_UNMERGED[@]}"; do
      echo -e "  ${RED}!${NC} $branch"
    done
  else
    echo -e "  ${GREEN}No stale unmerged branches found${NC}"
  fi
fi

# Delete action
if [ "$DELETE" = true ]; then
  echo ""
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}  DELETING MERGED BRANCHES${NC}"
  echo -e "${RED}========================================${NC}"
  
  DELETED=0
  FAILED=0
  
  for branch_info in "${MERGED_BRANCHES[@]}"; do
    branch=$(echo "$branch_info" | cut -d' ' -f1)
    echo -ne "  Deleting $branch... "
    if git push origin --delete "$branch" 2>/dev/null; then
      echo -e "${GREEN}✓${NC}"
      ((DELETED++))
    else
      echo -e "${RED}✗ (failed)${NC}"
      ((FAILED++))
    fi
  done
  
  echo ""
  echo -e "Deleted: ${GREEN}$DELETED${NC} branches"
  echo -e "Failed: ${RED}$FAILED${NC} branches"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total Remote Branches: $TOTAL_BRANCHES"
echo -e "Protected: ${#PROTECTED_FOUND[@]}"
echo -e "Stale Merged (Safe to Delete): ${GREEN}$MERGED_COUNT${NC}"
if [ "$MERGED_ONLY" = false ]; then
  echo -e "Stale Unmerged (Review Required): ${RED}$UNMERGED_COUNT${NC}"
fi
echo ""

# Commands for manual cleanup
if [ $MERGED_COUNT -gt 0 ]; then
  echo -e "${YELLOW}To delete merged branches:${NC}"
  echo "  $0 --merged-only --delete"
  echo ""
  echo -e "${YELLOW}Or delete individually:${NC}"
  count=0
  for branch_info in "${MERGED_BRANCHES[@]}"; do
    if [ $count -ge 5 ]; then
      break
    fi
    branch=$(echo "$branch_info" | cut -d' ' -f1)
    echo "  git push origin --delete $branch"
    ((count++))
  done
  if [ ${#MERGED_BRANCHES[@]} -gt 5 ]; then
    echo "  ... and $((MERGED_COUNT - 5)) more"
  fi
fi

echo ""
echo -e "${BLUE}========================================${NC}"
