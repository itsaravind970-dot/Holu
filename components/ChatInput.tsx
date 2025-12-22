
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Square, Zap } from 'lucide-react';

interface Props {
  onSend: (text: string, file?: { data: string; mimeType: string }) => void;
  onStop: () => void;
  disabled?: boolean;
}

const ChatInput: React.FC<Props> = ({ onSend, onStop, disabled }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled) { onStop(); return; }
    if (text.trim() || file) {
      onSend(text, file ? { data: file.data, mimeType: file.mimeType } : undefined);
      setText(''); setFile(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {file && (
        <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-xl border border-slate-700 w-fit animate-in slide-in-from-bottom-2">
          <span className="text-[8px] font-black text-green-400 truncate max-w-[120px] uppercase pl-1.5 tracking-widest">{file.name}</span>
          <button onClick={() => setFile(null)} className="p-1 bg-white/10 rounded-md text-white"><X size={10} /></button>
        </div>
      )}
      <div className="flex items-end gap-1.5 bg-slate-50 rounded-[24px] p-2 border border-slate-200 focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-100/50 transition-all shadow-sm">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
           const f = e.target.files?.[0];
           if (f) {
              const r = new FileReader();
              r.onloadend = () => setFile({ data: (r.result as string).split(',')[1], mimeType: f.type, name: f.name });
              r.readAsDataURL(f);
           }
        }} />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-slate-900 shrink-0 transition-colors"><Paperclip size={18} /></button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? "Synthesizing..." : "Type command..."}
          className="flex-1 bg-transparent border-none focus:outline-none text-[14px] font-medium py-2.5 px-0.5 max-h-[120px] resize-none leading-tight placeholder:text-slate-400"
          disabled={disabled}
        />
        <button type="button" onClick={handleSubmit} className={`p-3 rounded-2xl transition-all shrink-0 ${(!text.trim() && !file) && !disabled ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white shadow-lg active:scale-95'}`}>
          {disabled ? <Square size={16} fill="currentColor" className="animate-pulse" /> : <Send size={16} />}
        </button>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <Zap size={8} className="text-green-500" />
        <p className="text-[7px] text-slate-400 font-black uppercase tracking-[0.3em] leading-none">Secure Uplink established</p>
      </div>
    </div>
  );
};

export default ChatInput;
