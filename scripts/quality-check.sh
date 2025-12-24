#!/bin/bash

# Development quality checks script
# Run this before committing changes

echo "🔍 Running Quality Checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track success/failure
SUCCESS=true

echo -e "\n📦 1. Build Check..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    npm run build
    SUCCESS=false
fi

echo -e "\n🔡 2. TypeScript Check..."
if npm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript compilation passed${NC}"
else
    echo -e "${RED}❌ TypeScript errors found${NC}"
    npm run typecheck
    SUCCESS=false
fi

echo -e "\n🧹 3. Lint Check..."
if npm run lint > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Linting passed${NC}"
else
    echo -e "${YELLOW}⚠️  Linting warnings found${NC}"
    npm run lint
    # Lint warnings don't fail the check
fi

echo -e "\n📊 4. Bundle Size Check..."
BUILD_SIZE=$(du -sh dist/ 2>/dev/null | cut -f1 || echo "N/A")
echo -e "${GREEN}📦 Bundle size: $BUILD_SIZE${NC}"

echo -e "\n🔍 5. Large File Check..."
LARGE_FILES=$(find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v node_modules | grep -v dist | xargs ls -la | awk '$5 > 50000 {print $9, "(" $5/1024 "KB)"}')

if [ -z "$LARGE_FILES" ]; then
    echo -e "${GREEN}✅ No files > 50KB found${NC}"
else
    echo -e "${YELLOW}⚠️  Large files found:${NC}"
    echo "$LARGE_FILES"
fi

echo -e "\n📋 6. Service Size Check..."
echo "Checking for services > 500 lines..."
OVERSIZED_SERVICES=$(find services/ -name "*.ts" -exec wc -l {} + | awk '$1 > 500 {print $2, "(" $1 " lines)"}')

if [ -z "$OVERSIZED_SERVICES" ]; then
    echo -e "${GREEN}✅ No services > 500 lines found${NC}"
else
    echo -e "${YELLOW}⚠️  Services > 500 lines found:${NC}"
    echo "$OVERSIZED_SERVICES"
fi

echo -e "\n🎯 7. Quality Gates Summary..."
if [ "$SUCCESS" = true ]; then
    echo -e "${GREEN}🎉 All critical checks passed! Ready to commit.${NC}"
    exit 0
else
    echo -e "${RED}❌ Critical checks failed. Please fix issues before committing.${NC}"
    exit 1
fi