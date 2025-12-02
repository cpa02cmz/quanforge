/**
 * Utility functions for API key management and rotation
 */

/**
 * Helper to handle Key Rotation.
 * Parses the apiKey string (which might contain multiple keys separated by newlines or commas)
 * and returns a single random key.
 */
export const getActiveKey = (apiKeyString: string): string => {
    if (!apiKeyString) return "";
    
    // Split by newline or comma, trim whitespace, and filter empty strings
    const keys = apiKeyString.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
    
    if (keys.length === 0) return "";
    
    // Pick a random key
    const randomIndex = Math.floor(Math.random() * keys.length);
    return keys[randomIndex] || "";
};

/**
 * Validates if an API key string is properly formatted
 */
export const validateApiKeyString = (apiKeyString: string): { isValid: boolean; keys: string[] } => {
    if (!apiKeyString || !apiKeyString.trim()) {
        return { isValid: false, keys: [] };
    }
    
    const keys = apiKeyString.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
    
    return {
        isValid: keys.length > 0,
        keys
    };
};