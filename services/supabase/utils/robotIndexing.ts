// Robot indexing and search utilities

import { Robot } from '../../../types';

export interface RobotIndex {
  id: string;
  name: string;
  strategy: string;
  timeframe: string;
  lastModified: number;
  keywords: string[];
}

export class RobotIndexManager {
  private index: RobotIndex[] = [];
  private keywordIndex: Map<string, string[]> = new Map();

  getIndex(robots: Robot[]): RobotIndex[] {
    this.index = robots.map(robot => ({
      id: robot.id || this.generateId(),
      name: robot.name.toLowerCase(),
      strategy: (robot.strategy_params as any)?.strategy || 'unknown',
      timeframe: (robot.strategy_params as any)?.timeframe || 'unknown',
      lastModified: this.convertToTimestamp(robot.updated_at),
      keywords: this.extractKeywords(robot)
    }));

    this.buildKeywordIndex();
    return this.index;
  }

  private convertToTimestamp(date: string | number | undefined): number {
    if (typeof date === 'number') return date;
    if (typeof date === 'string') return new Date(date).getTime();
    return Date.now();
  }

  private extractKeywords(robot: Robot): string[] {
    const keywords: string[] = [];
    
    // Extract from name
    keywords.push(...robot.name.toLowerCase().split(/\s+/));
    
    // Extract from strategy parameters
    if (robot.strategy_params) {
      Object.values(robot.strategy_params).forEach(value => {
        if (typeof value === 'string') {
          keywords.push(...value.toLowerCase().split(/\s+/));
        }
      });
    }
    
    // Extract from code
    if (robot.code) {
      const codeWords = robot.code.toLowerCase().match(/\b[a-z_][a-z0-9_]*\b/g) || [];
      keywords.push(...codeWords);
    }
    
    // Filter common keywords and deduplicate
    const commonWords = new Set(['the', 'and', 'or', 'if', 'else', 'for', 'while', 'function', 'void']);
    return [...new Set(keywords.filter(word => word.length > 2 && !commonWords.has(word)))];
  }

  private buildKeywordIndex(): void {
    this.keywordIndex.clear();
    
    this.index.forEach(robot => {
      robot.keywords.forEach(keyword => {
        if (!this.keywordIndex.has(keyword)) {
          this.keywordIndex.set(keyword, []);
        }
        this.keywordIndex.get(keyword)!.push(robot.id);
      });
    });
  }

  search(query: string): string[] {
    const lowercaseQuery = query.toLowerCase();
    const terms = lowercaseQuery.split(/\s+/).filter(term => term.length > 0);
    
    if (terms.length === 0) return [];
    
    const scores = new Map<string, number>();
    
    terms.forEach(term => {
      const robotIds = this.keywordIndex.get(term) || [];
      robotIds.forEach(id => {
        scores.set(id, (scores.get(id) || 0) + 1);
      });
    });
    
    // Sort by score (most relevant first)
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, _]) => id);
  }

  filterByStrategy(strategy: string): string[] {
    return this.index
      .filter(robot => robot.strategy.includes(strategy.toLowerCase()))
      .map(robot => robot.id);
  }

  filterByTimeframe(timeframe: string): string[] {
    return this.index
      .filter(robot => robot.timeframe.includes(timeframe.toLowerCase()))
      .map(robot => robot.id);
  }

  getRobotById(id: string): RobotIndex | undefined {
    return this.index.find(robot => robot.id === id);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  clear(): void {
    this.index = [];
    this.keywordIndex.clear();
  }
}