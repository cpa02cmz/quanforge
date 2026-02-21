# Repository Index for AI Agents
**Quick Navigation**: Essential file locations and purposes
**Last Updated**: February 21, 2026

---

## ⚡ Quick Status

### Repository Health: Production Ready
- **Build System**: ✅ Stable (~22s build time)
- **Security**: ✅ Excellent (92/100) - OWASP Top 10 compliant
- **Performance**: ✅ Optimized (85/100) - advanced caching
- **Architecture**: ✅ Modular (25+ focused services)
- **Type Safety**: ✅ Complete (0 TypeScript errors)
- **Test Coverage**: ✅ Comprehensive (622 tests, 100% pass rate)

### Quick Commands
```bash
npm run build      # Verify production build
npm run typecheck  # TypeScript validation
npm run lint       # Code quality check
npm run test       # Run test suite (vitest)
npm run test:run   # Run tests once (CI mode)
```

---

## 🎯 Core Application Files

### Entry Points
- `index.html` - SPA entry point
- `index.tsx` - React app entry
- `App.tsx` - Main application component with routing

### Main Pages
- `pages/Generator.tsx` - AI code generation interface
- `pages/Dashboard.tsx` - Robot management dashboard
- `pages/About.tsx` - About page
- `pages/FAQ.tsx` - FAQ page
- `pages/Wiki.tsx` - Documentation wiki

### Core Components
- `components/ChatInterface.tsx` - AI chat with code generation
- `components/CodeEditor.tsx` - MQL5 editor with syntax highlighting
- `components/ChartComponents.tsx` - Dynamic chart loading (lazy)
- `components/StrategyConfig.tsx` - Strategy parameter configuration
- `components/BacktestPanel.tsx` - Monte Carlo simulation interface

## 🔧 Services Layer (Updated: Modular Architecture)

### Core Services (Streamlined)
- `services/supabase/` - **NEW**: Modular database adapter
  - `auth.ts` - Authentication layer
  - `database.ts` - Database operations
  - `storage.ts` - Storage utilities
  - `index.ts` - Main interface
- `services/gemini.ts` - Google Gemini AI integration
- `services/marketData.ts` - Simulated market data
- `services/i18n.ts` - Internationalization

### Performance Services (Consolidated)
- `services/unifiedCacheManager.ts` - **UNIFIED**: Single cache system
- `services/performance/` - **NEW**: Modular performance layer
  - `monitor.ts` - Performance tracking
  - `optimizer.ts` - Performance optimization
- `services/frontendPerformanceOptimizer.ts` - Bundle optimization

### Database Services (Consolidated)
- `services/database/` - **NEW**: Modular database layer
  - `connectionManager.ts` - Connection pooling
  - `operations.ts` - Database operations
  - `monitoring.ts` - Database monitoring

## 🛠️ Utilities

### Core Utils
- `utils/logger.ts` - Logging utility
- `utils/performance.ts` - Performance monitoring
- `utils/enhancedRateLimit.ts` - Rate limiting (browser compatible)
- `utils/seoEnhanced.ts` - SEO optimization

### Security Services (Modular)
- `services/security/` - **NEW**: Modular security system
  - `SecurityManager.ts` - Main security interface
  - `APISecurityManager.ts` - API protection
  - `RateLimiter.ts` - Rate limiting
  - `ThreatDetector.ts` - Threat detection
  - `InputValidator.ts` - Input validation

### Security Utils
- `utils/encryption.ts` - Encryption utilities
- `utils/errorHandler.ts` - Error handling system

## 📋 Configuration

### Build Configuration
- `vite.config.ts` - Vite build configuration with advanced chunking
- `tsconfig.json` - TypeScript configuration
- `package.json` - Dependencies and scripts

### Deployment
- `vercel.json` - Vercel deployment config
- `middleware.ts` - Request middleware

## 📚 Documentation

### Core Documentation
- `blueprint.md` - System architecture and component hierarchy
- `ROADMAP.md` - Development phases and feature plans
- `AGENTS.md` - Development guidelines and agent insights
- `DOCUMENTATION_INDEX.md` - AI-optimized documentation structure

### Tracking
- `docs/task.md` - Task tracking and completion status
- `bug.md` - Bug tracking and resolution history
- `CHANGELOG.md` - Version history and release notes

## 🎨 Assets

### Constants
- `constants/index.ts` - Application constants
- `constants/strategies/` - Strategy templates
- `constants/translations/` - Translation files

### Public Assets
- `public/` - Static assets, markdown content, images

## 🔒 Security Files

- `services/security/` - Security-related services
- `.env.example` - Environment variable template

## 📊 Analytics & Monitoring

- `services/analyticsManager.ts` - Analytics collection
- `services/edgeAnalytics.ts` - Edge performance analytics
- `utils/performance.ts` - Performance metrics

---

## 🚸 Critical Development Rules

### Must Follow
1. **No Node.js modules in frontend code** - breaks browser build
2. **Use TypeScript interfaces instead of `any`** 
3. **Guard console statements with `import.meta.env.DEV`**
4. **Prefix unused parameters with `_`**
5. **Test build before committing changes**

### File Patterns
- **Components**: PascalCase, `.tsx` extension
- **Services**: camelCase, `.ts` extension  
- **Utils**: camelCase, `.ts` extension
- **Types**: camelCase, `.ts` extension

### Import Patterns
```typescript
// React
import React, { memo, useCallback } from 'react';

// Types
import { Robot, StrategyParams } from '../types';

// Services
import { supabase } from '../services/supabase';
```

## 🔄 Development Workflow

1. **Make changes** to relevant files
2. **Run `npm run build`** to verify compatibility
3. **Run `npm run typecheck`** for TypeScript validation
4. **Run `npm run lint`** for code quality
5. **Update documentation** if structural changes made
6. **Commit with clear message** describing changes

## 📈 Performance Priorities

1. **Bundle size optimization** - chunks under 150KB
2. **Component memoization** - React.memo for heavy components
3. **Lazy loading** - for charts and heavy services
4. **Cache efficiency** - multi-layer caching strategy
5. **Error boundaries** - graceful failure handling

This index provides AI agents with quick navigation to relevant files and understanding of the repository structure and patterns.