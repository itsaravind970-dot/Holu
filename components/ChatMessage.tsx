
import React from 'react';
import { ChatMessage as ChatMessageType } from '../types';
import { User, Cpu, Play, Square, Loader2, Star, Copy, Terminal, FileImage } from 'lucide-react';

interface Props {
  message: ChatMessageType;
  onPlayAudio?: (messageId: string, text: string) => void;
  isAudioPlaying?: boolean;
  audioLoadingId?: string | null;
  onStar?: (message: ChatMessageType) => void;
  onSaveCode?: (code: string, lang: string) => void;
}

const ChatMessage: React.FC<Props> = ({ message, onPlayAudio, isAudioPlaying, audioLoadingId, onStar, onSaveCode }) => {
  const isUser = message.role === 'user';
  const isLoadingThisAudio = audioLoadingId === message.id;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const lines = part.split('\n');
        const lang = lines[0].replace('```', '').trim() || 'code';
        const code = lines.slice(1, -1).join('\n');
        
        return (
          <div key={i} className="my-5 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl animate-in zoom-in-95 w-full max-w-full">
            <div className="bg-slate-800 px-5 py-3 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3 text-slate-400">
                <Terminal size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{lang}</span>
              </div>
              <div className="flex items-center gap-4">
                 <button onClick={() => onSaveCode?.(code, lang)} className="text-slate-400 hover:text-green-400 transition-colors p-1" title="Save">
                    <Cpu size={14} />
                 </button>
                 <button onClick={() => handleCopy(code)} className="text-slate-400 hover:text-white transition-colors p-1" title="Copy">
                    <Copy size={14} />
                 </button>
              </div>
            </div>
            <div className="bg-slate-900 overflow-x-auto custom-scrollbar w-full">
              <pre className="p-6 md:p-8 min-w-full inline-block">
                <code className="text-sm text-green-400 font-mono whitespace-pre block leading-relaxed">{code}</code>
              </pre>
            </div>
          </div>
        );
      }
      return <div key={i} className="whitespace-pre-wrap leading-relaxed">{part}</div>;
    });
  };

  // Combine all text parts for full audio reading
  const fullTextContent = message.parts.map(p => p.text || '').join(' ').trim();

  return (
    <div className={`flex w-full mb-10 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex w-full md:max-w-[92%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-5`}>
        <div className={`flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform hover:scale-110 ${isUser ? 'bg-slate-900' : 'bg-green-500'}`}>
          {isUser ? <User size={18} className="text-white" /> : <Cpu size={18} className="text-white" />}
        </div>
        
        <div className={`flex flex-col min-w-0 flex-1 ${isUser ? 'items-end' : 'items-start'} gap-2`}>
          <div className={`p-5 md:p-6 rounded-[28px] shadow-sm text-[15px] w-full overflow-hidden ${isUser ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
            {message.parts.map((part, idx) => (
              <div key={idx} className="w-full">
                {part.inlineData && (
                  <div className="mb-4 p-3 bg-slate-800/20 border border-slate-300/30 rounded-2xl flex items-center gap-3 w-fit">
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-slate-300/50">
                      <img 
                        src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                        alt="attachment" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visual Context</span>
                       <span className="text-xs font-bold truncate max-w-[120px]">Image Attachment</span>
                    </div>
                  </div>
                )}
                {part.text && renderContent(part.text)}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 px-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            
            {!isUser && (
              <>
                <button
                  onClick={() => onPlayAudio?.(message.id, fullTextContent)}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 hover:text-green-600 transition-colors"
                >
                  {isLoadingThisAudio ? <Loader2 size={12} className="animate-spin" /> : isAudioPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                  {isAudioPlaying ? 'Stop' : 'Listen'}
                </button>
                
                <button onClick={() => onStar?.(message)} className={`transition-colors ${message.isStarred ? 'text-yellow-500' : 'text-slate-300 hover:text-yellow-500'}`}>
                  <Star size={14} fill={message.isStarred ? "currentColor" : "none"} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
