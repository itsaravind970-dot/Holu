
import React from 'react';
import { ChatMessage as ChatMessageType } from '../types';
import { User, Cpu, Play, Square, CheckCircle2, Loader2, Star, Copy, Share2, Terminal } from 'lucide-react';

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
          <div key={i} className="my-4 rounded-xl overflow-hidden border border-slate-700 shadow-2xl animate-in zoom-in-95 w-full">
            <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2 text-slate-400">
                <Terminal size={12} />
                <span className="text-[10px] font-black uppercase tracking-widest">{lang}</span>
              </div>
              <div className="flex items-center gap-3">
                 <button 
                  onClick={() => onSaveCode?.(code, lang)} 
                  className="text-slate-400 hover:text-green-400 transition-colors p-1" 
                  title="Save to Projects"
                 >
                    <Cpu size={14} />
                 </button>
                 <button 
                  onClick={() => handleCopy(code)} 
                  className="text-slate-400 hover:text-white transition-colors p-1"
                  title="Copy Code"
                 >
                    <Copy size={14} />
                 </button>
              </div>
            </div>
            <div className="bg-slate-900 overflow-x-auto custom-scrollbar w-full">
              <pre className="p-4 md:p-6 min-w-full">
                <code className="text-sm text-green-400 font-mono whitespace-pre block">{code}</code>
              </pre>
            </div>
          </div>
        );
      }
      return <div key={i} className="whitespace-pre-wrap">{part.replace(/SPEECH_SUMMARY:[\s\S]*/i, '')}</div>;
    });
  };

  return (
    <div className={`flex w-full mb-8 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex w-full md:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-4`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${isUser ? 'bg-slate-900' : 'bg-green-500'}`}>
          {isUser ? <User size={16} className="text-white" /> : <Cpu size={16} className="text-white" />}
        </div>
        
        <div className={`flex flex-col min-w-0 flex-1 ${isUser ? 'items-end' : 'items-start'} gap-1.5`}>
          <div className={`p-4 md:p-5 rounded-2xl shadow-sm text-[15px] leading-relaxed w-full overflow-hidden ${isUser ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
            {message.parts.map((part, idx) => (
              <div key={idx} className="w-full">
                {part.text && renderContent(part.text)}
                {part.inlineData && part.inlineData.mimeType.startsWith('image/') && (
                  <img src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} className="mt-2 rounded-xl border border-slate-100 max-w-full h-auto" />
                )}
              </div>
            ))}
            {message.isMediaGeneration && message.mediaUrl && (
              <div className="mt-3 w-full">
                <img 
                  src={message.mediaUrl} 
                  className="rounded-xl shadow-lg border border-green-100 max-w-full h-auto mx-auto" 
                  loading="lazy"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 px-1 mt-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            
            {!isUser && (
              <>
                <button
                  onClick={() => onPlayAudio?.(message.id, message.parts[0].text || '')}
                  className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-green-600 transition-colors"
                >
                  {isLoadingThisAudio ? <Loader2 size={10} className="animate-spin" /> : isAudioPlaying ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                  {isAudioPlaying ? 'Stop' : 'Listen'}
                </button>
                
                <button 
                  onClick={() => handleCopy(message.parts[0].text || '')}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  title="Copy Response"
                >
                  <Copy size={12} />
                </button>
                
                <button 
                  onClick={() => onStar?.(message)}
                  className={`transition-colors ${message.isStarred ? 'text-yellow-500' : 'text-slate-300 hover:text-yellow-500'}`}
                  title="Star to Projects"
                >
                  <Star size={12} fill={message.isStarred ? "currentColor" : "none"} />
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
