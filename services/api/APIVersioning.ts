/**
 * API Versioning - Version Management for API Calls
 * 
 * This module provides comprehensive API versioning support:
 * - Version header management
 * - Version negotiation
 * - Deprecation warnings
 * - Version-based feature detection
 * 
 * @module APIVersioning
 * @since 2026-02-20
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('APIVersioning');

// ============= Types =============

export interface APIVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface VersionConfig {
  current: APIVersion;
  minimum: APIVersion;
  deprecated?: APIVersion[];
  sunset?: Map<string, Date>;
}

export interface VersionInfo {
  version: APIVersion;
  deprecated: boolean;
  sunsetDate?: Date;
  features: string[];
}

// ============= Version Parsing =============

/**
 * Parse version string to APIVersion object
 */
export const parseVersion = (versionString: string): APIVersion => {
  const match = versionString.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  
  if (!match) {
    throw new Error(`Invalid version string: ${versionString}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: match[2] ? parseInt(match[2], 10) : 0,
    patch: match[3] ? parseInt(match[3], 10) : 0,
  };
};

/**
 * Convert APIVersion to string
 */
export const versionToString = (version: APIVersion): string => {
  return `v${version.major}.${version.minor}.${version.patch}`;
};

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export const compareVersions = (a: APIVersion, b: APIVersion): number => {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
};

/**
 * Check if version is greater than or equal to minimum
 */
export const isVersionSupported = (version: APIVersion, minimum: APIVersion): boolean => {
  return compareVersions(version, minimum) >= 0;
};

// ============= Version Manager =============

/**
 * Manages API versioning across the application
 */
export class APIVersionManager {
  private static instance: APIVersionManager;
  
  private config: VersionConfig = {
    current: { major: 1, minor: 0, patch: 0 },
    minimum: { major: 1, minor: 0, patch: 0 },
    deprecated: [],
    sunset: new Map(),
  };

  private featureFlags = new Map<string, APIVersion>();
  private versionHeaders = new Map<string, string>();

  private constructor() {
    this.initializeVersionHeaders();
  }

  static getInstance(): APIVersionManager {
    if (!APIVersionManager.instance) {
      APIVersionManager.instance = new APIVersionManager();
    }
    return APIVersionManager.instance;
  }

  /**
   * Initialize the version manager with configuration
   */
  configure(config: Partial<VersionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info(`API version configured: ${versionToString(this.config.current)}`);
  }

  /**
   * Get current API version
   */
  getCurrentVersion(): APIVersion {
    return { ...this.config.current };
  }

  /**
   * Get minimum supported version
   */
  getMinimumVersion(): APIVersion {
    return { ...this.config.minimum };
  }

  /**
   * Register a feature with its minimum required version
   */
  registerFeature(feature: string, minVersion: APIVersion): void {
    this.featureFlags.set(feature, minVersion);
    logger.debug(`Feature "${feature}" registered with min version ${versionToString(minVersion)}`);
  }

  /**
   * Check if a feature is available in current version
   */
  isFeatureAvailable(feature: string): boolean {
    const minVersion = this.featureFlags.get(feature);
    if (!minVersion) {
      return true; // Feature not versioned, assume available
    }
    return isVersionSupported(this.config.current, minVersion);
  }

  /**
   * Get version info including deprecation status
   */
  getVersionInfo(version?: APIVersion): VersionInfo {
    const targetVersion = version || this.config.current;
    const isDeprecated = this.isVersionDeprecated(targetVersion);
    const sunsetDate = this.getSunsetDate(targetVersion);

    return {
      version: targetVersion,
      deprecated: isDeprecated,
      sunsetDate,
      features: this.getFeaturesForVersion(targetVersion),
    };
  }

  /**
   * Get headers for API requests
   */
  getVersionHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    for (const [key, value] of this.versionHeaders.entries()) {
      headers[key] = value;
    }
    
    return headers;
  }

  /**
   * Set custom version header
   */
  setVersionHeader(key: string, value: string): void {
    this.versionHeaders.set(key, value);
  }

  /**
   * Create versioned URL
   */
  createVersionedUrl(baseUrl: string, version?: APIVersion): string {
    const targetVersion = version || this.config.current;
    const versionPrefix = `v${targetVersion.major}`;
    
    // Handle URLs with existing version prefix
    const urlWithoutVersion = baseUrl.replace(/\/v\d+(\/|$)/, '/');
    
    // Add version prefix
    if (urlWithoutVersion.includes('?')) {
      const [path, query] = urlWithoutVersion.split('?');
      return `${path}${versionPrefix}/${query ? `?${query}` : ''}`;
    }
    
    return `${urlWithoutVersion.replace(/\/$/, '')}/${versionPrefix}`;
  }

  /**
   * Check if response indicates version mismatch
   */
  checkVersionMismatch(response: Response): {
    hasMismatch: boolean;
    serverVersion?: APIVersion;
    message?: string;
  } {
    const serverVersionHeader = response.headers.get('X-API-Version');
    const deprecationHeader = response.headers.get('X-API-Deprecated');
    const sunsetHeader = response.headers.get('X-API-Sunset');

    if (!serverVersionHeader) {
      return { hasMismatch: false };
    }

    try {
      const serverVersion = parseVersion(serverVersionHeader);
      const comparison = compareVersions(this.config.current, serverVersion);

      if (comparison !== 0) {
        return {
          hasMismatch: true,
          serverVersion,
          message: comparison < 0
            ? `Client version ${versionToString(this.config.current)} is behind server ${versionToString(serverVersion)}`
            : `Client version ${versionToString(this.config.current)} is ahead of server ${versionToString(serverVersion)}`,
        };
      }

      if (deprecationHeader === 'true' && sunsetHeader) {
        logger.warn(`API version is deprecated. Sunset date: ${sunsetHeader}`);
      }

      return { hasMismatch: false, serverVersion };
    } catch (error: unknown) {
      logger.error('Failed to parse server version header:', error);
      return { hasMismatch: false };
    }
  }

  /**
   * Negotiate version with server
   */
  negotiateVersion(
    serverVersions: string[],
    preferStable = true
  ): APIVersion | null {
    if (serverVersions.length === 0) {
      return null;
    }

    const parsedVersions = serverVersions
      .map(v => {
        try {
          return parseVersion(v);
        } catch {
          return null;
        }
      })
      .filter((v): v is APIVersion => v !== null);

    if (parsedVersions.length === 0) {
      return null;
    }

    // Sort versions
    parsedVersions.sort(compareVersions);

    // Filter by minimum version
    const supportedVersions = parsedVersions.filter(
      v => isVersionSupported(v, this.config.minimum)
    );

    if (supportedVersions.length === 0) {
      logger.warn('No supported versions available from server');
      return null;
    }

    // Find best match
    if (preferStable) {
      // Find closest version to current
      let bestMatch = supportedVersions[0];
      let bestDiff = Math.abs(compareVersions(bestMatch, this.config.current));

      for (const version of supportedVersions) {
        const diff = Math.abs(compareVersions(version, this.config.current));
        if (diff < bestDiff) {
          bestDiff = diff;
          bestMatch = version;
        }
      }

      return bestMatch;
    }

    // Return latest version
    return supportedVersions[supportedVersions.length - 1] || null;
  }

  // ============= Private Methods =============

  private initializeVersionHeaders(): void {
    this.versionHeaders.set('X-API-Version', versionToString(this.config.current));
    this.versionHeaders.set('Accept-Version', versionToString(this.config.current));
  }

  private isVersionDeprecated(version: APIVersion): boolean {
    if (!this.config.deprecated) {
      return false;
    }

    return this.config.deprecated.some(
      deprecated => compareVersions(version, deprecated) === 0
    );
  }

  private getSunsetDate(version: APIVersion): Date | undefined {
    if (!this.config.sunset) {
      return undefined;
    }

    const versionStr = versionToString(version);
    return this.config.sunset.get(versionStr);
  }

  private getFeaturesForVersion(version: APIVersion): string[] {
    const features: string[] = [];

    for (const [feature, minVersion] of this.featureFlags.entries()) {
      if (isVersionSupported(version, minVersion)) {
        features.push(feature);
      }
    }

    return features;
  }
}

// ============= Export Singleton Instance =============

export const apiVersionManager = APIVersionManager.getInstance();

// ============= Convenience Functions =============

/**
 * Get current API version string
 */
export const getAPIVersion = (): string => 
  versionToString(apiVersionManager.getCurrentVersion());

/**
 * Check if feature is available
 */
export const isFeatureAvailable = (feature: string): boolean =>
  apiVersionManager.isFeatureAvailable(feature);

/**
 * Get version headers for requests
 */
export const getVersionHeaders = (): Record<string, string> =>
  apiVersionManager.getVersionHeaders();

/**
 * Create versioned URL
 */
export const createVersionedUrl = (baseUrl: string, version?: APIVersion): string =>
  apiVersionManager.createVersionedUrl(baseUrl, version);

// ============= Default Features =============

/**
 * Register default features with their version requirements
 */
export const registerDefaultFeatures = (): void => {
  apiVersionManager.registerFeature('streaming', { major: 1, minor: 1, patch: 0 });
  apiVersionManager.registerFeature('batch-operations', { major: 1, minor: 2, patch: 0 });
  apiVersionManager.registerFeature('webhooks', { major: 1, minor: 3, patch: 0 });
  apiVersionManager.registerFeature('analytics', { major: 1, minor: 0, patch: 0 });
  apiVersionManager.registerFeature('rate-limit-info', { major: 1, minor: 1, patch: 0 });
};

// Initialize default features
registerDefaultFeatures();
