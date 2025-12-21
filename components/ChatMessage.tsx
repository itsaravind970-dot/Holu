
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
          <div key={i} className="my-6 rounded-[24px] md:rounded-[32px] overflow-hidden border border-slate-700 shadow-2xl bg-slate-900 animate-in zoom-in-95 duration-500">
            <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang} synthesis</span>
              </div>
              <button onClick={() => navigator.clipboard.writeText(code)} className="text-slate-400 hover:text-white transition-colors p-2 bg-slate-700/50 rounded-lg"><Copy size={14} /></button>
            </div>
            <div className="p-6 md:p-8 overflow-x-auto custom-scrollbar">
              <code className="text-[11px] md:text-[13px] text-green-400 font-mono whitespace-pre leading-relaxed">{code}</code>
            </div>
          </div>
        );
      }
      return <div key={i} className="whitespace-pre-wrap leading-relaxed">{part}</div>;
    });
  };

  return (
    <div className={`flex w-full mb-8 md:mb-12 ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[95%] sm:max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-2.5 md:gap-4`}>
        <div className={`shrink-0 w-8 h-8 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg border-2 border-white ${isUser ? 'bg-slate-900' : 'bg-green-500'}`}>
          {isUser ? <User size={14} className="md:w-5 md:h-5 text-white" /> : <Cpu size={14} className="md:w-5 md:h-5 text-white" />}
        </div>
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-2`}>
          <div className={`p-4 md:p-6 rounded-[24px] md:rounded-[32px] text-[12px] md:text-[14px] shadow-sm font-medium ${isUser ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
            {message.parts.map((p, i) => (
              <div key={i}>
                {p.inlineData && (
                  <div className="mb-4 rounded-[16px] md:rounded-[24px] overflow-hidden border border-slate-200 max-w-[150px] md:max-w-[200px] shadow-md">
                    <img src={`data:${p.inlineData.mimeType};base64,${p.inlineData.data}`} className="w-full h-auto" />
                  </div>
                )}
                {p.text && renderContent(p.text)}
              </div>
            ))}

            {!isUser && message.groundingSources && message.groundingSources.length > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
                <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Globe size={12} /> RESEARCH NODES FOUND:</p>
                <div className="flex flex-wrap gap-2">
                  {message.groundingSources.map((s, idx) => s.web && (
                    <a key={idx} href={s.web.uri} target="_blank" rel="noreferrer" className="text-[10px] md:text-[11px] text-blue-600 font-bold bg-blue-50/60 hover:bg-blue-100 px-3 py-1.5 md:py-2 rounded-xl border border-blue-100 transition-all flex items-center gap-1.5 max-w-[180px] md:max-w-[240px]">
                      <span className="truncate">{s.web.title || 'Uplink Node'}</span>
                      <ExternalLink size={10} className="shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4 px-3">
            <span className="text-[8px] md:text-[9px] text-slate-400 font-black uppercase tracking-widest">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {!isUser && (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => onPlayAudio?.(message.id, message.parts.map(p => p.text || '').join(' '))} 
                  className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-1.5"
                >
                  {isAudioPlaying ? (
                    <Square size={12} fill="currentColor" />
                  ) : (
                    <Play size={12} fill="currentColor" />
                  )}
                  {isAudioPlaying ? 'STOP' : 'LISTEN'}
                </button>
                <button onClick={() => onStar?.(message)} className="text-slate-300 hover:text-yellow-500 transition-colors"><Star size={14} /></button>
                <button onClick={() => navigator.clipboard.writeText(message.parts.map(p => p.text || '').join(' '))} className="text-slate-300 hover:text-slate-900 transition-colors"><Copy size={14} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
