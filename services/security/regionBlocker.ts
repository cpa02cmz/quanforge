import { SecurityConfig } from './types';

export interface RegionInfo {
  country: string;
  region: string;
  isBlocked: boolean;
}

export class RegionBlocker {
  private config: SecurityConfig['regionBlocking'];

  constructor(config: SecurityConfig['regionBlocking']) {
    this.config = config;
  }

  isRegionBlocked(regionCode: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    return this.config.blockedRegions.includes(regionCode.toUpperCase());
  }

  analyzeIP(ip: string): { country?: string; region?: string; isBlocked: boolean } {
    if (!this.config.enabled) {
      return { isBlocked: false };
    }

    // In a real implementation, you would use a GeoIP database
    // For now, we'll provide a basic structure
    const geoInfo = this.getGeoInfoFromIP(ip);
    
    return {
      country: geoInfo?.country,
      region: geoInfo?.region,
      isBlocked: geoInfo ? this.isRegionBlocked(geoInfo.country) : false
    };
  }

  private getGeoInfoFromIP(ip: string): { country: string; region: string } | null {
    // Placeholder implementation
    // In production, integrate with a GeoIP service like MaxMind, IPinfo, etc.
    
    // Basic IP validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      return null;
    }

    // For demonstration, return dummy data
    // Replace with actual GeoIP lookup
    return {
      country: 'US',
      region: 'California'
    };
  }

  shouldBlockRequest(requestData: {
    ip?: string;
    countryCode?: string;
    forwardedFor?: string;
  }): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const ip = requestData.ip || requestData.forwardedFor?.split(',')[0]?.trim();
    const countryCode = requestData.countryCode;

    if (countryCode) {
      return this.isRegionBlocked(countryCode);
    }

    if (ip) {
      const analysis = this.analyzeIP(ip);
      return analysis.isBlocked;
    }

    return false;
  }

  getBlockedRegions(): string[] {
    return [...this.config.blockedRegions];
  }

  addBlockedRegion(regionCode: string): void {
    const normalizedCode = regionCode.toUpperCase();
    if (!this.config.blockedRegions.includes(normalizedCode)) {
      this.config.blockedRegions.push(normalizedCode);
    }
  }

  removeBlockedRegion(regionCode: string): void {
    const normalizedCode = regionCode.toUpperCase();
    const index = this.config.blockedRegions.indexOf(normalizedCode);
    if (index > -1) {
      this.config.blockedRegions.splice(index, 1);
    }
  }

  updateBlockedRegions(regions: string[]): void {
    this.config.blockedRegions = regions.map(r => r.toUpperCase()).filter(r => r.length === 2);
  }
}