
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { MessageSquare, Plus, PanelLeft, Search, Settings, Trash2, Bot, Info, ShieldCheck, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSessionHistory[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Closed by default
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gemini_chat_sessions');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      if (parsed.length > 0) {
        setCurrentSessionId(parsed[0].id);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('gemini_chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessions, currentSessionId]);

  const createNewSession = () => {
    const newSession: ChatSessionHistory = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsSidebarOpen(false); // Close sidebar on mobile after creating chat
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (currentSessionId === id) {
      setCurrentSessionId(filtered.length > 0 ? filtered[0].id : null);
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const handleSendMessage = async (text: string, isDeep: boolean, image?: { data: string; mimeType: string }) => {
    let activeId = currentSessionId;
    
    // Create session if none active
    if (!activeId) {
      const newSession: ChatSessionHistory = {
        id: Date.now().toString(),
        title: text.slice(0, 30) || 'Image Analysis',
        messages: [],
        updatedAt: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      activeId = newSession.id;
    }

    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      parts: [
        { text },
        ...(image ? [{ inlineData: { data: image.data, mimeType: image.mimeType } }] : [])
      ],
      timestamp: Date.now()
    };

    setSessions(prev => prev.map(s => {
      if (s.id === activeId) {
        return {
          ...s,
          title: s.messages.length === 0 ? text.slice(0, 30) : s.title,
          messages: [...s.messages, userMessage],
          updatedAt: Date.now()
        };
      }
      return s;
    }));

    setIsLoading(true);

    try {
      const response = await geminiService.chatWithHistory(
        currentSession?.messages || [],
        text,
        isDeep,
        image
      );

      const botMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        parts: [{ text: response.text }],
        timestamp: Date.now(),
        groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
          web: chunk.web,
          maps: chunk.maps
        })) || []
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeId) {
          return {
            ...s,
            messages: [...s.messages, botMessage],
            updatedAt: Date.now()
          };
        }
        return s;
      }));
    } catch (error) {
      console.error("API Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const playResponseAudio = async (text: string) => {
    if (isAudioPlaying) return;
    setIsAudioPlaying(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const base64Audio = await geminiService.textToSpeech(text);
      if (base64Audio) {
        const buffer = await decodeAudioData(base64Audio, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsAudioPlaying(false);
        source.start();
      } else {
        setIsAudioPlaying(false);
      }
    } catch (error) {
      setIsAudioPlaying(false);
    }
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden font-inter selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sidebar Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Menu */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-slate-50 border-r border-slate-200 transform transition-transform duration-300 ease-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-4">
            <button
              onClick={createNewSession}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
            >
              <Plus size={20} />
              New Conversation
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            <h3 className="px-3 py-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Recent Chats</h3>
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => {
                  setCurrentSessionId(session.id);
                  setIsSidebarOpen(false);
                }}
                className={`group relative flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all ${currentSessionId === session.id ? 'bg-white shadow-sm ring-1 ring-slate-200 text-indigo-600' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
              >
                <MessageSquare size={16} className={currentSessionId === session.id ? 'text-indigo-600' : 'text-slate-400'} />
                <span className="flex-1 text-sm font-semibold truncate pr-4">
                  {session.title || 'Chat'}
                </span>
                <button
                  onClick={(e) => deleteSession(session.id, e)}
                  className="absolute right-3 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="px-3 py-10 text-center">
                <p className="text-xs text-slate-400 font-medium italic">No history yet</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white transition-colors cursor-pointer group border border-transparent hover:border-slate-200">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                <Settings size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Advanced Settings</p>
                <p className="text-[10px] text-slate-500 font-medium">Manage API & Identity</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative bg-white">
        {/* Modern Header */}
        <header className="flex items-center justify-between px-4 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 hover:bg-slate-50 rounded-xl lg:hidden text-slate-600 transition-colors"
            >
              <PanelLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-900 tracking-tight leading-none">GEMINI ULTIMATE</h1>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Intelligence Layer</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
             <div className="hidden sm:flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-100">
               <ShieldCheck size={14} />
               <span className="text-[10px] font-black uppercase tracking-wider">Secure Connection</span>
             </div>
          </div>
        </header>

        {/* Scrollable Conversation Context */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto min-h-full">
            {!currentSession || currentSession.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 animate-in fade-in zoom-in-95 duration-1000 ease-out">
                <div className="relative mb-10">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full scale-150 animate-pulse" />
                  <div className="relative w-24 h-24 bg-white rounded-[32px] flex items-center justify-center shadow-2xl shadow-indigo-100 border border-indigo-50">
                    <Bot size={48} className="text-indigo-600" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg ring-4 ring-white">
                    <Zap size={16} fill="white" />
                  </div>
                </div>
                
                <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">AI Search & Analysis</h2>
                <p className="text-slate-500 max-w-md mx-auto mb-12 leading-relaxed font-semibold text-lg">
                  Ask complex questions, analyze images, and search the internet with deep reasoning.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
                  {[
                    { text: "Latest news on AI breakthroughs", icon: "🌐", tag: "Live Search" },
                    { text: "Compare the specs of Tesla vs BYD", icon: "📊", tag: "Data Analysis" },
                    { text: "Explain how photosynthesis works", icon: "🌱", tag: "Education" },
                    { text: "Help me write a professional email", icon: "✍️", tag: "Writing" }
                  ].map((tip, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(tip.text, false)}
                      className="group text-left p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-200 rounded-3xl transition-all hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{tip.icon}</span>
                        <span className="text-[9px] font-black text-indigo-500 uppercase bg-indigo-50 px-2 py-0.5 rounded-md">{tip.tag}</span>
                      </div>
                      <span className="text-slate-800 font-bold group-hover:text-indigo-600 transition-colors">"{tip.text}"</span>
                    </button>
                  ))}
                </div>
                
                <div className="mt-16 flex items-center gap-8 opacity-40 grayscale">
                   <div className="flex items-center gap-2 font-black text-sm tracking-tighter">
                     <Info size={16} /> DATA PRIVACY
                   </div>
                   <div className="flex items-center gap-2 font-black text-sm tracking-tighter">
                     <Zap size={16} /> REAL-TIME WEB
                   </div>
                </div>
              </div>
            ) : (
              <div className="pb-10">
                {currentSession.messages.map((msg) => (
                  <ChatMessage 
                    key={msg.id} 
                    message={msg} 
                    onPlayAudio={playResponseAudio}
                    isAudioPlaying={isAudioPlaying}
                  />
                ))}
                {isLoading && (
                  <div className="flex justify-start items-start gap-4 mb-8">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center animate-pulse border border-slate-200">
                      <Bot size={22} className="text-slate-300" />
                    </div>
                    <div className="space-y-3">
                      <div className="h-10 w-64 bg-slate-50 rounded-2xl animate-pulse"></div>
                      <div className="h-4 w-40 bg-slate-50 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Chat Input Bar */}
        <ChatInput onSend={handleSendMessage} disabled={isLoading} />
      </main>
    </div>
  );
};

export default App;
