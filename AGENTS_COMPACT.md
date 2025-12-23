# QuantForge Development Agent Guidelines

## Core Development Principles

- **Stability First**: Always verify build compatibility before making changes
- **Cross-Platform**: Target browser, Node.js, and edge environments
- **Type Safety**: Minimize `any` usage, prefer strict TypeScript
- **Modularity**: Keep services <500 lines, single responsibility
- **Security**: Never expose secrets, validate inputs

## Critical Development Patterns

### Build System (CRITICAL)
```bash
npm run build      # Must pass before any commit
npm run typecheck  # TypeScript compilation must be clean
npm run lint       # Address critical warnings
```

### Browser Compatibility Checklist
- [ ] Verify all imports work in browser environment
- [ ] Avoid Node.js-specific modules (`crypto`, `fs`, `path`)
- [ ] Use Web APIs or browser-compatible alternatives
- [ ] Test build after adding new dependencies

### Schema Compliance Rules
- **Vercel**: Use minimal, schema-compliant `vercel.json`
- **API Routes**: Avoid unsupported properties (`regions`, `experimental`)
- **Build Configuration**: Use optimized flags `--prefer-offline --no-audit`

## Common Issues & Solutions

### Browser Crypto Incompatibility
**Problem**: `crypto.createHash` fails in browser builds  
**Solution**: Use browser-compatible hash algorithms or Web Crypto API

### Deployment Schema Validation
**Problem**: Platform rejects configuration due to schema violations  
**Solution**: Remove deprecated properties, use minimal configuration

### Large Bundle Chunks (>100KB)
**Problem**: Build warnings about large chunks  
**Solution**: Implement dynamic imports, manual chunk splitting

### ESLint Warnings
**Problem**: Console statements, unused variables, any types  
**Solution**: Incremental cleanup, prioritize critical issues

## Repository Architecture

### Key Directories
- `components/` - React components with memoization
- `services/` - Business logic, API clients, utilities
- `utils/` - Pure utility functions, validation helpers
- `pages/` - Route components with lazy loading
- `api/` - Edge API routes (Vercel runtime)

### Build Configuration
- `vite.config.ts` - Advanced chunking and optimization
- `vercel.json` - Deployment configuration (schema compliant)
- `tsconfig.json` - Strict TypeScript settings

## Deployment Pattern

### Vercel Configuration (Working Pattern)
```json
{
  "version": 2,
  "buildCommand": "npm ci --prefer-offline --no-audit && npm run build",
  "installCommand": "npm ci --prefer-offline --no-audit",
  "functions": {
    "api/**/*.ts": {
      "runtime": "edge",
      "maxDuration": 15
    }
  }
}
```

## Quality Standards

### Performance Targets
- Build time: <15 seconds
- Bundle chunks: <100KB (except vendors)
- TypeScript errors: 0
- ESLint warnings: <50 (critical only)

### Code Quality
- Service files: <500 lines
- Component memoization: React.memo where appropriate
- Error handling: Unified patterns across services
- Type safety: Minimize `any` usage

## Testing & Validation Workflow

1. **Pre-commit**: `npm run build && npm run typecheck`
2. **Feature Development**: Incremental testing during development
3. **Deployment**: Local validation before pushing
4. **Documentation**: Update relevant docs after changes

## Recent Critical Fixes (Reference)

### Build System Restoration (2025-12-18)
- Fixed Node.js crypto browser compatibility
- Resolved Vercel schema validation errors
- Restored deployment pipelines

### Performance Optimizations (2025-12-22)
- Advanced chunk splitting implementation
- Edge runtime optimizations
- Bundle compression improvements

### Code Quality Improvements (Current)
- React Fast Refresh compatibility fixes
- ESLint warning reductions
- TypeScript strict typing

## Known Issues In Progress

- Large vendor chunks (React, charts, AI libraries) - needs manual splitting
- API routes using Next.js patterns in Vite project - architectural review needed
- 905+ `any` type usages - systematic reduction required
- 200+ ESLint warnings - incremental cleanup in progress

## Success Criteria

✅ Build passes without errors  
✅ TypeScript compilation clean  
✅ Deployment pipelines functional  
✅ Cross-platform compatibility maintained  
✅ No regressions introduced  
✅ Documentation updated  

---

*Last Updated: 2025-12-23*
*Build Verification: Passes (13.07s build time)*