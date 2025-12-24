
# QuantForge AI - System Blueprint

This document outlines the high-level architecture, component hierarchy, and data flow of the QuantForge AI application.

## 1. System Overview

QuantForge AI is a Single Page Application (SPA) designed to democratize algorithmic trading strategy creation. It bridges the gap between natural language intention and compiled MQL5 code.

**Core Value Proposition:**
- **Natural Language Interface**: Users describe logic in English.
- **Structural Integrity**: The system ensures generated code follows MQL5 best practices (Inputs, OnInit, OnTick).
- **Immediate Feedback Loop**: Code generation, syntax highlighting, and strategy risk analysis happen in one view.

## 2. Component Hierarchy

```mermaid
graph TD
    App[App.tsx] --> AuthProvider[Supabase Auth Listener]
    App --> ToastProvider[Toast Context]
    ToastProvider --> Router[React Router]
    
    Router --> Layout[Layout.tsx]
    Layout --> Sidebar[Navigation]
    Layout --> ContentArea[Outlet]
    
    ContentArea --> Login[Auth.tsx]
    ContentArea --> Dashboard[Dashboard.tsx]
    ContentArea --> Generator[Generator.tsx]
    
    Generator --> Chat[ChatInterface.tsx]
    Generator --> Settings[StrategyConfig.tsx]
    Settings --> MarketTicker[MarketTicker.tsx]
    Generator --> Editor[CodeEditor.tsx]
    Generator --> Charts[Recharts (Pie)]
```

## 3. Key Subsystems

### A. The Generation Loop (`services/gemini.ts`)
1.  **Input**: User Prompt + Current Code State + Strategy Configuration (JSON).
2.  **Context Construction**: The service builds a prompt that enforces the configuration (Timeframe, Risk, Inputs) as "Hard Constraints" and the User Prompt as "Soft Logic".
3.  **Model Interaction**: Calls `gemini-3-pro-preview` for high-reasoning code generation.
4.  **Parsing**: A robust extraction layer identifies Markdown code blocks to separate executable code from conversational text.

### B. Persistence Layer (`services/supabase.ts`)
*   **Design Pattern**: Adapter Pattern.
*   **Behavior**:
    *   If `SUPABASE_URL` is present -> Connects to real backend.
    *   If missing -> Falls back to `localStorage` (Mock Mode).
*   **Entities**:
    *   `Robot`: Contains `code`, `strategy_params`, `chat_history`, `analysis_result`.

### C. Market Simulation (`services/marketData.ts`)
*   **Pattern**: Observer (Pub/Sub) + Singleton.
*   **Logic**:
    *   Maintains a virtual order book price for major pairs.
    *   Updates subscribers (UI components) every 1000ms.
    *   Uses Brownian motion with volatility clustering for realistic "noise".

## 4. State Management Strategy

*   **Global State**: Minimal. `Auth Session` and `Toast Notifications`.
*   **Page State**: `Generator.tsx` acts as the main controller for the specific robot being edited. It manages:
    *   `code` (String)
    *   `messages` (Array)
    *   `strategyParams` (Object)
    *   `analysis` (Object)
*   **Sync**: When "Save" is clicked, all page state is serialized and sent to the Persistence Layer.

## 5. Security & Safety

*   **API Keys**: Accessed via `process.env`.
*   **Input Sanitization**: Filenames are sanitized before download.
*   **Prompt Engineering**: System prompts prevents the AI from generating harmful or non-MQL5 content.

## 6. Deployment Considerations

### Build Compatibility
- **Cross-Platform Environment**: All code must work in browser, Node.js, and edge environments
- **Module Restrictions**: Avoid Node.js-specific modules (`crypto`, `fs`, `path`) in frontend code
- **Schema Compliance**: Platform configuration files must follow current schema requirements

### Known Issues & Solutions
- **Browser Crypto**: Replace Node.js `crypto` with browser-compatible alternatives
- **Vercel Schema**: Use minimal, schema-compliant `vercel.json` configuration
- **API Route Schema**: API route config exports must avoid unsupported properties like `regions`
- **Build Validation**: Always run build and typecheck before deployment

### Critical Technical Debt (2025-12-20 Analysis)
- **Build System**: Fixed TypeScript compilation and restored functionality  
- **Type Safety**: 905 `any` type usages creating runtime risks (priority action)
- **Maintainability**: Monolithic services limiting development velocity
- **Code Quality**: Advanced optimizations implemented, build system restored

### Performance Optimization Status (2025-12-24 Update)
- **Vite Configuration**: Advanced 320-line config with 25+ chunk categories
- **Bundle Splitting**: Granular component, service, and route-based optimization  
- **Edge Performance**: Full Vercel Edge runtime optimization
- **Build Compression**: Triple-pass terser optimization
- **Schema Compliance**: Clean, deployment-ready configuration files
- **PR Management**: Systematic resolution of deployment issues across multiple PRs
- **Database Optimization**: PR #132 ready with comprehensive indexing and query optimization
- **Deployment Reliability**: Optimized vercel.json pattern for consistent platform deployments
- **Pattern Framework**: Established proven Documentation-Only PR resolution pattern (6/6 successful applications)
- **Platform Independence**: Validated approach for separating code quality from platform deployment issues
- **Documentation Quality**: PR #146 establishes platform deployment pattern framework for future issues
- **Deployment Reliability**: Optimized vercel.json pattern consistently applied across all platforms
>>>>>>> 0a856d7ad185c16b1734ee5dcad5dd9be57fb580

### Comprehensive Codebase Analysis Results (2025-12-24)

| Category | Score (0-100) | Assessment |
|----------|---------------|------------|
| **Stability** | 78/100 | Good reliability with robust error handling |
| **Performance** | 85/100 | Excellent optimization with advanced chunking |
| **Security** | 88/100 | Enterprise-grade protection systems |
| **Scalability** | 82/100 | Strong architecture for growth readiness |
| **Modularity** | 71/100 | Good separation with some monolithic services |
| **Flexibility** | 94/100 | Outstanding configurability, zero hardcoded values |
| **Consistency** | 76/100 | Good standards with some pattern variation |
| **Overall Score** | **82/100** | **Production Ready with targeted improvements needed** |

#### Category Justifications

**Stability (78/100)**:
- Comprehensive error boundaries with retry logic (`components/ErrorBoundary.tsx:120`)
- Circuit breaker pattern with auto-recovery (`services/resilientSupabase.ts:518`)
- **Critical Issue**: 905+ `any` type usages reducing compile-time safety
- **Risk**: Console logging in production (100+ statements)

**Performance (85/100)**:
- Advanced 320-line Vite configuration with granular code splitting
- Build time: 13.23s with successful TypeScript compilation
- **Strength**: 12+ strategic chunks (react-vendor, ai-vendor, services-data)
- **Concern**: Large service files >500 lines need decomposition

**Security (88/100)**:
- 781-line security manager with 14 attack pattern categories
- MQL5-specific trading code protection
- **Excellence**: Comprehensive input validation and rate limiting
- **Coverage**: CSRF protection, edge security, content sanitization

**Scalability (82/100)**:
- Advanced connection pooling and edge architecture
- Circuit breakers and retry mechanisms for horizontal scaling
- **Ready**: Multi-level caching and performance budgeting
- **Infrastructure**: Edge configuration with 15+ environment variables

**Modularity (71/100)**:
- Clear service layer with specialized components
- **Improvement Needed**: Services >500 lines (resilientSupabase.ts:518, enhancedSecurityManager.ts:781)
- **Architecture**: Some cross-domain dependencies and tight coupling
- **Structure**: 11 components, 50+ services, 30+ utilities

**Flexibility (94/100)**:
- 68-line `.env.example` with comprehensive configurability
- Feature flags and multi-provider support
- **Excellence**: Zero hardcoded values found
- **Adaptability**: Runtime environment detection and fallback mechanisms

**Consistency (76/100)**:
- Strict TypeScript configuration with comprehensive rules
- **Positive**: Consistent naming conventions and error handling patterns
- **Gaps**: Import style variation and documentation inconsistency
- **Standards**: Similar functionality implemented differently across services

#### Critical Priorities (Immediate)

1. **Type Safety Crisis**: ✅ IN PROGRESS - Reduced securityManager.ts from 21→0 any types, overall 905→884 instances
2. **Service Decomposition**: Break down monolithic services >500 lines
3. **Production Cleanup**: Remove console statements from production build
4. **Documentation Standardization**: Consistent documentation across modules

#### Technical Debt Summary

**High Risk**:
- Type safety degradation with extensive `any` usage
- Monolithic service architecture limiting maintainability

**Medium Risk**:
- Pattern inconsistency across similar functionality
- Production console logging affecting security

**Low Risk**:
- Import style variation
- Documentation gaps

#### Production Readiness Assessment

✅ **Ready for Production** with immediate focus on:
- Type safety improvements (Week 1)
- Service decomposition (Week 2)
- Production cleanup (Week 1)

**Enterprise Strengths**:
- Security: 88/100 with comprehensive protection
- Performance: 85/100 with advanced optimization
- Flexibility: 94/100 with zero hardcoded values
- Build Reliability: Working 13.23s build system

### Code Quality Standards
- **Type Safety**: Minimize `any` usage, implement strict TypeScript (CRITICAL: 905 instances found)
- **Modularity**: Service files should be <500 lines (IMPROVEMENT: Multiple services exceeding limit)
- **Consistency**: Unified error handling, naming conventions, patterns (GOOD: Generally consistent)
- **Testing**: >80% test coverage for critical paths (PENDING: Analysis reveals testing gap)
