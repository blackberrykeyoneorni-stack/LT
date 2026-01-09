const fs = require('fs');
const path = require('path');

const getAllFiles = function(dirPath, arrayOfFiles) {
  // HIER WAR DER FEHLER: 'const' fehlte
  const files = fs.readdirSync(dirPath); 
  
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, "/", file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      // Nur Text-Dateien (Code) einschließen
      if (file.match(/\.(js|jsx|css|json|html|txt|md)$/i)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

try {
  // Prüfen, ob der src Ordner existiert
  if (!fs.existsSync("./src")) {
    throw new Error("Der Ordner './src' wurde nicht gefunden. Bitte führe das Skript im Hauptverzeichnis des Projekts aus.");
  }

  const allFiles = getAllFiles("./src");
  let output = "";

  console.log(`Gefunden: ${allFiles.length} Dateien.`);

  allFiles.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        output += `\n\n================================================================================\nFILE: ${file}\n================================================================================\n${content}`;
    } catch (err) {
        console.log(`Konnte Datei nicht lesen (übersprungen): ${file}`);
    }
  });

  fs.writeFileSync("src_complete.txt", output);
  console.log("ERFOLG: 'src_complete.txt' wurde erstellt!");

} catch (e) {
  console.error("FEHLER:", e.message);
}
