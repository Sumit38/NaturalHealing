// Copies the files tsc does not compile (the web page and the reporters) next to the compiled code.
import { cpSync } from 'node:fs';

cpSync('src/server/public', 'dist/server/public', { recursive: true });
cpSync('src/reporters', 'dist/reporters', { recursive: true });
