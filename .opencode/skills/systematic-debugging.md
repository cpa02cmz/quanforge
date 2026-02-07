# Systematic Debugging Skill for QuanForge

## Trigger
Activates when investigating bugs, build failures, or unexpected behavior.

## Purpose
Follow a structured 4-phase root cause analysis process.

## 4-Phase Debugging Process

### Phase 1: Information Gathering
- [ ] Reproduce the issue consistently
- [ ] Identify affected components/files
- [ ] Check recent changes (git log)
- [ ] Review error messages and stack traces
- [ ] Examine environment (dev/prod/test)

### Phase 2: Hypothesis Formation
- [ ] List possible causes (don't filter yet)
- [ ] Rank by likelihood
- [ ] Identify quickest to verify

### Phase 3: Testing Hypotheses
- [ ] Test most likely cause first
- [ ] Isolate variables
- [ ] Use logging/debugging tools
- [ ] Document each test result

### Phase 4: Resolution & Prevention
- [ ] Implement fix
- [ ] Verify fix resolves issue
- [ ] Write regression test
- [ ] Document root cause
- [ ] Update AGENTS.md with insights

## Debugging Techniques for QuanForge

### Build Failures
```bash
# Check TypeScript errors
npm run typecheck

# Check build output
npm run build 2>&1 | tee build.log

# Verify dependencies
npm audit
npm outdated
```

### Runtime Errors
```typescript
// Use structured logging
import { logger } from './utils/logger';
logger.error('Context:', { userId, action, data });

// Check browser console for frontend
// Check network tab for API calls
```

### Performance Issues
- Use performanceMonitor utility
- Check bundle size with build:analyze
- Profile React components

### Security Issues
- Run npm audit
- Check for secrets in code
- Verify input validation

## Defense in Depth
Always verify at multiple levels:
1. **Unit tests**: Function level
2. **Integration tests**: Component interactions
3. **E2E tests**: Full user flows
4. **Manual verification**: Real-world usage

## Root Cause Analysis Template
```markdown
### Bug Report: [Title]
**Symptom**: [What went wrong]
**Root Cause**: [Underlying issue]
**Fix**: [What was changed]
**Prevention**: [How to avoid in future]
**Files Modified**: [List of files]
```

## References
- Based on obra/superpowers systematic-debugging skill
- Adapted for QuanForge's tech stack
