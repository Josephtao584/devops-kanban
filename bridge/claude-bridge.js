/**
 * Claude Bridge Service
 *
 * A Node.js bridge layer that spawns Claude CLI processes with stream-json output,
 * bypassing PTY compatibility issues with Java's pty4j and Ink TUI framework.
 *
 * Architecture:
 *   Java Backend <-> HTTP API (session lifecycle) <-> Node.js Bridge <-> Claude CLI (spawn)
 *                    WebSocket (real-time I/O)      <->
 *
 * Endpoints:
 *   POST /session/start  - Create a new session
 *   DELETE /session/:id  - Stop and cleanup a session
 *   GET /health          - Health check
 *   WS /ws?session=xxx   - Real-time bidirectional communication
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Auto-detect Claude CLI path based on platform
 */
function findClaudeCliPath() {
  const platform = process.platform;

  if (platform === 'win32') {
    return 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js';
  } else if (platform === 'darwin') {
    // macOS - check common locations
    const macPaths = [
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      process.env.HOME + '/.npm-global/bin/claude'
    ];
    for (const p of macPaths) {
      if (fs.existsSync(p)) return p;
    }
    // Fallback: assume claude is in PATH
    return 'claude';
  } else {
    // Linux and others - assume claude is in PATH
    return 'claude';
  }
}

// Configuration
const CONFIG = {
  port: process.env.BRIDGE_PORT || 3002,
  host: process.env.BRIDGE_HOST || 'localhost',
  claudeCliPath: process.env.CLAUDE_CLI_PATH || findClaudeCliPath(),
  outputFormat: 'stream-json',
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Session storage
const sessions = new Map();

// WebSocket server (initialized after HTTP server)
let wss = null;

// Logging utility
const log = {
  info: (...args) => console.log(`[${new Date().toISOString()}] [INFO]`, ...args),
  error: (...args) => console.error(`[${new Date().toISOString()}] [ERROR]`, ...args),
  debug: (...args) => CONFIG.logLevel === 'debug' && console.log(`[${new Date().toISOString()}] [DEBUG]`, ...args),
  warn: (...args) => console.warn(`[${new Date().toISOString()}] [WARN]`, ...args)
};

/**
 * Create HTTP server with request routing
 */
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    // Route: Health check
    if (url.pathname === '/health' && req.method === 'GET') {
      handleHealthCheck(req, res);
      return;
    }

    // Route: Start session
    if (url.pathname === '/session/start' && req.method === 'POST') {
      await handleStartSession(req, res);
      return;
    }

    // Route: Stop session
    const stopMatch = url.pathname.match(/^\/session\/(.+)$/);
    if (stopMatch && req.method === 'DELETE') {
      handleStopSession(req, res, stopMatch[1]);
      return;
    }

    // Route: Get session info
    if (stopMatch && req.method === 'GET') {
      handleGetSession(req, res, stopMatch[1]);
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Not found' }));

  } catch (err) {
    log.error('Request handler error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: err.message }));
  }
});

/**
 * Health check endpoint
 */
function handleHealthCheck(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    status: 'healthy',
    activeSessions: sessions.size,
    uptime: process.uptime()
  }));
}

/**
 * Start a new Claude session
 * POST /session/start
 * Body: { sessionId, workDir, initialPrompt?, env? }
 */
async function handleStartSession(req, res) {
  const body = await parseJsonBody(req);

  if (!body.sessionId || !body.workDir) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Missing required fields: sessionId, workDir'
    }));
    return;
  }

  const { sessionId, workDir, initialPrompt, env = {} } = body;

  // Check if session already exists
  if (sessions.has(sessionId)) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: `Session already exists: ${sessionId}`
    }));
    return;
  }

  // Verify working directory exists
  if (!fs.existsSync(workDir)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: `Working directory does not exist: ${workDir}`
    }));
    return;
  }

  log.info(`[Session-${sessionId}] Starting session | WorkDir: ${workDir}`);

  try {
    // Build environment variables
    const processEnv = { ...process.env };

    // Remove CLAUDE* environment variables to allow nested sessions
    // Preserve ANTHROPIC* vars (API credentials)
    for (const key of Object.keys(processEnv)) {
      if (key.toUpperCase().startsWith('CLAUDE')) {
        log.debug(`[Session-${sessionId}] Removing env var: ${key}`);
        delete processEnv[key];
      }
    }

    // Apply custom environment
    Object.assign(processEnv, env);

    // Set terminal mode for non-interactive output
    processEnv.TERM = 'dumb';
    processEnv.NO_COLOR = '1';

    // Build command arguments
    let command, args;
    if (CONFIG.claudeCliPath.endsWith('.js')) {
      // Windows: run via node
      command = 'node';
      args = [CONFIG.claudeCliPath, '--output-format', CONFIG.outputFormat];
    } else {
      // macOS/Linux: run directly
      command = CONFIG.claudeCliPath;
      args = ['--output-format', CONFIG.outputFormat];
    }

    log.info(`[Session-${sessionId}] Spawning Claude CLI | Command: ${command} ${args.join(' ')}`);

    // Spawn Claude CLI process
    const childProcess = spawn(command, args, {
      cwd: workDir,
      env: processEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    });

    // Create session object
    const session = {
      id: sessionId,
      workDir,
      process: childProcess,
      startTime: Date.now(),
      output: [],
      status: 'RUNNING',
      websockets: new Set()
    };

    sessions.set(sessionId, session);

    // Handle stdout - parse stream-json format
    let stdoutBuffer = '';
    childProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutBuffer += chunk;

      log.debug(`[Session-${sessionId}] stdout chunk (${chunk.length} bytes)`);

      // Process complete lines (NDJSON format)
      let newlineIndex;
      while ((newlineIndex = stdoutBuffer.indexOf('\n')) >= 0) {
        const line = stdoutBuffer.substring(0, newlineIndex);
        stdoutBuffer = stdoutBuffer.substring(newlineIndex + 1);

        if (line.trim()) {
          const message = parseStreamJsonLine(line, sessionId);
          if (message) {
            session.output.push(message);
            broadcastToSession(sessionId, message);
          }
        }
      }
    });

    // Handle stderr
    let stderrBuffer = '';
    childProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrBuffer += chunk;

      log.debug(`[Session-${sessionId}] stderr chunk: ${chunk}`);

      // Process stderr lines
      let newlineIndex;
      while ((newlineIndex = stderrBuffer.indexOf('\n')) >= 0) {
        const line = stderrBuffer.substring(0, newlineIndex);
        stderrBuffer = stderrBuffer.substring(newlineIndex + 1);

        if (line.trim()) {
          const message = {
            type: 'stderr',
            content: line,
            timestamp: Date.now()
          };
          session.output.push(message);
          broadcastToSession(sessionId, message);
        }
      }
    });

    // Handle process exit
    childProcess.on('close', (code, signal) => {
      log.info(`[Session-${sessionId}] Process exited | Code: ${code} | Signal: ${signal}`);

      session.status = code === 0 ? 'COMPLETED' : 'ERROR';
      session.exitCode = code;

      const exitMessage = {
        type: 'exit',
        exitCode: code,
        signal,
        status: session.status,
        timestamp: Date.now()
      };

      session.output.push(exitMessage);
      broadcastToSession(sessionId, exitMessage);
    });

    // Handle process error
    childProcess.on('error', (err) => {
      log.error(`[Session-${sessionId}] Process error:`, err);

      session.status = 'ERROR';
      const errorMessage = {
        type: 'error',
        message: err.message,
        timestamp: Date.now()
      };

      session.output.push(errorMessage);
      broadcastToSession(sessionId, errorMessage);
    });

    // Send initial prompt if provided
    if (initialPrompt) {
      log.info(`[Session-${sessionId}] Sending initial prompt via stdin`);
      childProcess.stdin.write(initialPrompt + '\n');
    }

    // Success response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        sessionId,
        status: session.status,
        pid: childProcess.pid
      }
    }));

  } catch (err) {
    log.error(`[Session-${sessionId}] Failed to start session:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: `Failed to start session: ${err.message}`
    }));
  }
}

/**
 * Stop a running session
 * DELETE /session/:id
 */
function handleStopSession(req, res, sessionId) {
  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: `Session not found: ${sessionId}`
    }));
    return;
  }

  log.info(`[Session-${sessionId}] Stopping session`);

  try {
    // Kill the process
    if (session.process && session.process.kill) {
      session.process.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (session.process && !session.process.killed) {
          log.warn(`[Session-${sessionId}] Force killing process`);
          session.process.kill('SIGKILL');
        }
      }, 3000);
    }

    // Update status
    session.status = 'STOPPED';

    // Close all WebSocket connections
    for (const ws of session.websockets) {
      if (ws.readyState === ws.OPEN) {
        ws.close(1000, 'Session stopped');
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        sessionId,
        status: 'STOPPED'
      }
    }));

  } catch (err) {
    log.error(`[Session-${sessionId}] Failed to stop session:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: `Failed to stop session: ${err.message}`
    }));
  }
}

/**
 * Get session info
 * GET /session/:id
 */
function handleGetSession(req, res, sessionId) {
  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: `Session not found: ${sessionId}`
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    data: {
      sessionId: session.id,
      status: session.status,
      workDir: session.workDir,
      pid: session.process?.pid,
      startTime: session.startTime,
      outputLength: session.output.length
    }
  }));
}

/**
 * Parse a line of stream-json output
 * Claude CLI outputs NDJSON format with various message types
 */
function parseStreamJsonLine(line, sessionId) {
  try {
    const json = JSON.parse(line);

    // Handle different message types from Claude CLI
    // Based on stream-json format specification

    if (json.type === 'text' || json.type === 'assistant') {
      // Text content from assistant
      return {
        type: 'chunk',
        stream: 'stdout',
        role: 'assistant',
        content: json.text || json.content || '',
        isComplete: true,
        timestamp: Date.now()
      };
    }

    if (json.type === 'user') {
      // User message echo
      return {
        type: 'chunk',
        stream: 'stdout',
        role: 'user',
        content: json.text || json.content || '',
        isComplete: true,
        timestamp: Date.now()
      };
    }

    if (json.type === 'system') {
      // System message
      return {
        type: 'system',
        content: json.message || json.content || '',
        timestamp: Date.now()
      };
    }

    if (json.type === 'error') {
      // Error message
      return {
        type: 'error',
        content: json.message || json.error || line,
        timestamp: Date.now()
      };
    }

    if (json.type === 'result') {
      // Final result
      return {
        type: 'result',
        content: json.result || json.content || '',
        timestamp: Date.now()
      };
    }

    // Generic message - pass through
    log.debug(`[Session-${sessionId}] Unknown message type: ${json.type}`);
    return {
      type: json.type || 'unknown',
      content: JSON.stringify(json),
      timestamp: Date.now()
    };

  } catch (err) {
    // Not valid JSON - treat as plain text
    return {
      type: 'chunk',
      stream: 'stdout',
      role: 'assistant',
      content: line,
      isComplete: true,
      timestamp: Date.now()
    };
  }
}

/**
 * Broadcast message to all WebSocket clients for a session
 */
function broadcastToSession(sessionId, message) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const payload = JSON.stringify(message);

  for (const ws of session.websockets) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Handle WebSocket upgrade and connection
 */
function handleWebSocket(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('session');

  if (!sessionId) {
    log.warn('WebSocket connection without session parameter');
    ws.close(4000, 'Missing session parameter');
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    log.warn(`WebSocket connection for unknown session: ${sessionId}`);
    ws.close(4004, 'Session not found');
    return;
  }

  // Register WebSocket with session
  session.websockets.add(ws);
  log.info(`[Session-${sessionId}] WebSocket connected | Total: ${session.websockets.size}`);

  // Send session info on connect
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId,
    status: session.status,
    timestamp: Date.now()
  }));

  // Send buffered output (last 100 messages)
  const recentOutput = session.output.slice(-100);
  for (const msg of recentOutput) {
    ws.send(JSON.stringify(msg));
  }

  // Handle incoming messages (stdin)
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'input' && session.process && session.process.stdin.writable) {
        const input = msg.content || msg.text || '';
        log.debug(`[Session-${sessionId}] Received input: ${input.substring(0, 50)}...`);
        session.process.stdin.write(input + '\n');
      }

    } catch (err) {
      log.error(`[Session-${sessionId}] WebSocket message error:`, err);
    }
  });

  // Handle WebSocket close
  ws.on('close', () => {
    session.websockets.delete(ws);
    log.info(`[Session-${sessionId}] WebSocket disconnected | Remaining: ${session.websockets.size}`);
  });

  // Handle WebSocket error
  ws.on('error', (err) => {
    log.error(`[Session-${sessionId}] WebSocket error:`, err);
    session.websockets.delete(ws);
  });
}

/**
 * Parse JSON body from HTTP request
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Cleanup old sessions periodically
 */
function cleanupOldSessions() {
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [sessionId, session] of sessions) {
    const age = Date.now() - session.startTime;

    if (age > maxAge && session.status !== 'RUNNING') {
      log.info(`[Session-${sessionId}] Cleaning up old session`);

      if (session.process) {
        session.process.kill();
      }

      for (const ws of session.websockets) {
        ws.close(1000, 'Session expired');
      }

      sessions.delete(sessionId);
    }
  }
}

// Initialize WebSocket server
wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    handleWebSocket(ws, req);
  });
});

// Start server - listen on all interfaces (0.0.0.0) for cross-interface access
server.listen(CONFIG.port, '0.0.0.0', () => {
  log.info(`Claude Bridge started on http://0.0.0.0:${CONFIG.port}`);
  log.info(`WebSocket endpoint: ws://${CONFIG.host}:${CONFIG.port}/ws?session=<sessionId>`);
  log.info(`Claude CLI path: ${CONFIG.claudeCliPath}`);
});

// Periodic cleanup
setInterval(cleanupOldSessions, 60 * 60 * 1000); // Every hour

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('Received SIGTERM, shutting down...');

  // Stop all sessions
  for (const [sessionId, session] of sessions) {
    if (session.process) {
      session.process.kill();
    }
  }

  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log.info('Received SIGINT, shutting down...');
  process.emit('SIGTERM');
});
