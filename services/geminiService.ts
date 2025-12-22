
import { GoogleGenAI, Modality } from "@google/genai";
import { ChatMessage } from "../types";

const MASTER_PROMPT = `You are "Hulu assis", a world-class AI assistant developed for Aravind. 
You provide elite, accurate, and helpful responses. Use Markdown for formatting.
Always respond as the user's chosen Bot identity if applicable. 
You are currently powered by the Gemini 2.5 Flash engine.`;

// Using the provided API key as a fallback to ensure the user gets responses immediately
const API_KEY = process.env.API_KEY || "AIzaSyC12LW4wzwTPPtS6BekGUzv75QeO3H3u-A";

export const geminiService = {
  async chatWithHistory(
    history: ChatMessage[],
    newMessage: string,
    media?: { data: string; mimeType: string },
    signal?: AbortSignal
  ) {
    if (!API_KEY || API_KEY === "undefined") {
      throw new Error("API_KEY_MISSING");
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: msg.parts.map(p => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        return { text: '' };
      })
    })).filter(c => c.parts.length > 0);

    const currentParts: any[] = [{ text: newMessage }];
    if (media) {
      currentParts.push({
        inlineData: { data: media.data, mimeType: media.mimeType }
      });
    }

    contents.push({ role: 'user', parts: currentParts });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents as any,
        config: {
          systemInstruction: MASTER_PROMPT,
          temperature: 0.7,
          topP: 0.9,
          tools: [{ googleSearch: {} }]
        }
      });
      
      if (signal?.aborted) throw new Error('AbortError');
      return response;
    } catch (error: any) {
      if (error.message === 'AbortError') throw error;
      console.error("Transmission Error:", error);
      throw error;
    }
  },

  async textToSpeech(text: string) {
    if (!API_KEY || API_KEY === "undefined") return null;
    
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    try {
      const cleanText = text.replace(/[`*#]/g, '').slice(0, 300);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });
      const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      return audioPart?.inlineData?.data || null;
    } catch (error) {
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
