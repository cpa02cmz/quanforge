# AGENTS.md - Development Team Guidelines

## Development Team Roles and Responsibilities

### Core Development Agents

#### Frontend Architect
- **Responsibility**: React component architecture, performance optimization, UX patterns
- **Focus**: Component modularity, lazy loading, state management optimization
- **Key Metrics**: Bundle size reduction, component render performance, UX scores

#### Backend Engineer
- **Responsibility**: Service layer, database optimization, API design
- **Focus**: Supabase optimization, caching strategies, query performance
- **Key Metrics**: Response times, database efficiency, API reliability

#### Security Engineer
- **Responsibility**: Application security, threat detection, compliance
- **Focus**: WAF implementation, input validation, rate limiting
- **Key Metrics**: Vulnerability count, threat detection rate, security score

#### Performance Engineer
- **Responsibility**: Application performance, monitoring, optimization
- **Focus**: Edge optimization, caching, memory management
- **Key Metrics**: Load times, memory usage, cache hit rates

#### DevOps Engineer
- **Responsibility**: Deployment, infrastructure, monitoring
- **Focus**: Vercel Edge optimization, CI/CD pipelines, alerting
- **Key Metrics**: Deployment success rate, uptime, performance metrics

## Codebase Analysis Team Insights

### Security Team Findings
- **WAF Implementation**: Successfully deployed enterprise-grade threat detection
- **Input Validation**: Comprehensive XSS/SQL injection prevention in place
- **Rate Limiting**: Adaptive throttling with user-tier controls implemented
- **Next Steps**: CSP policy enhancement, advanced bot detection

### Performance Team Findings
- **Bundle Optimization**: Achieved 60% initial load reduction through code splitting
- **Caching Strategy**: Multi-layer caching with intelligent TTL management
- **Web Workers**: Successfully offloaded AI processing from main thread
- **Next Steps**: Memory leak fixes, cache cleanup optimization

### Architecture Team Findings
- **Modularity**: Well-structured service layer with clear separation
- **Scalability**: Edge optimization ready, database scaling needed
- **Maintainability**: Good TypeScript coverage, inconsistent patterns present
- **Next Steps**: Service consolidation, configuration centralization

## Development Guidelines

### Code Quality Standards
1. **TypeScript**: Strict mode with comprehensive type definitions
2. **Testing**: Minimum 80% coverage for critical paths
3. **Documentation**: JSDoc comments for all public APIs
4. **Performance**: Bundle analysis before major releases
5. **Security**: Security review for all new features

## Development Priorities

### Immediate Focus (Next 2 Weeks)
1. **Memory Management**: Cache cleanup and monitoring implementation
2. **Error Boundaries**: Complete error boundary coverage
3. **Configuration**: Centralize all hardcoded values
4. **Service Consolidation**: Merge overlapping services
5. **Testing**: Increase coverage for edge cases

### Short-term Goals (Next Month)
1. **Feature Flags**: Implement comprehensive flag system
2. **Performance Monitoring**: Advanced metrics collection
3. **Security Hardening**: CSP policy enhancement
4. **Documentation**: Complete API documentation
5. **Automation**: Deploy automated testing pipelines

## Success Metrics

### Technical Metrics
- **Performance**: Load time < 2s, memory < 100MB, uptime > 99.9%
- **Security**: Zero critical vulnerabilities, threat detection < 5s
- **Quality**: Bug rate < 1 per 1000 lines, test coverage > 80%
- **Maintainability**: Code review turnaround < 24h, documentation score > 90%

### Business Metrics
- **User Satisfaction**: UX score > 4.5/5, support tickets < 5%
- **Adoption**: Feature adoption rate > 70%, user retention > 90%
- **Innovation**: New feature delivery < 2 weeks, tech debt ratio < 20%

## Continuous Improvement

### Feedback Loops
- **User Feedback**: Regular user satisfaction surveys
- **Team Feedback**: Retrospectives and process improvement
- **Performance Feedback**: A/B testing and feature metrics
- **Code Feedback**: Static analysis and quality metrics

This document provides comprehensive guidelines for the development team based on the comprehensive codebase analysis completed on 2024-12-18.