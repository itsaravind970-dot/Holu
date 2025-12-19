
import { GoogleGenAI, Modality } from "@google/genai";
import { ChatMessage, HuluMode } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  async chatWithHistory(
    history: ChatMessage[],
    newMessage: string,
    mode: HuluMode,
    media?: { data: string; mimeType: string }
  ) {
    const ai = getAI();
    
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

    const isPro = mode === 'pro';
    const model = isPro ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    const systemInstruction = isPro 
      ? `You are HULU Pro. Analyze the user's text and expression (tone/sentiment). React empathetically or professionally based on their mood.
         You have access to global platforms via Google Search. 
         IMPORTANT: After your main response, add a section labeled 'SPEECH_SUMMARY:' containing the most important 2-3 points for audio playback.`
      : `You are HULU AI. Provide fast, accurate, and helpful answers. Be concise.`;

    const config: any = {
      systemInstruction,
      tools: isPro ? [{ googleSearch: {} }] : [],
    };

    try {
      const response = await ai.models.generateContent({
        model,
        contents: contents as any,
        config
      });
      return response;
    } catch (error: any) {
      console.error("HULU API Error:", error);
      throw error;
    }
  },

  async generateImage(prompt: string) {
    const ai = getAI();
    try {
      // Using gemini-2.5-flash-image for free, high-quality generation
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }]
        },
        config: { 
          imageConfig: { 
            aspectRatio: "1:1" 
          } 
        }
      });

      if (response.candidates?.[0]?.content?.parts) {
        const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
          return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        }
      }
      throw new Error("The model did not return an image. It might be a safety filter or complex prompt.");
    } catch (error) {
      console.error("HULU Image Error:", error);
      throw error;
    }
  },

  async textToSpeech(text: string) {
    const ai = getAI();
    try {
      // Aggressive cleaning to prevent 500 INTERNAL errors
      const summaryMatch = text.match(/SPEECH_SUMMARY:\s*([\s\S]*)/i);
      let cleanText = summaryMatch ? summaryMatch[1] : text;
      
      cleanText = cleanText
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks entirely
        .replace(/[*_#`\[\]()]/g, '') // Remove markdown syntax
        .replace(/[^\w\s.,?!']/g, ' ') // Remove all special symbols that cause model crashes
        .replace(/\s+/g, ' ') // Collapse spaces
        .slice(0, 150) // Keep it very short for stability
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
      // Silently fail TTS if it errors, as it's a non-critical preview feature
      console.warn("TTS failed:", error);
      return null;
    }
  }
};

export async function decodeAudioData(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
  return buffer;
}
