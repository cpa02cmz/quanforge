# Deployment Guide

This guide covers deployment strategies and procedures for QuantForge AI across different platforms and environments.

---

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Platforms](#deployment-platforms)
5. [Build Process](#build-process)
6. [Production Deployment](#production-deployment)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Overview

QuantForge AI supports multiple deployment targets optimized for different use cases:

### 🌐 Production Platforms
- **Vercel**: Recommended for production with edge optimization
- **Cloudflare Pages**: Alternative with global edge network
- **Netlify**: Static site generation with edge functions
- **AWS**: Full infrastructure control

### 🧪 Development Environments
- **Local Development**: Complete development setup
- **Staging**: Production-like testing environment
- **Preview**: Automated previews for pull requests

### 🏗️ Architecture
- **Frontend**: React + TypeScript + Vite
- **Backend**: Next.js API routes with edge runtime
- **Database**: Supabase (PostgreSQL) with optional fallback
- **CDN**: Platform-specific edge caching
- **Monitoring**: Built-in performance and error tracking

---

## Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **npm**: 8.x or higher
- **Git**: Latest stable version
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### Development Tools
```bash
# Verify Node.js version
node --version  # Should be >= 18.0.0

# Verify npm version
npm --version   # Should be >= 8.0.0

# Verify Git
git --version
```

### Platform Accounts
- **GitHub**: For repository management and CI/CD
- **Vercel/Cloudflare/Netlify**: For deployment platform
- **Supabase**: For database and authentication (optional)
- **AI Providers**: API keys for supported AI services

---

## Environment Configuration

### Environment Variables

#### Required Variables
```bash
# Create .env file
cp .env.example .env
```

#### Core Configuration
```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key  # Optional

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### Optional Variables
```bash
# Analytics (Optional)
GOOGLE_ANALYTICS_ID=your_ga_id
VERCEL_ANALYTICS_ID=your_vercel_id

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=false

# Performance
CACHE_MAX_AGE=3600
RATE_LIMIT_WINDOW=60000
```

### Environment-Specific Configs

#### Development (.env.local)
```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:5173
NEXT_PUBLIC_ENABLE_DEBUG=true
```

#### Production (.env.production)
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://quanforge.ai
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

#### Staging (.env.staging)
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://staging.quanforge.ai
NEXT_PUBLIC_ENABLE_DEBUG=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

---

## Deployment Platforms

### 1. Vercel (Recommended)

#### Setup
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project
vercel link
```

#### Configuration
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci --prefer-offline --no-audit",
  "framework": "vite",
  "regions": ["iad1"],
  "functions": {
    "api/**/*.ts": {
      "runtime": "edge"
    }
  }
}
```

#### Deployment
```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel

# Deploy custom branch
vercel --prod -b feature-branch
```

#### Custom Domain
```bash
# Add custom domain
vercel domains add quanforge.ai
vercel domains add www.quanforge.ai
```

#### Environment Variables (Vercel Dashboard)
1. Go to Project Settings → Environment Variables
2. Add all required variables
3. Select appropriate environments (Production, Preview, Development)

### 2. Cloudflare Pages

#### Setup
1. Connect GitHub repository to Cloudflare Pages
2. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node.js version**: `18`

#### Configuration
```toml
# wrangler.toml (optional for edge functions)
name = "quanforge"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[env.production]
vars = { NODE_ENV = "production" }
```

#### Deployment
- **Automatic**: Push to main branch triggers production deployment
- **Manual**: Trigger deploy from Cloudflare dashboard

### 3. Netlify

#### Configuration
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

#### Setup
1. Connect repository to Netlify
2. Configure build settings in netlify.toml
3. Add environment variables in Netlify dashboard
4. Deploy automatically on git push

### 4. AWS (Advanced)

#### Infrastructure as Code (Terraform)
```hcl
# main.tf
resource "aws_s3_bucket" "frontend" {
  bucket = "quanforge-frontend"
  website {
    index_document = "index.html"
    error_document = "index.html"
  }
}

resource "aws_cloudfront_distribution" "cdn" {
  # CloudFront configuration
}

resource "aws_lambda_function" "api" {
  # Lambda functions for API routes
}
```

#### CI/CD Pipeline (GitHub Actions)
```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Deploy
        run: aws s3 sync dist/ s3://quanforge-frontend
```

---

## Build Process

### Local Build
```bash
# Install dependencies
npm ci

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run tests
npm test

# Build for production
npm run build

# Preview build locally
npm run preview
```

### Build Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "test": "vitest"
  }
}
```

### Build Optimization
- **Code Splitting**: Automatic chunking for optimal loading
- **Tree Shaking**: Dead code elimination
- **Compression**: Gzip/Brotli compression
- **Asset Optimization**: Image and font optimization
- **Bundle Analysis**: Built-in bundle analyzer

---

## Production Deployment

### Pre-Deployment Checklist

#### Code Quality
- [ ] All tests passing
- [ ] TypeScript compilation successful
- [ ] ESLint warnings resolved
- [ ] Bundle size within acceptable limits (< 2MB total)

#### Security
- [ ] Environment variables configured
- [ ] API keys rotated if needed
- [ ] Security headers configured
- [ ] HTTPS enforced

#### Performance
- [ ] Bundle analysis completed
- [ ] Caching strategies configured
- [ ] CDN settings optimized
- [ ] Monitoring tools configured

#### Content
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Release notes prepared

### Deployment Process

#### Automated Deployment (Preferred)
```bash
# Push to main branch
git push origin main

# Deployment triggered automatically
# CI/CD runs tests and builds
# Application deployed to production
```

#### Manual Deployment
```bash
# Build locally
npm run build

# Deploy to specific platform
vercel --prod  # Vercel
# or
netlify deploy --prod --dir=dist  # Netlify
```

#### Blue-Green Deployment (Advanced)
```bash
# Deploy to staging environment
vercel --prod -b staging

# Run smoke tests
npm run test:smoke

# Promote to production
vercel --prod -b staging --to-production
```

### Post-Deployment

#### Verification
```bash
# Check application health
curl https://quanforge.ai/api/health

# Verify key functionality
curl https://quanforge.ai/api/robots

# Check performance metrics
curl https://quanforge.ai/api/metrics
```

#### Monitoring
- **Uptime**: External monitoring service (UptimeRobot, Pingdom)
- **Performance**: Core Web Vitals monitoring
- **Errors**: Error tracking and alerting
- **Analytics**: User behavior and performance metrics

---

## Monitoring and Maintenance

### Health Checks

#### Application Health
```bash
# Health endpoint
GET /api/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2025-12-21T10:00:00Z",
  "version": "1.6.0",
  "services": {
    "database": "connected",
    "ai_provider": "operational",
    "cache": "active"
  }
}
```

#### Database Health
```bash
# Database connection test
GET /api/health/database

# Cache status
GET /api/health/cache
```

### Performance Monitoring

#### Core Web Vitals
- **Largest Contentful Paint (LCP)**: < 2.5s
- **First Input Delay (FID)**: < 100ms
- **Cumulative Layout Shift (CLS)**: < 0.1

#### API Performance
- **Response Time**: < 200ms average
- **Error Rate**: < 1%
- **Throughput**: 1000+ requests/minute

### Log Management

#### Application Logs
```typescript
// Error logging
logger.error('Error in robot generation', {
  userId: 'user123',
  error: errorMessage,
  context: { strategyType: 'RSI' }
});

// Performance logs
logger.info('Robot generation completed', {
  duration: 1500,
  tokens: 2500,
  success: true
});
```

#### System Logs
- **Access Logs**: HTTP requests and responses
- **Error Logs**: Application errors and exceptions
- **Performance Logs**: Response times and resource usage
- **Security Logs**: Authentication and security events

### Maintenance Tasks

#### Regular Updates
- **Dependencies**: Weekly security updates
- **Platform**: Monthly platform updates
- **Documentation**: As needed for new features
- **Backups**: Daily automated backups

#### Performance Optimization
- **Bundle Analysis**: Monthly bundle review
- **Cache Updates**: Quarterly cache strategy review
- **Database Optimization**: Monthly performance tuning
- **CDN Configuration**: Quarterly CDN review

---

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check Node.js version
node --version

# Clear dependencies
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run typecheck

# Check linting
npm run lint
```

#### Deployment Failures
```bash
# Check environment variables
vercel env ls

# Check build logs
vercel logs

# Test locally
npm run build && npm run preview
```

#### Runtime Errors
```bash
# Check application logs
vercel logs

# Test health endpoint
curl https://your-domain.com/api/health

# Check configuration
vercel inspect
```

### Performance Issues

#### Slow Loading
- Check bundle size with `npm run build:analyze`
- Verify CDN configuration
- Check caching headers
- Monitor Core Web Vitals

#### API Timeouts
- Check AI provider status
- Verify rate limits
- Monitor database performance
- Check connection timeouts

### Security Issues

#### Environment Variables
- Never commit `.env` files
- Use platform-specific secret management
- Rotate API keys regularly
- Monitor for leaked credentials

#### HTTPS Issues
- Ensure HTTPS enforcement
- Check SSL certificate validity
- Verify security headers
- Monitor for mixed content

### Platform-Specific Issues

#### Vercel
```bash
# Debug deployment
vercel logs

# Check configuration
vercel inspect

# Clear cache
vercel rm --all --yes
```

#### Cloudflare Pages
- Check Pages build logs
- Verify Workers configuration
- Check environment variables
- Monitor edge function performance

#### Netlify
- Check deploy logs in Netlify dashboard
- Verify redirects configuration
- Check functions logs
- Monitor form submissions

---

## Emergency Procedures

### Rollback Process

#### Vercel
```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]

# Promote rollback
vercel promote [deployment-url]
```

#### Emergency Patches
```bash
# Create hotfix branch
git checkout -b hotfix/critical-issue

# Apply fix
# ...make changes...

# Deploy immediately
git commit -m "hotfix: critical security fix"
git push origin hotfix/critical-issue
vercel --prod -b hotfix/critical-issue
```

### Communication
- **Status Page**: Update external status page
- **Team Notification**: Alert development team
- **User Communication**: Notify users if needed
- **Documentation**: Update for post-mortem analysis

---

## Best Practices

### Security
- Use HTTPS everywhere
- Implement rate limiting
- Validate all inputs
- Monitor for vulnerabilities
- Keep dependencies updated
- Use secrets management

### Performance
- Implement aggressive caching
- Optimize bundle size
- Use CDN for static assets
- Monitor continuously
- Test regularly
- Optimize for mobile

### Reliability
- Implement health checks
- Use automatic scaling
- Monitor uptime
- Have rollback procedures
- Test disaster recovery
- Document everything

### Development
- Use feature branches
- Implement CI/CD
- Automate testing
- Review code changes
- Document changes
- Monitor build health

---

For additional support, check the [USER_GUIDE.md](./USER_GUIDE.md) or open an issue on GitHub.

---

**Last Updated**: December 21, 2025  
**Version**: v1.6.0  
**Maintainers**: QuantForge AI Team