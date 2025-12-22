
import { GoogleGenAI, Modality } from "@google/genai";
import { ChatMessage } from "../types";

const MASTER_PROMPT = `You are "Hulu assis", a professional, world-class AI assistant engineered for Aravind. 
Your intelligence is elite, your reasoning is deep, and your tone is sophisticated but helpful.
Always provide detailed, precise answers. Use bold text and bullet points for clarity. 
You represent the absolute peak of AI technology.`;

export const geminiService = {
  async chatWithHistory(
    history: ChatMessage[],
    newMessage: string,
    media?: { data: string; mimeType: string },
    signal?: AbortSignal
  ) {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "undefined") {
      throw new Error("API_KEY_MISSING");
    }

    const ai = new GoogleGenAI({ apiKey });
    
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
        model: 'gemini-3-flash-preview',
        contents: contents as any,
        config: {
          systemInstruction: MASTER_PROMPT,
          temperature: 0.8,
          topP: 0.95,
          tools: [{ googleSearch: {} }]
        }
      });
      
      if (signal?.aborted) throw new Error('AbortError');
      return response;
    } catch (error: any) {
      if (error.message === 'AbortError') throw error;
      console.error("Gemini Core Failure:", error);
      throw error;
    }
  },

  async textToSpeech(text: string) {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "undefined") return null;
    
    const ai = new GoogleGenAI({ apiKey });
    try {
      // Clean text for cleaner audio synthesis
      const cleanText = text.replace(/[`*#]/g, '').replace(/\[.*?\]/g, '').slice(0, 400);
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
