/**
 * Version Control Service Index
 * 
 * Central export point for version control functionality
 */

export * from './types';
export * from './versionControlService';

// Testing utilities (not for production use)
export { __resetVersionStore } from './versionControlService';
