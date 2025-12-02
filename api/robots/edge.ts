/**
 * Edge Function for Robot Operations
 * Optimized for Vercel Edge Runtime with regional routing
 */

export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1'],
  // Edge-specific configuration
  maxDuration: 30, // seconds
};

interface RobotRequest {
  action: 'list' | 'create' | 'update' | 'delete' | 'search';
  data?: any;
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

interface EdgeResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  region: string;
  responseTime: number;
  cached: boolean;
}

// Region-based Supabase routing
const REGION_SUPABASE_MAPPING: Record<string, string> = {
  'hkg1': 'supabase.co', // Asia Pacific
  'iad1': 'supabase.co', // US East
  'sin1': 'supabase.co', // Asia Pacific
  'fra1': 'supabase.co', // Europe
};

export default async function handler(req: Request): Promise<Response> {
  const startTime = Date.now();
  const region = detectRegion(req);
  const url = new URL(req.url);
  
  try {
    // Add CORS headers for edge
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-edge-region',
      'x-edge-region': region,
      'cache-control': getCacheControl(req),
    };

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    // Parse request body for non-GET requests
    let requestBody: RobotRequest | null = null;
    if (req.method !== 'GET') {
      try {
        requestBody = await req.json() as RobotRequest;
      } catch (error) {
        return createErrorResponse('Invalid JSON body', region, startTime, corsHeaders);
      }
    }

    // Route to appropriate handler based on method and action
    const result = await handleRequest(req.method, url.pathname, requestBody, region);
    
    const responseTime = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      ...result,
      region,
      responseTime,
    } as EdgeResponse), {
      status: result.success ? 200 : 400,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json',
        'x-response-time': `${responseTime}ms`,
      },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    const responseTime = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      region,
      responseTime,
    } as EdgeResponse), {
      status: 500,
      headers: {
        'content-type': 'application/json',
        'x-edge-region': region,
        'x-response-time': `${responseTime}ms`,
      },
    });
  }
}

function detectRegion(req: Request): string {
  // Detect region from Vercel headers or geography
  const country = req.headers.get('x-vercel-ip-country');
  const city = req.headers.get('x-vercel-ip-city');
  
  // Simple region mapping - in production, use more sophisticated logic
  if (country) {
    if (['HK', 'SG', 'JP', 'KR', 'CN', 'IN', 'TH', 'MY', 'ID', 'PH', 'VN'].includes(country)) {
      return 'hkg1';
    } else if (['US', 'CA', 'MX'].includes(country)) {
      return 'iad1';
    } else if (['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI'].includes(country)) {
      return 'fra1';
    }
  }
  
  // Fallback to default region
  return 'iad1';
}

function getCacheControl(req: Request): string {
  const url = new URL(req.url);
  const isGetRequest = req.method === 'GET';
  const isListEndpoint = url.pathname.includes('/list') || url.pathname === '/';
  
  if (isGetRequest && isListEndpoint) {
    // Cache list responses for 5 minutes
    return 'public, max-age=300, stale-while-revalidate=60';
  } else if (isGetRequest) {
    // Cache individual items for 1 hour
    return 'public, max-age=3600, stale-while-revalidate=300';
  } else {
    // Don't cache mutations
    return 'no-cache, no-store, must-revalidate';
  }
}

async function handleRequest(
  method: string, 
  pathname: string, 
  body: RobotRequest | null, 
  region: string
): Promise<Omit<EdgeResponse, 'region' | 'responseTime'>> {
  // Simulate database operations - in production, connect to actual Supabase
  switch (method) {
    case 'GET':
      if (pathname === '/' || pathname === '/list') {
        return await handleListRobots(body?.params, region);
      } else if (pathname.includes('/search')) {
        return await handleSearchRobots(body?.params, region);
      } else {
        return await handleGetRobot(pathname.split('/').pop(), region);
      }
      
    case 'POST':
      return await handleCreateRobot(body?.data, region);
      
    case 'PUT':
      return await handleUpdateRobot(pathname.split('/').pop(), body?.data, region);
      
    case 'DELETE':
      return await handleDeleteRobot(pathname.split('/').pop(), region);
      
    default:
      return { success: false, error: 'Method not allowed', cached: false };
  }
}

async function handleListRobots(params: any, region: string): Promise<Omit<EdgeResponse, 'region' | 'responseTime'>> {
  // Simulate robot listing with pagination
  const page = params?.page || 1;
  const limit = Math.min(params?.limit || 10, 100); // Cap at 100
  const sortBy = params?.sortBy || 'created_at';
  const sortOrder = params?.sortOrder || 'desc';
  
  // Mock data - in production, query Supabase
  const mockRobots = Array.from({ length: 50 }, (_, i) => ({
    id: `robot_${i + 1}`,
    name: `Trading Robot ${i + 1}`,
    strategy: 'EMA Crossover',
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
    updated_at: new Date(Date.now() - i * 43200000).toISOString(),
    status: i % 3 === 0 ? 'active' : 'inactive',
  }));
  
  // Sort and paginate
  const sorted = mockRobots.sort((a, b) => {
    const aVal = a[sortBy as keyof typeof a];
    const bVal = b[sortBy as keyof typeof b];
    const comparison = aVal > bVal ? 1 : -1;
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  const start = (page - 1) * limit;
  const paginated = sorted.slice(start, start + limit);
  
  return {
    success: true,
    data: {
      robots: paginated,
      pagination: {
        page,
        limit,
        total: mockRobots.length,
        pages: Math.ceil(mockRobots.length / limit),
      },
    },
    cached: true,
  };
}

async function handleSearchRobots(params: any, region: string): Promise<Omit<EdgeResponse, 'region' | 'responseTime'>> {
  const searchQuery = params?.search || '';
  
  // Mock search - in production, use Supabase full-text search
  const mockResults = [
    { id: 'robot_1', name: 'EMA Crossover Robot', strategy: 'EMA Crossover' },
    { id: 'robot_5', name: 'RSI Strategy Robot', strategy: 'RSI' },
  ].filter(robot => 
    robot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    robot.strategy.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return {
    success: true,
    data: { robots: mockResults },
    cached: false,
  };
}

async function handleGetRobot(id: string | undefined, region: string): Promise<Omit<EdgeResponse, 'region' | 'responseTime'>> {
  if (!id) {
    return { success: false, error: 'Robot ID required', cached: false };
  }
  
  // Mock robot data - in production, fetch from Supabase
  const mockRobot = {
    id,
    name: `Trading Robot ${id}`,
    strategy: 'Advanced EMA Crossover',
    code: '// MQL5 code here...',
    parameters: { risk: 2, stopLoss: 50, takeProfit: 100 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  return {
    success: true,
    data: mockRobot,
    cached: true,
  };
}

async function handleCreateRobot(data: any, region: string): Promise<Omit<EdgeResponse, 'region' | 'responseTime'>> {
  if (!data) {
    return { success: false, error: 'Robot data required', cached: false };
  }
  
  // Mock creation - in production, insert into Supabase
  const newRobot = {
    id: `robot_${Date.now()}`,
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  return {
    success: true,
    data: newRobot,
    cached: false,
  };
}

async function handleUpdateRobot(id: string | undefined, data: any, region: string): Promise<Omit<EdgeResponse, 'region' | 'responseTime'>> {
  if (!id || !data) {
    return { success: false, error: 'Robot ID and data required', cached: false };
  }
  
  // Mock update - in production, update in Supabase
  const updatedRobot = {
    id,
    ...data,
    updated_at: new Date().toISOString(),
  };
  
  return {
    success: true,
    data: updatedRobot,
    cached: false,
  };
}

async function handleDeleteRobot(id: string | undefined, region: string): Promise<Omit<EdgeResponse, 'region' | 'responseTime'>> {
  if (!id) {
    return { success: false, error: 'Robot ID required', cached: false };
  }
  
  // Mock deletion - in production, delete from Supabase
  return {
    success: true,
    data: { id, deleted: true },
    cached: false,
  };
}

function createErrorResponse(
  message: string, 
  region: string, 
  startTime: number, 
  additionalHeaders: Record<string, string> = {}
): Response {
  const responseTime = Date.now() - startTime;
  
  return new Response(JSON.stringify({
    success: false,
    error: message,
    region,
    responseTime,
  } as EdgeResponse), {
    status: 400,
    headers: {
      'content-type': 'application/json',
      'x-edge-region': region,
      'x-response-time': `${responseTime}ms`,
      ...additionalHeaders,
    },
  });
}