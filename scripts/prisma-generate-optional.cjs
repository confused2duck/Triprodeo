const { spawnSync } = require('child_process');

let result;

try {
  const prismaCli = require.resolve('prisma/build/index.js');
  result = spawnSync(process.execPath, [prismaCli, 'generate', '--schema', 'backend/prisma/schema.prisma'], {
    stdio: 'inherit',
    shell: false,
  });
} catch (error) {
  console.warn(`[postinstall] Prisma CLI was not found: ${error.message}`);
  process.exit(0);
}

if (result.status !== 0) {
  console.warn('[postinstall] Prisma generate skipped. Run `npx prisma generate --schema backend/prisma/schema.prisma` after dependencies are installed.');
}

process.exit(0);
