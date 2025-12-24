/**
 * Mock session management
 * Extracted from monolithic supabase.ts for better modularity
 */

import type { UserSession } from '../../types';
import { STORAGE_KEYS } from '../core/databaseConfig';
import { safeParse } from '../utils/helpers';

/**
 * Get mock session from localStorage or return null
 */
export const getMockSession = (): UserSession | null => {
  return safeParse(localStorage.getItem(STORAGE_KEYS.SESSION), null);
};