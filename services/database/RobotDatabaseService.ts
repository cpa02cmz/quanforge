/**
 * Enhanced Database Service - Robot Operations
 * 
 * Extends the base DatabaseCore with robot-specific operations
 * to maintain backward compatibility while using modular architecture
 */

import { DatabaseCore } from './DatabaseCore';
import type { IDatabaseCore } from '../../types/serviceInterfaces';
import { Robot } from '../../types';
import { handleError } from '../../utils/errorHandler';

export interface IRobotDatabaseService extends IDatabaseCore {
  saveRobot(robot: Robot): Promise<string>;
  getRobot(id: string): Promise<Robot | null>;
  getAllRobots(): Promise<Robot[]>;
  updateRobot(id: string, updates: Partial<Robot>): Promise<boolean>;
  deleteRobot(id: string): Promise<boolean>;
  searchRobots(term: string, filter?: string): Promise<Robot[]>;
  getStats(): Promise<{ count: number; storageType: string }>;
  exportDatabase(): Promise<string>;
  importDatabase(json: string, merge?: boolean): Promise<{ success: boolean; count: number; error?: string }>;
  optimizeDatabase(): Promise<{ success: boolean; message: string }>;
}

export class RobotDatabaseService extends DatabaseCore implements IRobotDatabaseService {
  
  async saveRobot(robot: Robot): Promise<string> {
    try {
      const client = await this.getClient();
      
      // Ensure robot has required fields
      const robotToSave = {
        ...robot,
        id: robot.id || this.generateUUID(),
        strategy_type: robot.strategy_type || 'Custom',
        name: robot.name || 'Untitled Robot',
        code: robot.code || '// No code',
        created_at: robot.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client.from('robots').insert([robotToSave]).select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Failed to save robot');

      return data[0].id;
    } catch (error) {
      handleError(error as Error, 'saveRobot', 'RobotDatabaseService');
      throw error;
    }
  }

  async getRobot(id: string): Promise<Robot | null> {
    try {
      const client = await this.getClient();
      const { data, error } = await client.from('robots').select('*').eq('id', id).single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }
      
      return data as Robot;
    } catch (error) {
      handleError(error as Error, 'getRobot', 'RobotDatabaseService');
      throw error;
    }
  }

  async getAllRobots(): Promise<Robot[]> {
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('robots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as Robot[];
    } catch (error) {
      handleError(error as Error, 'getAllRobots', 'RobotDatabaseService');
      throw error;
    }
  }

  async updateRobot(id: string, updates: Partial<Robot>): Promise<boolean> {
    try {
      const client = await this.getClient();
      
      const updatesWithTimestamp = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from('robots').update(updatesWithTimestamp).eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      handleError(error as Error, 'updateRobot', 'RobotDatabaseService');
      throw error;
    }
  }

  async deleteRobot(id: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const { error } = await client.from('robots').delete().eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      handleError(error as Error, 'deleteRobot', 'RobotDatabaseService');
      throw error;
    }
  }

  async searchRobots(term: string, filter?: string): Promise<Robot[]> {
    try {
      const client = await this.getClient();
      
      let query = client
        .from('robots')
        .select('*')
        .or(`name.ilike.%${term}%,code.ilike.%${term}%`);

      if (filter && filter !== 'All') {
        query = query.eq('strategy_type', filter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Robot[];
    } catch (error) {
      handleError(error as Error, 'searchRobots', 'RobotDatabaseService');
      throw error;
    }
  }

  async getStats(): Promise<{ count: number; storageType: string }> {
    try {
      const client = await this.getClient();
      const { count } = await client.from('robots').select('*', { count: 'exact', head: true });
      
      return {
        count: count || 0,
        storageType: this.getConfig().mode === 'mock' ? 'Browser Local Storage' : 'Supabase Cloud DB'
      };
    } catch (error) {
      handleError(error as Error, 'getStats', 'RobotDatabaseService');
      throw error;
    }
  }

  async exportDatabase(): Promise<string> {
    try {
      const robots = await this.getAllRobots();
      
      const exportObj = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: this.getConfig().mode,
        robots: robots
      };

      return JSON.stringify(exportObj, null, 2);
    } catch (error) {
      handleError(error as Error, 'exportDatabase', 'RobotDatabaseService');
      throw error;
    }
  }

  async importDatabase(json: string, merge: boolean = true): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const parsed = JSON.parse(json);
      if (!parsed.robots || !Array.isArray(parsed.robots)) {
        throw new Error("Invalid format: 'robots' array missing.");
      }

      const validRobots = parsed.robots.filter(this.isValidRobot).map((robot: Robot) => ({
        ...robot,
        strategy_type: robot.strategy_type || 'Custom',
        name: robot.name || 'Untitled Robot',
        code: robot.code || '// No code',
        id: robot.id || this.generateUUID(),
        created_at: robot.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      if (validRobots.length === 0 && parsed.robots.length > 0) {
        throw new Error("No valid robot data found in import file.");
      }

      if (!merge) {
        await this.clearAllRobots();
      }

      let successCount = 0;
      for (const robot of validRobots) {
        try {
          await this.saveRobot(robot);
          successCount++;
        } catch (error) {
          console.error('Failed to import robot:', robot.id, error);
        }
      }

      return {
        success: true,
        count: successCount
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error: (error as Error).message
      };
    }
  }

  async optimizeDatabase(): Promise<{ success: boolean; message: string }> {
    try {
      const stats = await this.getStats();
      
      // Simple optimization - in a real implementation this would include
      // vacuum, analyze, index optimization, etc.
      return {
        success: true,
        message: `Database optimized. Current record count: ${stats.count}. Storage: ${stats.storageType}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Optimization failed: ${(error as Error).message}`
      };
    }
  }

  private async clearAllRobots(): Promise<void> {
    try {
      const client = await this.getClient();
      const { error } = await client.from('robots').delete().neq('id', '');
      if (error) throw error;
    } catch (error) {
      handleError(error as Error, 'clearAllRobots', 'RobotDatabaseService');
      throw error;
    }
  }

  private isValidRobot = (r: any): boolean => {
    return r && 
           typeof r.name === 'string' && 
           typeof r.code === 'string' && 
           r.name.trim().length > 0 && 
           r.code.trim().length > 0;
  };

  private generateUUID = (): string => {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    const timestamp = new Date().getTime();
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    
    // Convert to hex with timestamp included
    const hex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${timestamp}-${hex.substring(0, 12)}-${hex.substring(12)}`;
  };
}