import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, './dist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const targets = [
  { file: 'mobile.html', dir: 'mobile' },
  { file: 'admin.html', dir: 'admin' },
  { file: 'screen.html', dir: 'screen' }
];

targets.forEach(target => {
  const srcPath = path.join(distDir, target.file);
  if (fs.existsSync(srcPath)) {
    const destDir = path.join(distDir, target.dir);
    ensureDir(destDir);
    const destPath = path.join(destDir, 'index.html');
    fs.renameSync(srcPath, destPath);
    console.log(`Successfully moved and renamed: ${target.file} -> ${target.dir}/index.html`);
  } else {
    console.warn(`File not found, skipping: ${target.file}`);
  }
});

console.log('Build output structured for Nginx successfully!');
