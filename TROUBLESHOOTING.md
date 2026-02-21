# Troubleshooting Guide

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with QuantForge AI.

---

## Table of Contents
1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Build and Development Issues](#build-and-development-issues)
4. [Runtime Issues](#runtime-issues)
5. [AI Service Issues](#ai-service-issues)
6. [Database Issues](#database-issues)
7. [Performance Issues](#performance-issues)
8. [Browser Compatibility](#browser-compatibility)
9. [Deployment Issues](#deployment-issues)
10. [Getting Help](#getting-help)

---

## Quick Diagnostics

### Health Check Commands
```bash
# Manual health checks
npm run typecheck  # TypeScript compilation
npm run lint       # Code quality
npm run test       # Test suite
npm run build      # Production build
```

### Common Diagnostic Commands
```bash
# Check Node.js and npm versions
node --version && npm --version

# Verify environment variables
printenv | grep -E "(SUPABASE|API_KEY|NODE_ENV)"

# Check network connectivity
curl -I https://api.openai.com/v1/models
curl -I https://generativelanguage.googleapis.com

# Test build process
npm run build && echo "Build successful"
```

### Browser Console Diagnostics
```javascript
// Check for JavaScript errors
console.log('JavaScript working');

// Check API connectivity
fetch('/api/health')
  .then(r => r.json())
  .then(console.log);

// Check browser compatibility
console.log('User Agent:', navigator.userAgent);
console.log('Cookies Enabled:', navigator.cookieEnabled);
```

---

## Installation Issues

### Dependencies Not Installing

#### Problem
```bash
npm install fails with errors
```

#### Solutions
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall with npm ci
npm ci

# If still failing, try with different registry
npm config set registry https://registry.npmjs.org/
npm install
```

#### Node.js Version Issues
```bash
# Check current version
node --version

# Install correct version using nvm
nvm install 18
nvm use 18

# Verify
node --version  # Should show v18.x.x
```

### Permission Issues

#### Linux/macOS
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

#### Windows
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Reinstall Node.js using official installer
```

---

## Build and Development Issues

### TypeScript Compilation Errors

#### Common Issues
```bash
# Error: Property 'X' does not exist on type 'Y'
# Solution: Check interface definitions
```

#### Solutions
```bash
# Check for type errors
npm run typecheck

# Fix specific error patterns
# 1. Missing imports
import { MissingInterface } from './types';

# 2. Incorrect types
const variable: CorrectType = initialValue;

# 3. Optional chaining
const value = object?.property?.nestedProperty;
```

### Build Optimization Issues

#### Bundle Size Too Large
```bash
# Analyze bundle
npm run build:analyze

# Check largest chunks
# In vite.config.ts:
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ai': ['@ai-sdk/openai', '@google/generative-ai']
        }
      }
    }
  }
}
```

#### Memory Issues During Build
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Or add to package.json
"scripts": {
  "build": "node --max-old-space-size=4096 ./node_modules/.bin/vite build"
}
```

### Development Server Issues

#### Port Already in Use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

#### Hot Reload Not Working
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Restart development server
npm run dev
```

---

## Runtime Issues

### Application Not Loading

#### Blank White Screen
```javascript
// Check browser console for errors
// Common causes:

// 1. JavaScript errors
// Fix: Check console.log and syntax errors

// 2. Missing environment variables
// Check: window.location.env or process.env

// 3. CORS issues
// Check: Network tab for failed requests
```

#### Component Not Rendering
```typescript
// Check React development tools
// Ensure correct import:
import ComponentName from './ComponentName';

// Check for missing props
interface Props {
  requiredProp: string;
}

// Check for TypeScript errors
npm run typecheck
```

### State Management Issues

#### State Not Updating
```typescript
// Check React hooks usage
const [state, setState] = useState(initialValue);

// Proper state update
setState(prevState => ({ ...prevState, newValue }));

// Check for stale closures
useEffect(() => {
  // Use latest state
}, [dependency]);
```

### API Connection Issues

#### Network Errors
```typescript
// Check API endpoint availability
try {
  const response = await fetch('/api/robots');
  if (!response.ok) throw new Error('API unavailable');
} catch (error) {
  console.error('Network error:', error);
}
```

#### Authentication Issues
```typescript
// Check authentication flow
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  // Handle unauthenticated state
}
```

---

## AI Service Issues

### API Key Problems

#### Invalid API Key
```bash
# Test API key directly (Google Gemini)
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=$VITE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"]}]}]'

# Check environment variable
echo $VITE_API_KEY
```

#### Solution
```typescript
// Validate API key format
const isValidApiKey = (key: string) => {
  return key.startsWith('sk-') && key.length > 20;
};

// Secure key storage
const apiKey = import.meta.env.VITE_API_KEY;
if (!apiKey) {
  throw new Error('API key not configured');
}
```

### Rate Limiting

#### Hit API Rate Limits
```typescript
// Implement exponential backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async (fn: Function, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(2 ** i * 1000);
    }
  }
};
```

#### Solution
```typescript
// Add rate limiting middleware
const rateLimiter = new Map<string, number[]>();

const checkRateLimit = (key: string, limit: number, window: number) => {
  const now = Date.now();
  const requests = rateLimiter.get(key) || [];
  const recent = requests.filter(time => now - time < window);
  
  if (recent.length >= limit) {
    throw new Error('Rate limit exceeded');
  }
  
  rateLimiter.set(key, [...recent, now]);
};
```

### AI Provider Downtime

#### Check Service Status
```bash
# OpenAI status
curl https://status.openai.com/api/v2/status.json

# Google Cloud status
curl https://status.cloud.google.com/api/v2/status.json
```

#### Implement Fallback
```typescript
// Fallback to different provider
const generateWithFallback = async (prompt: string) => {
  try {
    return await generateWithOpenAI(prompt);
  } catch (error) {
    console.log('OpenAI failed, trying Gemini');
    return await generateWithGemini(prompt);
  }
};
```

---

## Database Issues

### Connection Problems

#### Supabase Connection Failed
```typescript
// Check configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase configuration missing');
}

// Test connection
const { data, error } = await supabase.from('robots').select('count');
if (error) {
  console.error('Database connection error:', error);
}
```

#### Solution
```bash
# Check environment variables
 echo SUPABASE_URL: $VITE_SUPABASE_URL
 echo SUPABASE_KEY: $VITE_SUPABASE_ANON_KEY

# Test connection manually
curl -H "apikey: YOUR_KEY" \
     -H "Authorization: Bearer YOUR_KEY" \
     YOUR_SUPABASE_URL/rest/v1/
```

### Data Validation Issues

#### Invalid Data Types
```typescript
// Use Zod for validation
import { z } from 'zod';

const RobotSchema = z.object({
  name: z.string().min(1),
  strategy: z.string().min(10),
  risk: z.number().min(0).max(100),
});

const validatedData = RobotSchema.parse(inputData);
```

#### Solution
```typescript
// Add validation middleware
const validateRobotData = (data: unknown) => {
  try {
    return RobotSchema.parse(data);
  } catch (error) {
    throw new Error(`Invalid robot data: ${error.message}`);
  }
};
```

### Performance Issues

#### Slow Queries
```sql
-- Add database indexes
CREATE INDEX idx_robots_user_id ON robots(user_id);
CREATE INDEX idx_robots_created_at ON robots(created_at);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM robots WHERE user_id = 'user123';
```

#### Solution
```typescript
// Implement query optimization
const getOptimizedRobots = async (userId: string) => {
  return await supabase
    .from('robots')
    .select('id, name, created_at, strategy')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
};
```

---

## Performance Issues

### Slow Loading

#### Bundle Analysis
```bash
# Analyze bundle size
npm run build:analyze

# Check for large dependencies
ls -la node_modules/ | grep -E "^[d].*[0-9]+$"
```

#### Optimization
```typescript
// Implement lazy loading
const LazyComponent = React.lazy(() => import('./LazyComponent'));

// Use dynamic imports
const loadHeavyLibrary = () => import('./heavyLibrary');

// Optimize re-renders
const MemoizedComponent = React.memo(({ data }) => {
  return <div>{data}</div>;
});
```

### Memory Leaks

#### Common Causes
```typescript
// 1. Unmounted components
useEffect(() => {
  const subscription = subscribeToData();
  
  return () => {
    subscription.unsubscribe(); // Cleanup
  };
}, []);

// 2. Event listeners
useEffect(() => {
  const handleResize = () => console.log('resized');
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

#### Detection
```javascript
// Monitor memory usage
setInterval(() => {
  if (performance.memory) {
    console.log('Memory:', {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB',
      total: Math.round(performance.memory.totalJSHeapSize / 1048576) + 'MB'
    });
  }
}, 5000);
```

### Network Performance

#### Slow API Calls
```typescript
// Implement request cancellation
const controller = new AbortController();

const fetchWithTimeout = async (url: string, timeout = 5000) => {
  const response = await fetch(url, {
    signal: controller.signal,
  });
  
  controller.abort(); // Cleanup
  return response;
};
```

#### Caching Strategy
```typescript
// Implement response caching
const cache = new Map<string, any>();

const cachedFetch = async (url: string) => {
  if (cache.has(url)) {
    return cache.get(url);
  }
  
  const response = await fetch(url);
  const data = await response.json();
  cache.set(url, data);
  
  return data;
};
```

---

## Browser Compatibility

### Chrome Issues

#### Chrome Specific Problems
```javascript
// Check Chrome version
console.log('Chrome version:', navigator.userAgent.match(/Chrome\/(\d+)/));

// Enable Chrome DevTools experiments
chrome://flags/#enable-experimental-web-platform-features
```

### Firefox Issues

#### Firefox Specific Problems
```javascript
// Firefox specific debugging
console.log('Firefox version:', navigator.userAgent.match(/Firefox\/(\d+)/));

// Check for Firefox specific APIs
if ('mozFullScreen' in document) {
  // Firefox specific code
}
```

### Safari Issues

#### Safari Specific Problems
```javascript
// Safari bug workarounds
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

if (isSafari) {
  // Safari specific fixes
}
```

#### Mobile Safari
```css
/* Mobile Safari viewport fix */
meta[name="viewport"] {
  content: "width=device-width, initial-scale=1.0, maximum-scale=1.0";
}

/* Safari input zoom fix */
input[type="text"], input[type="email"], textarea {
  font-size: 16px !important;
}
```

---

## Deployment Issues

### Vercel Deployment

#### Build Failures
```bash
# Check Vercel logs
vercel logs

# Local build test
vercel build

# Clear build cache
vercel rm --all --yes
```

#### Environment Variable Issues
```bash
# Check Vercel environment
vercel env ls

# Pull environment to local
vercel env pull .env.production.local
```

### Netlify Deployment

#### Build Failures
```bash
# Check Netlify build logs
# In Netlify dashboard: Site builds → Failed builds

# Local build test
npm run build

# Check netlify.toml configuration
cat netlify.toml
```

### Cloudflare Pages

#### Edge Function Issues
```typescript
// Check Edge Runtime compatibility
export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1']
};

// Avoid Node.js APIs in edge functions
// ❌ Not allowed: fs, path, crypto (use Web Crypto API)
// ✅ Allowed: fetch, Response, Request, URL
```

---

## Getting Help

### Self-Service Resources

#### Documentation
- [USER_GUIDE.md](./USER_GUIDE.md) - Complete user documentation
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guide
- [blueprint.md](./docs/blueprint.md) - Technical architecture

#### Code Repository
- **Issues**: [GitHub Issues](https://github.com/cpa02cmz/quanforge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/cpa02cmz/quanforge/discussions)
- **Documentation**: [Documentation Index](./DOCUMENTATION_INDEX.md)

### Community Support

#### Getting Help
1. **Search First**: Check existing issues and documentation
2. **Provide Details**: Include error logs, environment info, and reproduction steps
3. **Use Templates**: Follow issue templates for faster resolution

#### Bug Reports
```markdown
## Bug Description
Brief description of the issue

## Steps to Reproduce
1. Go to...
2. Click on...
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g. macOS 12.0]
- Browser: [e.g. Chrome 96.0]
- Node.js: [e.g. 18.0.0]
- Version: [e.g. 1.6.0]

## Additional Context
Logs, screenshots, or other helpful information
```

### Debug Information Collection

#### System Information
```bash
# Collect system information
echo "=== System Information ==="
echo "OS: $(uname -s)"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Git: $(git --version)"
echo "Browser: $(echo $HTTP_USER_AGENT)"

echo "=== Environment Variables ==="
printenv | grep -E "(NODE_ENV|SUPABASE|API_KEY)" | sed 's/=.*/=***/'

echo "=== Network Test ==="
curl -s -o /dev/null -w "%{http_code}" https://api.openai.com/v1/models
echo " - OpenAI Status"

curl -s -o /dev/null -w "%{http_code}" https://generativelanguage.googleapis.com
echo " - Google API Status"
```

#### Application Logs
```bash
# Collect application logs
npm run dev > dev.log 2>&1 &
DEV_PID=$!

# Wait for startup
sleep 5

# Test application
curl -s http://localhost:5173/api/health

# Stop and collect logs
kill $DEV_PID
cat dev.log
```

### Professional Support

#### Priority Issues
- **Security Vulnerabilities**: security@quanforge.ai
- **Production Outages**: support@quanforge.ai
- **Enterprise Inquiries**: enterprise@quanforge.ai

#### Response Times
- **Critical**: 1-2 hours
- **High**: 4-8 hours
- **Normal**: 24-48 hours
- **Low**: 3-5 days

---

## Emergency Procedures

### Complete Application Failure

#### Immediate Actions
1. **Check Status**: [status.quanforge.ai](https://status.quanforge.ai)
2. **Rollback**: Deploy previous working version
3. **Communicate**: Notify users of outage
4. **Investigate**: Review recent changes and logs

#### Recovery Steps
```bash
# Emergency rollback
git log --oneline -10  # Find last working commit
git checkout <working-commit>
git push origin main --force
vercel --prod
```

### Data Recovery

#### Database Recovery
```bash
# Check Supabase backups
# In Supabase dashboard: Settings → Database → Backups

# Manual backup if needed
pg_dump -h ... -U ... quanforge > backup.sql
```

#### Configuration Recovery
```bash
# Export current configuration
vercel env pull .env.backup

# Review and restore as needed
```

---

This troubleshooting guide covers the most common issues. For additional help, don't hesitate to reach out through the channels listed above.

---

**Last Updated**: February 21, 2026  
**Version**: v1.9.0
**Maintainers**: QuantForge AI Team