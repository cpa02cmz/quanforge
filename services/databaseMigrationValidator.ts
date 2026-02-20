/**
 * Database Migration Validator
 * 
 * Validates database migrations for safety, best practices, and consistency.
 * Ensures migrations follow architectural patterns and don't introduce breaking changes.
 * 
 * @module services/databaseMigrationValidator
 * @author Database Architect
 */

import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('DatabaseMigrationValidator');

// ============================================================================
// TYPES
// ============================================================================

export interface MigrationFile {
  name: string;
  content: string;
  order: number;
  category: 'schema' | 'index' | 'constraint' | 'data' | 'rls' | 'function' | 'trigger';
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (content: string) => ValidationResult;
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  line?: number;
  suggestion?: string;
}

export interface MigrationValidationReport {
  fileName: string;
  passed: boolean;
  results: Array<{
    rule: ValidationRule;
    result: ValidationResult;
  }>;
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

const VALIDATION_RULES: ValidationRule[] = [
  // Safety Rules
  {
    id: 'SAFETY_001',
    name: 'No DROP TABLE without CASCADE check',
    description: 'DROP TABLE statements should use IF EXISTS to prevent errors',
    severity: 'error',
    check: (content: string): ValidationResult => {
      const dropTableRegex = /DROP\s+TABLE\s+(?!IF\s+EXISTS)/gi;
      const match = dropTableRegex.exec(content);
      if (match) {
        return {
          passed: false,
          message: 'DROP TABLE found without IF EXISTS clause',
          suggestion: 'Use DROP TABLE IF EXISTS to safely handle missing tables',
        };
      }
      return { passed: true, message: 'No unsafe DROP TABLE statements found' };
    },
  },
  {
    id: 'SAFETY_002',
    name: 'No DROP COLUMN without check',
    description: 'Dropping columns is destructive and should be carefully reviewed',
    severity: 'warning',
    check: (content: string): ValidationResult => {
      const dropColumnRegex = /DROP\s+COLUMN/gi;
      const match = dropColumnRegex.exec(content);
      if (match) {
        return {
          passed: true,
          message: 'DROP COLUMN statement found - ensure data backup before migration',
          suggestion: 'Consider soft delete or data migration before dropping columns',
        };
      }
      return { passed: true, message: 'No DROP COLUMN statements found' };
    },
  },
  {
    id: 'SAFETY_003',
    name: 'Transaction wrapping for DDL',
    description: 'DDL statements should be wrapped in transactions where possible',
    severity: 'warning',
    check: (content: string): ValidationResult => {
      const hasDDL = /CREATE\s+(TABLE|INDEX|FUNCTION|TRIGGER)/gi.test(content);
      const hasTransaction = /BEGIN|START\s+TRANSACTION/gi.test(content);
      if (hasDDL && !hasTransaction) {
        return {
          passed: true,
          message: 'DDL statements found without transaction wrapping',
          suggestion: 'Consider wrapping DDL in transactions for rollback capability',
        };
      }
      return { passed: true, message: 'Transaction handling looks appropriate' };
    },
  },
  // Performance Rules
  {
    id: 'PERF_001',
    name: 'CONCURRENT index creation',
    description: 'Index creation should use CONCURRENTLY to avoid table locks',
    severity: 'warning',
    check: (content: string): ValidationResult => {
      const createIndexRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?!.*CONCURRENTLY)/gi;
      const match = createIndexRegex.exec(content);
      if (match) {
        return {
          passed: true,
          message: 'CREATE INDEX found without CONCURRENTLY',
          suggestion: 'Use CREATE INDEX CONCURRENTLY for production migrations',
        };
      }
      return { passed: true, message: 'Index creation follows best practices' };
    },
  },
  {
    id: 'PERF_002',
    name: 'Avoid SELECT * in functions',
    description: 'Functions should select only needed columns for performance',
    severity: 'warning',
    check: (content: string): ValidationResult => {
      const selectStarRegex = /SELECT\s+\*\s+FROM/gi;
      const matches = content.match(selectStarRegex);
      if (matches && matches.length > 2) {
        return {
          passed: true,
          message: `Found ${matches.length} SELECT * statements`,
          suggestion: 'Consider selecting only required columns for better performance',
        };
      }
      return { passed: true, message: 'SELECT usage looks appropriate' };
    },
  },
  // Naming Conventions
  {
    id: 'NAMING_001',
    name: 'Index naming convention',
    description: 'Indexes should follow naming convention: idx_table_column',
    severity: 'info',
    check: (content: string): ValidationResult => {
      const createIndexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
      let match;
      const violations: string[] = [];
      
      while ((match = createIndexRegex.exec(content)) !== null) {
        const indexName = match[1];
        if (indexName && !indexName.startsWith('idx_') && !indexName.startsWith('pk_') && !indexName.startsWith('uq_')) {
          violations.push(indexName);
        }
      }
      
      if (violations.length > 0) {
        return {
          passed: true,
          message: `Index names not following convention: ${violations.join(', ')}`,
          suggestion: 'Use idx_ prefix for regular indexes, pk_ for primary keys, uq_ for unique',
        };
      }
      return { passed: true, message: 'Index naming follows conventions' };
    },
  },
  {
    id: 'NAMING_002',
    name: 'Foreign key naming convention',
    description: 'Foreign keys should follow naming convention: fk_table_referenced',
    severity: 'info',
    check: (content: string): ValidationResult => {
      const fkRegex = /CONSTRAINT\s+(\w+)\s+FOREIGN\s+KEY/gi;
      let match;
      const violations: string[] = [];
      
      while ((match = fkRegex.exec(content)) !== null) {
        const fkName = match[1];
        if (fkName && !fkName.startsWith('fk_')) {
          violations.push(fkName);
        }
      }
      
      if (violations.length > 0) {
        return {
          passed: true,
          message: `Foreign key names not following convention: ${violations.join(', ')}`,
          suggestion: 'Use fk_ prefix for foreign key constraints',
        };
      }
      return { passed: true, message: 'Foreign key naming follows conventions' };
    },
  },
  // Security Rules
  {
    id: 'SEC_001',
    name: 'RLS enabled check',
    description: 'Tables with user data should have RLS enabled',
    severity: 'warning',
    check: (content: string): ValidationResult => {
      const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
      const enableRLSRegex = /ALTER\s+TABLE\s+(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
      
      const tables: string[] = [];
      let match;
      
      while ((match = createTableRegex.exec(content)) !== null) {
        if (match[1]) tables.push(match[1].toLowerCase());
      }
      
      const rlsTables: string[] = [];
      while ((match = enableRLSRegex.exec(content)) !== null) {
        if (match[1]) rlsTables.push(match[1].toLowerCase());
      }
      
      const tablesWithoutRLS = tables.filter(t => !rlsTables.includes(t) && !t.includes('audit') && !t.includes('metrics'));
      
      if (tablesWithoutRLS.length > 0) {
        return {
          passed: true,
          message: `Tables without RLS: ${tablesWithoutRLS.join(', ')}`,
          suggestion: 'Enable RLS on tables containing user data for security',
        };
      }
      return { passed: true, message: 'RLS configuration looks appropriate' };
    },
  },
  {
    id: 'SEC_002',
    name: 'No hardcoded secrets',
    description: 'Migrations should not contain hardcoded passwords or secrets',
    severity: 'error',
    check: (content: string): ValidationResult => {
      const secretPatterns = [
        /password\s*=\s*['"][^'"]+['"]/gi,
        /secret\s*=\s*['"][^'"]+['"]/gi,
        /api_key\s*=\s*['"][^'"]+['"]/gi,
        /token\s*=\s*['"][^'"]+['"]/gi,
      ];
      
      for (const pattern of secretPatterns) {
        const match = pattern.exec(content);
        if (match) {
          return {
            passed: false,
            message: 'Potential hardcoded secret found',
            suggestion: 'Use environment variables or secure storage for secrets',
          };
        }
      }
      return { passed: true, message: 'No hardcoded secrets found' };
    },
  },
  // Best Practices
  {
    id: 'BEST_001',
    name: 'Migration comments',
    description: 'Migrations should have comments explaining their purpose',
    severity: 'info',
    check: (content: string): ValidationResult => {
      const hasComments = /--.*\n|\/\*[\s\S]*?\*\//.test(content);
      if (!hasComments) {
        return {
          passed: true,
          message: 'No comments found in migration',
          suggestion: 'Add comments to explain the migration purpose and impact',
        };
      }
      return { passed: true, message: 'Migration contains comments' };
    },
  },
  {
    id: 'BEST_002',
    name: 'Down migration availability',
    description: 'Destructive migrations should have corresponding down migrations',
    severity: 'warning',
    check: (content: string): ValidationResult => {
      const hasDropOrAlter = /DROP\s+(TABLE|COLUMN|INDEX|FUNCTION)/gi.test(content) ||
                            /ALTER\s+TABLE.*DROP/gi.test(content);
      const hasDownMigration = /--\s*DOWN|--\s*ROLLBACK|ROLLBACK\s*MIGRATION/gi.test(content);
      
      if (hasDropOrAlter && !hasDownMigration) {
        return {
          passed: true,
          message: 'Destructive changes found without visible rollback',
          suggestion: 'Create a corresponding down migration for rollback capability',
        };
      }
      return { passed: true, message: 'Rollback strategy looks appropriate' };
    },
  },
  {
    id: 'BEST_003',
    name: 'IF EXISTS/IF NOT EXISTS usage',
    description: 'CREATE/DROP statements should use IF EXISTS/IF NOT EXISTS',
    severity: 'warning',
    check: (content: string): ValidationResult => {
      const createWithoutIf = /CREATE\s+(TABLE|INDEX|FUNCTION|TRIGGER)\s+(?!IF\s+NOT\s+EXISTS)/gi;
      const dropWithoutIf = /DROP\s+(TABLE|INDEX|FUNCTION|TRIGGER)\s+(?!IF\s+EXISTS)/gi;
      
      const createMatches = content.match(createWithoutIf);
      const dropMatches = content.match(dropWithoutIf);
      
      if ((createMatches && createMatches.length > 0) || (dropMatches && dropMatches.length > 0)) {
        return {
          passed: true,
          message: 'Some CREATE/DROP statements without IF EXISTS/IF NOT EXISTS',
          suggestion: 'Use IF EXISTS/IF NOT EXISTS for idempotent migrations',
        };
      }
      return { passed: true, message: 'CREATE/DROP statements use safe patterns' };
    },
  },
  // Data Integrity
  {
    id: 'DATA_001',
    name: 'NOT NULL constraints',
    description: 'Adding NOT NULL to existing columns requires default values',
    severity: 'error',
    check: (content: string): ValidationResult => {
      const alterNotNull = /ALTER\s+TABLE\s+\w+\s+ALTER\s+COLUMN\s+\w+\s+SET\s+NOT\s+NULL/gi;
      const hasDefault = /SET\s+DEFAULT|DEFAULT\s+/gi;
      
      if (alterNotNull.test(content) && !hasDefault.test(content)) {
        return {
          passed: false,
          message: 'SET NOT NULL found without DEFAULT value',
          suggestion: 'Set a default value before adding NOT NULL constraint',
        };
      }
      return { passed: true, message: 'NOT NULL constraints handled properly' };
    },
  },
  {
    id: 'DATA_002',
    name: 'Foreign key constraints',
    description: 'Foreign keys should reference valid columns with appropriate ON DELETE',
    severity: 'info',
    check: (content: string): ValidationResult => {
      const fkWithDelete = /FOREIGN\s+KEY.*ON\s+DELETE/gi;
      const fkWithoutDelete = /FOREIGN\s+KEY(?![\s\S]*?ON\s+DELETE)/gi;
      
      if (fkWithoutDelete.test(content) && !fkWithDelete.test(content)) {
        return {
          passed: true,
          message: 'Foreign keys without ON DELETE action',
          suggestion: 'Consider adding ON DELETE CASCADE or SET NULL for referential integrity',
        };
      }
      return { passed: true, message: 'Foreign key constraints have appropriate actions' };
    },
  },
];

// ============================================================================
// MIGRATION VALIDATOR CLASS
// ============================================================================

class DatabaseMigrationValidator {
  private static instance: DatabaseMigrationValidator;
  private customRules: ValidationRule[] = [];

  private constructor() {}

  static getInstance(): DatabaseMigrationValidator {
    if (!DatabaseMigrationValidator.instance) {
      DatabaseMigrationValidator.instance = new DatabaseMigrationValidator();
    }
    return DatabaseMigrationValidator.instance;
  }

  /**
   * Validate a single migration file
   */
  validateMigration(migration: MigrationFile): MigrationValidationReport {
    const results: Array<{ rule: ValidationRule; result: ValidationResult }> = [];
    let errors = 0;
    let warnings = 0;
    let info = 0;

    // Run all validation rules
    const allRules = [...VALIDATION_RULES, ...this.customRules];
    
    for (const rule of allRules) {
      const result = rule.check(migration.content);
      results.push({ rule, result });
      
      if (!result.passed && rule.severity === 'error') {
        errors++;
      } else if (rule.severity === 'warning') {
        warnings++;
      } else if (rule.severity === 'info') {
        info++;
      }
    }

    return {
      fileName: migration.name,
      passed: errors === 0,
      results,
      summary: { errors, warnings, info },
    };
  }

  /**
   * Validate multiple migration files
   */
  validateMigrations(migrations: MigrationFile[]): MigrationValidationReport[] {
    return migrations.map(m => this.validateMigration(m));
  }

  /**
   * Add custom validation rule
   */
  addRule(rule: ValidationRule): void {
    this.customRules.push(rule);
  }

  /**
   * Remove custom validation rule
   */
  removeRule(ruleId: string): boolean {
    const index = this.customRules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.customRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all validation rules
   */
  getRules(): ValidationRule[] {
    return [...VALIDATION_RULES, ...this.customRules];
  }

  /**
   * Categorize migration by content analysis
   */
  categorizeMigration(content: string): MigrationFile['category'] {
    const upperContent = content.toUpperCase();
    
    if (upperContent.includes('CREATE TABLE') || upperContent.includes('ALTER TABLE')) {
      return 'schema';
    }
    if (upperContent.includes('CREATE INDEX') || upperContent.includes('CREATE UNIQUE INDEX')) {
      return 'index';
    }
    if (upperContent.includes('CONSTRAINT') || upperContent.includes('CHECK')) {
      return 'constraint';
    }
    if (upperContent.includes('INSERT') || upperContent.includes('UPDATE') || upperContent.includes('DELETE')) {
      return 'data';
    }
    if (upperContent.includes('ROW LEVEL SECURITY') || upperContent.includes('CREATE POLICY')) {
      return 'rls';
    }
    if (upperContent.includes('CREATE FUNCTION') || upperContent.includes('CREATE OR REPLACE FUNCTION')) {
      return 'function';
    }
    if (upperContent.includes('CREATE TRIGGER')) {
      return 'trigger';
    }
    
    return 'schema';
  }

  /**
   * Extract migration order from filename
   */
  extractOrder(filename: string): number {
    const match = filename.match(/^(\d+)/);
    return match?.[1] ? parseInt(match[1], 10) : 999;
  }

  /**
   * Generate validation summary
   */
  generateSummary(reports: MigrationValidationReport[]): {
    totalMigrations: number;
    passedMigrations: number;
    failedMigrations: number;
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    recommendations: string[];
  } {
    const passedMigrations = reports.filter(r => r.passed).length;
    const failedMigrations = reports.length - passedMigrations;
    const totalErrors = reports.reduce((sum, r) => sum + r.summary.errors, 0);
    const totalWarnings = reports.reduce((sum, r) => sum + r.summary.warnings, 0);
    const totalInfo = reports.reduce((sum, r) => sum + r.summary.info, 0);

    const recommendations: string[] = [];
    
    // Generate recommendations based on common issues
    if (totalErrors > 0) {
      recommendations.push('Fix all errors before applying migrations to production');
    }
    if (totalWarnings > 3) {
      recommendations.push('Review warnings and consider addressing them for better migration quality');
    }
    if (failedMigrations > 0) {
      recommendations.push('Some migrations failed validation - review and fix before deployment');
    }

    return {
      totalMigrations: reports.length,
      passedMigrations,
      failedMigrations,
      totalErrors,
      totalWarnings,
      totalInfo,
      recommendations,
    };
  }

  /**
   * Print validation report to console
   */
  printReport(report: MigrationValidationReport): void {
    logger.log(`\n=== Migration Validation: ${report.fileName} ===`);
    logger.log(`Status: ${report.passed ? 'PASSED' : 'FAILED'}`);
    logger.log(`Errors: ${report.summary.errors}, Warnings: ${report.summary.warnings}, Info: ${report.summary.info}`);
    
    for (const { rule, result } of report.results) {
      const icon = result.passed ? '✓' : (rule.severity === 'error' ? '✗' : '!');
      const severity = `[${rule.severity.toUpperCase()}]`;
      logger.log(`  ${icon} ${severity} ${rule.name}: ${result.message}`);
      if (result.suggestion) {
        logger.log(`      Suggestion: ${result.suggestion}`);
      }
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const databaseMigrationValidator = DatabaseMigrationValidator.getInstance();
export { DatabaseMigrationValidator };
