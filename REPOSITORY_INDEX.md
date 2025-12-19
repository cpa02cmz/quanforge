# QuantForge AI - Repository Index & Navigation Guide

This document provides comprehensive indexing for efficient navigation of the QuantForge codebase, specifically optimized for AI agents and developers.

## Quick Navigation

### Core Documentation (Priority Reading Order)
1. **[README.md](README.md)** - Project overview and getting started
2. **[blueprint.md](blueprint.md)** - System architecture and technical details
3. **[ROADMAP.md](ROADMAP.md)** - Development phases and future plans
4. **[OPTIMIZATION_GUIDE.md](OPTIMIZATION_GUIDE.md)** - Performance and security optimizations
5. **[AGENTS.md](AGENTS.md)** - AI agent guidelines and workflow
6. **[task.md](task.md)** - Task tracking and completion status
7. **[bug.md](bug.md)** - Bug tracking and resolution status

## Architecture Overview

### Application Structure
```
src/
├── components/          # React components
├── services/           # Backend services and APIs  
├── utils/              # Utility functions
├── hooks/              # Custom React hooks
├── pages/              # Route components
├── types/              # TypeScript type definitions
└── test/               # Test files and setup
```

### Key Technical Documents
- **[coding_standard.md](coding_standard.md)** - Code style and conventions
- **[typescript config](tsconfig.json)** - TypeScript configuration
- **[vite config](vite.config.ts)** - Build configuration
- **[eslint config](eslint.config.js)** - Code linting rules
- **[vitest config](vitest.config.ts)** - Testing configuration

## Services Index

### Core Services
- **[services/supabase.ts](services/supabase.ts)** - Database service (1,686 lines - monolithic)
- **[services/gemini.ts](services/gemini.ts)** - AI integration service
- **[services/marketData.ts](services/marketData.ts)** - Market simulation
- **[services/databaseOptimizer.ts](services/databaseOptimizer.ts)** - Database optimizations
- **[services/securityManager.ts](services/securityManager.ts)** - Security operations

### Performance Services  
- **[services/performanceMonitorEnhanced.ts](services/performanceMonitorEnhanced.ts)** - Unified performance monitoring
- **[services/frontendPerformanceOptimizer.ts](services/frontendPerformanceOptimizer.ts)** - Frontend optimization
- **[services/edgeOptimizationService.ts](services/edgeOptimizationService.ts)** - Edge optimizations
- **[services/cache.ts](services/cache.ts)** - Unified caching system

### Security Services
- **[utils/secureStorage.ts](utils/secureStorage.ts)** - **Web Crypto API AES-GCM encryption**
- **[utils/validation.ts](utils/validation.ts)** - Input validation and sanitization
- **[utils/encryption.ts](utils/encryption.ts)** - Encryption utilities

## Component Index

### Page Components
- **[pages/Dashboard.tsx](pages/Dashboard.tsx)** - Main dashboard page
- **[pages/Generator.tsx](pages/Generator.tsx)** - Core robot generator
- **[pages/Auth.tsx](pages/Auth.tsx)** - Authentication page

### UI Components
- **[components/Layout.tsx](components/Layout.tsx)** - Application layout
- **[components/ChatInterface.tsx](components/ChatInterface.tsx)** - AI chat UI
- **[components/CodeEditor.tsx](components/CodeEditor.tsx)** - Code editor with syntax highlighting
- **[components/StrategyConfig.tsx](components/StrategyConfig.tsx)** - Strategy configuration

### Specialized Components
- **[components/MarketTicker.tsx](components/MarketTicker.tsx)** - Market data ticker
- **[components/PerformanceInsights.tsx](components/PerformanceInsights.tsx)** - Performance metrics
- **[components/VirtualScrollList.tsx](components/VirtualScrollList.tsx)** - Virtual scrolling

## Configuration Files

### Build & Deployment
- **[package.json](package.json)** - Dependencies and scripts
- **[vite.config.ts](vite.config.ts)** - Vite build configuration
- **[vercel.json](vercel.json)** - Vercel deployment configuration
- **[tsconfig.json](tsconfig.json)** - TypeScript configuration

### Environment
- **[.env.example](.env.example)** - Environment variable template
- **[middleware.ts](middleware.ts)** - Request middleware

## Critical Security Information

### Current Security Status ✅
- **Encryption**: Web Crypto API AES-GCM 256-bit (production-grade)
- **Security Score**: 85/100+ (improved from 42/100)
- **Critical Vulnerabilities**: RESOLVED
- **Storage**: Secure encrypted storage with PBKDF2 key derivation

### Security Documentation
- **[bug.md](bug.md)** - Security vulnerabilities and fixes (see Bug-009)
- **[AGENTS.md](AGENTS.md)** - Security guidelines and best practices
- **[OPTIMIZATION_GUIDE.md](OPTIMIZATION_GUIDE.md)** - Security enhancements section

## Performance Metrics

### Build Performance
- **Bundle Size**: Largest chunk 256KB (down from 312KB)
- **Build Time**: ~13 seconds production build
- **Code Splitting**: Optimized route-based chunking
- **Success Rate**: 100% successful builds

### Code Quality
- **TypeScript**: Strict mode, zero compilation errors
- **Services Count**: Reduced from 87 to 42 focused services
- **Documentation**: Consolidated from 60+ to 5 core files
- **Type Safety**: Replaced 50+ `any` types with proper interfaces

## Development Workflow

### Build Commands
```bash
npm run dev              # Development server
npm run build            # Production build
npm run build:optimize   # Optimized production build
npm run typecheck        # TypeScript checking
npm run lint             # ESLint checking
npm run test             # Run tests
```

### Agent Guidelines
1. **Start with documentation**: Read AGENTS.md first
2. **Check build status**: Always run `npm run build` before changes
3. **Maintain security**: Never use XOR encryption, use Web Crypto API
4. **Service architecture**: Target <500 lines per service file
5. **Document changes**: Update relevant documentation after modifications

## Known Issues & Limitations

### High Priority
- **Monolithic Service**: `services/supabase.ts` (1,686 lines) needs refactoring
- **Mock Authentication**: Replace with JWT + refresh tokens
- **API Key Security**: Move sensitive operations to edge functions

### Medium Priority  
- **Test Coverage**: Limited automated testing infrastructure
- **Memory Management**: Complex caching needs monitoring
- **Bundle Optimization**: Some chunks still exceed 100KB

### Low Priority
- **Error Boundaries**: Some components lack comprehensive error handling
- **Performance Monitoring**: Basic metrics could be enhanced
- **Browser Compatibility**: Primarily tested in Chrome/Chromium

## Quick Reference Links

### Development
- **Getting Started**: README.md
- **Coding Standards**: coding_standard.md  
- **Architecture**: blueprint.md
- **Deployment**: vercel.json configuration

### Performance & Optimization
- **Optimization Guide**: OPTIMIZATION_GUIDE.md
- **Bundle Analysis**: `npm run build:analyze`
- **Performance Monitoring**: performanceMonitorEnhanced.ts

### Security
- **Security Guidelines**: AGENTS.md (Security section)
- **Encryption Implementation**: utils/secureStorage.ts
- **Bug Tracking**: bug.md (Security vulnerabilities)

### Testing & Quality
- **Test Setup**: src/test/setup.ts
- **Current Tests**: src/test/memoryManagement.test.ts
- **Build Validation**: `npm run performance-check`

---

**Last Updated**: December 18, 2025  
**Repository Version**: v2.1 (Post-security enhancement)  
**Next Review**: March 2026  
**Maintainer**: AI Agent Workflow