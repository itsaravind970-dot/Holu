
import React, { useState, useRef } from 'react';
import { Send, Paperclip, X, Zap, Square } from 'lucide-react';

interface Props {
  onSend: (text: string, file?: { data: string; mimeType: string }) => void;
  onStop: () => void;
  disabled?: boolean;
}

const ChatInput: React.FC<Props> = ({ onSend, onStop, disabled }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return onStop();
    if (text.trim() || file) {
      onSend(text, file ? { data: file.data, mimeType: file.mimeType } : undefined);
      setText(''); setFile(null);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl px-4 md:px-8 py-3 md:py-6 border-t border-slate-100 sticky bottom-0 z-30">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex flex-col gap-3">
        {file && (
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 w-fit animate-in slide-in-from-bottom-2">
            <span className="text-[9px] md:text-[11px] font-black text-slate-700 truncate max-w-[120px] md:max-w-[200px] uppercase pl-2">{file.name}</span>
            <button type="button" onClick={() => setFile(null)} className="p-1.5 bg-white border border-slate-200 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={12} /></button>
          </div>
        )}
        <div className="flex items-center gap-2 md:gap-4 bg-slate-50/80 rounded-[20px] md:rounded-[32px] p-2 md:p-3 border border-slate-200 focus-within:ring-4 focus-within:ring-slate-100 transition-all">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
             const f = e.target.files?.[0];
             if (f) {
                const r = new FileReader();
                r.onloadend = () => setFile({ data: (r.result as string).split(',')[1], mimeType: f.type, name: f.name });
                r.readAsDataURL(f);
             }
          }} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 md:p-3.5 bg-white border border-slate-100 rounded-xl md:rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm"><Paperclip size={18} /></button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit(e))}
            placeholder={disabled ? "Synthesizing Protocol..." : "Enter command..."}
            className="flex-1 bg-transparent border-none focus:outline-none text-[13px] md:text-[15px] font-medium py-3 px-1 md:px-2 h-11 md:h-12 resize-none custom-scrollbar"
            disabled={disabled}
          />
          <button type="submit" className={`p-3.5 md:p-4.5 rounded-[16px] md:rounded-[24px] transition-all flex items-center justify-center ${(!text.trim() && !file) && !disabled ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white shadow-xl active:scale-90 hover:bg-black'}`}>
            {disabled ? <Square size={18} fill="currentColor" className="animate-pulse" /> : <Send size={18} className="md:w-6 md:h-6" />}
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 pb-1">
          <div className="w-1 h-1 rounded-full bg-green-500"></div>
          <p className="text-[8px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.4em]">HULU ASSIS SECURE UPLINK</p>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
