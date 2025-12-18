# AGENTS.md

## Autonomous AI Agents Documentation

### Overview
This document outlines the autonomous AI agents used within QuantForge AI for various optimization and operational tasks.

### Active Agents

#### 1. Code Analysis Agent
- **Type**: `explore`
- **Purpose**: Deep codebase exploration and architectural analysis
- **Capabilities**: 
  - Pattern recognition
  - Security vulnerability detection
  - Performance bottleneck identification
  - Code quality assessment
- **Usage**: Comprehensive codebase evaluations and refactoring recommendations

#### 2. SEO Optimization Agent  
- **Type**: `general`
- **Purpose**: Search engine optimization and content enhancement
- **Capabilities**:
  - Meta tag optimization
  - Content structure analysis
  - Sitemap generation
  - Performance optimization for search crawlers
- **Usage**: SEO improvements and content strategy

#### 3. Performance Monitoring Agent
- **Type**: `general` 
- **Purpose**: Real-time performance monitoring and optimization
- **Capabilities**:
  - Web Vitals tracking
  - Bundle size analysis
  - Memory usage monitoring
  - Optimization recommendations
- **Usage**: Performance optimization and monitoring

### Agent Configuration

#### Security Considerations
- All agents operate with sandboxed permissions
- No external network access unless explicitly required
- Code changes require human approval
- Sensitive data is automatically redacted

#### Integration Points
- **CI/CD Pipeline**: Automated testing and quality gates
- **Development Workflow**: Real-time code analysis and suggestions
- **Monitoring Dashboard**: Performance and security alerts

### Future Agent Roadmap

#### Planned Agents
1. **Security Scanning Agent**: Automated vulnerability detection and patching
2. **Database Optimization Agent**: Query optimization and indexing strategies  
3. **User Behavior Analysis Agent**: UX optimization and personalization
4. **Market Data Analysis Agent**: Trading strategy optimization and backtesting

#### Agent Enhancement Priorities
- Improved pattern recognition capabilities
- Enhanced context awareness
- Better integration with development tools
- Advanced anomaly detection

### Agent Performance Metrics

#### Success Criteria
- **Accuracy**: >95% in pattern recognition
- **Performance**: <2s response time for analysis
- **Coverage**: 100% codebase analysis capability
- **Reliability**: >99% uptime and availability

#### Monitoring
- Real-time performance tracking
- Error rate monitoring
- User feedback integration
- Continuous improvement loops

### Technical Implementation

#### Agent Architecture
```typescript
interface AgentConfig {
  type: 'explore' | 'general' | 'specialized';
  capabilities: string[];
  permissions: Permission[];
  timeout: number;
  retryPolicy: RetryPolicy;
}
```

#### Security Framework
- Role-based access control
- Audit logging for all agent actions
- Automated security scanning
- Encrypted communication channels

### Usage Guidelines

#### Best Practices
- Always review agent recommendations before implementation
- Use agents for augmentation, not replacement of human judgment
- Regularly update agent models and capabilities
- Monitor agent performance and accuracy

#### Limitations
- Agents cannot access external resources without permission
- No autonomous code deployment capabilities
- Limited to predefined scopes and contexts
- Requires human oversight for critical decisions

## Agent Decision Log

### 2024-12-18 - Comprehensive Codebase Analysis
- **Agent**: exploratory_codebase_analyst_v1
- **Task**: Deep analysis of QuantForge AI codebase
- **Findings**: Overall score 8.5/10, excellent security and performance
- **Recommendations**: Enhance error recovery, improve modularity, expand testing
- **Status**: Completed
- **Impact**: High - Identified critical improvement areas

### 2024-12-18 - PR Management and Deployment Fix
- **Agent**: deployment_optimization_agent_v1
- **Task**: Fix critical deployment failures in PR #138 (Vercel and Workers build failures)
- **Findings**: 
  - Vercel schema validation errors due to unsupported `regions` properties in function configurations
  - Build-time duplicate method warnings from `checkRateLimit` method conflicts
  - Local build environment setup issues resolved with dependency installation
- **Actions Taken**:
  - Removed `regions` properties from `api/**/*.ts` and `api/edge/**/*.ts` function configs in vercel.json
  - Renamed duplicate `checkRateLimit` method to `checkRateLimitSync` in unifiedSecurityManager.ts
  - Verified successful local build generation with `npm run build`
  - Updated documentation (bug.md, roadmap.md, task.md) with fix details
- **Recommendations**: 
  - Implement pre-commit hooks for Vercel schema validation
  - Consider automated deployment verification scripts
  - Establish deployment testing patterns for future PR workflows
- **Status**: Completed
- **Impact**: High - Resolved blocking deployment issues, restored CI/CD pipeline functionality

### 2024-12-18 - System Flow Optimization Implementation
- **Agent**: system_optimization_engine_v1
- **Task**: Implement advanced error recovery and service flow optimizations
- **Findings**: Successfully integrated circuit breaker pattern, enhanced error recovery, consolidated security services
- **Recommendations**: Continue with dependency injection pattern, add monitoring dashboard
- **Status**: Completed
- **Impact**: High - Improved system resilience, fixed critical BUG-001 and BUG-002

### Future Insights
- Agent performance should be tracked for continuous improvement
- Consider implementing specialized agents for different domains
- Regular agent model updates recommended
- Integration with CI/CD pipeline planned
- System flow optimization agents should focus on dependency injection for next iteration
- PR management agents should automate deployment verification and schema validation