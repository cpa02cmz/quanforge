#!/bin/bash
#
# DevOps Health Check Script
# Comprehensive repository health verification for CI/CD pipelines
#
# Usage: ./scripts/devops-health-check.sh [--verbose] [--fix]
#
# Exit codes:
#   0 - All checks passed
#   1 - Critical issues found
#   2 - Warnings found (non-critical)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
VERBOSE=false
FIX_MODE=false
for arg in "$@"; do
    case $arg in
        --verbose|-v) VERBOSE=true ;;
        --fix|-f) FIX_MODE=true ;;
        --help|-h) 
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --verbose, -v    Show detailed output"
            echo "  --fix, -f        Attempt to fix issues automatically"
            echo "  --help, -h       Show this help message"
            exit 0
            ;;
    esac
done

# Counters
ERRORS=0
WARNINGS=0
PASSED=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((ERRORS++))
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "       $1"
    fi
}

# Header
echo ""
echo "========================================"
echo "  DevOps Health Check"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# ============================================
# SECTION 1: Build System Health
# ============================================
echo ""
echo "--- Build System Health ---"
echo ""

# Check Node.js version
log_info "Checking Node.js version..."
NODE_VERSION=$(node --version 2>/dev/null || echo "not installed")
if [[ $NODE_VERSION == v1[89]* ]] || [[ $NODE_VERSION == v2[0-9]* ]]; then
    log_pass "Node.js version: $NODE_VERSION (compatible)"
else
    log_warn "Node.js version: $NODE_VERSION (may need update)"
fi

# Check npm version
log_info "Checking npm version..."
NPM_VERSION=$(npm --version 2>/dev/null || echo "not installed")
log_pass "npm version: $NPM_VERSION"

# Check dependencies installed
log_info "Checking dependencies..."
if [ -d "node_modules" ]; then
    DEPS_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    log_pass "Dependencies installed: $DEPS_COUNT packages"
else
    log_error "node_modules not found - run 'npm install'"
fi

# Run build
log_info "Running production build..."
BUILD_START=$(date +%s.%N 2>/dev/null || date +%s)
if npm run build > /dev/null 2>&1; then
    BUILD_END=$(date +%s.%N 2>/dev/null || date +%s)
    BUILD_TIME=$(echo "$BUILD_END - $BUILD_START" | bc 2>/dev/null || echo "N/A")
    log_pass "Build completed in ${BUILD_TIME}s"
else
    log_error "Build failed"
fi

# ============================================
# SECTION 2: Code Quality Checks
# ============================================
echo ""
echo "--- Code Quality Checks ---"
echo ""

# TypeScript check
log_info "Running TypeScript type check..."
if npm run typecheck > /dev/null 2>&1; then
    log_pass "TypeScript: No type errors"
else
    log_error "TypeScript: Type errors found"
fi

# Lint check
log_info "Running ESLint..."
LINT_OUTPUT=$(npm run lint 2>&1 || true)
LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -c "error" || true)
LINT_WARNINGS=$(echo "$LINT_OUTPUT" | grep -c "warning" || true)

if [ "$LINT_ERRORS" -gt 0 ]; then
    log_error "ESLint: $LINT_ERRORS errors found"
else
    log_pass "ESLint: No errors"
fi

if [ "$LINT_WARNINGS" -gt 0 ]; then
    log_warn "ESLint: $LINT_WARNINGS warnings (any-type - non-critical)"
fi

# ============================================
# SECTION 3: Test Suite
# ============================================
echo ""
echo "--- Test Suite ---"
echo ""

log_info "Running test suite..."
TEST_OUTPUT=$(npm run test:run 2>&1 || true)
TEST_PASSED=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= passed)' || echo "0")
TEST_FAILED=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= failed)' || echo "0")

if [ "$TEST_FAILED" -gt 0 ]; then
    log_error "Tests: $TEST_FAILED failed, $TEST_PASSED passed"
else
    log_pass "Tests: $TEST_PASSED passed"
fi

# ============================================
# SECTION 4: Security Checks
# ============================================
echo ""
echo "--- Security Checks ---"
echo ""

# Production vulnerabilities
log_info "Checking production vulnerabilities..."
PROD_AUDIT=$(npm audit --omit=dev 2>&1 || true)
PROD_VULNS=$(echo "$PROD_AUDIT" | grep -c "severity" || true)

if [ "$PROD_VULNS" -gt 0 ]; then
    log_error "Production vulnerabilities: $PROD_VULNS found"
else
    log_pass "Production vulnerabilities: 0"
fi

# Dev vulnerabilities
log_info "Checking development vulnerabilities..."
DEV_AUDIT=$(npm audit 2>&1 || true)
DEV_VULNS=$(echo "$DEV_AUDIT" | grep -c "severity" || true)

if [ "$DEV_VULNS" -gt 0 ]; then
    log_warn "Development vulnerabilities: $DEV_VULNS (acceptable for dev tools)"
else
    log_pass "Development vulnerabilities: 0"
fi

# Check for hardcoded secrets
log_info "Scanning for potential secrets..."
SECRETS_FOUND=$(grep -r --include="*.ts" --include="*.tsx" --include="*.js" \
    -E "(api[_-]?key|secret|password|token)\s*[=:]\s*['\"][^'\"]+['\"]" \
    --exclude-dir=node_modules --exclude-dir=dist . 2>/dev/null | wc -l || echo "0")

if [ "$SECRETS_FOUND" -gt 0 ]; then
    log_warn "Potential secrets found in $SECRETS_FOUND locations (verify manually)"
else
    log_pass "No hardcoded secrets detected"
fi

# ============================================
# SECTION 5: Git Repository Health
# ============================================
echo ""
echo "--- Git Repository Health ---"
echo ""

# Check git status
log_info "Checking git status..."
GIT_STATUS=$(git status --porcelain 2>/dev/null || echo "not a git repo")
if [ -z "$GIT_STATUS" ]; then
    log_pass "Working tree clean"
else
    CHANGED_FILES=$(echo "$GIT_STATUS" | wc -l)
    log_warn "Working tree has $CHANGED_FILES changes"
fi

# Check branch sync
log_info "Checking branch synchronization..."
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
UPSTREAM=$(git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo "")

if [ -n "$UPSTREAM" ]; then
    LOCAL=$(git rev-parse HEAD 2>/dev/null)
    REMOTE=$(git rev-parse @{upstream} 2>/dev/null)
    if [ "$LOCAL" = "$REMOTE" ]; then
        log_pass "Branch '$CURRENT_BRANCH' is up to date with $UPSTREAM"
    else
        BEHIND=$(git rev-list --count HEAD..@{upstream} 2>/dev/null || echo "?")
        AHEAD=$(git rev-list --count @{upstream}..HEAD 2>/dev/null || echo "?")
        log_warn "Branch '$CURRENT_BRANCH' is $BEHIND behind, $AHEAD ahead of $UPSTREAM"
    fi
else
    log_warn "No upstream configured for branch '$CURRENT_BRANCH'"
fi

# Check for large files
log_info "Checking for large files in repository..."
LARGE_FILES=$(find . -type f -size +10M -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./.git/*" 2>/dev/null | wc -l || echo "0")
if [ "$LARGE_FILES" -gt 0 ]; then
    log_warn "Found $LARGE_FILES large files (>10MB) - consider Git LFS"
else
    log_pass "No large files detected"
fi

# ============================================
# SECTION 6: CI/CD Configuration
# ============================================
echo ""
echo "--- CI/CD Configuration ---"
echo ""

# Check workflow files
log_info "Checking GitHub Actions workflows..."
WORKFLOW_COUNT=$(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null | wc -l)
if [ "$WORKFLOW_COUNT" -gt 0 ]; then
    log_pass "Found $WORKFLOW_COUNT workflow files"
    log_verbose "Workflows: $(ls .github/workflows/*.yml 2>/dev/null | xargs -n1 basename | tr '\n' ' ')"
else
    log_warn "No GitHub Actions workflows found"
fi

# Check for required env vars documentation
log_info "Checking environment configuration..."
if [ -f ".env.example" ]; then
    log_pass ".env.example exists"
else
    log_warn ".env.example not found"
fi

# Check Vercel configuration
log_info "Checking deployment configuration..."
if [ -f "vercel.json" ]; then
    log_pass "vercel.json exists"
else
    log_warn "vercel.json not found"
fi

# ============================================
# SECTION 7: Bundle Analysis
# ============================================
echo ""
echo "--- Bundle Analysis ---"
echo ""

if [ -d "dist" ]; then
    # Count chunks
    CHUNK_COUNT=$(find dist -name "*.js" -type f | wc -l)
    log_pass "Build produced $CHUNK_COUNT JS chunks"
    
    # Check largest chunk
    LARGEST_CHUNK=$(find dist -name "*.js" -type f -exec ls -lh {} \; 2>/dev/null | sort -k5 -hr | head -1)
    LARGEST_SIZE=$(echo "$LARGEST_CHUNK" | awk '{print $5}')
    LARGEST_NAME=$(echo "$LARGEST_CHUNK" | awk '{print $NF}' | xargs basename)
    
    if [[ $LARGEST_SIZE =~ M ]]; then
        log_warn "Largest chunk: $LARGEST_NAME ($LARGEST_SIZE) - consider splitting"
    else
        log_pass "Largest chunk: $LARGEST_NAME ($LARGEST_SIZE)"
    fi
    
    # Total dist size
    DIST_SIZE=$(du -sh dist 2>/dev/null | awk '{print $1}')
    log_pass "Total dist size: $DIST_SIZE"
else
    log_warn "dist directory not found - run build first"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "========================================"
echo "  Health Check Summary"
echo "========================================"
echo ""
echo -e "  ${GREEN}Passed:${NC}   $PASSED"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "  ${RED}Errors:${NC}   $ERRORS"
echo ""

if [ "$ERRORS" -gt 0 ]; then
    echo -e "${RED}STATUS: CRITICAL ISSUES FOUND${NC}"
    echo ""
    echo "Run with --verbose for more details"
    exit 1
elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}STATUS: PASSED WITH WARNINGS${NC}"
    echo ""
    echo "Run with --verbose for more details"
    exit 2
else
    echo -e "${GREEN}STATUS: ALL CHECKS PASSED${NC}"
    exit 0
fi
