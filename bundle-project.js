import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Da __dirname in ES-Modules nicht existiert, erstellen wir es:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konfiguration: Welche Ordner/Dateien sollen ignoriert werden?
const IGNORE_DIRS = ['node_modules', '.git', 'build', 'dist', '.firebase', 'public', '.idea', '.vscode'];
const IGNORE_FILES = ['package-lock.json', 'yarn.lock', '.DS_Store', 'bundle-project.js', 'logo.svg', 'reportWebVitals.js', 'setupTests.js'];
const ALLOWED_EXTENSIONS = ['.js', '.jsx', '.css', '.html', '.json', '.rules'];

// Ausgabedatei
const OUTPUT_FILE = 'PROJECT_FULL_CODE.txt';

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (!IGNORE_FILES.includes(file) && ALLOWED_EXTENSIONS.includes(path.extname(file))) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

const projectFiles = getAllFiles(__dirname);
let outputContent = `PROJEKT EXPORT: ${new Date().toISOString()}\n\n`;

projectFiles.forEach(file => {
    // Relativen Pfad berechnen für bessere Lesbarkeit
    const relativePath = path.relative(__dirname, file);
    
    try {
        const content = fs.readFileSync(file, 'utf8');
        outputContent += `\n\n================================================================================\n`;
        outputContent += `FILE: ${relativePath}\n`;
        outputContent += `================================================================================\n`;
        outputContent += content + `\n`;
    } catch (err) {
        console.error(`Fehler beim Lesen von ${relativePath}:`, err);
    }
});

fs.writeFileSync(OUTPUT_FILE, outputContent);
console.log(`Fertig! Alle Codes wurden in "${OUTPUT_FILE}" gespeichert.`);
