
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
1. ELITE REASONING: Every response must be thorough, structured, and insightful. Use bullet points for complex breakdowns and provide "best-in-class" solutions.
2. VISUAL ANALYSIS: You can analyze images with high precision. When an image is provided, describe its components, context, and any specific details requested.
3. LIMITATIONS: Do not attempt to process videos. Do not generate images or videos.
4. TONE: Professional, helpful, and highly intelligent.

GOAL:
Act as a primary research, coding, and analytical partner for the user. Always deliver the most accurate and high-quality information available.`;

export const geminiService = {
  // Fix: Generate content using gemini-3-pro-preview with search grounding, initializing right before use.
  async chatWithHistory(
    history: ChatMessage[],
    newMessage: string,
    media?: { data: string; mimeType: string },
    signal?: AbortSignal
  ) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
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

    const modelName = 'gemini-3-pro-preview';
    
    const config: any = {
      systemInstruction: MASTER_PROMPT,
      tools: [{ googleSearch: {} }],
      temperature: 0.7,
      topP: 0.95,
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

  // Fix: Generate speech using gemini-2.5-flash-preview-tts.
  async textToSpeech(text: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    try {
      let cleanText = text
        .replace(/```[\s\S]*?```/g, ' [Code omitted] ') 
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

// Fix: Implement raw PCM audio decoding as required by the Live/TTS APIs.
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
