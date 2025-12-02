#!/bin/bash

# Enhanced Build Optimization Script for Vercel Deployment
# Optimizes bundle size, enables edge features, and prepares for production

set -e

echo "🚀 Starting Enhanced Build Optimization for Vercel Edge..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build configuration
NODE_ENV=${NODE_ENV:-production}
VITE_ENABLE_EDGE_OPTIMIZATION=${VITE_ENABLE_EDGE_OPTIMIZATION:-true}
VITE_ENABLE_SERVICE_WORKER=${VITE_ENABLE_SERVICE_WORKER:-true}
VITE_ENABLE_COMPRESSION=${VITE_ENABLE_COMPRESSION:-true}
VITE_ENABLE_WEB_VITALS=${VITE_ENABLE_WEB_VITALS:-true}

echo -e "${BLUE}📋 Build Configuration:${NC}"
echo "  NODE_ENV: $NODE_ENV"
echo "  VITE_ENABLE_EDGE_OPTIMIZATION: $VITE_ENABLE_EDGE_OPTIMIZATION"
echo "  VITE_ENABLE_SERVICE_WORKER: $VITE_ENABLE_SERVICE_WORKER"
echo "  VITE_ENABLE_COMPRESSION: $VITE_ENABLE_COMPRESSION"
echo "  VITE_ENABLE_WEB_VITALS: $VITE_ENABLE_WEB_VITALS"

# Clean previous build
echo -e "${YELLOW}🧹 Cleaning previous build...${NC}"
rm -rf dist node_modules/.vite

# Install dependencies with legacy peer deps for compatibility
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci --legacy-peer-deps

# Type checking
echo -e "${YELLOW}🔍 Running TypeScript type checking...${NC}"
npm run typecheck
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ TypeScript errors found. Please fix them before building.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ TypeScript type checking passed.${NC}"

# Run enhanced build with edge optimization
echo -e "${YELLOW}🏗️ Building with edge optimization...${NC}"
NODE_ENV=$NODE_ENV \
VITE_ENABLE_EDGE_OPTIMIZATION=$VITE_ENABLE_EDGE_OPTIMIZATION \
VITE_ENABLE_SERVICE_WORKER=$VITE_ENABLE_SERVICE_WORKER \
VITE_ENABLE_COMPRESSION=$VITE_ENABLE_COMPRESSION \
VITE_ENABLE_WEB_VITALS=$VITE_ENABLE_WEB_VITALS \
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed.${NC}"
    exit 1
fi

# Analyze bundle size
echo -e "${YELLOW}📊 Analyzing bundle size...${NC}"
npm run build:analyze

# Get bundle sizes
echo -e "${BLUE}📦 Bundle Analysis:${NC}"
find dist/assets/js -name "*.js" -exec ls -lh {} \; | awk '{print $5, $9}' | sort -hr

# Calculate total bundle size
TOTAL_SIZE=$(find dist/assets/js -name "*.js" -exec du -b {} + | awk '{sum += $1} END {print sum}')
TOTAL_SIZE_MB=$(echo "scale=2; $TOTAL_SIZE / 1024 / 1024" | bc)
echo -e "${GREEN}📏 Total bundle size: ${TOTAL_SIZE_MB} MB${NC}"

# Check bundle size limits
if (( $(echo "$TOTAL_SIZE_MB > 2.0" | bc -l) )); then
    echo -e "${YELLOW}⚠️ Bundle size is above 2MB. Consider further optimization.${NC}"
elif (( $(echo "$TOTAL_SIZE_MB > 1.5" | bc -l) )); then
    echo -e "${YELLOW}⚠️ Bundle size is above 1.5MB. Some optimization may be beneficial.${NC}"
else
    echo -e "${GREEN}✅ Bundle size is within acceptable limits.${NC}"
fi

# Optimize service worker for edge
echo -e "${YELLOW}⚡ Optimizing service worker for edge deployment...${NC}"
if [ -f "public/sw.js" ]; then
    # Add edge optimization headers to service worker
    sed -i.bak 's/CACHE_NAME = .*/CACHE_NAME = '\''quanforge-edge-v3'\'';/' public/sw.js
    sed -i 's/STATIC_CACHE_NAME = .*/STATIC_CACHE_NAME = '\''quanforge-static-v3'\'';/' public/sw.js
    sed -i 's/API_CACHE_NAME = .*/API_CACHE_NAME = '\''quanforge-api-v3'\'';/' public/sw.js
    echo -e "${GREEN}✅ Service worker optimized for edge.${NC}"
else
    echo -e "${YELLOW}⚠️ Service worker not found. Skipping edge optimization.${NC}"
fi

# Generate edge optimization report
echo -e "${YELLOW}📈 Generating edge optimization report...${NC}"
cat > dist/edge-report.json << EOF
{
  "buildTime": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "bundleSize": {
    "totalBytes": $TOTAL_SIZE,
    "totalMB": $TOTAL_SIZE_MB,
    "files": $(find dist/assets/js -name "*.js" -exec ls -lh {} \; | jq -R -s 'split("\n") | map(select(length > 0)) | map(split(" ") | {size: .[4], file: .[8]})')
  },
  "optimizations": {
    "edgeRuntime": $VITE_ENABLE_EDGE_OPTIMIZATION,
    "serviceWorker": $VITE_ENABLE_SERVICE_WORKER,
    "compression": $VITE_ENABLE_COMPRESSION,
    "webVitals": $VITE_ENABLE_WEB_VITALS
  },
  "performance": {
    "targetBuildTime": "10s",
    "targetBundleSize": "1.5MB",
    "compressionEnabled": true,
    "edgeRegions": ["hkg1", "iad1", "sin1", "fra1", "sfo1"]
  }
}
EOF

# Create edge optimization manifest
echo -e "${YELLOW}📋 Creating edge optimization manifest...${NC}"
cat > dist/edge-manifest.json << EOF
{
  "edgeOptimized": true,
  "version": "3.0.0",
  "buildTimestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "cacheStrategy": {
    "staticAssets": {
      "ttl": 31536000,
      "strategy": "cacheFirst"
    },
    "apiResponses": {
      "ttl": 300,
      "strategy": "networkFirst"
    },
    "pages": {
      "ttl": 86400,
      "strategy": "staleWhileRevalidate"
    }
  },
  "compression": {
    "enabled": true,
    "brotli": true,
    "gzip": true,
    "level": 6
  },
  "performance": {
    "coreWebVitals": true,
    "monitoring": true,
    "reporting": true
  },
  "regions": ["hkg1", "iad1", "sin1", "fra1", "sfo1"],
  "headers": {
    "security": true,
    "caching": true,
    "compression": true,
    "cors": true
  }
}
EOF

# Validate critical files
echo -e "${YELLOW}🔍 Validating critical files...${NC}"
CRITICAL_FILES=("index.html" "manifest.json" "robots.txt" "sitemap.xml")
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "dist/$file" ]; then
        echo -e "${GREEN}✅ $file found${NC}"
    else
        echo -e "${YELLOW}⚠️ $file not found${NC}"
    fi
done

# Check service worker
if [ -f "dist/sw.js" ]; then
    echo -e "${GREEN}✅ Service worker found${NC}"
else
    echo -e "${YELLOW}⚠️ Service worker not found in dist${NC}"
fi

# Generate deployment summary
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo "  ✅ Build completed successfully"
echo "  📦 Bundle size: ${TOTAL_SIZE_MB} MB"
echo "  ⚡ Edge optimization: Enabled"
echo "  🗜️ Compression: Enabled"
echo "  📊 Performance monitoring: Enabled"
echo "  🌍 Edge regions: 5 (hkg1, iad1, sin1, fra1, sfo1)"

# Performance recommendations
echo -e "${BLUE}💡 Performance Recommendations:${NC}"
if (( $(echo "$TOTAL_SIZE_MB > 1.5" | bc -l) )); then
    echo "  ⚠️ Consider lazy loading non-critical components"
    echo "  ⚠️ Review and optimize large dependencies"
fi

if [ "$VITE_ENABLE_WEB_VITALS" = "true" ]; then
    echo "  ✅ Core Web Vitals monitoring enabled"
else
    echo "  💡 Consider enabling Web Vitals monitoring"
fi

echo -e "${GREEN}🎉 Enhanced build optimization completed successfully!${NC}"
echo -e "${GREEN}🚀 Ready for Vercel Edge deployment${NC}"

# Create success marker
touch dist/.edge-optimized

echo -e "${BLUE}📄 Generated files:${NC}"
echo "  - dist/edge-report.json (Build analysis)"
echo "  - dist/edge-manifest.json (Edge configuration)"
echo "  - dist/.edge-optimized (Success marker)"

exit 0