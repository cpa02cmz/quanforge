
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

## Comprehensive Codebase Analysis Results (December 2025)

### Evaluation Scores
Based on systematic analysis of the entire codebase:

| Category | Score | Status |
|----------|-------|--------|
| **Stability** | 78/100 | Good |
| **Performance** | 85/100 | Excellent |
| **Security** | 42/100 | ⚠️ Critical Issues |
| **Scalability** | 55/100 | Moderate |
| **Modularity** | 65/100 | Good |
| **Flexibility** | 82/100 | Excellent |
| **Consistency** | 88/100 | Excellent |

### Critical Findings

#### Security Vulnerabilities (Priority 1)
- ~~**Encryption**: XOR encryption in `utils/secureStorage.ts:21` is not production-grade~~ ✅ **FIXED**
  - **Replaced** with Web Crypto API AES-GCM 256-bit encryption
  - **Added** PBKDF2 key derivation with salt for enhanced security
  - **Maintained** backward compatibility with legacy data migration
- **Authentication**: Mock system lacks proper security controls
- **API Keys**: Client-side exposure in environment variables

#### Architecture Issues (Priority 2) ✅ IMPROVED
- **Monolithic Service**: `services/supabase.ts` (1,686 lines) remains - future iteration needed
- **Service Fragmentation**: ✅ RESOLVED - Reduced from 87 to 42 focused services
- **Memory Management**: ✅ OPTIMIZED - Consolidated duplicate caching layers

#### Performance Strengths
- **Bundle Optimization**: Largest chunk 256KB (down from 312KB)
- **Code Splitting**: Sophisticated route-based chunking
- **React Optimization**: Extensive memoization implemented

### Architectural Recommendations

#### Immediate Actions (Critical)
1. **Replace XOR Encryption**: ✅ COMPLETED - Implemented Web Crypto API with AES-GCM
2. **Service Layer Consolidation**: ✅ COMPLETED - Reduced 87 services to 42 focused modules
3. **Security Audit**: Comprehensive review of authentication and data protection

#### Medium Term ✅ COMPLETED (December 2025)
1. **Service Consolidation**: ✅ Reduced from 87 to 42 services (52% reduction)
   - Consolidated cache services under `consolidatedCacheManager.ts`
   - Merged performance monitoring under `performanceMonitorEnhanced.ts`  
   - Removed 45+ unused/duplicate service files
   - Maintained all core functionality with cleaner architecture
2. **Memory Profiling**: ✅ Optimized caching layer and removed redundancies
3. **Bundle Optimization**: ✅ Maintained <300KB chunks with better splitting

#### Long Term
1. **Microservices Architecture**: For enterprise scalability
2. **Multi-tenancy**: Design for multiple users/organizations
3. **APM Integration**: Real-time performance monitoring

## Agent Workflow

### Development Process
1. **Branch Strategy**: Main for production, develop for integration work
2. **PR Management**: All changes via pull requests with automated checks
3. **Documentation First**: Update AGENTS.md before major architectural changes
4. **Quality Gates**: Build, lint, and type-check must pass before merge

### Deployment Considerations
- **Vercel Config**: Avoid experimental features that break schema validation
- **Edge Functions**: Regional deployment for performance
- **Bundle Analysis**: Monitor chunks >100KB for optimization opportunities
- **Environment Variables**: Never expose sensitive data in client bundles

### Security Priorities
- **Encryption**: Replace XOR with production-grade encryption immediately
- **Authentication**: Implement proper user authentication system
- **API Security**: Move sensitive operations to edge functions
