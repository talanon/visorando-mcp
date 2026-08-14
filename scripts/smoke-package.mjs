import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const projectDirectory = resolve(import.meta.dirname, '..');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'visorando-mcp-package-'));
let archivePath;

try {
  const packOutput = execFileSync('npm', ['pack', '--json'], {
    cwd: projectDirectory,
    encoding: 'utf8',
  });
  const packResult = /** @type {unknown} */ (JSON.parse(packOutput));
  const firstResult = Array.isArray(packResult)
    ? /** @type {unknown} */ (packResult[0])
    : undefined;
  if (
    typeof firstResult !== 'object' ||
    firstResult === null ||
    !('filename' in firstResult) ||
    typeof firstResult.filename !== 'string'
  ) {
    throw new Error('npm pack n’a pas produit d’archive.');
  }
  const filename = firstResult.filename;
  archivePath = join(projectDirectory, filename);

  execFileSync('npm', ['init', '--yes'], { cwd: temporaryDirectory, stdio: 'ignore' });
  execFileSync('npm', ['install', '--ignore-scripts', archivePath], {
    cwd: temporaryDirectory,
    stdio: 'ignore',
  });
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "import { VisorandoClient, createServer } from 'visorando-mcp'; if (!VisorandoClient || !createServer) process.exit(1);",
    ],
    { cwd: temporaryDirectory, stdio: 'inherit' },
  );

  const installedManifest = /** @type {unknown} */ (
    JSON.parse(
      readFileSync(join(temporaryDirectory, 'node_modules/visorando-mcp/package.json'), 'utf8'),
    )
  );
  if (
    typeof installedManifest !== 'object' ||
    installedManifest === null ||
    !('name' in installedManifest) ||
    installedManifest.name !== 'visorando-mcp'
  ) {
    throw new Error('Paquet installé invalide.');
  }
} finally {
  if (archivePath) rmSync(archivePath, { force: true });
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
