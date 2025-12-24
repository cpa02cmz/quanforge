// CSRF Protection Utilities
// Cross-Site Request Forgery prevention system

// Generate cryptographically secure random token
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32); // 256-bit token
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Store CSRF token in session storage (more secure than localStorage)
export const storeCSRFToken = (token: string): void => {
  try {
    sessionStorage.setItem('csrf_token', token);
  } catch (e) {
    console.warn('Failed to store CSRF token:', e);
  }
};

// Get stored CSRF token
export const getCSRFToken = (): string | null => {
  try {
    return sessionStorage.getItem('csrf_token');
  } catch (e) {
    console.warn('Failed to retrieve CSRF token:', e);
    return null;
  }
};

// Generate and store new CSRF token
export const createCSRFToken = (): string => {
  const token = generateCSRFToken();
  storeCSRFToken(token);
  return token;
};

// Validate CSRF token against stored value
export const validateCSRFToken = (providedToken: string): boolean => {
  const storedToken = getCSRFToken();
  if (!storedToken || !providedToken) {
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  return constantTimeCompare(storedToken, providedToken);
};

// Constant-time string comparison to prevent timing attacks
export const constantTimeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
};

// Add CSRF token to request headers
export const addCSRFToHeaders = (headers: Record<string, string> = {}): Record<string, string> => {
  const token = getCSRFToken();
  if (token) {
    headers['X-CSRF-Token'] = token;
  }
  return headers;
};

// CSRF middleware for API calls
export const csrfFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  // Merge existing headers, ensuring they're strings
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers[key] = String(value);
    });
  }
  
  // Add CSRF token to the request
  addCSRFToHeaders(headers);
  
  return fetch(url, {
    ...options,
    headers
  });
};

// Initialize CSRF token on page load
export const initializeCSRFProtection = (): string => {
  let token = getCSRFToken();
  
  // Generate new token if none exists
  if (!token) {
    token = createCSRFToken();
  }
  
  return token;
};

// Meta tag-based CSRF token (for server-rendered pages)
export const getCSRFTokenFromMeta = (): string | null => {
  const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
  return meta?.content || null;
};

// Form-based CSRF token injection
export const injectCSRFIntoForm = (form: HTMLFormElement): void => {
  let tokenInput = form.querySelector('input[name="csrf_token"]') as HTMLInputElement;
  
  if (!tokenInput) {
    tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'csrf_token';
    form.appendChild(tokenInput);
  }
  
  tokenInput.value = getCSRFToken() || '';
};

// Auto-inject CSRF tokens into all forms
export const autoInjectCSRF = (): void => {
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    injectCSRFIntoForm(form);
  });
};

// CSRF error handling
export class CSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CSRFError';
  }
}

// Validate token from request headers or body
export const validateCSRFFromRequest = (request: Request): boolean => {
  // Try to get token from header
  const headerToken = request.headers.get('X-CSRF-Token');
  if (headerToken && validateCSRFToken(headerToken)) {
    return true;
  }
  
  // If no header, try to get from body (for form submissions)
  // This would require parsing the request body in the API route
  return false;
};

// Refresh CSRF token (useful after authentication changes)
export const refreshCSRFToken = (): string => {
  return createCSRFToken();
};

// Clean up expired tokens (session-based cleanup)
export const cleanupCSRF = (): void => {
  try {
    sessionStorage.removeItem('csrf_token');
  } catch (e) {
    console.warn('Failed to cleanup CSRF token:', e);
  }
};