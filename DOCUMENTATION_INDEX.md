# QuantForge Documentation Index

## 🎯 Quick Start for AI Agents

**Most Important Files:**
- `AGENTS_COMPACT.md` - Essential development patterns (READ THIS FIRST)
- `README.md` - Project overview and setup
- `blueprint.md` - System architecture
- `ROADMAP.md` - Development phases and priorities

## 📋 Documentation Structure

### Core Architecture
- `blueprint.md` - System design and component hierarchy
- `types.ts` - TypeScript type definitions
- `constants.ts` - Global constants and configurations

### Development Guidelines
- `AGENTS.md` - Detailed agent guidelines (comprehensive)
- `AGENTS_COMPACT.md` - Quick reference patterns (essential)
- `coding_standard.md` - Code style and conventions
- `how-to.md` - Common development procedures

### Performance & Optimization
**Current Status (Dec 2025):**
- ✅ **Build System**: Optimized with 13s build time
- ✅ **Bundle Splitting**: Advanced chunking implemented
- ✅ **Edge Runtime**: Full Vercel Edge optimization
- ✅ **Schema Compliance**: All deployment configs validated

**Optimization Areas:**
- `OPTIMIZATIONS.md` - General optimization overview
- `PERFORMANCE_OPTIMIZATIONS.md` - Performance improvements
- `FRONTEND_OPTIMIZATIONS_SUMMARY.md` - Frontend-specific optimizations
- `DB_OPTIMIZATIONS.md` - Database performance tuning

### Deployment & Infrastructure
- `vercel.json` - Vercel deployment configuration
- `ROADMAP.md` - Deployment phases and status
- Various `ADVANCED_*_OPTIMIZATION.md` - Detailed implementation notes

### SEO & Marketing
- `SEO_IMPLEMENTATION.md` - SEO optimization guide
- `seoService.tsx` - SEO utility implementation
- `public/` - Static assets and SEO metadata

## 🚨 Current Issues & In Progress

### High Priority
- **Large Bundle Chunks**: React vendor (224KB), Chart vendor (356KB), AI vendor (214KB)
- **ESLint Warnings**: 200+ warnings (console statements, unused vars, any types)
- **Type Safety**: 905+ `any` type usages throughout codebase

### Architecture Review Needed
- **API Routes**: Next.js patterns in Vite project (incompatible architecture)
- **Service Monoliths**: Several services >500 lines need decomposition

## 📊 Quality Metrics (Latest)

### Build Performance
- **Build Time**: 13.07 seconds ✅
- **TypeScript**: Passes without errors ✅
- **Bundle Size**: Optimized with manual chunking ⚠️ (large vendors)

### Code Quality
- **ESLint**: 200+ warnings ⚠️
- **Type Safety**: 905 `any` types ❌
- **Test Coverage**: Limited ⚠️

### Deployment
- **Vercel**: Schema compliant ✅
- **Cloudflare Workers**: Compatible ✅
- **Edge Runtime**: Fully optimized ✅

## 🔧 Development Workflow

1. **Before Starting**: Read `AGENTS_COMPACT.md`
2. **Setup**: Follow `README.md` installation guide
3. **Development**: Use patterns from `coding_standard.md`
4. **Validation**: Always run `npm run build && npm run typecheck`
5. **Deployment**: Check schema compliance in `vercel.json`

## 📝 Documentation Maintenance

### Recently Updated
- `AGENTS_COMPACT.md` - Quick reference guide
- `AGENTS.md` - Added quick reference pointer
- `utils/dynamicImports.ts` - Extracted from App.tsx for Fast Refresh

### Need Consolidation
- 60+ optimization documentation files → Create summary index
- Multiple PR resolution logs → Consolidate key learnings
- API route documentation → Align with actual Vite architecture

---

**Last Updated**: 2025-12-23  
**Build Status**: ✅ Passing (13.07s)  
**TypeScript**: ✅ Clean  
**Deployment**: ✅ Ready