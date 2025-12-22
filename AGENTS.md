# Development Agent Guidelines

## Core Principles
- **Stability First**: Never break existing functionality
- **Performance**: Maintain 92%+ cache efficiency and optimal bundle sizes
- **Security**: Zero client-side secret storage, server-side API key management
- **Modularity**: Keep modules <500 lines with single responsibilities
- **Flexibility**: Configuration-driven, no hardcoded values
- **AI Efficiency**: Consolidated documentation for optimal context processing

## Architecture Overview

### Current System State (2025-12-22)
- **Overall Health**: 85/100 - Production-ready with continuous optimization
- **Build System**: ✅ Zero TypeScript errors, 12-14s build time
- **Bundle Performance**: ✅ 22 optimized chunks, chart-vendor 276KB, AI-vendor 214KB
- **Documentation**: ✅ Consolidated from 80+ to 30 core files (62% reduction)
- **Modularity**: ✅ Large services refactored into focused modules

### Key Services Architecture

#### Supabase Modular System (NEW)
```
services/supabase/
├── core.ts      - Primary operations (400 lines)
├── pools.ts     - Connection pooling (350 lines)  
├── edge.ts      - Edge optimizations (400 lines)
└── adapter.ts   - Backward compatibility (300 lines)
```
- **Result**: 80% code reduction from 8 variants → 4 modules
- **Backward Compatibility**: 100% maintained through adapter layer

#### Consolidated Utilities
- **Performance**: `utils/performanceConsolidated.ts` (unified monitoring)
- **SEO**: `utils/seoUnified.tsx` (comprehensive SEO management)
- **Validation**: `utils/validationCore.ts` (centralized validation)

## Build & Development Guidelines

### Critical Commands
```bash
npm run build          # Production build (12-14s)
npm run typecheck      # TypeScript validation
npm run lint           # Code quality checks
```

### Build Compatibility Rules
- **Browser Only**: No Node.js modules in frontend code
- **Dynamic Imports**: Use for heavy libraries (Charts, AI services)
- **Type Safety**: Zero `any` types in critical paths
- **Bundle Size**: Monitor chunks >100KB

### Error Resolution Priority
1. **Critical**: Build failures, security vulnerabilities, data loss
2. **High**: TypeScript errors, breaking changes, performance regressions  
3. **Medium**: ESLint warnings, documentation updates, code duplication
4. **Low**: Style improvements, minor optimizations

## Repository Structure

### Modular Service Pattern
```typescript
// Example: services/supabase/core.ts
class CoreSupabaseService {
  // Single responsibility, <500 lines
  // Type-safe interfaces
  // Comprehensive error handling
  // Performance monitoring integration
}
```

### Configuration Management
- **Central Constants**: `constants/config.ts` with environment overrides
- **Feature Flags**: Environment-based feature toggles
- **No Hardcoded Values**: All magic numbers centralized
- **Dynamic Build Configuration**: Environment-aware build settings via `getBuildConfig()`
- **Performance Tuning**: Runtime-specific optimizations for edge and production deployments
- **Vendor Chunking**: Granular control over bundle splitting and chunk size limits

#### Build Environment Variables
```bash
# Chunk optimization
CHUNK_SIZE_WARNING_LIMIT=150    # Override default chunk warning size (kB)
ASSETS_INLINE_LIMIT=256         # Asset inlining threshold (bytes) 
TERSER_COMPRESSION_PASSES=3     # Number of terser compression passes

# Feature toggles
CSS_MINIFY=true                 # Enable/disable CSS minification
CSS_CODE_SPLIT=true             # Enable/disable CSS code splitting
DROP_CONSOLE=true               # Remove console statements in production

# Performance modes
PERFORMANCE_MODE=true           # Enable aggressive optimizations
EDGE_RUNTIME=true              # Edge runtime specific optimizations
DEBUG_MODE=true                # Development debug features
```

### Documentation Standards
- **Single Source Truth**: One file per major topic
- **AI Optimized**: <400 lines for efficient context processing
- **Current State**: Always reflect actual codebase implementation

## Security Guidelines

### API Key Management
- **Never Client-Side**: All secrets in edge functions or environment variables
- **Server-Side Storage**: `/api/edge/api-key-manager` with audit logging
- **Rate Limiting**: 100 req/min with burst protection
- **Encryption**: AES-GCM with session-based keys

### Input Validation
- **Comprehensive Sanitization**: XSS/SQL injection prevention
- **Type Safety**: Strict TypeScript validation
- **Edge Validation**: Server-side validation for all user inputs

## Performance Standards

### Bundle Optimization
- **Chart Vendor**: 276KB (optimally dynamic imported)
- **AI Vendor**: 214KB (service loader pattern)
- **Cache Efficiency**: 92% target minimum
- **Load Times**: FCP < 1.5s, LCP < 2.5s

### Database Performance
- **Connection Pooling**: Automatic optimization with regional affinity
- **Query Patterns**: Monitored and optimized automatically
- **Caching Strategy**: Multi-layer (LRU, semantic, TTL)

## Development Workflow

### Before Starting Work
1. Switch to `develop` branch and update
2. Run `npm run build` and `npm run typecheck`
3. Review `blueprint.md`, `ROADMAP.md`, and this guide
4. Check for open blockers or related tasks

### During Development
- **Incremental Changes**: Small, testable commits
- **Backward Compatibility**: Maintain existing APIs
- **Performance Monitoring**: Verify no regressions
- **Documentation**: Update relevant files immediately

### Before Committing
1. All tests pass and build succeeds
2. No TypeScript errors or warnings
3. Performance metrics maintained
4. Documentation updated
5. Related todos marked completed

## Common Patterns

### Error Handling
```typescript
// Use ErrorManager for consistency
import { ErrorManager } from '../utils/errorManager';
const error = ErrorManager.handle(error, context, severity);
```

### Performance Monitoring
```typescript
// Use consolidated performance module
import { performanceConsolidated } from '../utils/performanceConsolidated';
performanceConsolidated.recordMetric(name, value, metadata);
```

### Validation
```typescript
// Use validation core
import { validationCore } from '../utils/validationCore';
const result = validationCore.validateStrategyParams(params);
```

## Deployment Guidelines

### Platform Compatibility
- **Vercel**: Schema-compliant `vercel.json`
- **Cloudflare Workers**: Edge-optimized code only
- **Node.js**: Cross-platform compatibility maintained

### Performance Validation
- **Bundle Analysis**: Regular chunk size monitoring
- **Cache Warming**: Edge cache pre-warming for critical paths
- **Health Checks**: Automated monitoring and alerting

## Agent Contact & Handoff

When transitioning between agents:
1. Run final build and typecheck
2. Update relevant documentation
3. Note temporary workarounds or blockers
4. Flag critical follow-up items
5. Summarize decisions and their rationale

## Success Criteria
- ✅ No broken functionality or regressions
- ✅ Code more maintainable and modular
- ✅ Changes clearly documented and traceable
- ✅ Performance metrics maintained or improved
- ✅ Security standards upheld
- ✅ Build and deployment pipelines functional

---

*Last updated: 2025-12-22*
*Repository efficiency transformation completed*