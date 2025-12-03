# API Documentation - QuantForge AI

This document outlines the new API endpoints implemented for Vercel Edge deployment and Supabase integration optimization.

## 🚀 Core API Endpoints

### Robots API

#### `GET /api/robots`
List all trading robots with pagination, search, and filtering.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `search` (string): Search term for robot names/descriptions
- `type` (string): Filter by strategy type
- `sort` (string): Sort field (created_at, updated_at, name)
- `order` (string): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 100,
    "totalPages": 5
  },
  "meta": {
    "search": "EMA",
    "type": "trend_following"
  }
}
```

#### `POST /api/robots`
Create a new trading robot.

**Request Body:**
```json
{
  "name": "My EMA Strategy",
  "description": "EMA crossover strategy",
  "code": "// MQL5 code here",
  "strategy_type": "trend_following",
  "risk_percent": 2.0,
  "stop_loss_pips": 50,
  "take_profit_pips": 100
}
```

#### `PUT /api/robots`
Batch update multiple robots.

**Request Body:**
```json
{
  "updates": [
    {
      "id": "robot_id_1",
      "data": { "name": "Updated Name" }
    }
  ]
}
```

#### `DELETE /api/robots`
Batch delete robots.

**Query Parameters:**
- `ids` (string): Comma-separated robot IDs

#### `GET /api/robots/[id]`
Get a specific robot by ID.

#### `PUT /api/robots/[id]`
Update a specific robot.

#### `DELETE /api/robots/[id]`
Delete a specific robot.

---

### Strategies API

#### `GET /api/strategies`
List all available strategy templates.

**Query Parameters:**
- `category` (string): Filter by category (trend_following, mean_reversion, etc.)
- `difficulty` (string): Filter by difficulty (beginner, intermediate, advanced)
- `search` (string): Search term

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ema_crossover",
      "name": "EMA Crossover",
      "description": "Exponential Moving Average crossover strategy",
      "category": "trend_following",
      "difficulty": "beginner",
      "parameters": {
        "fast_ema": { "type": "number", "default": 12 },
        "slow_ema": { "type": "number", "default": 26 }
      },
      "code_template": "// MQL5 template code"
    }
  ],
  "meta": {
    "total": 4,
    "categories": ["trend_following", "mean_reversion"],
    "difficulties": ["beginner", "intermediate", "advanced"]
  }
}
```

#### `POST /api/strategies`
Create a custom strategy template.

#### `GET /api/strategies/[id]`
Get a specific strategy template.

#### `PUT /api/strategies/[id]`
Update a custom strategy (only works for custom strategies).

#### `DELETE /api/strategies/[id]`
Delete a custom strategy.

---

### Market Data API

#### `GET /api/market-data`
Get real-time market data for multiple symbols.

**Query Parameters:**
- `symbols` (string): Comma-separated symbol list
- `timeframe` (string): Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
- `limit` (number): Number of data points (default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "EURUSD",
      "timestamp": 1640995200000,
      "bid": 1.0850,
      "ask": 1.0852,
      "mid": 1.0851,
      "spread": 0.0002,
      "change": 0.0001,
      "changePercent": 0.009,
      "volume": 1000000,
      "high": 1.0860,
      "low": 1.0840
    }
  ],
  "metrics": {
    "totalVolume": 5000000,
    "avgSpread": 0.00015,
    "mostVolatile": { "symbol": "GBPJPY", "changePercent": 0.15 }
  }
}
```

#### `POST /api/market-data`
Subscribe to real-time market data updates.

**Request Body:**
```json
{
  "symbols": ["EURUSD", "GBPUSD"],
  "webhook_url": "https://your-webhook-url.com",
  "subscription_type": "realtime"
}
```

#### `GET /api/market-data/[symbol]`
Get real-time data for a specific symbol.

**Query Parameters:**
- `timeframe` (string): Timeframe (default: 1m)
- `technical` (boolean): Include technical indicators (default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "EURUSD",
    "timestamp": 1640995200000,
    "bid": 1.0850,
    "ask": 1.0852,
    "technical": {
      "sma_20": 1.0850,
      "ema_12": 1.0849,
      "rsi": 55.5,
      "macd": {
        "main": 0.0001,
        "signal": 0.0002,
        "histogram": -0.0001
      }
    },
    "historical": [...]
  }
}
```

#### `POST /api/market-data/[symbol]`
Create subscription for a specific symbol.

---

## 🔧 Edge Functions

### WebSocket API

#### `GET /api/edge/websockets`
WebSocket endpoint for real-time communication.

**WebSocket Messages:**

**Subscribe to symbols:**
```json
{
  "type": "subscribe",
  "symbols": ["EURUSD", "GBPUSD"]
}
```

**Market data update:**
```json
{
  "type": "market_update",
  "data": [...],
  "timestamp": 1640995200000,
  "region": "iad1"
}
```

**Ping/Pong:**
```json
{
  "type": "ping"
}
```

#### `POST /api/edge/websockets`
Manage WebSocket connections and broadcasting.

**Request Body:**
```json
{
  "action": "stats" // or "broadcast"
}
```

---

### Rate Limiting API

#### `GET /api/edge/rate-limit`
Check current rate limit status.

**Query Parameters:**
- `type` (string): Rate limit type (default, strict, api, market_data, upload)

**Response:**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "limit": 100,
    "remaining": 95,
    "resetTime": 1640995260000,
    "type": "api"
  }
}
```

#### `POST /api/edge/rate-limit`
Check and enforce rate limits.

**Request Body:**
```json
{
  "type": "api",
  "action": "enforce", // or "check"
  "customConfig": {
    "windowMs": 60000,
    "maxRequests": 50
  }
}
```

#### `DELETE /api/edge/rate-limit`
Reset rate limit (admin only).

**Headers:**
- `x-admin-key`: Admin authentication key

---

## 🛡️ Security Features

### Input Validation
- All inputs are sanitized using `securityManager.sanitizeInput()`
- XSS prevention with HTML tag removal
- SQL injection prevention
- Type validation and sanitization

### Rate Limiting
- Distributed rate limiting across edge regions
- Configurable limits per endpoint type
- Automatic request blocking when limits exceeded
- Graceful degradation with proper error responses

### Caching Strategy
- Multi-tier caching with edge optimization
- Intelligent cache invalidation
- Performance monitoring and metrics
- Region-specific caching for better performance

### Error Handling
- Comprehensive error logging
- Graceful fallback to mock mode
- Performance metrics collection
- Security incident tracking

---

## 📊 Performance Monitoring

### Response Headers
All API responses include performance headers:
- `X-Response-Time`: Request processing time in milliseconds
- `X-Cache`: Cache hit/miss status
- `X-Edge-Region`: Vercel edge region that processed the request
- `Cache-Control`: Appropriate caching directives

### Metrics Collection
- Request duration tracking
- Cache hit rate monitoring
- Error rate tracking
- Regional performance analysis

---

## 🔗 Integration Examples

### JavaScript/TypeScript Client

```typescript
// Fetch robots with pagination
const response = await fetch('/api/robots?page=1&limit=20&search=EMA');
const data = await response.json();

// Create a new robot
const createResponse = await fetch('/api/robots', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Strategy',
    code: '// MQL5 code',
    strategy_type: 'trend_following'
  })
});

// WebSocket connection
const ws = new WebSocket('wss://your-domain.com/api/edge/websockets');
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'market_update') {
    // Handle market data updates
  }
};
```

### Python Client

```python
import requests

# Get market data
response = requests.get('https://your-domain.com/api/market-data?symbols=EURUSD,GBPUSD')
data = response.json()

# Check rate limit status
rate_limit = requests.get('https://your-domain.com/api/edge/rate-limit?type=api')
print(rate_limit.json())
```

---

## 🚀 Deployment Notes

### Vercel Edge Configuration
- All API endpoints are configured for edge runtime
- Multi-region deployment for global performance
- Automatic scaling and load balancing
- Edge caching for improved response times

### Environment Variables
Required environment variables for production:
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
- `RATE_LIMIT_ADMIN_KEY`: Admin key for rate limit management

### Monitoring and Analytics
- Built-in performance monitoring
- Real-time metrics collection
- Error tracking and alerting
- Usage analytics and reporting

---

## 📝 Best Practices

1. **Caching**: Utilize built-in caching headers for optimal performance
2. **Rate Limiting**: Implement client-side rate limiting to avoid API blocks
3. **Error Handling**: Always check response status and handle errors gracefully
4. **WebSocket**: Use ping/pong messages to maintain connection health
5. **Security**: Validate all inputs and never expose sensitive data

---

## 🔍 Troubleshooting

### Common Issues

**429 Too Many Requests**
- Implement exponential backoff
- Check rate limit status before making requests
- Use appropriate rate limit type for your use case

**WebSocket Connection Issues**
- Ensure proper WebSocket upgrade headers
- Check network connectivity and firewall settings
- Implement reconnection logic with exponential backoff

**Cache Issues**
- Clear cache when updating data
- Use appropriate cache invalidation strategies
- Monitor cache hit rates for performance optimization

For more detailed troubleshooting information, refer to the performance monitoring endpoints and logs.