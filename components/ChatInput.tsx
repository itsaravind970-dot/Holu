
import React, { useState } from 'react';
import { Send, Image as ImageIcon, Sparkles, Mic, MicOff, Shield, ShieldAlert, Cpu } from 'lucide-react';
import { HuluMode } from '../types';

interface Props {
  onSend: (text: string, mode: HuluMode, image?: { data: string; mimeType: string }) => void;
  onGenerateImage: (prompt: string) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<Props> = ({ onSend, onGenerateImage, disabled }) => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<HuluMode>('normal');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text, mode);
      setText('');
    }
  };

  return (
    <div className="bg-white p-4 border-t border-slate-100 glass">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('normal')}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${mode === 'normal' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
          >
            <Shield size={10} /> Normal
          </button>
          <button
            type="button"
            onClick={() => setMode('pro')}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${mode === 'pro' ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-slate-100 text-slate-500'}`}
          >
            <ShieldAlert size={10} /> Pro Mode
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => onGenerateImage(text)}
            disabled={!text.trim() || disabled}
            className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50 transition-all flex items-center gap-1.5"
          >
            <ImageIcon size={10} /> Image Lab
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-2 border border-slate-200 focus-within:border-green-400 focus-within:ring-4 focus-within:ring-green-100/50 transition-all">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit(e))}
            placeholder={mode === 'pro' ? "HULU Pro: Analyzing expression..." : "Message HULU..."}
            className="flex-1 bg-transparent border-none focus:outline-none text-sm font-medium p-2 h-10 resize-none overflow-hidden"
          />
          <button
            type="submit"
            disabled={!text.trim() || disabled}
            className={`p-2.5 rounded-xl transition-all ${!text.trim() || disabled ? 'bg-slate-200 text-slate-400' : 'bg-green-500 text-white hover:bg-green-600 shadow-lg active:scale-95'}`}
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
