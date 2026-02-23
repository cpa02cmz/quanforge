#!/usr/bin/env ts-node
/**
 * Deployment Status Tracker
 * 
 * Tracks and reports deployment status across platforms:
 * - Vercel deployments
 * - Cloudflare Workers deployments
 * - Build artifacts status
 * 
 * @author DevOps Engineer Agent
 * @version 1.0.0
 * @date 2026-02-23
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface DeploymentStatus {
  platform: string;
  status: 'deployed' | 'pending' | 'failed' | 'unknown' | 'not_configured' | 'not_built';
  url?: string;
  lastDeploy?: string;
  commit?: string;
  branch?: string;
  environment?: string;
}

interface DeploymentReport {
  timestamp: string;
  deployments: DeploymentStatus[];
  buildInfo: {
    version: string;
    commit: string;
    branch: string;
    buildTime: string;
  };
  healthStatus: {
    vercel: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    cloudflare: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  };
}

class DeploymentTracker {
  private results: DeploymentStatus[] = [];

  /**
   * Run a command safely
   */
  private runCommand(command: string): { success: boolean; output: string } {
    try {
      const output = execSync(command, { 
        encoding: 'utf-8', 
        stdio: 'pipe',
        timeout: 30000 
      });
      return { success: true, output: output.trim() };
    } catch {
      return { success: false, output: '' };
    }
  }

  /**
   * Get current git info
   */
  private getGitInfo(): { commit: string; branch: string } {
    const commit = this.runCommand('git rev-parse HEAD').output.slice(0, 7);
    const branch = this.runCommand('git rev-parse --abbrev-ref HEAD').output;
    return { commit: commit || 'unknown', branch: branch || 'unknown' };
  }

  /**
   * Get package version
   */
  private getVersion(): string {
    try {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
      return pkg.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /**
   * Check Vercel deployment status
   */
  checkVercel(): DeploymentStatus {
    console.log('🔍 Checking Vercel deployment...');

    const gitInfo = this.getGitInfo();
    const vercelConfig = existsSync('vercel.json');
    
    // Try to get deployment info from Vercel CLI if available
    const vercelList = this.runCommand('vercel list 2>/dev/null | head -5');
    
    let status: DeploymentStatus = {
      platform: 'vercel',
      status: 'unknown',
      commit: gitInfo.commit,
      branch: gitInfo.branch,
      environment: 'production'
    };

    if (vercelConfig) {
      if (vercelList.success && vercelList.output) {
        // Parse Vercel output
        const lines = vercelList.output.split('\n');
        const latestDeploy = lines.find(line => line.includes('Ready') || line.includes('production'));
        
        if (latestDeploy) {
          status.status = 'deployed';
          status.lastDeploy = new Date().toISOString();
          
          // Try to extract URL
          const urlMatch = latestDeploy.match(/https:\/\/[^\s]+/);
          if (urlMatch) {
            status.url = urlMatch[0];
          }
        } else {
          status.status = 'pending';
        }
      } else {
        status.status = 'unknown';
        status.url = 'https://quanforge.ai'; // Default production URL
      }
    } else {
      status.status = 'not_configured';
    }

    this.results.push(status);
    return status;
  }

  /**
   * Check Cloudflare Workers deployment status
   */
  checkCloudflare(): DeploymentStatus {
    console.log('🔍 Checking Cloudflare Workers deployment...');

    const gitInfo = this.getGitInfo();
    const wranglerConfig = existsSync('wrangler.toml');
    
    let status: DeploymentStatus = {
      platform: 'cloudflare',
      status: 'unknown',
      commit: gitInfo.commit,
      branch: gitInfo.branch,
      environment: 'production'
    };

    if (wranglerConfig) {
      // Try to get deployment info from Wrangler CLI if available
      const wranglerStatus = this.runCommand('npx wrangler deployments list 2>/dev/null | head -5');
      
      if (wranglerStatus.success && wranglerStatus.output) {
        if (wranglerStatus.output.includes('Success') || wranglerStatus.output.includes('Active')) {
          status.status = 'deployed';
          status.lastDeploy = new Date().toISOString();
        } else {
          status.status = 'pending';
        }
      } else {
        // Known issue: Cloudflare Workers has configuration issues
        status.status = 'failed';
        status.url = 'Configuration issue - see Issue #1096';
      }
    } else {
      status.status = 'not_configured';
    }

    this.results.push(status);
    return status;
  }

  /**
   * Check build artifacts
   */
  checkBuildArtifacts(): void {
    console.log('🔍 Checking build artifacts...');

    const distExists = existsSync('dist');
    const assetsExist = existsSync('dist/assets');
    
    let status: DeploymentStatus = {
      platform: 'build_artifacts',
      status: 'unknown',
      commit: this.getGitInfo().commit,
      branch: this.getGitInfo().branch
    };

    if (distExists && assetsExist) {
      // Check build size
      const sizeResult = this.runCommand('du -sh dist/ 2>/dev/null');
      const size = sizeResult.output.split('\t')[0] || 'unknown';
      
      // Check for main files
      const indexExists = existsSync('dist/index.html');
      const assetsCount = this.runCommand('ls -1 dist/assets/*.js 2>/dev/null | wc -l');
      
      if (indexExists && parseInt(assetsCount.output) > 0) {
        status.status = 'deployed';
        status.url = `local:dist/ (${size}, ${assetsCount.output.trim()} chunks)`;
      } else {
        status.status = 'failed';
      }
    } else {
      status.status = 'not_built';
    }

    this.results.push(status);
  }

  /**
   * Generate deployment report
   */
  generateReport(): DeploymentReport {
    const gitInfo = this.getGitInfo();
    
    // Determine health status
    const vercelStatus = this.results.find(r => r.platform === 'vercel');
    const cloudflareStatus = this.results.find(r => r.platform === 'cloudflare');

    const getHealthStatus = (status?: DeploymentStatus): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' => {
      if (!status) return 'unknown';
      switch (status.status) {
        case 'deployed': return 'healthy';
        case 'pending': return 'degraded';
        case 'failed': return 'unhealthy';
        case 'not_configured':
        case 'not_built':
        case 'unknown':
        default: return 'unknown';
      }
    };

    return {
      timestamp: new Date().toISOString(),
      deployments: this.results,
      buildInfo: {
        version: this.getVersion(),
        commit: gitInfo.commit,
        branch: gitInfo.branch,
        buildTime: new Date().toISOString()
      },
      healthStatus: {
        vercel: getHealthStatus(vercelStatus),
        cloudflare: getHealthStatus(cloudflareStatus)
      }
    };
  }

  /**
   * Print report
   */
  printReport(report: DeploymentReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 DEPLOYMENT STATUS REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n📦 Build Info:`);
    console.log(`   Version: ${report.buildInfo.version}`);
    console.log(`   Commit: ${report.buildInfo.commit}`);
    console.log(`   Branch: ${report.buildInfo.branch}`);
    console.log(`   Time: ${report.buildInfo.buildTime}`);

    console.log(`\n🌐 Deployment Status:`);
    for (const deployment of report.deployments) {
      const icon = deployment.status === 'deployed' ? '✅' : 
                   deployment.status === 'failed' ? '❌' : 
                   deployment.status === 'pending' ? '⏳' : '❓';
      console.log(`   ${icon} ${deployment.platform}: ${deployment.status}`);
      if (deployment.url) {
        console.log(`      URL: ${deployment.url}`);
      }
      if (deployment.environment) {
        console.log(`      Environment: ${deployment.environment}`);
      }
    }

    console.log(`\n💚 Health Status:`);
    console.log(`   Vercel: ${report.healthStatus.vercel}`);
    console.log(`   Cloudflare: ${report.healthStatus.cloudflare}`);

    console.log('\n' + '='.repeat(60));
  }

  /**
   * Save report
   */
  saveReport(report: DeploymentReport, filename = 'deployment-status.json'): void {
    const filepath = join(process.cwd(), 'docs', filename);
    try {
      writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Report saved to ${filepath}`);
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  }

  /**
   * Run all checks
   */
  async run(): Promise<DeploymentReport> {
    console.log('🚀 Starting Deployment Status Check...\n');
    
    this.checkVercel();
    this.checkCloudflare();
    this.checkBuildArtifacts();

    const report = this.generateReport();
    this.printReport(report);
    this.saveReport(report);
    
    return report;
  }
}

// Main execution
async function main(): Promise<void> {
  const tracker = new DeploymentTracker();
  await tracker.run();
}

main().catch(console.error);
