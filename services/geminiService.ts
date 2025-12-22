
import { GoogleGenAI, Modality } from "@google/genai";
import { ChatMessage } from "../types";

const MASTER_PROMPT = `You are "Aravind's bot", an elite AI assistant. 
You provide professional, accurate, and concise responses. 
Always use clean Markdown formatting. 
Respond as a high-tier intelligence hub designed for business efficiency.`;

export const geminiService = {
  async chatWithHistory(
    history: ChatMessage[],
    newMessage: string,
    media?: { data: string; mimeType: string },
    signal?: AbortSignal
  ) {
    if (!process.env.API_KEY) {
      throw new Error("API configuration missing. Check environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Map history to the format required by the SDK
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: msg.parts.map(p => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        return { text: '' };
      })
    })).filter(c => c.parts.length > 0);

    // Add current user message
    const currentParts: any[] = [{ text: newMessage }];
    if (media) {
      currentParts.push({
        inlineData: { data: media.data, mimeType: media.mimeType }
      });
    }

    contents.push({ role: 'user', parts: currentParts });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents as any,
        config: {
          systemInstruction: MASTER_PROMPT,
          temperature: 0.8,
          topP: 0.95,
        }
      });
      
      if (signal?.aborted) throw new Error('AbortError');

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("Intelligence hub returned an empty response.");
      }

      return response;
    } catch (error: any) {
      if (error.message === 'AbortError') throw error;
      console.error("Gemini Critical Error:", error);
      throw error;
    }
  },

  async textToSpeech(text: string) {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
