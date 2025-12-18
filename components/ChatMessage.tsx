
import React from 'react';
import { ChatMessage as ChatMessageType } from '../types';
import { User, Bot, Globe, Play, Square, ExternalLink } from 'lucide-react';

interface Props {
  message: ChatMessageType;
  onPlayAudio?: (text: string) => void;
  isAudioPlaying?: boolean;
}

const ChatMessage: React.FC<Props> = ({ message, onPlayAudio, isAudioPlaying }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full mb-8 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[85%] md:max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-4`}>
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${isUser ? 'bg-indigo-600' : 'bg-white border border-slate-200'}`}>
          {isUser ? <User size={20} className="text-white" /> : <Bot size={22} className="text-indigo-600" />}
        </div>
        
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
          {/* Search Cards / Grounding Sources Header for Bot messages */}
          {!isUser && message.groundingSources && message.groundingSources.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.groundingSources.slice(0, 4).map((source, idx) => {
                const title = source.web?.title || source.maps?.title || 'Source';
                // Clean up title for "Card" style
                const shortTitle = title.split(' - ')[0].split(' | ')[0].slice(0, 20);
                return (
                  <a
                    key={idx}
                    href={source.web?.uri || source.maps?.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full text-[11px] font-bold border border-indigo-100 transition-all hover:scale-105"
                  >
                    <Globe size={10} />
                    {shortTitle} <span className="text-indigo-400">✔</span>
                  </a>
                );
              })}
            </div>
          )}

          <div className={`p-5 rounded-2xl shadow-sm leading-relaxed ${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
            {message.parts.map((part, idx) => (
              <div key={idx} className="space-y-4">
                {part.text && <div className="whitespace-pre-wrap text-[15px]">{part.text}</div>}
                {part.inlineData && (
                  <div className="relative group">
                    <img 
                      src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                      alt="Uploaded content" 
                      className="max-w-full max-h-[300px] rounded-xl mt-2 border border-slate-200 object-contain shadow-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 mt-1">
            <span className="text-[10px] text-slate-400 font-medium">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            
            {!isUser && onPlayAudio && (
              <button
                onClick={() => onPlayAudio(message.parts.find(p => p.text)?.text || '')}
                disabled={isAudioPlaying}
                className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 rounded-full text-[11px] font-semibold transition-colors"
              >
                {isAudioPlaying ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                {isAudioPlaying ? 'Stop' : 'Listen'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
