
import React, { useState, useRef } from 'react';
import { Send, Zap, Paperclip, X, Square } from 'lucide-react';

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
    if (disabled) {
      onStop();
      return;
    }
    
    if (text.trim() || file) {
      onSend(text, file ? { data: file.data, mimeType: file.mimeType } : undefined);
      setText(''); setFile(null);
    }
  };

  return (
    <div className="bg-white/98 backdrop-blur-xl px-4 py-3 border-t border-slate-100 shrink-0 pb-[calc(12px+env(safe-area-inset-bottom))] z-40">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex flex-col gap-2">
        {file && (
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 w-fit animate-in slide-in-from-bottom-2 duration-200">
            <span className="text-[8px] sm:text-[9px] font-black text-slate-700 truncate max-w-[120px] sm:max-w-[200px] uppercase pl-2">{file.name}</span>
            <button type="button" onClick={() => setFile(null)} className="p-1 hover:bg-slate-200 rounded-full"><X size={12} /></button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-slate-50 rounded-[20px] sm:rounded-2xl p-1.5 sm:p-2 border border-slate-200 focus-within:ring-4 focus-within:ring-slate-100 transition-all shadow-sm">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
             const f = e.target.files?.[0];
             if (f) {
                const reader = new FileReader();
                reader.onloadend = () => setFile({ data: (reader.result as string).split(',')[1], mimeType: f.type, name: f.name });
                reader.readAsDataURL(f);
             }
          }} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-slate-900 transition-colors shrink-0"><Paperclip size={18} /></button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit(e))}
            placeholder={disabled ? "Synthesizing Node..." : "Type command..."}
            className="flex-1 bg-transparent border-none focus:outline-none text-[12px] sm:text-[13px] font-medium py-2 px-1 h-[40px] resize-none overflow-hidden leading-normal placeholder:text-slate-400"
            disabled={disabled}
          />
          <button type="submit" className={`p-2.5 sm:p-3 rounded-xl transition-all shrink-0 ${(!text.trim() && !file) && !disabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white shadow-lg active:scale-95 cursor-pointer'}`}>
            {disabled ? <Square size={16} fill="currentColor" className="animate-pulse" /> : <Send size={16} />}
          </button>
        </div>
        <div className="flex items-center justify-center gap-1.5 h-4">
          <Zap size={8} className="text-green-500 animate-pulse" />
          <p className="text-[7px] sm:text-[8px] text-slate-400 font-black uppercase tracking-widest">Secure Uplink</p>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
