La oss generere ved bruk av ge gemini-2.5-pro-preview-tts  lyd for kvar presposisjon 
merk style instruictions: les denne proposisjonen monotomt og tydelig


output til denne mapppa og namngi lydfila etter voicename + proposisjonsnummer i.e. algieba_1.11
C:\Users\Shadow\Documents\GitHub\stolar-db\writings\traktat\audio

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import csv from 'csv-parser';

// Initier Gemini-klienten (den hentar GEMINI_API_KEY automatisk)
const ai = new GoogleGenAI();
const MODEL_NAME = 'gemini-2.5-pro-preview-tts'; 

const results = [];
const CSV_FILNAMN = 'Formverda_ Ein oversikt - Formverda_ Ein oversikt.csv';

// 1. Les CSV-fila
fs.createReadStream(CSV_FILNAMN)
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    console.log(`Leste inn ${results.length} proposisjonar. Startar lydgenerering...`);

    // 2. Løkk gjennom kvar proposisjon
    for (const row of results) {
      const id = row['Nummer'];
      const tekst = row['Tekst'];

      if (!id || !tekst) continue; // Hopp over tomme rader

      try {
        console.log(`Genererer lyd for proposisjon ${id}...`);

        // Gjer API-kallet for å hente ut lyden
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: [{ 
            parts: [{ 
              // Eit lite tips for kontroll: Modellen forstår "regibemerkningar".
              // Vil du endre tempo, kan du prefixe teksten, t.d.: 
              // text: "Les sakte, tydeleg og filosofisk på norsk: " + tekst
              text: tekst 
            }] 
          }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  // Her sikrar vi konsistensen! 
                  // Nokre godkjende stemmer: 'Kore', 'Fenrir', 'Puck', 'Aoede', 'Charon'
                  voiceName: "Fenrir" 
                }
              }
            }
          }
        });

        // 3. Trekk ut lyden og lagre som lydfil
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (base64Audio) {
           const buffer = Buffer.from(base64Audio, 'base64');
           // Døyper filene etter proposisjonsnummeret slik at du lett kan byggje dei inn på nettsida
           const filnamn = `proposisjon_${id}.wav`; 
           fs.writeFileSync(filnamn, buffer);
           console.log(`-> Lagra ${filnamn}`);
        } else {
           console.log(`-> Feil: Fekk inga lyd tilbake for proposisjon ${id}.`);
        }

      } catch (error) {
        console.error(`-> Feil ved API-kall for proposisjon ${id}:`, error);
      }
      
      // Valfritt: Legg inn ein liten pause mellom kalla for å unngå "rate-limiting" om du har mange rader
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Alle lydfiler er genererte og klare for formverden.iverfinne.no!');
  });