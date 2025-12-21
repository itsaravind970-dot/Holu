
// services/geminiService.ts
import { GoogleGenAI, Modality } from "@google/genai";
import { ChatMessage } from "../types";

const MASTER_PROMPT = `You are "Hulu assis", a world-class AI companion engineered for elite performance, deep reasoning, and precise analysis.

────────────────────────
IDENTITY & ORIGIN
────────────────────────
Project Name: Hulu assis
Founder: Aravind
Mission: To provide the highest tier of artificial intelligence, combining advanced logic, creative depth, and real-time synthesis.

────────────────────────
OPERATIONAL PROTOCOLS
────────────────────────
1. ELITE REASONING: Every response must be thorough, structured, and insightful. Use bullet points for complex breakdowns.
2. VISUAL ANALYSIS: You can analyze images with high precision.
3. TONE: Professional, helpful, and highly intelligent.

GOAL:
Act as a primary research and coding partner. Always deliver accurate, high-quality info.`;

export const geminiService = {
  async chatWithHistory(
    history: ChatMessage[],
    newMessage: string,
    media?: { data: string; mimeType: string },
    signal?: AbortSignal
  ) {
    if (!process.env.API_KEY) {
      throw new Error("API KEY MISSING. Please configure the environment variable.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: msg.parts.map(p => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        return { text: '' };
      })
    }));

    const currentParts: any[] = [{ text: newMessage }];
    if (media) {
      currentParts.push({
        inlineData: {
          data: media.data,
          mimeType: media.mimeType
        }
      });
    }

    contents.push({
      role: 'user',
      parts: currentParts
    });

    // gemini-3-flash-preview is more widely available and faster for general chat
    const modelName = 'gemini-3-flash-preview';
    
    const config: any = {
      systemInstruction: MASTER_PROMPT,
      tools: [{ googleSearch: {} }],
      temperature: 0.7,
      topP: 0.95,
      thinkingConfig: { thinkingBudget: 0 } // Flash doesn't need high budget for chat
    };

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents as any,
        config
      });
      
      if (signal?.aborted) {
        throw new Error('AbortError');
      }
      
      return response;
    } catch (error: any) {
      if (error.message === 'AbortError' || signal?.aborted) {
        throw new Error('AbortError');
      }
      console.error("Hulu assis Core Error:", error);
      throw error;
    }
  },

  async textToSpeech(text: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    try {
      let cleanText = text
        .replace(/```[\s\S]*?```/g, ' [Code content] ') 
        .replace(/[*_#`\[\]()]/g, ' ') 
        .replace(/[^\w\s.,?!']/g, ' ') 
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText || cleanText.length < 2) return null;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: 'Kore' } 
            },
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      return audioPart?.inlineData?.data || null;
    } catch (error) {
      console.warn("TTS System Error:", error);
      return null;
    }
  }
};

export async function decodeAudioData(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const dataInt16 = new Int16Array(bytes.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
  return buffer;
}
