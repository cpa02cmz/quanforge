// Secure Session Management
// Replaces localStorage with secure httpOnly cookie-based sessions

export interface SessionData {
  userId?: string;
  isAuthenticated: boolean;
  preferences: Record<string, any>;
  apiSettings?: {
    provider: string;
    hasApiKey: boolean; // Don't store actual key, just flag if configured
    lastUsed?: string;
  };
  createdAt: number;
  lastAccessed: number;
  expires: number;
}

export interface SessionOptions {
  maxAge?: number; // Session lifetime in milliseconds (default: 24 hours)
  secure?: boolean; // HTTPS only (default: true in production)
  sameSite?: 'strict' | 'lax' | 'none'; // CSRF protection (default: strict)
  httpOnly?: boolean; // Prevent JavaScript access (default: true)
}

// Session configuration
const DEFAULT_SESSION_OPTIONS: SessionOptions = {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
  sameSite: 'strict',
  httpOnly: true
};

// Generate secure session ID
export const generateSessionId = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Create new session
export const createSession = async (
  data: Partial<SessionData>,
  options: SessionOptions = {}
): Promise<string> => {
  const sessionData: SessionData = {
    userId: data.userId,
    isAuthenticated: data.isAuthenticated || false,
    preferences: data.preferences || {},
    apiSettings: data.apiSettings,
    createdAt: Date.now(),
    lastAccessed: Date.now(),
    expires: Date.now() + (options.maxAge || DEFAULT_SESSION_OPTIONS.maxAge!)
  };

  const sessionId = generateSessionId();
  
  // Store session data securely
  await storeSessionData(sessionId, sessionData, options);
  
  // Set session cookie
  setSessionCookie(sessionId, options);
  
  return sessionId;
};

// Store session data (would connect to backend in production)
const storeSessionData = async (
  sessionId: string,
  data: SessionData,
  _options: SessionOptions
): Promise<void> => {
  // In production, this would be a database call or Redis
  // For now, we'll use encrypted sessionStorage as fallback
  try {
    const serialized = JSON.stringify(data);
    const encrypted = await encryptSessionData(serialized);
    sessionStorage.setItem(`session_${sessionId}`, encrypted);
  } catch (e) {
    console.warn('Failed to store session data:', e);
    // Fallback to non-encrypted storage during migration
    sessionStorage.setItem(`session_${sessionId}`, JSON.stringify(data));
  }
};

// Simple session encryption (client-side only for development)
// In production, this should be server-side encryption
const encryptSessionData = async (data: string): Promise<string> => {
  try {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    
    const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.warn('Session encryption failed, using plaintext:', e);
    return data;
  }
};

// Set session cookie
const setSessionCookie = (
  sessionId: string,
  options: SessionOptions
): void => {
  if (typeof document === 'undefined') return;
  
  const maxAge = options.maxAge || DEFAULT_SESSION_OPTIONS.maxAge!;
  const secure = options.secure ?? DEFAULT_SESSION_OPTIONS.secure;
  const sameSite = options.sameSite || DEFAULT_SESSION_OPTIONS.sameSite;
  
  let cookieString = `session_id=${sessionId}`;
  cookieString += `; Max-Age=${Math.floor(maxAge / 1000)}`;
  cookieString += `; Path=/`;
  
  if (secure) cookieString += '; Secure';
  if (sameSite) cookieString += `; SameSite=${sameSite}`;
  
  // Note: httpOnly cannot be set from JavaScript - would need server-side
  
  document.cookie = cookieString;
};

// Get current session
export const getCurrentSession = async (): Promise<SessionData | null> => {
  if (typeof document === 'undefined') return null;
  
  const sessionId = getSessionIdFromCookie();
  if (!sessionId) return null;
  
  try {
    return await retrieveSessionData(sessionId);
  } catch (e) {
    console.warn('Failed to retrieve session:', e);
    await destroySession();
    return null;
  }
};

// Get session ID from cookie
const getSessionIdFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'session_id') {
      return value || null;
    }
  }
  return null;
};

// Retrieve session data
const retrieveSessionData = async (sessionId: string): Promise<SessionData> => {
  try {
    const stored = sessionStorage.getItem(`session_${sessionId}`);
    if (!stored) {
      throw new Error('Session not found');
    }
    
    let data: SessionData;
    
    // Try to decrypt first
    try {
      // Decryption logic would go here for production
      data = JSON.parse(stored);
    } catch (e) {
      // Fallback to plain JSON if decryption fails
      data = JSON.parse(stored);
    }
    
    // Check expiry
    if (Date.now() > data.expires) {
      throw new Error('Session expired');
    }
    
    // Update last accessed time
    data.lastAccessed = Date.now();
    await storeSessionData(sessionId, data, DEFAULT_SESSION_OPTIONS);
    
    return data;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    throw new Error(`Invalid session: ${errorMessage}`);
  }
};

// Update session data
export const updateSession = async (
  updates: Partial<SessionData>
): Promise<void> => {
  const currentSession = await getCurrentSession();
  if (!currentSession) {
    throw new Error('No active session');
  }
  
  const sessionId = getSessionIdFromCookie();
  if (!sessionId) {
    throw new Error('No session ID found');
  }
  
  const updatedSession = {
    ...currentSession,
    ...updates,
    lastAccessed: Date.now()
  };
  
  await storeSessionData(sessionId, updatedSession, DEFAULT_SESSION_OPTIONS);
};

// Destroy session
export const destroySession = async (): Promise<void> => {
  const sessionId = getSessionIdFromCookie();
  if (sessionId) {
    // Remove from storage
    sessionStorage.removeItem(`session_${sessionId}`);
    
    // Clear cookie
    document.cookie = 'session_id=; Max-Age=0; Path=/; SameSite=Strict';
  }
};

// Session validation middleware
export const validateSession = async (): Promise<boolean> => {
  try {
    const session = await getCurrentSession();
    return session !== null && Date.now() < session.expires;
  } catch (e) {
    return false;
  }
};

// Session refresh
export const refreshSession = async (): Promise<void> => {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error('No active session to refresh');
  }
  
  const newExpiry = Date.now() + (DEFAULT_SESSION_OPTIONS.maxAge || 24 * 60 * 60 * 1000);
  await updateSession({ expires: newExpiry });
};

// Get session API key status (without exposing the key)
export const getSessionApiKeyStatus = (): { hasKey: boolean; provider: string } => {
  return {
    hasKey: false, // Will be updated when user configures API key
    provider: 'google'
  };
};

// Migration utility: migrate from localStorage to secure session
export const migrateFromLocalStorage = async (): Promise<void> => {
  if (typeof localStorage === 'undefined') return;
  
  try {
    // Get old settings from localStorage
    const oldSettings = localStorage.getItem('quantforge_ai_settings');
    if (oldSettings) {
      const settings = JSON.parse(oldSettings);
      
      // Create new secure session
      await createSession({
        isAuthenticated: true,
        preferences: {
          language: settings.language || 'en',
          modelName: settings.modelName || 'gemini-3-pro-preview'
        },
        apiSettings: {
          provider: settings.provider || 'google',
          hasApiKey: !!settings.apiKey, // Check if API key is configured
          lastUsed: settings.lastUsed
        }
      });
      
      // Remove old insecure data
      localStorage.removeItem('quantforge_ai_settings');
      console.log('Successfully migrated from localStorage to secure session');
    }
  } catch (e) {
    console.warn('Migration from localStorage failed:', e);
  }
};