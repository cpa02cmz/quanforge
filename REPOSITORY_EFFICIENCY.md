# Repository Efficiency Guide

## Overview
This document provides AI agents with efficient access to repository information, context, and development patterns for the QuantForge AI project.

## Quick Start for AI Agents

### 1. Repository Health Status (2025-12-23)
- **Build System**: ✅ Functional (14.4s build time)
- **Testing**: ✅ Vitest + React Testing Library (28 passing tests, 31.44% coverage)
- **TypeScript**: ✅ Compilation passes
- **Bundle Size**: ⚠️ Some chunks >100KB (react-dom: 177KB, chart-core: 213KB, ai-gemini: 246KB)
- **ESLint**: ⚠️ 200+ warnings (console.log, unused vars, any types)

### 2. Critical Success Metrics
| Metric | Current | Target | Status |
|--------|---------|--------|---------|
| Test Coverage | 31.44% | >80% | 🟡 Needs Work |
| Build Time | 14.4s | <15s | ✅ Good |
| Any Types | Reduced | <50 | 🟡 Improved |
| Services >500 lines | Eliminated | 0 | ✅ Complete |

### 3. Repository Architecture Summary

#### Modular Service Layer (COMPLETED)
- **Core Services**: DIContainer, ServiceOrchestrator
- **Database Layer**: DatabaseCore, CacheManager, ConnectionPool, RobotDatabaseService
- **AI Services**: AICore, WorkerManager, RateLimiter
- **Security**: security/ (7 specialized modules)
- **Analytics**: AnalyticsCollector
- **Performance**: Performance Monitor, Edge Optimizer

#### Key File Patterns
```
services/core/           - Core infrastructure and DI
services/database/       - Database operations
services/ai/             - AI and ML services
services/security/       - Security and validation
services/analytics/      - Analytics and monitoring
utils/                   - Shared utilities
components/              - React components
api/                     - API routes
types/                   - TypeScript definitions
```

### 4. Development Patterns for Efficiency

#### Service Creation Pattern
```typescript
// 1. Define interface in types/serviceInterfaces.ts
export interface IExampleService {
  method(): Promise<Result>;
}

// 2. Implement service in services/core/
export class ExampleService implements IExampleService {
  constructor(private deps: Dependencies) {}
  
  async method(): Promise<Result> {
    // Implementation
  }
}

// 3. Register in DIContainer
container.register(SERVICE_TOKENS.EXAMPLE_SERVICE, ExampleService);
```

#### Component Pattern
```typescript
// Use consistent patterns across components
export const ExampleComponent: React.FC<ExampleProps> = ({ prop }) => {
  // Component logic
};
```

### 5. Testing Framework Setup

#### Test Files Structure
```
services/core/DIContainer.test.ts    - Core service tests
src/test/memoryManagement.test.ts   - Utility tests
services/edgeCacheManager.test.ts   - Service tests
```

#### Running Tests
- All tests: `npm run test:run`
- Coverage: `npm run test:coverage`
- UI: `npm run test:ui`

### 6. Bundle Optimization Status

#### Current Chunk Analysis
- **react-dom**: 177KB (React core)
- **chart-core-engine**: 213KB (Recharts)
- **ai-google-gemini**: 246KB (Google AI SDK)

#### Optimization Strategy
- Dynamic imports implemented
- Manual chunk splitting configured
- Edge optimization applied

### 7. Code Quality Priorities

#### ESLint Focus Areas
1. Remove console.log statements
2. Fix unused variables/imports
3. Reduce `any` type usage
4. Standardize naming conventions

#### Type Safety Improvement
- Focus on service response types
- Error handling patterns
- Cache implementation types
- API integration contracts

### 8. Build and Deployment

#### Build Commands
- Standard: `npm run build` (14.4s)
- Edge: `npm run build:edge`
- Analyze: `npm run build:analyze`

#### Platform Support
- ✅ Vercel (Edge Runtime)
- ✅ Cloudflare Workers
- ✅ Browser, Node.js compatibility

### 9. Configuration System

#### Environment Variables
```typescript
// All configs centralized in constants/config.ts
AI_CONFIG          - AI model configurations
DEV_SERVER_CONFIG  - Development server settings
CACHE_CONFIG       - Caching strategies
SECURITY_CONFIG    - Security parameters
```

### 10. Common Agent Tasks

#### When Adding New Features
1. Create interface in types/
2. Implement service in appropriate module
3. Add tests with proper coverage
4. Update documentation
5. Run typecheck and lint

#### When Fixing Bugs
1. Add test case that reproduces issue
2. Fix the implementation
3. Verify all tests pass
4. Update bug.md

#### When Optimizing Performance
1. Measure before and after
2. Update bundle analysis
3. Verify no regression
4. Document improvements

### 11. Security Best Practices

#### Current Security Score: 92/100
- WAF implemented with 9 attack protections
- Input validation with XSS prevention
- Multi-tier rate limiting
- Edge security measures

### 12. Performance Optimizations Applied

#### Current Performance Score: 88/100
- Edge runtime optimization
- Advanced chunk splitting (25+ strategies)
- Multi-tier caching
- Real-time monitoring

### 13. Documentation Workflow

#### When Updating Documentation
1. Keep AGENTS.md current for insights
2. Update blueprint.md for architecture changes
3. Update roadmap.md for progress tracking
4. Update task.md for completion status

## Quick Reference

### Essential Scripts
```bash
npm run build        # Production build
npm run test:run     # Run all tests
npm run typecheck    # Type validation
npm run lint         # Code quality check
npm run lint:fix     # Auto-fix warnings
```

### Important Locations
- **Architecture**: blueprint.md
- **Progress**: ROADMAP.md
- **Bugs**: bug.md
- **Tasks**: task.md
- **Agent Guide**: AGENTS.md
- **Efficiency Guide**: REPOSITORY_EFFICIENCY.md

This guide serves as the primary reference for AI agents working with the QuantForge AI repository. Keep this documentation synchronized with the codebase for maximum efficiency.