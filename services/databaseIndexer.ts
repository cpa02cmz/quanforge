/**
 * Database Indexer Service
 * Provides optimized search and indexing for the QuantForge database
 */

import { Robot } from '../types';

// In-memory indexes for efficient search and filtering
interface DatabaseIndexes {
  byId: Map<string, Robot>;
  byName: Map<string, Robot[]>;
  byStrategyType: Map<string, Robot[]>;
  byDate: Robot[]; // Sorted by creation date
  searchIndex: Map<string, Robot[]>; // For full-text search
}

class DatabaseIndexer {
  private indexes: DatabaseIndexes;

  constructor() {
    this.indexes = {
      byId: new Map(),
      byName: new Map(),
      byStrategyType: new Map(),
      byDate: [],
      searchIndex: new Map()
    };
  }

  /**
   * Initialize indexes with the current robot data
   */
  public initialize(robots: Robot[]): void {
    // Clear existing indexes
    this.indexes.byId.clear();
    this.indexes.byName.clear();
    this.indexes.byStrategyType.clear();
    this.indexes.searchIndex.clear();
    
    // Rebuild indexes
    this.indexes.byDate = [...robots].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    robots.forEach(robot => {
      // Index by ID
      this.indexes.byId.set(robot.id, robot);

      // Index by name (case-insensitive)
      const normalizedName = robot.name.toLowerCase();
      if (!this.indexes.byName.has(normalizedName)) {
        this.indexes.byName.set(normalizedName, []);
      }
      this.indexes.byName.get(normalizedName)!.push(robot);

      // Index by strategy type
      const strategyType = robot.strategy_type || 'Custom';
      if (!this.indexes.byStrategyType.has(strategyType)) {
        this.indexes.byStrategyType.set(strategyType, []);
      }
      this.indexes.byStrategyType.get(strategyType)!.push(robot);

      // Build search index (tokenize name and description)
      this.addToSearchIndex(robot);
    });
  }

  /**
   * Add a robot to all indexes
   */
  public addRobot(robot: Robot): void {
    // Add to ID index
    this.indexes.byId.set(robot.id, robot);

    // Add to name index
    const normalizedName = robot.name.toLowerCase();
    if (!this.indexes.byName.has(normalizedName)) {
      this.indexes.byName.set(normalizedName, []);
    }
    this.indexes.byName.get(normalizedName)!.push(robot);

    // Add to strategy type index
    const strategyType = robot.strategy_type || 'Custom';
    if (!this.indexes.byStrategyType.has(strategyType)) {
      this.indexes.byStrategyType.set(strategyType, []);
    }
    this.indexes.byStrategyType.get(strategyType)!.push(robot);

    // Add to date-sorted list and re-sort (inefficient for large datasets, but suitable for browser storage)
    this.indexes.byDate = [...this.indexes.byDate, robot].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Add to search index
    this.addToSearchIndex(robot);
  }

  /**
   * Remove a robot from all indexes
   */
  public removeRobot(robotId: string): boolean {
    const robot = this.indexes.byId.get(robotId);
    if (!robot) return false;

    // Remove from ID index
    this.indexes.byId.delete(robotId);

    // Remove from name index
    const normalizedName = robot.name.toLowerCase();
    const nameList = this.indexes.byName.get(normalizedName) || [];
    const updatedNameList = nameList.filter(r => r.id !== robotId);
    if (updatedNameList.length === 0) {
      this.indexes.byName.delete(normalizedName);
    } else {
      this.indexes.byName.set(normalizedName, updatedNameList);
    }

    // Remove from strategy type index
    const strategyType = robot.strategy_type || 'Custom';
    const typeList = this.indexes.byStrategyType.get(strategyType) || [];
    const updatedTypeList = typeList.filter(r => r.id !== robotId);
    if (updatedTypeList.length === 0) {
      this.indexes.byStrategyType.delete(strategyType);
    } else {
      this.indexes.byStrategyType.set(strategyType, updatedTypeList);
    }

    // Remove from date-sorted list
    this.indexes.byDate = this.indexes.byDate.filter(r => r.id !== robotId);

    // Remove from search index
    this.removeFromSearchIndex(robot);

    return true;
  }

  /**
   * Update a robot in all indexes
   */
  public updateRobot(robotId: string, updates: Partial<Robot>): boolean {
    const robot = this.indexes.byId.get(robotId);
    if (!robot) return false;

    // Store old values for index updates
    const oldName = robot.name.toLowerCase();
    const oldStrategyType = robot.strategy_type || 'Custom';

    // Update the robot
    Object.assign(robot, updates);

    // If name changed, update name index
    const newName = robot.name.toLowerCase();
    if (oldName !== newName) {
      // Remove from old name index
      const oldNameList = this.indexes.byName.get(oldName) || [];
      const updatedOldNameList = oldNameList.filter(r => r.id !== robotId);
      if (updatedOldNameList.length === 0) {
        this.indexes.byName.delete(oldName);
      } else {
        this.indexes.byName.set(oldName, updatedOldNameList);
      }

      // Add to new name index
      if (!this.indexes.byName.has(newName)) {
        this.indexes.byName.set(newName, []);
      }
      this.indexes.byName.get(newName)!.push(robot);
    }

    // If strategy type changed, update strategy type index
    const newStrategyType = robot.strategy_type || 'Custom';
    if (oldStrategyType !== newStrategyType) {
      // Remove from old strategy type index
      const oldTypeList = this.indexes.byStrategyType.get(oldStrategyType) || [];
      const updatedOldTypeList = oldTypeList.filter(r => r.id !== robotId);
      if (updatedOldTypeList.length === 0) {
        this.indexes.byStrategyType.delete(oldStrategyType);
      } else {
        this.indexes.byStrategyType.set(oldStrategyType, updatedOldTypeList);
      }

      // Add to new strategy type index
      if (!this.indexes.byStrategyType.has(newStrategyType)) {
        this.indexes.byStrategyType.set(newStrategyType, []);
      }
      this.indexes.byStrategyType.get(newStrategyType)!.push(robot);
    }

    // Update date-sorted list (re-sort - not optimal but works for browser storage)
    this.indexes.byDate = [...this.indexes.byDate].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Update search index
    this.removeFromSearchIndex(robot);
    this.addToSearchIndex(robot);

    return true;
  }

  /**
   * Find robot by ID - O(1) lookup
   */
  public findById(id: string): Robot | undefined {
    return this.indexes.byId.get(id);
  }

  /**
   * Find robots by name - O(1) lookup
   */
  public findByName(name: string): Robot[] {
    return this.indexes.byName.get(name.toLowerCase()) || [];
  }

  /**
   * Find robots by strategy type - O(1) lookup
   */
  public findByStrategyType(strategyType: string): Robot[] {
    return this.indexes.byStrategyType.get(strategyType) || [];
  }

  /**
   * Get all robots sorted by date - O(1) lookup
   */
  public getAllSortedByDate(): Robot[] {
    return this.indexes.byDate;
  }

  /**
   * Full-text search across name and description
   */
   public search(query: string): Robot[] {
     if (!query || query.trim().length === 0) {
       return this.getAllSortedByDate();
     }

     const searchTerm = query.toLowerCase().trim();
     const results = new Set<Robot>();

     // Split search term into individual words for multi-token search
     const searchTerms = searchTerm.split(/\s+/).filter(term => term.length > 0);

     // Search for each term
     for (const term of searchTerms) {
       // Search in cached results first
       const cachedResults = this.indexes.searchIndex.get(term);
       if (cachedResults) {
         cachedResults.forEach(robot => results.add(robot));
       } else {
         // Perform search if not cached
         const allRobots = this.getAllSortedByDate();
         allRobots.forEach(robot => {
           if (
             robot.name.toLowerCase().includes(term) ||
             robot.description.toLowerCase().includes(term) ||
             (robot.strategy_type && robot.strategy_type.toLowerCase().includes(term))
           ) {
             results.add(robot);
           }
         });
       }
     }

     return Array.from(results);
   }

  /**
   * Add robot to search index
   */
  private addToSearchIndex(robot: Robot): void {
    // Tokenize the robot's name and description for search
    const tokens = new Set<string>();
    
    // Add name tokens
    robot.name.toLowerCase().split(/\s+/).forEach(token => {
      if (token.length > 2) { // Only index tokens longer than 2 characters
        tokens.add(token);
      }
    });
    
    // Add description tokens
    if (robot.description) {
      robot.description.toLowerCase().split(/\s+/).forEach(token => {
        if (token.length > 2) {
          tokens.add(token);
        }
      });
    }
    
    // Add strategy type tokens
    if (robot.strategy_type) {
      robot.strategy_type.toLowerCase().split(/\s+/).forEach(token => {
        if (token.length > 2) {
          tokens.add(token);
        }
      });
    }
    
    // Add tokens to search index
    tokens.forEach(token => {
      if (!this.indexes.searchIndex.has(token)) {
        this.indexes.searchIndex.set(token, []);
      }
      this.indexes.searchIndex.get(token)!.push(robot);
    });
  }

  /**
   * Remove robot from search index
   */
  private removeFromSearchIndex(robot: Robot): void {
    // Remove robot from all token indexes
    const allTokens = Array.from(this.indexes.searchIndex.keys());
    
    allTokens.forEach(token => {
      const tokenList = this.indexes.searchIndex.get(token) || [];
      const updatedList = tokenList.filter(r => r.id !== robot.id);
      
      if (updatedList.length === 0) {
        this.indexes.searchIndex.delete(token);
      } else {
        this.indexes.searchIndex.set(token, updatedList);
      }
    });
  }

  /**
   * Get statistics about the indexes
   */
  public getStats(): { 
    totalRobots: number; 
    indexTypes: { [key: string]: number };
    searchIndexSize: number;
  } {
    return {
      totalRobots: this.indexes.byId.size,
      indexTypes: {
        byId: this.indexes.byId.size,
        byName: this.indexes.byName.size,
        byStrategyType: this.indexes.byStrategyType.size,
        byDate: this.indexes.byDate.length,
      },
      searchIndexSize: this.indexes.searchIndex.size
    };
  }
}

// Singleton instance
export const databaseIndexer = new DatabaseIndexer();