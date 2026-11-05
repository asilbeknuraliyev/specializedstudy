import { build } from 'esbuild';
await build({ entryPoints:['src/server/vercelEntry.ts'], outfile:'api/index.js',bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',sourcemap:false });
