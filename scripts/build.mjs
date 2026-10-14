import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'build');
await fs.rm(output, { recursive: true, force: true });
await fs.cp(path.join(root, 'addon'), output, { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: ['src/plugin.js'],
  bundle: true,
  format: 'iife',
  globalName: 'ReadingStatusModule',
  outfile: path.join(output, 'content/plugin.js'),
  loader: { '.css': 'text' },
  target: 'firefox140',
  legalComments: 'eof',
});
await fs.cp(path.join(root, 'licenses'), path.join(output, 'licenses'), { recursive: true });
await fs.copyFile(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));
execFileSync('python3', [path.join(root, 'scripts/package.py')], { cwd: root, stdio: 'inherit' });
