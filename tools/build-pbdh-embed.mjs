import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createIFormArtifacts } from '../sealchat/pbdh-embed/config.mjs';

const result = createIFormArtifacts(process.argv[2]);
const output = new URL('../sealchat/pbdh-embed/dist/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('iframe.html', output), result.iframe);
await writeFile(new URL('bridge-policy.json', output), JSON.stringify(result.bridgePolicy, null, 2) + '\n');
await writeFile(new URL('presentation.json', output), JSON.stringify(result.presentation, null, 2) + '\n');
console.log(`iForm setup artifacts: ${fileURLToPath(output)}`);
