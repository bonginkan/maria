/**
 * Development-only runtime guards to prevent API key access in commands
 * This prevents accidental regressions during development
 */

let guardInstalled = false;

export function installDevelopmentGuards() {
  if (process.env.NODE_ENV !== 'development' || guardInstalled) {
    return;
  }
  
  const originalEnv = process.env;
  
  // Monkey-patch process.env reads to detect and block API key access
  process.env = new Proxy(originalEnv, {
    get(target: any, prop: string | symbol) {
      if (typeof prop === 'string' && prop.includes('API_KEY')) {
        const stack = new Error().stack || '';
        
        // Check if the access is coming from slash commands directory
        if (stack.includes('src/slash-commands/')) {
          const stackLines = stack.split('\n');
          const commandLine = stackLines.find(line => line.includes('src/slash-commands/'));
          const fileName = commandLine ? commandLine.match(/\/([^\/]+\.ts)/)?.[1] || 'unknown' : 'unknown';
          
          throw new Error(
            `🚫 API Key access blocked: ${prop}\n` +
            `📁 File: ${fileName}\n` +
            `💡 Solution: Use callApi() instead of direct provider access\n` +
            `📖 Security Guide: https://docs.maria-code.ai/security\n` +
            `\n` +
            `Example:\n` +
            `// ❌ Don't do this\n` +
            `const api = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });\n` +
            `\n` +
            `// ✅ Do this instead\n` +
            `const result = await callApi('/v1/generate', { method: 'POST', body: {...} });\n`
          );
        }
      }
      
      return target[prop];
    },
    
    set(target: any, prop: string | symbol, value: any) {
      target[prop] = value;
      return true;
    }
  });
  
  guardInstalled = true;
  
  if (process.env.DEBUG) {
    console.debug('🛡️ Development API key guards installed');
  }
}

// Auto-install in development
if (process.env.NODE_ENV === 'development') {
  installDevelopmentGuards();
}