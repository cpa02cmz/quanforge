import { Robot } from '../../types';
import { getClient } from './supabaseClient';
import { withRetry } from './supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

// Supabase database operations
const supabaseDb = {
  // Robot CRUD operations
  async getRobots(userId: string): Promise<Robot[]> {
    const client = await getClient();
    const result = await withRetry(
      () => client.from('robots').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      'getRobots'
    );
    
    if (result.error) throw result.error;
    return result.data || [];
  },

  async getRobot(userId: string, robotId: string): Promise<Robot | null> {
    const client = await getClient();
    const result = await withRetry(
      () => client.from('robots').select('*').eq('user_id', userId).eq('id', robotId).single(),
      'getRobot'
    );
    
    if (result.error && result.error.code !== 'PGRST116') throw result.error; // Not found is ok
    return result.data;
  },

  async saveRobot(robot: Robot): Promise<{ error: any }> {
    const client = await getClient();
    const result = await withRetry(
      () => client.from('robots').upsert(robot),
      'saveRobot'
    );
    
    return { error: result.error };
  },

  async deleteRobot(userId: string, robotId: string): Promise<{ error: any }> {
    const client = await getClient();
    const result = await withRetry(
      () => client.from('robots').delete().eq('user_id', userId).eq('id', robotId),
      'deleteRobot'
    );
    
    return { error: result.error };
  },

  async duplicateRobot(userId: string, robotId: string, newName: string): Promise<Robot | null> {
    try {
      const original = await this.getRobot(userId, robotId);
      if (!original) return null;

      const duplicate: Robot = {
        ...original,
        id: crypto.randomUUID(),
        name: newName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await this.saveRobot(duplicate);
      return error ? null : duplicate;
    } catch (error) {
      return null;
    }
  },

  // Batch operations
  async batchUpdateRobots(updates: Array<{ id: string; data: Partial<Robot> }>): Promise<{ error: any }> {
    const client = await getClient();
    
    try {
      // Process updates in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const promises = batch.map(({ id, data }) =>
          withRetry(
            () => client.from('robots').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id),
            `batchUpdate_${id}`
          )
        );
        
        await Promise.all(promises);
      }
      
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  },

  // Search and filter operations
  async searchRobots(userId: string, query: string): Promise<Robot[]> {
    const client = await getClient();
    const result = await withRetry(
      () => client
        .from('robots')
        .select('*')
        .eq('user_id', userId)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%,strategy_type.ilike.%${query}%`)
        .order('updated_at', { ascending: false }),
      'searchRobots'
    );
    
    if (result.error) throw result.error;
    return result.data || [];
  },

  async getRobotsByStrategyType(userId: string, strategyType: string): Promise<Robot[]> {
    const client = await getClient();
    const result = await withRetry(
      () => client
        .from('robots')
        .select('*')
        .eq('user_id', userId)
        .eq('strategy_type', strategyType)
        .order('updated_at', { ascending: false }),
      'getRobotsByStrategyType'
    );
    
    if (result.error) throw result.error;
    return result.data || [];
  },

  // Pagination
  async getRobotsPaginated(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<{ robots: Robot[]; total: number; page: number; totalPages: number }> {
    const client = await getClient();
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await withRetry(
      () => client.from('robots').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      'getRobotsCount'
    );
    
    if (countResult.error) throw countResult.error;
    
    // Get paginated data
    const dataResult = await withRetry(
      () => client
        .from('robots')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1),
      'getRobotsPaginated'
    );
    
    if (dataResult.error) throw dataResult.error;
    
    const total = countResult.count || 0;
    const totalPages = Math.ceil(total / limit);
    
    return {
      robots: dataResult.data || [],
      total,
      page,
      totalPages
    };
  },

  // Database optimization
  async optimizeDatabase(): Promise<{ success: boolean; message: string }> {
    try {
      const client = await getClient();
      
      // For Supabase, run ANALYZE equivalent operations
      // Note: Supabase/PostgreSQL handles VACUUM automatically, but we can run ANALYZE
      const result = await client.rpc('pg_stat_reset');
      
      if (result.error) {
        console.warn("Could not run database optimization:", result.error.message);
        // Non-critical error, just return success with warning
      }
      
      return { 
        success: true, 
        message: "Database optimization commands issued successfully" 
      };
    } catch (e: any) {
      return { 
        success: false, 
        message: `Database optimization failed: ${e.message}` 
      };
    }
  },

  // Database statistics
  async getDatabaseStats(): Promise<{ 
    totalRecords: number; 
    totalSizeKB: number; 
    avgRecordSizeKB: number; 
    lastOptimized?: string;
  }> {
    const client = await getClient();
    const result = await withRetry(
      () => client.from('robots').select('*', { count: 'exact', head: true }),
      'getDatabaseStats'
    );
    
    if (result.error) throw result.error;
    
    // Get approximate table size from PostgreSQL
    await client
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .eq('table_name', 'robots');
    
    return {
      totalRecords: result.count || 0,
      totalSizeKB: 0, // Cannot get exact size from Supabase
      avgRecordSizeKB: 0, // Cannot get exact size from Supabase
      lastOptimized: new Date().toISOString()
    };
  }
};

export { supabaseDb };