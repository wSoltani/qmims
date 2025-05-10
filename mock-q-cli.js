#!/usr/bin/env node

/**
 * Mock implementation of Amazon Q CLI for testing purposes
 * 
 * This script simulates the behavior of the Amazon Q Developer CLI
 * for local development and testing of qmims without requiring
 * an actual Amazon Q installation.
 * 
 * Usage:
 *   node mock-q-cli.js chat [--no-interactive] [prompt]
 *   node mock-q-cli.js --version
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Handle version command
if (command === '--version') {
  console.log('Amazon Q Developer CLI (mock) v1.0.0');
  process.exit(0);
}

// Handle chat command
if (command === 'chat') {
  const isNonInteractive = args.includes('--no-interactive');
  const promptIndex = args.indexOf('--no-interactive') !== -1 ? 
    args.indexOf('--no-interactive') + 1 : 
    1;
  const prompt = args[promptIndex];

  // For non-interactive mode with a test prompt
  if (isNonInteractive && prompt && prompt.includes('echo')) {
    console.log('Mock Amazon Q: This is a test response');
    process.exit(0);
  }

  // For interactive mode
  console.log('Mock Amazon Q Developer CLI Chat');
  console.log('--------------------------------');
  console.log('Type your questions or commands. Type /quit to exit.');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You: '
  });

  rl.prompt();

  rl.on('line', (line) => {
    const input = line.trim();
    
    // Handle quit command
    if (input === '/quit') {
      console.log('Exiting mock Q chat...');
      rl.close();
      process.exit(0);
    }

    // Handle context command
    if (input.startsWith('/context add')) {
      const filePath = input.substring('/context add '.length).trim();
      try {
        if (fs.existsSync(filePath)) {
          console.log(`Added ${filePath} to context.`);
        } else {
          console.log(`Warning: File ${filePath} does not exist.`);
        }
      } catch (error) {
        console.log(`Error adding context: ${error.message}`);
      }
      rl.prompt();
      return;
    }

    // Simulate a response based on the input
    console.log('\nMock Amazon Q:');
    
    // Simulate file edit request
    if (input.toLowerCase().includes('edit') || 
        input.toLowerCase().includes('update') || 
        input.toLowerCase().includes('modify')) {
      console.log('I can help with that. I would like to edit the file to make the requested changes.');
      console.log('Would you like me to edit the file? (y/N)');
      
      // Set up a one-time listener for the permission response
      const originalPrompt = rl.prompt;
      rl.prompt = () => {}; // Temporarily disable prompt
      
      rl.once('line', (response) => {
        if (response.trim().toLowerCase() === 'y') {
          console.log('Making changes to the file...');
          console.log('Changes applied successfully!');
        } else {
          console.log('No changes were made to the file.');
        }
        rl.prompt = originalPrompt; // Restore prompt
        rl.prompt();
      });
      
      return;
    }
    
    // Default response
    console.log(`I received your message: "${input}"`);
    console.log('This is a mock response from the Amazon Q Developer CLI simulator.');
    console.log('In a real environment, Amazon Q would provide a helpful response here.');
    
    rl.prompt();
  }).on('close', () => {
    console.log('Mock Q chat session ended.');
    process.exit(0);
  });
}
else {
  console.log(`Unknown command: ${command}`);
  console.log('Available commands: chat, --version');
  process.exit(1);
}