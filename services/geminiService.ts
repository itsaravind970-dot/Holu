
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { ChatMessage, MessagePart } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  async chatWithHistory(
    history: ChatMessage[],
    newMessage: string,
    isDeepAnalysis: boolean,
    image?: { data: string; mimeType: string }
  ) {
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: msg.parts.map(p => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        return { text: '' };
      })
    }));

    const currentParts: any[] = [{ text: newMessage }];
    if (image) {
      currentParts.push({
        inlineData: {
          data: image.data,
          mimeType: image.mimeType
        }
      });
    }

    contents.push({
      role: 'user',
      parts: currentParts
    });

    // Dynamic system instruction based on "Deep Analysis" mode
    const systemInstruction = isDeepAnalysis 
      ? "You are a Deep Analysis Expert. Analyze information from multiple search sources if available. Remove repeated points. Pick only the strongest and unique insights. Explain core concepts clearly with structural depth and examples."
      : "You are a helpful AI Search Assistant. Provide clear, accurate, and concise answers. Use internet search to verify latest information.";

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents as any,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: systemInstruction
      }
    });

    return response;
  },

  async textToSpeech(text: string) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Read this response naturally: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio generated");

      return base64Audio;
    } catch (error) {
      console.error("TTS Error:", error);
      return null;
    }
  }
};

export async function decodeAudioData(
  base64: string,
  ctx: AudioContext
): Promise<AudioBuffer> {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const dataInt16 = new Int16Array(bytes.buffer);
  const numChannels = 1;
  const sampleRate = 24000;
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
