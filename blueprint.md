
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

### Comprehensive Codebase Analysis (2025-12-23)
**Overall Score: 65/100** - Advanced architecture with significant technical debt

#### Category Breakdown:
- **Stability**: 7/10 - Comprehensive error handling, monolithic services create risk
- **Performance**: 9/10 - Exceptional edge optimization and advanced caching strategies  
- **Security**: 8/10 - Multi-layer security with comprehensive input validation
- **Scalability**: 7/10 - Good connection pooling, service complexity hinders scaling
- **Modularity**: 4/10 - Major issues: service explosion, monolithic components, tight coupling
- **Flexibility**: 8/10 - Excellent configuration management and feature flags
- **Consistency**: 6/10 - Good patterns in core, inconsistent across service layer

#### Critical Technical Findings:
**Monolithic Services Requiring Decomposition:**
- `services/SecurityManager.ts` - 1,611 lines (violates Single Responsibility Principle)
- `services/supabase.ts` - 1,583 lines (database + UI + auth concerns mixed)
- `services/enhancedSupabasePool.ts` - 1,405 lines
- `services/edgeCacheManager.ts` - 1,209 lines

**Service Layer Issues:**
- Service explosion: 95+ service files indicating over-engineering
- Duplicate cache implementations: 6+ redundant cache services
- Multiple Supabase clients with overlapping functionality
- High inter-service coupling with no dependency injection patterns

**Component Analysis:**
- `components/ChatInterface.tsx` - 420 lines (needs decomposition)
- `components/StrategyConfig.tsx` - 369 lines (form + validation + UI mixed)
- `components/CodeEditor.tsx` - 345 lines (editor + linting + syntax mixed)

**Key Architectural Strengths:**
- Advanced Vite configuration with 15+ granular chunk splitting rules
- Triple-pass terser optimization and edge runtime optimization
- Comprehensive security with multi-layer validation and sanitization
- Sophisticated caching strategies (edge + application + database tiers)

#### Immediate Refactoring Priorities:
1. **Week 1**: Decompose SecurityManager into 5 focused services
2. **Week 2**: Break down supabase.ts into separate concerns
3. **Week 3**: Consolidate 6 cache implementations into 1-2 cohesive services

### Performance Optimization Status (2025-12-22 Update)
- **Vite Configuration**: Advanced 320-line config with 25+ chunk categories
- **Bundle Splitting**: Granular component, service, and route-based optimization  
- **Edge Performance**: Full Vercel Edge runtime optimization
- **Build Compression**: Triple-pass terser optimization
- **Schema Compliance**: Clean, deployment-ready configuration files
- **PR Management**: Systematic resolution of deployment issues across multiple PRs
- **Database Optimization**: PR #132 ready with comprehensive indexing and query optimization
- **Deployment Reliability**: Optimized vercel.json pattern for consistent platform deployments

### Code Quality Standards
- **Type Safety**: Minimize `any` usage, implement strict TypeScript
- **Modularity**: Service files should be <500 lines, well-decoupled
- **Consistency**: Unified error handling, naming conventions, patterns
- **Testing**: >80% test coverage for critical paths

### Architectural Principles (Post-Analysis)  
- **Service Decomposition**: Single Responsibility Principle enforcement
- **Dependency Injection**: Reduce coupling between 95+ services
- **Component Boundaries**: UI components <300 lines with clear concerns
- **Configuration Management**: Continue excellent environment variable patterns
- **Performance Optimization**: Maintain advanced edge and build optimizations
