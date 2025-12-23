import { ErrorManager, ErrorCategory, ErrorSeverity } from './errorManager';

/**
 * Centralized API error handling utility
 * Replaces duplicate console.log patterns across API routes
 */
export class APIErrorHandler {

  /**
   * Handle API route errors with proper logging and standardized responses
   */
  static handleError(
    error: unknown,
    apiName: string,
    method: string,
    additionalContext?: Record<string, unknown>
  ): Response {
    // Log the error properly using ErrorManager
    const errorManager = ErrorManager.getInstance();
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    errorManager.handleError(errorMessage, ErrorCategory.DATABASE, {
      operation: method,
      api: apiName,
      ...additionalContext
    }, {
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'An error occurred while processing your request'
    });

    // Determine appropriate status code
    let statusCode = 500;
    let message = 'Internal Server Error';

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        statusCode = 404;
        message = 'Resource not found';
      } else if (error.message.includes('Unauthorized') || error.message.includes('Authentication')) {
        statusCode = 401;
        message = 'Unauthorized';
      } else if (error.message.includes('Validation') || error.message.includes('Invalid')) {
        statusCode = 400;
        message = 'Bad Request';
      }
    }

    return new Response(
      JSON.stringify({
        error: message,
        timestamp: new Date().toISOString(),
        context: apiName
      }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );
  }

  /**
   * Handle successful API responses
   */
  static handleSuccess<T>(
    data: T,
    apiName: string,
    status = 200,
    headers?: Record<string, string>
  ): Response {
    // Optional success logging for debugging (development only)
    if (process.env['NODE_ENV'] === 'development') {
      const errorManager = ErrorManager.getInstance();
      errorManager.handleError(`API Success: ${apiName}`, ErrorCategory.UNKNOWN, {
        dataSize: JSON.stringify(data).length
      }, {
        severity: ErrorSeverity.LOW
      });
    }

    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
        ...headers
      }
    });
  }

  /**
   * Validate and parse request body
   */
  static async validateRequestBody<T>(
    request: Request,
    schema?: { parse: (data: unknown) => T }
  ): Promise<T> {
    try {
      const body = await request.json();
      return schema ? schema.parse(body) : body;
    } catch (error) {
      throw new Error('Invalid JSON payload');
    }
  }
}