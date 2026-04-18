import { GoogleGenAI } from '@google/genai';
import mime from 'mime';
import fs from 'fs';
import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyD3X5De06kuXZvMocRpS6teuFiv23ZuhHA";
const AUDIO_DIR = 'public/audio/tts-enceladius';
const TRAKTAT_PATH = 'data/traktat.json';
const FOREORD_PATH = 'data/foreord.json';
const ETTERORD_PATH = 'data/etterord.json';

const genAI = new GoogleGenAI({ apiKey: API_KEY });
const MODEL_NAME = 'gemini-3.1-flash-tts-preview';

async function generateAudio(id, text, filename) {
  const targetPath = path.join(AUDIO_DIR, filename);
  if (fs.existsSync(targetPath)) {
    return;
  }

  console.log(`  - Generating ${filename}...`);
  
  const config = {
    temperature: 0.2,
    responseModalities: ['audio'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Enceladus',
        }
      }
    },
  };

  const contents = [
    {
      role: 'user',
      parts: [{ text: `## Scene:\nles lovtekstar på nynorsk, eldre filosofisk herremann\n\n## Transcript:\n${id}. ${text}` }],
    },
  ];

  try {
    const result = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents,
      config
    });

    const part = result.candidates[0].content.parts.find(p => p.inlineData);
    
    if (part) {
      const inlineData = part.inlineData;
      let buffer = Buffer.from(inlineData.data, 'base64');
      
      if (inlineData.mimeType.includes('audio/L16')) {
         buffer = convertToWav(inlineData.data, inlineData.mimeType);
      }
      
      fs.writeFileSync(targetPath, buffer);
      console.log(`    ✓ Saved ${filename}`);
    }
  } catch (err) {
    console.error(`    × Error generating ${filename}:`, err.message);
    if (err.message.includes('429')) {
       console.log("      (Rate limit hit, consider reducing concurrency)");
    }
  }
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

async function main() {
  const traktat = JSON.parse(fs.readFileSync(TRAKTAT_PATH, 'utf8'));
  const foreord = JSON.parse(fs.readFileSync(FOREORD_PATH, 'utf8'));
  const etterord = JSON.parse(fs.readFileSync(ETTERORD_PATH, 'utf8'));

  function flatten(nodes) {
    let res = [];
    for (const n of nodes) {
      if (n.text) {
        res.push({ id: n.id, text: n.text.replace(/<[^>]+>/g, ''), status: n.status || '' });
      }
      if (n.children) res = res.concat(flatten(n.children));
    }
    return res;
  }

  const allTasks = [];

  // 1. Foreord
  for (let i = 0; i < foreord.blocks.length; i++) {
    const block = foreord.blocks[i];
    if (block.text) {
      const text = block.text.replace(/<[^>]+>/g, '');
      allTasks.push({ id: `føreord ${i+1}`, text, filename: `forord-${i}.wav` });
    }
  }

  // 2. Etterord
  for (let i = 0; i < etterord.blocks.length; i++) {
    const block = etterord.blocks[i];
    if (block.text) {
      const text = block.text.replace(/<[^>]+>/g, '');
      allTasks.push({ id: `etterord ${i+1}`, text, filename: `etterord-${i}.wav` });
    }
  }

  // 3. Propositions
  const allProps = flatten(traktat);
  for (const p of allProps) {
    allTasks.push({ id: p.id, text: p.text, filename: `${p.id}${p.status}.wav` });
  }

  console.log(`Starting generation for ${allTasks.length} tasks...`);

  const CONCURRENCY = 5;
  const queue = [...allTasks];
  const active = [];

  async function processQueue() {
    while (queue.length > 0) {
      if (active.length < CONCURRENCY) {
        const task = queue.shift();
        const p = generateAudio(task.id, task.text, task.filename).then(() => {
           active.splice(active.indexOf(p), 1);
        });
        active.push(p);
        // Small stagger
        await new Promise(r => setTimeout(r, 500));
      } else {
        await Promise.race(active);
      }
    }
    await Promise.all(active);
  }

  await processQueue();

  console.log("Done!");
}

main();
