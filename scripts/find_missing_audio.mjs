import fs from 'fs';
import csv from 'csv-parser';

const existing = new Map();
fs.createReadStream('public/audio/preposisjons_innhald.csv')
  .pipe(csv())
  .on('data', (data) => existing.set(data['Nummer'], data['Tekst']))
  .on('end', () => {
     const traktat = JSON.parse(fs.readFileSync('data/traktat.json', 'utf8'));
     const foreord = JSON.parse(fs.readFileSync('data/foreord.json', 'utf8'));
     const etterord = JSON.parse(fs.readFileSync('data/etterord.json', 'utf8'));
     
     const current = new Map();
     
     function flatten(nodes) {
       for (const n of nodes) {
         if (n.text) {
            let num = n.id + (n.status || '');
            let cleanText = n.text.replace(/<[^>]+>/g, '').trim();
            current.set(num, cleanText);
         }
         if (n.children) flatten(n.children);
       }
     }
     flatten(traktat);
     
     for (let i = 0; i < foreord.blocks.length; i++) {
        if (foreord.blocks[i].text) {
           current.set(`forord-${i}`, foreord.blocks[i].text.replace(/<[^>]+>/g, '').trim());
        }
     }
     for (let i = 0; i < etterord.blocks.length; i++) {
        if (etterord.blocks[i].text) {
           current.set(`etterord-${i}`, etterord.blocks[i].text.replace(/<[^>]+>/g, '').trim());
        }
     }

     const missing = [];
     for (const [id, text] of current.entries()) {
        const ext = existing.get(id);
        if (!ext || ext.trim() !== text) {
           missing.push({ id, text });
        }
     }

     console.log(`Found ${missing.length} missing/changed items.`);
     let csvContent = 'Nummer,Tekst\n';
     for (const item of missing) {
        csvContent += `"${item.id}","${item.text.replace(/"/g, '""')}"\n`;
     }
     fs.writeFileSync('public/audio/missing_innhald.csv', csvContent);
     console.log('Saved to public/audio/missing_innhald.csv');
  });