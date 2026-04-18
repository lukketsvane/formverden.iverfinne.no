import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyD3X5De06kuXZvMocRpS6teuFiv23ZuhHA";
const ai = new GoogleGenAI({ apiKey: API_KEY });
const MODEL_NAME = 'gemini-2.5-pro-preview-tts'; 

const results = [];
const CSV_FILNAMN = 'public/audio/missing_innhald.csv';
const OUTPUT_DIR = 'C:\\Users\\Shadow\\Documents\\GitHub\\stolar-db\\writings\\traktat\\audio';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function convertToWav(rawDataB64, mimeType) {
  const options = parseMimeType(mimeType);
  const buffer = Buffer.from(rawDataB64, 'base64');
  const wavHeader = createWavHeader(buffer.length, options);
  return Buffer.concat([wavHeader, buffer]);
}

function parseMimeType(mimeType) {
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
  const options = { numChannels: 1, sampleRate: 24000, bitsPerSample: 16 };
  for (const param of params) {
    const [key, value] = param.split('=');
    if (key === 'rate') options.sampleRate = parseInt(value, 10);
  }
  return options;
}

function createWavHeader(dataLength, options) {
  const { numChannels, sampleRate, bitsPerSample } = options;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const buffer = Buffer.alloc(44);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  return buffer;
}

fs.createReadStream(CSV_FILNAMN)
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    console.log(`Leste inn ${results.length} proposisjonar. Startar lydgenerering...`);

    for (const row of results) {
      const id = row['Nummer'];
      const tekst = row['Tekst'];

      if (!id || !tekst) continue;

      const voiceName = "Fenrir";
      const filnamn = `${voiceName}_${id}.wav`;
      const targetPath = path.join(OUTPUT_DIR, filnamn);

      if (fs.existsSync(targetPath)) {
        console.log(`Hoppar over ${filnamn}, fil eksisterer allereie.`);
        continue;
      }

      try {
        console.log(`Genererer lyd for proposisjon ${id}...`);

        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: [{ 
            parts: [{ 
              text: "Les denne proposisjonen monotomt og tydelig: " + tekst 
            }] 
          }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName
                }
              }
            }
          }
        });

        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (part && part.inlineData) {
           const inlineData = part.inlineData;
           let buffer = Buffer.from(inlineData.data, 'base64');
           
           if (inlineData.mimeType.includes('audio/L16')) {
              buffer = convertToWav(inlineData.data, inlineData.mimeType);
           }

           fs.writeFileSync(targetPath, buffer);
           console.log(`-> Lagra ${filnamn} i ${OUTPUT_DIR}`);
        } else {
           console.log(`-> Feil: Fekk inga lyd tilbake for proposisjon ${id}.`);
        }

      } catch (error) {
        console.error(`-> Feil ved API-kall for proposisjon ${id}:`, error.message);
        if (error.message.includes('429')) {
          console.log('-> Rate limit hit, stopping script.');
          break;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('Ferdig!');
  });