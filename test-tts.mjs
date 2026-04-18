import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const API_KEY = "AIzaSyD3X5De06kuXZvMocRpS6teuFiv23ZuhHA";
const genAI = new GoogleGenAI({ apiKey: API_KEY });
const MODEL_NAME = 'gemini-3.1-flash-tts-preview';

async function test() {
  console.log("Testing TTS with gemini-3.1-flash-tts-preview...");
  const text = "Denne boka er eit drastisk tiltak. Målet er ikkje å forbetre designfaget; det er å etablere grunnen faget kan stå på.";
  
  const config = {
    responseModalities: ['audio'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Enceladus',
        }
      }
    },
  };

  try {
    const result = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text }] }],
      config
    });

    const part = result.candidates[0].content.parts.find(p => p.inlineData);
    if (part) {
      console.log("✓ Success! Received audio data. MimeType:", part.inlineData.mimeType);
      let buffer = Buffer.from(part.inlineData.data, 'base64');
      
      if (part.inlineData.mimeType.includes('audio/L16')) {
        console.log("Wrapping raw L16 in WAV header...");
        buffer = convertToWav(part.inlineData.data, part.inlineData.mimeType);
      }
      
      fs.writeFileSync('test-output.wav', buffer);
      console.log("✓ Saved test-output.wav");
    } else {
      console.log("× No audio data in response.");
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error("× Error:", err.message);
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

test();
