
import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, X, Zap, Loader2 } from 'lucide-react';

interface Props {
  onSend: (text: string, isDeep: boolean, image?: { data: string; mimeType: string }) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<Props> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [isDeep, setIsDeep] = useState(false);
  const [image, setImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setImage({
          data: base64,
          mimeType: file.type,
          preview: URL.createObjectURL(file)
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((text.trim() || image) && !disabled) {
      onSend(text, isDeep, image ? { data: image.data, mimeType: image.mimeType } : undefined);
      setText('');
      setImage(null);
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white p-4 pb-6">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
           {image ? (
            <div className="relative inline-block">
              <img src={image.preview} alt="Preview" className="h-14 w-14 object-cover rounded-xl border border-slate-200 shadow-sm" />
              <button 
                type="button"
                onClick={() => setImage(null)}
                className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-1 hover:bg-red-500 shadow-md transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isDeep ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isDeep}
                    onChange={(e) => setIsDeep(e.target.checked)}
                  />
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isDeep ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${isDeep ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  Deep Analysis Mode 🔬
                </span>
              </label>
            </div>
          )}
        </div>
        
        <div className="flex items-end gap-3 bg-slate-50 rounded-2xl p-2 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100/50 transition-all">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-slate-400 hover:text-indigo-600 p-2.5 rounded-xl transition-colors mb-0.5"
            title="Upload image"
          >
            <ImageIcon size={20} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <textarea
            value={text}
            rows={1}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Search the internet or analyze an image..."
            disabled={disabled}
            className="flex-1 bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400 py-3 px-1 resize-none min-h-[48px] max-h-[200px]"
          />
          <button
            type="submit"
            disabled={(!text.trim() && !image) || disabled}
            className={`p-3 rounded-xl transition-all mb-0.5 ${(!text.trim() && !image) || disabled ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md active:scale-95'}`}
          >
            {disabled ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
          Gemini 3 Flash • Search-Integrated AI
        </p>
      </form>
    </div>
  );
};

export default ChatInput;
