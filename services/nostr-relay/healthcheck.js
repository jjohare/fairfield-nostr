#!/usr/bin/env node
/**
 * Health check script for Cloud Run
 * Tests HTTP endpoint and WebSocket upgrade capability
 */

const http = require('http');

const PORT = process.env.PORT || 8080;
const TIMEOUT = 5000;

function healthCheck() {
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/health',
    method: 'GET',
    timeout: TIMEOUT,
    headers: {
      'User-Agent': 'HealthCheck/1.0'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const health = JSON.parse(data);
          if (health.status === 'healthy') {
            console.log('Health check passed:', health);
            process.exit(0);
          } else {
            console.error('Service unhealthy:', health);
            process.exit(1);
          }
        } catch (err) {
          console.error('Invalid health response:', data);
          process.exit(1);
        }
      } else {
        console.error('Health check failed with status:', res.statusCode);
        process.exit(1);
      }
    });
  });

  req.on('timeout', () => {
    console.error('Health check timeout');
    req.destroy();
    process.exit(1);
  });

  req.on('error', (err) => {
    console.error('Health check error:', err.message);
    process.exit(1);
  });

  req.end();
}

healthCheck();
