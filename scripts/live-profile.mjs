import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
await build({entryPoints:[process.argv[2] || 'tests/live.js'],bundle:true,format:'iife',globalName:'ReadingStatusLive',outfile:'/tmp/reading-status-live/live.js',target:'firefox140'});
execFileSync('python3',['scripts/live-profile.py']);
