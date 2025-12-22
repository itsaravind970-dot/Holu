
import React from 'react';
import { ChatMessage as ChatMessageType } from '../types';
import { User, Cpu, Play, Square, Star, Copy, Globe, ExternalLink, Loader2 } from 'lucide-react';

interface Props {
  message: ChatMessageType;
  onPlayAudio?: (id: string, text: string) => void;
  isAudioPlaying?: boolean;
  onStar?: (m: ChatMessageType) => void;
}

const ChatMessage: React.FC<Props> = ({ message, onPlayAudio, isAudioPlaying, onStar }) => {
  const isUser = message.role === 'user';

  const renderContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const lines = part.split('\n');
        const lang = lines[0].replace('```', '').trim() || 'code';
        const code = lines.slice(1, -1).join('\n');
        return (
          <div key={i} className="my-4 rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-900 animate-in zoom-in-95 duration-500">
            <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{lang} synthesis</span>
              </div>
              <button onClick={() => navigator.clipboard.writeText(code)} className="text-slate-400 hover:text-white transition-colors p-1.5 bg-slate-700/50 rounded-lg"><Copy size={12} /></button>
            </div>
            <div className="p-4 md:p-6 overflow-x-auto custom-scrollbar">
              <code className="text-[10px] md:text-[12px] text-green-400 font-mono whitespace-pre leading-normal">{code}</code>
            </div>
          </div>
        );
      }
      return <div key={i} className="whitespace-pre-wrap leading-normal">{part}</div>;
    });
  };

  return (
    <div className={`flex w-full mb-5 md:mb-8 ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[95%] sm:max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-2 md:gap-3`}>
        <div className={`shrink-0 w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl flex items-center justify-center shadow-md border border-white ${isUser ? 'bg-slate-900' : 'bg-green-500'}`}>
          {isUser ? <User size={12} className="md:w-4 md:h-4 text-white" /> : <Cpu size={12} className="md:w-4 md:h-4 text-white" />}
        </div>
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1.5`}>
          <div className={`p-3 md:p-4 rounded-2xl md:rounded-[24px] text-[11px] md:text-[13px] shadow-sm font-medium ${isUser ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
            {message.parts.map((p, i) => (
              <div key={i}>
                {p.inlineData && (
                  <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 max-w-[120px] md:max-w-[160px] shadow-sm">
                    <img src={`data:${p.inlineData.mimeType};base64,${p.inlineData.data}`} className="w-full h-auto" />
                  </div>
                )}
                {p.text && renderContent(p.text)}
              </div>
            ))}

            {!isUser && message.groundingSources && message.groundingSources.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-1.5"><Globe size={10} /> RESEARCH NODES FOUND:</p>
                <div className="flex flex-wrap gap-1.5">
                  {message.groundingSources.map((s, idx) => s.web && (
                    <a key={idx} href={s.web.uri} target="_blank" rel="noreferrer" className="text-[9px] md:text-[10px] text-blue-600 font-bold bg-blue-50/60 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-100 transition-all flex items-center gap-1 max-w-[140px] md:max-w-[200px]">
                      <span className="truncate">{s.web.title || 'Uplink Node'}</span>
                      <ExternalLink size={8} className="shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 px-2">
            <span className="text-[7px] md:text-[8px] text-slate-400 font-black uppercase tracking-widest">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {!isUser && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => onPlayAudio?.(message.id, message.parts.map(p => p.text || '').join(' '))} 
                  className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-1"
                >
                  {isAudioPlaying ? (
                    <Square size={10} fill="currentColor" />
                  ) : (
                    <Play size={10} fill="currentColor" />
                  )}
                  {isAudioPlaying ? 'STOP' : 'LISTEN'}
                </button>
                <button onClick={() => onStar?.(message)} className="text-slate-300 hover:text-yellow-500 transition-colors"><Star size={12} /></button>
                <button onClick={() => navigator.clipboard.writeText(message.parts.map(p => p.text || '').join(' '))} className="text-slate-300 hover:text-slate-900 transition-colors"><Copy size={12} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
