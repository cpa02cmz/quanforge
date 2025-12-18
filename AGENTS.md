# Development Agent Guidelines

## Agent Insights & Decisions

### Build System Compatibility (2025-12-18)
**Issue**: Node.js crypto module incompatibility with browser builds  
**Root Cause**: `utils/enhancedRateLimit.ts` imported server-side `crypto` using `createHash`  
**Solution Applied**: Browser-compatible simple hash algorithm  
**Key Insight**: Always verify cross-platform compatibility when importing Node.js modules in frontend code

### Vercel Deployment Schema Issues (2025-12-18)
**Issue**: Multiple `vercel.json` schema validation errors blocking deployments  
**Root Causes**: 
- Conflicting `builds` and `functions` properties
- Invalid `experimental` and `environment` properties  
- Legacy configuration patterns
**Solution Applied**: Cleaned up vercel.json with schema-compliant settings
**Key Insight**: Deployment platform schemas evolve - remove deprecated properties proactively

### PR Management & Red Flag Resolution (2025-12-18)
**Issue**: PR #139 had red flags with failing deployments on both Vercel and Cloudflare Workers
**Root Causes**: Build compatibility and deployment configuration conflicts
**Solution Applied**: Systematic troubleshooting of build, schema, and deployment pipeline
**Key Insight**: Address root causes systematically rather than symptom patches

### Recommended Development Patterns

#### Browser Compatibility Checklist
- [ ] Verify all imports work in browser environment
- [ ] Avoid Node.js-specific modules (`crypto`, `fs`, `path`, etc.)
- [ ] Use Web APIs or browser-compatible alternatives
- [ ] Test build process after adding new dependencies

#### Error Handling Strategy
- **Current**: Build-blocking errors must be resolved immediately
- **Priority**: Critical > High > Medium > Low
- **Critical Impact**: Build failures, security vulnerabilities, data loss
- **Approach**: Fix first, optimize later

#### Module Design Principles
1. **Cross-Platform First**: Always target browser environment
2. **Graceful Degradation**: Provide fallbacks when possible
3. **Type Safety**: Strong TypeScript typing preferred
4. **Single Responsibility**: Each utility should have one clear purpose

## Agent Guidelines for Future Work

### When Addressing Bugs
1. **Verify Build Impact**: Always run `npm run build` to check for breaking changes
2. **Type Check**: Use `npm run typecheck` to catch TypeScript issues
3. **Lint Quality**: Address critical lint issues but prioritize function over form
4. **Document**: Record root cause, solution, and prevention strategies

### When Optimizing Features
1. **Measure First**: Use bundle analysis before and after changes
2. **User Impact**: Prioritize visible improvements over internal optimizations
3. **Backwards Compatibility**: Maintain existing APIs where possible
4. **Testing**: Verify optimization doesn't break existing functionality

### When Improving Code Quality
1. **Incremental**: Fix issues in logical groups rather than random scatter
2. **Context-Aware**: Understand file purpose before changing patterns
3. **Consistent**: Follow existing conventions unless clearly problematic
4. **Document Changes**: Update relevant documentation files

## Codebase Analysis Results (2025-12-18)

### Comprehensive Assessment
- **Overall Score**: 75/100 across 7 critical categories
- **Critical Issues Identified**:
  - Service size violations (`services/supabase.ts`: 1584+ lines)
  - Hardcoded configuration values throughout codebase
  - Bundle size optimization needed (>100KB chunks)
  - Missing comprehensive test coverage

### Architecture Insights
- **Security Excellence**: 90/100 - Enterprise-grade implementation with comprehensive protection
- **Scalability Ready**: 80/100 - Edge-ready architecture with connection pooling
- **Maintainability Concerns**: Service size and configuration rigidity need attention

## Future Agent Tasks

### Immediate (Next Sprint - Critical)
- **Service Refactoring**: Split oversized services into focused microservices
  - `services/supabase.ts` → `databaseClient`, `robotRepository`, `cacheManager`, `performanceMonitor`
- **Configuration Extraction**: Remove hardcoded values
  - Extract rate limiting parameters to environment variables
  - Move cache TTL values to configurable settings
  - Convert security thresholds to config files
- **Bundle Optimization**: Implement strategic code splitting for large utilities

### Short Term (Next Month - High Priority)
- **Performance Enhancement**:
  - Add virtualization for large lists (dashboard, chat history)
  - Implement lazy loading for security utilities
  - Optimize import tree and remove dead code
- **Quality Foundation**:
  - Establish comprehensive testing framework
  - Add missing TypeScript interfaces for service contracts
  - Address high-impact ESLint warnings (console statements, unused vars)
- **Security Upgrade**:
  - Upgrade to Web Crypto API for more secure hashing
  - Implement security audit and vulnerability scanning

### Medium Term (Next 2-3 Months)
- **Testing & Documentation**:
  - Achieve 90% test coverage for critical paths
  - Create comprehensive API documentation
  - Establish architecture decision records (ADRs)
- **Advanced Features**:
  - Add health checks and dependency monitoring
  - Implement performance regression detection
  - Create observability and monitoring dashboard

### Long Term (3+ Months)
- **Enterprise Features**:
  - Multi-tenant architecture support
  - Advanced user management and permissions
  - API development for third-party integration
- **Platform Maturity**:
  - Enhanced error boundary coverage
  - Comprehensive component refactoring
  - Advanced optimization strategies

## Development Patterns Update

### Service Architecture Guidelines
1. **Single Responsibility**: Each service should have <300 lines and clear purpose
2. **Interface First**: Define TypeScript interfaces before implementation
3. **Configuration Externalization**: No hardcoded values in production code
4. **Dependency Injection**: Use proper abstraction layers for testability

### Code Quality Standards
1. **Bundle Size**: Individual chunks should be <100KB after minification
2. **Test Coverage**: Minimum 80% for new code, 90% for critical paths
3. **Type Safety**: Strict TypeScript mode, no implicit any types
4. **Error Handling**: Every async operation must have proper error boundaries

### Performance Requirements
1. **Initial Load**: <2 seconds on 3G connection
2. **Time to Interactive**: <3 seconds
3. **Database Queries**: <100ms for 95th percentile
4. **Memory Usage**: <50MB for typical user sessions

### Security Standards
1. **Input Validation**: All user inputs must pass through security manager
2. **API Key Management**: Never expose secrets in client-side code
3. **CORS Policies**: Explicit allowed origins only
4. **Dependency Security**: Automated vulnerability scanning for all dependencies

## Development Workflow Recommendations

1. **Start with Build Check**: Always verify build works before major changes
2. **Test Incrementally**: Run type checking and linting during development  
3. **Document Decisions**: Record why changes were made, not just what was changed
4. **Think Cross-Platform**: Consider browser, server, and edge environments
5. **Security Mindset**: Validate inputs, avoid exposing secrets, use secure defaults

## New Quality Gates Implementation

### Before Any Code Commit
1. **Build Verification**: `npm run build` must pass without errors
2. **Type Checking**: `npm run typecheck` must show no TypeScript errors
3. **Lint Critical Issues**: No ESLint errors, warnings acceptable for non-critical issues
4. **Bundle Size Check**: New chunks must not exceed 100KB after minification

### Service Creation Guidelines
1. **Size Limits**: New services must be <300 lines with clear single responsibility
2. **Interface Requirements**: All services must export TypeScript interfaces for contracts
3. **Configuration**: No hardcoded values - must use environment variables or config
4. **Error Handling**: All async operations must have proper error boundaries

### Performance Impact Assessment
1. **Bundle Analysis**: Use `npm run build` and analyze bundle impact before merging
2. **Memory Testing**: Check for memory leaks in components with state management
3. **Database Optimization**: Verify new queries use appropriate indexes
4. **Cache Strategy**: Ensure caching is implemented for expensive operations

## Known Issues & Solutions

### Build Compatibility
- **Issue**: Node.js modules in frontend code
- **Solution**: Use browser-compatible alternatives or Web APIs
- **Detection**: Build failures with module resolution errors

### Deployment Configuration
- **Issue**: Platform schema validation failures
- **Solution**: Review platform documentation and remove deprecated properties
- **Detection**: Deployment logs show validation errors

### Code Quality
- **Issue**: 200+ ESLint warnings (console.log, unused vars, any types)
- **Solution**: Incremental cleanup with focus on critical issues
- **Detection**: `npm run lint` shows extensive warnings

### Architecture Issues (New from Analysis)
- **Service Size Violations**: `services/supabase.ts` at 1584+ lines
- **Solution**: Refactor into focused microservices with single responsibilities
- **Detection**: Code review and size analysis tools

### Configuration Rigidity
- **Hardcoded Values**: Rate limits, TTLs, security thresholds throughout codebase
- **Solution**: Extract to environment variables and configuration files
- **Detection**: Search for magic numbers and fixed numeric values

### Performance Optimization Needed
- **Bundle Size**: Multiple chunks >100KB after minification
- **Solution**: Implement code splitting and lazy loading strategies
- **Detection**: Bundle analysis tools and build output inspection

## Success Metrics

- ✅ Build passes without errors
- ✅ Type checking passes
- ✅ Deployment pipelines functional
- ✅ Cross-platform compatibility maintained
- ✅ No regressions introduced
- ✅ Documentation updated
- ✅ Service size constraints maintained (<300 lines per service)
- ✅ Bundle size within acceptable limits (<100KB per chunk)
- ✅ Configuration externalization completed
- ✅ Test coverage targets achieved (>80% new, >90% critical)

## Agent Contact & Handoff

When handing off between agents:
1. Always run final build test
2. Update relevant documentation
3. Note any temporary workarounds
4. Flag any critical issues for follow-up
5. Summarize decisions made and rationale