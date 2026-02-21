/**
 * Cloudflare Worker entry point for QuantForge AI
 * Minimal worker for static site serving with SPA routing
 * 
 * This worker serves static files from the asset manifest
 * and handles SPA routing by serving index.html for non-asset routes.
 */

import manifest from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifest);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;
    
    // Check if the path is for a static asset
    const assetKey = path === '/' ? '/index.html' : path;
    
    // If the path doesn't have an extension and isn't a known route, serve index.html (SPA)
    const hasExtension = path.match(/\.[a-zA-Z0-9]+$/);
    
    try {
      // Try to get the asset from the KV binding
      const assetPath = hasExtension ? assetKey : '/index.html';
      
      if (env.__STATIC_CONTENT) {
        const asset = await env.__STATIC_CONTENT.get(assetPath.replace(/^\//, ''));
        if (asset) {
          const contentType = getContentType(assetPath);
          return new Response(asset, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      }
      
      // Fallback to index.html for SPA routing
      if (env.__STATIC_CONTENT) {
        const indexHtml = await env.__STATIC_CONTENT.get('index.html');
        if (indexHtml) {
          return new Response(indexHtml, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=0, must-revalidate',
            },
          });
        }
      }
      
      // If no assets found, return 404
      return new Response('Not Found', { status: 404 });
    } catch (e) {
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

/**
 * Get the content type based on file extension
 */
function getContentType(path) {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const types = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
  };
  return types[ext] || 'application/octet-stream';
}
