
import React, { useState, useRef, useEffect } from 'react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled) {
      onStop();
      return;
    }
    
    if (text.trim() || file) {
      onSend(text, file ? { data: file.data, mimeType: file.mimeType } : undefined);
      setText(''); 
      setFile(null);
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
    <div className="px-4 py-3 bg-white border-t border-slate-100 pb-[calc(10px+env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto space-y-2">
        {file && (
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 w-fit">
            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[150px] uppercase pl-2">{file.name}</span>
            <button onClick={() => setFile(null)} className="p-1"><X size={12} /></button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-slate-50 rounded-[28px] p-2 border border-slate-200 focus-within:border-slate-400 transition-all shadow-sm">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
             const f = e.target.files?.[0];
             if (f) {
                const reader = new FileReader();
                reader.onloadend = () => setFile({ data: (reader.result as string).split(',')[1], mimeType: f.type, name: f.name });
                reader.readAsDataURL(f);
             }
          }} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-slate-900 transition-colors shrink-0"><Paperclip size={20} /></button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={disabled ? "Processing..." : "Type command..."}
            className="flex-1 bg-transparent border-none focus:outline-none text-[15px] font-medium py-3 px-1 max-h-[120px] resize-none leading-tight placeholder:text-slate-400"
            disabled={disabled}
          />
          <button 
            type="button" 
            onClick={handleSubmit} 
            className={`p-3.5 rounded-2xl transition-all shrink-0 ${(!text.trim() && !file) && !disabled ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white shadow-lg active:scale-95'}`}
          >
            {disabled ? <Square size={16} fill="currentColor" className="animate-pulse" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
