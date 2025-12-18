
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
*   **Security Manager**: Industrial-grade security system (`services/securityManager.ts`) with XSS/SQL injection prevention, rate limiting, and WAF patterns
*   **Code Validation**: Comprehensive MQL5 dangerous function detection and sanitization
*   **Edge Security**: Advanced edge-specific security with region blocking and bot detection

## 6. Architectural Analysis & Recommendations

### Current State (Overall Score: 75/100)
- **Security**: 90/100 - Enterprise-grade security implementation
- **Stability**: 80/100 - Robust error handling and memory management
- **Scalability**: 80/100 - Edge-ready with connection pooling and indexing
- **Consistency**: 80/100 - Strong TypeScript standards and code organization
- **Performance**: 70/100 - Advanced caching but large bundle sizes
- **Modularity**: 70/100 - Clear separation but some oversized services
- **Flexibility**: 60/100 - Environment configuration but many hardcoded values

### Critical Architectural Issues

#### Service Size Violations
- `services/supabase.ts` (1584+ lines) violates single responsibility principle
- **Recommendation**: Split into focused microservices:
  - `services/databaseClient.ts` - Core database operations
  - `services/robotRepository.ts` - Robot-specific queries
  - `services/cacheManager.ts` - Caching operations
  - `services/performanceMonitor.ts` - Metrics and monitoring

#### Configuration Rigidity
- Hardcoded values limit deployment flexibility:
  - Rate limiting: `maxRetries: 5`, `retryDelay: 500`
  - Cache TTL: `ttl: 15 * 60 * 1000`
  - Security thresholds and limits
- **Recommendation**: Extract to environment variables or config files

#### Performance Bottlenecks
- Large bundle chunks (>100KB) impact initial load
- Missing virtualization for large lists
- **Recommendation**: Implement code splitting for security utilities and add virtual scrolling

### Recommended Architectural Improvements

#### Phase 1: Service Refactoring (1-2 weeks)
1. **Database Service Split**: Break down `supabase.ts` into focused services
2. **Configuration Extraction**: Move hardcoded values to environment variables
3. **Interface Definition**: Add proper TypeScript interfaces for service contracts

#### Phase 2: Performance Optimization (3-4 weeks)
1. **Bundle Splitting**: Separate security utilities into lazy-loaded chunks
2. **Virtualization**: Implement for dashboard lists and chat history
3. **Caching Strategy**: Optimize cache TTLs and implement intelligent invalidation

#### Phase 3: Quality Enhancement (1-2 months)
1. **Testing Framework**: Comprehensive unit and integration tests
2. **Documentation**: Standardize commenting and API documentation
3. **Health Checks**: Add dependency monitoring and health endpoints

### Architectural Strengths to Preserve
- **Security-First Approach**: Maintain comprehensive security manager
- **Edge Optimization**: Preserve edge-ready performance optimizations
- **Error Handling**: Continue robust error boundary and recovery patterns
- **Type Safety**: Maintain strict TypeScript configuration and practices

### Long-term Architectural Vision
- **Microservice Ready**: Current service-oriented architecture can evolve to microservices
- **API-First**: Clean separation allows for future API layer implementation
- **Multi-Provider**: AI service abstraction supports adding new providers
- **Horizontal Scaling**: Edge-ready architecture supports global deployment scaling
