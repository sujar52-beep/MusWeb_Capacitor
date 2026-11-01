import { cp, mkdir } from 'node:fs/promises';

await mkdir('www', { recursive: true });
for (const file of ['index.html', 'style.css', 'game.js']) {
  await cp(file, `www/${file}`);
}
await cp('cartas', 'www/cartas', { recursive: true, force: true });
console.log('Archivos web copiados a www/.');
