#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const CONFIG_FILE_NAME = "claude_desktop_config.json";
const CLAUDE_CONFIG_DIR = join(homedir(), "Library", "Application Support", "Claude");
const CLAUDE_CONFIG_FILE = join(CLAUDE_CONFIG_DIR, CONFIG_FILE_NAME);

// Get the package directory path (this script is in scripts/, so go up one level)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = dirname(__dirname); // Go up from scripts/ to package root

const MCP_SERVER_CONFIG = {
  "mcpServers": {
    "prediction-markets-mcp": {
      "command": "node",
      "args": [
        join(packageDir, "build", "index.js")
      ],
      "env": {}
    }
  }
};

function setupClaudeConfig() {
  try {
    console.log('🔧 Setting up Claude configuration for prediction-markets-mcp...');
    
    // Ensure Claude config directory exists
    if (!existsSync(CLAUDE_CONFIG_DIR)) {
      mkdirSync(CLAUDE_CONFIG_DIR, { recursive: true });
      console.log(`📁 Created Claude config directory: ${CLAUDE_CONFIG_DIR}`);
    }
    
    let existingConfig = {};
    
    // Read existing config if it exists
    if (existsSync(CLAUDE_CONFIG_FILE)) {
      try {
        const configContent = readFileSync(CLAUDE_CONFIG_FILE, 'utf8');
        existingConfig = JSON.parse(configContent);
        console.log('📖 Found existing Claude configuration');
      } catch (error) {
        console.log('⚠️  Could not parse existing config, creating new one');
        existingConfig = {};
      }
    }
    
    // Merge with existing config
    const mergedConfig = {
      ...existingConfig,
      mcpServers: {
        ...existingConfig.mcpServers,
        ...MCP_SERVER_CONFIG.mcpServers
      }
    };
    
    // Write the updated config
    writeFileSync(CLAUDE_CONFIG_FILE, JSON.stringify(mergedConfig, null, 2));
    
    console.log('✅ Successfully configured Claude to use prediction-markets-mcp');
    console.log(`📄 Config file: ${CLAUDE_CONFIG_FILE}`);
    console.log('');
    console.log('🚀 You can now use prediction markets in Claude by asking questions like:');
    console.log('   • "What are the current odds for Trump winning the election?"');
    console.log('   • "Show me prediction markets about the Supreme Court"');
    console.log('   • "What are the latest odds on PredictIt?"');
    console.log('');
    console.log('💡 Note: You may need to restart Claude Desktop for the changes to take effect.');
    
  } catch (error) {
    console.error('❌ Error setting up Claude configuration:', error.message);
    console.log('');
    console.log('🔧 Manual setup instructions:');
    console.log('1. Open Claude Desktop');
    console.log('2. Go to Settings > Developer');
    console.log('3. Add a new MCP server with:');
    console.log('   - Name: prediction-markets-mcp');
    console.log('   - Command: node');
    console.log(`   - Args: [\"${join(packageDir, "build", "index.js")}\"]`);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupClaudeConfig();
}

export { setupClaudeConfig };
