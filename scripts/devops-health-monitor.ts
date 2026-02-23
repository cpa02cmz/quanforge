#!/usr/bin/env ts-node
/**
 * DevOps Health Monitor - Comprehensive Infrastructure Health Check
 * 
 * This script provides a unified health monitoring system for:
 * - CI/CD pipeline status
 * - Build system health
 * - Deployment status
 * - Security posture
 * - Performance metrics
 * - Repository hygiene
 * 
 * @author DevOps Engineer Agent
 * @version 1.0.0
 * @date 2026-02-23
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface HealthCheckResult {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

interface HealthReport {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  score: number;
  checks: HealthCheckResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
  };
  recommendations: string[];
}

class DevOpsHealthMonitor {
  private results: HealthCheckResult[] = [];
  private recommendations: string[] = [];

  /**
   * Run a command and return the output
   */
  private runCommand(command: string, silent = false): { success: boolean; output: string; error?: string } {
    try {
      const output = execSync(command, { 
        encoding: 'utf-8', 
        stdio: silent ? 'pipe' : 'pipe',
        timeout: 60000 
      });
      return { success: true, output: output.trim() };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      return { 
        success: false, 
        output: err.stdout || '',
        error: err.stderr || err.message || 'Unknown error'
      };
    }
  }

  /**
   * Add a health check result
   */
  private addResult(
    category: string,
    check: string,
    status: 'pass' | 'fail' | 'warning',
    message: string,
    details?: Record<string, unknown>
  ): void {
    this.results.push({
      category,
      check,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add a recommendation
   */
  private addRecommendation(recommendation: string): void {
    this.recommendations.push(recommendation);
  }

  /**
   * Check build system health
   */
  checkBuildSystem(): void {
    console.log('📦 Checking Build System...');

    // Check if build works
    const buildResult = this.runCommand('npm run build', true);
    if (buildResult.success) {
      const buildTime = buildResult.output.match(/built in (\d+\.?\d*s)/)?.[1] || 'unknown';
      this.addResult('Build System', 'Production Build', 'pass', `Build successful in ${buildTime}`, {
        buildTime,
        output: buildResult.output.slice(-500)
      });
    } else {
      this.addResult('Build System', 'Production Build', 'fail', 'Build failed', {
        error: buildResult.error
      });
      this.addRecommendation('Fix build errors before deployment');
    }

    // Check TypeScript compilation
    const typecheckResult = this.runCommand('npm run typecheck', true);
    if (typecheckResult.success) {
      this.addResult('Build System', 'TypeScript Compilation', 'pass', 'No TypeScript errors');
    } else {
      this.addResult('Build System', 'TypeScript Compilation', 'fail', 'TypeScript errors detected', {
        error: typecheckResult.error
      });
    }

    // Check for large bundles
    const bundleCheck = this.runCommand('du -sh dist/ 2>/dev/null || echo "0"', true);
    if (bundleCheck.success) {
      const sizeMatch = bundleCheck.output.match(/(\d+\.?\d*[MGK]?)/);
      const size = sizeMatch ? sizeMatch[1] : 'unknown';
      const sizeInMB = parseFloat(size.replace(/[^0-9.]/g, ''));
      const unit = size.match(/[MGK]/)?.[0] || 'B';
      
      if (unit === 'M' && sizeInMB > 3) {
        this.addResult('Build System', 'Bundle Size', 'warning', `Bundle size is ${size}`, {
          size,
          threshold: '3M'
        });
        this.addRecommendation('Consider further bundle optimization');
      } else {
        this.addResult('Build System', 'Bundle Size', 'pass', `Bundle size is ${size}`);
      }
    }
  }

  /**
   * Check code quality
   */
  checkCodeQuality(): void {
    console.log('🔍 Checking Code Quality...');

    // Check linting
    const lintResult = this.runCommand('npm run lint 2>&1 | tail -5', true);
    const lintOutput = lintResult.output;
    
    const errorMatch = lintOutput.match(/✖ (\d+) problems \((\d+) errors/);
    const warningMatch = lintOutput.match(/(\d+) warnings/);
    
    if (errorMatch && parseInt(errorMatch[2]) > 0) {
      this.addResult('Code Quality', 'Lint Errors', 'fail', `${errorMatch[2]} lint errors found`, {
        errors: parseInt(errorMatch[2])
      });
    } else {
      const warnings = warningMatch ? parseInt(warningMatch[1]) : 0;
      if (warnings > 100) {
        this.addResult('Code Quality', 'Lint Warnings', 'warning', `${warnings} lint warnings found`, {
          warnings
        });
      } else {
        this.addResult('Code Quality', 'Lint Check', 'pass', 'No lint errors');
      }
    }

    // Check test coverage
    const testResult = this.runCommand('npm run test:run 2>&1 | tail -10', true);
    const testMatch = testResult.output.match(/(\d+) passed/);
    
    if (testMatch) {
      const passedTests = parseInt(testMatch[1]);
      this.addResult('Code Quality', 'Test Suite', 'pass', `${passedTests} tests passing`, {
        testsPassed: passedTests
      });
    } else {
      const failedMatch = testResult.output.match(/(\d+) failed/);
      if (failedMatch) {
        this.addResult('Code Quality', 'Test Suite', 'fail', `${failedMatch[1]} tests failing`);
      }
    }
  }

  /**
   * Check security posture
   */
  checkSecurity(): void {
    console.log('🔒 Checking Security...');

    // Check for vulnerabilities
    const auditResult = this.runCommand('npm audit --audit-level=moderate --json 2>/dev/null', true);
    try {
      const audit = JSON.parse(auditResult.output || '{}');
      const vulns = audit.metadata?.vulnerabilities || {};
      const total = (vulns.total || 0);
      const critical = vulns.critical || 0;
      const high = vulns.high || 0;

      if (critical > 0) {
        this.addResult('Security', 'Vulnerabilities', 'fail', `${critical} critical vulnerabilities found`, {
          critical,
          high,
          total
        });
        this.addRecommendation('Address critical security vulnerabilities immediately');
      } else if (high > 0) {
        this.addResult('Security', 'Vulnerabilities', 'warning', `${high} high severity vulnerabilities found`, {
          high,
          total
        });
        this.addRecommendation('Review and address high severity vulnerabilities');
      } else {
        this.addResult('Security', 'Vulnerabilities', 'pass', 'No moderate+ vulnerabilities in production');
      }
    } catch {
      this.addResult('Security', 'Vulnerabilities', 'warning', 'Could not parse npm audit output');
    }

    // Check for secrets in code
    const secretsCheck = this.runCommand('grep -r "apiKey\\|secretKey\\|password\\|token" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist . 2>/dev/null | head -5 || echo "none"', true);
    const secretsFound = secretsCheck.output && !secretsCheck.output.includes('none') && secretsCheck.output.length > 0;
    
    if (secretsFound) {
      this.addResult('Security', 'Secrets Check', 'warning', 'Potential hardcoded secrets found', {
        note: 'Review for false positives'
      });
      this.addRecommendation('Review potential hardcoded credentials');
    } else {
      this.addResult('Security', 'Secrets Check', 'pass', 'No obvious hardcoded secrets found');
    }
  }

  /**
   * Check CI/CD pipeline health
   */
  checkCICD(): void {
    console.log('⚙️ Checking CI/CD Pipeline...');

    // Check if workflows exist
    const workflowsDir = '.github/workflows';
    if (existsSync(workflowsDir)) {
      const workflows = this.runCommand(`ls -1 ${workflowsDir}/*.yml 2>/dev/null | wc -l`, true);
      const count = parseInt(workflows.output) || 0;
      
      if (count >= 3) {
        this.addResult('CI/CD', 'Workflow Files', 'pass', `${count} workflow files configured`);
      } else {
        this.addResult('CI/CD', 'Workflow Files', 'warning', `Only ${count} workflow files found`, {
          recommendation: 'Consider adding more workflows for comprehensive CI/CD'
        });
      }
    } else {
      this.addResult('CI/CD', 'Workflow Files', 'fail', 'No GitHub workflows found');
    }

    // Check for deployment configs
    const vercelConfig = existsSync('vercel.json');
    const wranglerConfig = existsSync('wrangler.toml');
    
    if (vercelConfig) {
      this.addResult('CI/CD', 'Vercel Config', 'pass', 'Vercel deployment configured');
    }
    
    if (wranglerConfig) {
      this.addResult('CI/CD', 'Cloudflare Config', 'pass', 'Cloudflare Workers configured');
    }

    if (!vercelConfig && !wranglerConfig) {
      this.addResult('CI/CD', 'Deployment Config', 'warning', 'No deployment configuration found');
      this.addRecommendation('Add deployment configuration (vercel.json or wrangler.toml)');
    }
  }

  /**
   * Check repository hygiene
   */
  checkRepositoryHygiene(): void {
    console.log('🧹 Checking Repository Hygiene...');

    // Check git status
    const statusResult = this.runCommand('git status --porcelain', true);
    const uncommittedChanges = statusResult.output.split('\n').filter(line => line.trim()).length;
    
    if (uncommittedChanges === 0) {
      this.addResult('Repository', 'Working Tree', 'pass', 'Clean working tree');
    } else {
      this.addResult('Repository', 'Working Tree', 'warning', `${uncommittedChanges} uncommitted changes`);
    }

    // Check for stale branches
    const branchesResult = this.runCommand('git branch -r --sort=-committerdate | head -10', true);
    const _branches = branchesResult.output.split('\n').filter(b => b.trim());
    
    // Check default branch
    const defaultBranch = this.runCommand('git remote show origin 2>/dev/null | grep "HEAD branch" | cut -d: -f2', true);
    const mainBranch = defaultBranch.output.trim() || 'main';
    
    this.addResult('Repository', 'Default Branch', 'pass', `Default branch is ${mainBranch}`);

    // Check for recent activity
    const lastCommit = this.runCommand('git log -1 --format="%cr"', true);
    this.addResult('Repository', 'Recent Activity', 'pass', `Last commit was ${lastCommit.output}`);

    // Check for remote tracking
    const trackingResult = this.runCommand('git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null', true);
    if (trackingResult.success && trackingResult.output) {
      this.addResult('Repository', 'Remote Tracking', 'pass', `Tracking ${trackingResult.output}`);
    } else {
      this.addResult('Repository', 'Remote Tracking', 'warning', 'No upstream branch set');
    }
  }

  /**
   * Check dependencies health
   */
  checkDependencies(): void {
    console.log('📦 Checking Dependencies...');

    // Check for outdated packages
    const outdatedResult = this.runCommand('npm outdated --json 2>/dev/null || echo "{}"', true);
    try {
      const outdated = JSON.parse(outdatedResult.output || '{}');
      const outdatedCount = Object.keys(outdated).length;
      
      if (outdatedCount === 0) {
        this.addResult('Dependencies', 'Outdated Packages', 'pass', 'All packages up to date');
      } else if (outdatedCount < 10) {
        this.addResult('Dependencies', 'Outdated Packages', 'warning', `${outdatedCount} packages have updates available`);
      } else {
        this.addResult('Dependencies', 'Outdated Packages', 'warning', `${outdatedCount} packages are outdated`, {
          packages: Object.keys(outdated).slice(0, 5)
        });
        this.addRecommendation('Consider updating outdated dependencies');
      }
    } catch {
      this.addResult('Dependencies', 'Outdated Packages', 'warning', 'Could not check for outdated packages');
    }

    // Check package.json exists
    if (existsSync('package.json')) {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
      const depCount = Object.keys(pkg.dependencies || {}).length;
      const devDepCount = Object.keys(pkg.devDependencies || {}).length;
      
      this.addResult('Dependencies', 'Package Configuration', 'pass', `${depCount} dependencies, ${devDepCount} dev dependencies`);
    }
  }

  /**
   * Generate health report
   */
  generateReport(): HealthReport {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    
    const total = this.results.length;
    const score = Math.round((passed / total) * 100);
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (failed > 0) {
      overallStatus = 'unhealthy';
    } else if (warnings > 2) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      score,
      checks: this.results,
      summary: { passed, failed, warnings },
      recommendations: this.recommendations
    };
  }

  /**
   * Print report to console
   */
  printReport(report: HealthReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEVOPS HEALTH REPORT');
    console.log('='.repeat(60));
    console.log(`\nTimestamp: ${report.timestamp}`);
    console.log(`Overall Status: ${report.overallStatus.toUpperCase()}`);
    console.log(`Health Score: ${report.score}/100`);
    console.log(`\nSummary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.warnings} warnings`);

    // Group by category
    const categories = [...new Set(report.checks.map(c => c.category))];
    
    for (const category of categories) {
      console.log(`\n📁 ${category}`);
      console.log('-'.repeat(40));
      
      const categoryChecks = report.checks.filter(c => c.category === category);
      for (const check of categoryChecks) {
        const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
        console.log(`  ${icon} ${check.check}: ${check.message}`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      console.log('-'.repeat(40));
      for (const rec of report.recommendations) {
        console.log(`  • ${rec}`);
      }
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * Save report to file
   */
  saveReport(report: HealthReport, filename = 'devops-health-report.json'): void {
    const filepath = join(process.cwd(), 'docs', filename);
    try {
      writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Report saved to ${filepath}`);
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<HealthReport> {
    console.log('🚀 Starting DevOps Health Check...\n');
    
    this.checkBuildSystem();
    this.checkCodeQuality();
    this.checkSecurity();
    this.checkCICD();
    this.checkRepositoryHygiene();
    this.checkDependencies();

    const report = this.generateReport();
    this.printReport(report);
    
    return report;
  }
}

// Main execution
async function main(): Promise<void> {
  const monitor = new DevOpsHealthMonitor();
  const report = await monitor.runAllChecks();
  
  // Save report
  monitor.saveReport(report);
  
  // Exit with appropriate code
  if (report.overallStatus === 'unhealthy') {
    process.exit(1);
  } else if (report.overallStatus === 'degraded') {
    process.exit(0); // Warnings are acceptable
  }
}

main().catch(console.error);
