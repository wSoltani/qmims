/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs-extra');
const path = require('path');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const sourceDir = path.join(projectRoot, 'src', 'templates');
  const targetDir = path.join(projectRoot, 'dist', 'templates');

  const sourceExists = await fs.pathExists(sourceDir);
  if (!sourceExists) {
    throw new Error(`Template source directory not found: ${sourceDir}`);
  }

  await fs.ensureDir(targetDir);
  await fs.copy(sourceDir, targetDir, { overwrite: true });

  console.log(`Copied templates from ${sourceDir} to ${targetDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
