
import React, { useState, useRef } from 'react';
import { Send, Zap, Paperclip, X, FileImage, ShieldCheck, Square } from 'lucide-react';

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
    if ((text.trim() || file)) {
      onSend(text, file ? { data: file.data, mimeType: file.mimeType } : undefined);
      setText('');
      setFile(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        alert("Only image analysis is supported in this architecture.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setFile({ 
          data: base64String, 
          mimeType: selectedFile.type,
          name: selectedFile.name 
        });
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  return (
    <div className="bg-white p-5 border-t border-slate-100 glass relative">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="px-4 py-1.5 bg-green-500/10 text-green-600 rounded-full border border-green-500/20 flex items-center gap-2">
            <ShieldCheck size={12} />
            <span className="text-[10px] font-black uppercase tracking-widest">Elite Intelligence Active</span>
          </div>
        </div>

        {file && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 w-fit animate-in slide-in-from-bottom-2">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <FileImage size={16} className="text-green-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analysis Pending</span>
              <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{file.name}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setFile(null)}
              className="p-1 hover:bg-slate-200 rounded-full transition-colors ml-2"
            >
              <X size={14} className="text-slate-400" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 bg-slate-50 rounded-[28px] p-3 border border-slate-200 focus-within:border-slate-900 focus-within:ring-8 focus-within:ring-slate-100 transition-all">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange}
            accept="image/*"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-3 text-slate-400 hover:text-slate-900 transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
            title="Attach Image for Analysis"
            disabled={disabled}
          >
            <Paperclip size={20} />
          </button>
          
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit(e))}
            placeholder={disabled ? "Processing Elite Logic..." : "Ask Hulu assis anything..."}
            className="flex-1 bg-transparent border-none focus:outline-none text-[15px] font-medium p-3 h-12 resize-none overflow-hidden custom-scrollbar"
            disabled={disabled}
          />
          <button
            type={disabled ? "button" : "submit"}
            onClick={disabled ? onStop : undefined}
            className={`p-4 rounded-2xl transition-all ${(!text.trim() && !file) && !disabled ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white hover:bg-black shadow-xl active:scale-95'}`}
          >
            {disabled ? <Square size={20} fill="currentColor" className="animate-pulse" /> : <Send size={20} />}
          </button>
        </div>
        <div className="flex justify-center">
           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
             <Zap size={10} className="text-green-500" /> Fully Secured & Optimized Architecture
           </p>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
