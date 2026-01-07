import { Robot } from '../types';

export interface RobotIndex {
  byId: Map<string, Robot>;
  byName: Map<string, Robot[]>;
  byType: Map<string, Robot[]>;
  byDate: Robot[];
}

export class RobotIndexManager {
  private index: RobotIndex | null = null;
  private lastDataVersion: string = '';
  private currentDataVersion: string = '';

  private getDataVersion(robots: Robot[]): string {
    return robots.map(r => `${r.id}:${r.updated_at}`).join('|');
  }

  createIndex(robots: Robot[]): RobotIndex {
    const byId = new Map<string, Robot>();
    const byName = new Map<string, Robot[]>();
    const byType = new Map<string, Robot[]>();
    
    const byDate = [...robots].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    for (const robot of robots) {
      byId.set(robot.id, robot);
      
      const nameKey = robot.name.toLowerCase();
      if (!byName.has(nameKey)) {
        byName.set(nameKey, []);
      }
      byName.get(nameKey)!.push(robot);
      
      const typeKey = robot.strategy_type || 'Custom';
      if (!byType.has(typeKey)) {
        byType.set(typeKey, []);
      }
      byType.get(typeKey)!.push(robot);
    }
    
    return { byId, byName, byType, byDate };
  }

  getIndex(robots: Robot[]): RobotIndex {
    this.currentDataVersion = this.getDataVersion(robots);
    
    if (!this.index || this.lastDataVersion !== this.currentDataVersion) {
      this.index = this.createIndex(robots);
      this.lastDataVersion = this.currentDataVersion;
    }
    return this.index;
  }

  clear() {
    this.index = null;
    this.lastDataVersion = '';
    this.currentDataVersion = '';
  }
}

export const robotIndexManager = new RobotIndexManager();
