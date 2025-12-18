# QuantForge AI - Agent Documentation

This document provides insights and decisions for future AI agents working on the QuantForge codebase.

## Architecture Insights

### Current State
- **Framework**: React 18 + TypeScript + Vite
- **Backend**: Supabase with edge functions on Vercel
- **AI Integration**: Gemini API via service workers
- **State Management**: Minimal global state, page-level state management
- **Database**: PostgreSQL with advanced optimization patterns

### Key Design Patterns
1. **Adapter Pattern**: Supabase service with localStorage fallback
2. **Observer Pattern**: Market data simulation
3. **Worker Pattern**: AI processing offloaded to Web Workers
4. **Cache Layers**: Multi-tier caching (memory, persistent, edge)

## Common Issues & Solutions

### Build & Deployment
- **Vercel Configuration**: Avoid `experimental` property in vercel.json - causes schema validation errors
- **TypeScript**: Strict mode enabled - watch for implicit any types
- **Bundle Size**: Monitor chunks >100KB, use dynamic imports for code splitting

### Performance Optimizations
- **React.memo**: Applied to Layout, Generator, Dashboard components
- **Query Optimization**: Use database-level queries with proper indexing
- **Request Deduplication**: Prevent duplicate API calls
- **Edge Functions**: Regional distribution for low latency

### Code Quality
- **Error Handling**: Unified error handler utility across services
- **Input Validation**: Comprehensive validation service with XSS protection
- **Security**: Environment variables not exposed in client bundle

## Agent Decision Guidelines

### When Adding Features
1. **Check existing patterns** before creating new utilities
2. **Use established abstractions** (Supabase client, error handler)
3. **Consider performance impact** - measure before/after
4. **Update documentation** for any architectural changes

### When Optimizing
1. **Profile first** - don't optimize prematurely
2. **Use React.memo** for expensive renders
3. **Implement proper caching** strategies
4. **Monitor bundle size** impact

### When Debugging
1. **Check TypeScript strict** mode violations
2. **Review ESLint warnings** - address root causes
3. **Test edge function deployments** locally when possible
4. **Validate Vercel configuration** schema

## Future Considerations

### Scalability
- Consider implementing proper version control for robot strategies
- Evaluate multi-file project support (.mqh includes)
- Plan for direct MT5 integration requirements

### Security
- Continue environment variable protection practices
- Maintain input sanitization for all user inputs
- Regular security audits of edge functions

### Performance
- Monitor Core Web Vitals metrics
- Evaluate need for more aggressive caching
- Consider service worker for offline capabilities

## Agent Success Criteria

### Code Quality
- [ ] TypeScript compilation passes with strict mode
- [ ] ESLint warnings addressed or documented
- [ ] Tests pass (when implemented)
- [ ] Build succeeds without warnings

### Performance
- [ ] Bundle size impact measured and acceptable
- [ ] React rendering optimization verified
- [ ] Database queries optimized
- [ ] Edge function cold start times acceptable

### Documentation
- [ ] Code comments added for complex logic
- [ ] README/bp/roadmap updated as needed
- [ ] AGENTS.md updated with new insights
- [ ] Breaking changes documented

## Known Limitations

1. **Test Coverage**: Limited automated tests - agents should add tests when possible
2. **Error Boundaries**: Some components lack comprehensive error handling
3. **Performance Monitoring**: Basic metrics implemented, could be enhanced
4. **Documentation**: Some advanced features need better user documentation

## Agent Communication

When switching between agents or sessions:
1. **Update AGENTS.md** with current status and decisions made
2. **Document any breaking changes** or architectural decisions
3. **Leave notes** about incomplete work or known issues
4. **Reference relevant PRs** or commits for context

## Tool Recommendations

For future agents working on this codebase:
- **Use Task tool** for complex multi-step operations
- **Leverage Glob/Grep** for code exploration before writing
- **Read multiple files** in parallel for context understanding
- **Use Bash** for testing builds and validation