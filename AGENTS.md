# Development Agent Guidelines

## Agent Insights & Decisions

### Vercel Schema Compatibility (2025-12-18)
**Issue**: `vercel.json` contained unsupported properties causing deployment failures  
**Root Cause**: Schema validation failures with `experimental`, `regions`, `cache`, and `environment` properties  
**Solution Applied**: Removed all unsupported Vercel schema properties while maintaining functionality  
**Key Insight**: Always validate deployment configuration schemas before merging PRs

### Recommended Development Patterns

#### Deployment Configuration Checklist
- [ ] Verify `vercel.json` schema compliance
- [ ] Avoid deprecated Vercel configuration properties
- [ ] Use supported Vercel build configurations
- [ ] Test deployment builds after configuration changes

#### Error Handling Strategy
- **Current**: Critical deployment issues must be resolved immediately
- **Priority**: Critical > High > Medium > Low
- **Critical Impact**: Build failures, deployment errors, schema violations
- **Approach**: Fix deployment blockers first, optimize later

#### Deployment Review Process
1. **Schema Validation**: Always validate deployment configuration files
2. **Build Testing**: Run full build process after configuration changes
3. **Documentation**: Record deployment constraint fixes
4. **Cross-Platform**: Consider browser, server, and edge environment requirements

## Agent Guidelines for Future Work

### When Addressing Deployment Issues
1. **Schema Check**: Always verify configuration schemas with deployment providers
2. **Build Impact**: Run `npm run build` to ensure configuration changes work
3. **Provider Constraints**: Understand deployment platform limitations and requirements
4. **Document**: Record constraints and workarounds for future reference

### When Reviewing PRs with Build Failures
1. **Prioritize Build Issues**: Address red flags preventing merges first
2. **Check Comments**: Review deployment error logs and CI/CD failures
3. **Minimal Changes**: Fix only what's needed to restore build/deployment capability
4. **Maintain Functionality**: Don't remove critical features when fixing compliance

### When Optimizing Infrastructure
1. **Provider Guidelines**: Follow current Vercel configuration best practices
2. **Fallback Options**: Have alternative configurations ready
3. **Document Constraints**: Maintain knowledge base of platform limitations
4. **Security First**: Never sacrifice security for convenience in deployment config

## Future Agent Tasks

### Immediate (Next Sprint)
- Address deployment configuration standardization
- Implement configuration validation automation
- Document platform-specific deployment requirements

### Short Term (Next Month)
- Review and cleanup 200+ ESLint warnings
- Implement bundle splitting for performance
- Add automated schema validation to CI/CD pipeline

### Long Term
- Enhanced deployment strategy with multiple providers
- Infrastructure as code implementation
- Advanced testing strategy for deployment configurations

## Development Workflow Recommendations

1. **Configuration Validation**: Always verify deployment configuration schemas before merging
2. **Build Testing**: Run full build and type checking during development  
3. **Document Workarounds**: Record why deployment changes were made, not just what was changed
4. **Platform Compliance**: Consider all deployment target environments (Vercel, Cloudflare Workers, etc.)
5. **Security Mindset**: Validate deployment configurations don't expose secrets or create vulnerabilities