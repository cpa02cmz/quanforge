# Agent Workflow and Guidelines

This document provides guidance for future agents working on the QuantForge AI codebase.

## Development Process

### Branch Strategy
- **main**: Production-ready code, always stable and deployable
- **develop**: Integration branch for feature work (when exists)
- **feature/***: Feature-specific branches
- **fix/***: Bug fix branches

### PR Management
- All changes must go through pull requests
- Automated checks (build, lint, type-check) must pass
- Review required for all non-trivial changes
- Update relevant documentation (blueprint.md, roadmap.md, task.md) before merging

### Quality Gates
- [x] Build must pass (`npm run build`)
- [x] Linting must pass (if configured)
- [x] Type checking must pass (if configured)
- [x] No regression in functionality
- [x] Documentation updated

## Known Issues and Solutions

### Vercel Deployment Schema Validation
**Issue**: Vercel's schema validation is strict and will reject invalid properties
**Fixed Issues**:
- Removed `regions` property from function configurations (not supported)
- Removed `experimental` section causing validation failures

**Best Practices**:
- Always test build locally (`npm run build`) after vercel.json changes
- Validate vercel.json schema using Vercel documentation
- Use project-level regional settings instead of function-specific

### Critical Configuration Files
- `vercel.json`: Deployment configuration - validate schema carefully
- `package.json`: Dependencies and build scripts
- `vite.config.ts`: Build configuration
- `tsconfig.json`: TypeScript configuration

## Code Standards

### File Naming
- Components: PascalCase (e.g., `ChatInterface.tsx`)
- Services: camelCase (e.g., `geminiService.ts`)
- Utils: camelCase with descriptive names (e.g., `errorHandler.ts`)
- Constants: UPPER_SNAKE_CASE in dedicated files

### Import Organization
1. React imports first
2. Third-party libraries
3. Internal services
4. Components
5. Utils and types

### Error Handling
- Use standardized error handler utility
- Wrap async calls in try-catch blocks
- Provide meaningful error messages
- Log errors appropriately without exposing sensitive data

## Testing and Validation

### Before PR Submission
1. Run build command: `npm run build`
2. Test core functionality manually
3. Check for console errors
4. Verify responsive design
5. Test with different user scenarios

### Performance Considerations
- Monitor bundle sizes (>100KB chunks need review)
- Use React.memo for expensive components
- Implement proper caching strategies
- Optimize images and assets

## Documentation Updates

### When to Update
- After any architectural changes
- When adding new features
- After fixing significant bugs
- When deployment process changes

### Files to Update
- `blueprint.md`: System architecture and design decisions
- `roadmap.md`: Feature progress and planning
- `task.md`: Development activity tracking
- `bug.md`: Bug fixes and issues
- `AGENTS.md`: This file - agent workflow updates

#### Common Schema Violations (To Avoid):
```json
// ❌ INVALID - Not supported in Vercel schema
{
  "regions": ["hkg1", "iad1"],
  "experimental": { ... },
  "functions": {
    "api/**/*.ts": {
      "cache": "max-age=600",
      "environment": { ... }
    }
  }
}

// ✅ VALID - Schema compliant
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "edge",
      "maxDuration": 15,
      "memory": 512
    }
  }
}
```

## Security Guidelines

### Never Commit
- API keys or secrets
- Environment variables with sensitive data
- Personal credentials

### Always Validate
- User inputs and sanitization
- API responses
- File uploads and sizes
- Cross-site scripting (XSS) prevention

## Common Workflows

### Adding New Feature
1. Create feature branch from main
2. Implement feature following code standards
3. Add/update tests
4. Update documentation
5. Submit PR with detailed description
6. Address review feedback
7. Merge after approval

### Fixing Bug
1. Identify root cause
2. Create fix branch
3. Implement minimal fix
4. Test thoroughly
5. Update bug.md
6. Submit PR with bug reference
7. Merge after validation

### Performance Optimization
1. Identify bottlenecks
2. Implement targeted optimizations
3. Measure impact
4. Document changes
5. Test for regressions
6. Deploy incrementally

## Emergency Procedures

### Build Failures
1. Check error logs immediately
2. Identify if configuration vs code issue
3. Revert breaking changes if necessary
4. Test fix before redeploying
5. Document root cause and solution

### Deployment Issues
1. Check Vercel/Cloudflare dashboard for errors
2. Validate configuration files
3. Review recent changes for breaking modifications
4. Roll back if needed
5. Fix underlying issue before redeploying