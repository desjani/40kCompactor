import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

console.log('Running test suite...');
const testPath = fileURLToPath(new URL('../test/v11_parser.test.mjs', import.meta.url));
const result = spawnSync(process.execPath, [testPath], { stdio: 'inherit' });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
console.log('All tests completed successfully.');
