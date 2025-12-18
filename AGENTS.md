# Development Agents Guide

This document contains insights, decisions, and patterns discovered during development to guide future development and agent interactions.

## Critical Infrastructure Decisions

### Browser Compatibility
- **Issue**: Node.js crypto module not available in browser environments
- **Solution**: Implement browser-compatible hash algorithms using simple, effective methods (djb2-based)
- **Lesson**: Always verify cross-platform compatibility for utility functions

### Vercel Configuration Best Practices
- **Issue**: Schema validation failures with unsupported properties
- **Solution**: Use modern `functions` configuration instead of legacy `builds`
- **Lesson**: Keep deployment configurations minimal and schema-compliant
- **Avoid**: `experimental`, `environment` in functions, `regions` properties with `functions`

### Deployment Architecture
- **Functions vs Builds**: Cannot be used together - choose modern `functions` approach
- **Edge Runtime**: Optimal for API routes with better performance and cost efficiency
- **Schema Compliance**: Always validate configuration against platform schemas

## Development Patterns

### Rate Limiting Implementation
```typescript
// Browser-compatible hashing
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash).toString(16).padStart(32, '0').substring(0, 32);
}
```

### Error Resolution Workflow
1. **Identify Root Cause**: Check build logs for specific error patterns
2. **Local Verification**: Always reproduce and fix issues locally
3. **Schema Compliance**: Validate all configuration files against platform schemas
4. **Cross-Platform Testing**: Verify fixes work across all target environments
5. **Documentation**: Update relevant docs with solution patterns

### Performance Monitoring
- **Build Analysis**: Monitor bundle sizes and chunk optimization
- **Deployment Verification**: Test across multiple deployment targets (Vercel, Cloudflare)
- **Cross-Environment Testing**: Browser, Node.js, and edge runtime compatibility

## Deployment Platform Guidelines

### Vercel Best Practices
- Use `functions` configuration for modern edge deployment
- Implement comprehensive security headers via CSP
- Optimize caching strategies for API and static assets
- Ensure schema compliance to prevent deployment failures

### Cloudflare Workers
- Focus on edge-optimized code patterns
- Minimize dependencies to reduce bundle size
- Test worker builds separately from application builds

## Future Considerations

### Scalability Architecture
- **Service Workers**: For client-side caching and offline support
- **Edge Functions**: For API routes and regional optimization
- **CDN Integration**: For static asset optimization

### Security Enhancements
- **Content Security Policy**: Already implemented with comprehensive headers
- **Rate Limiting**: Enhanced limiter ready for production deployment
- **Input Validation**: Extensive validation utilities for all user inputs

### Development Workflow
- **Incremental Testing**: Test changes across all deployment platforms
- **Documentation Updates**: Keep technical docs synchronized with code changes
- **Agent Guidelines**: Document patterns for future development iterations

## Agent Interaction Patterns

### Problem Resolution Approach
1. **Assessment**: Evaluate issue impact across all environments
2. **Isolation**: Create minimal reproduction for testing
3. **Solution Design**: Prioritize cross-platform compatibility
4. **Verification**: Test solution in target environments
5. **Documentation**: Record solutions for future reference

### Code Quality Standards
- **Type Safety**: Maintain comprehensive TypeScript coverage
- **Error Handling**: Implement graceful degradation patterns
- **Performance**: Monitor bundle sizes and optimize chunking
- **Security**: Follow OWASP guidelines and implement defense in depth

This guide should be referenced when addressing infrastructure issues, deploying changes, or implementing new features to maintain consistency with established patterns and avoid previously solved problems.