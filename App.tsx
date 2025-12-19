
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, HuluMode, SavedProjectItem } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Search, Terminal, Star, 
  Menu, X, Sparkles, User, AlertTriangle, Loader2, Cpu, History, BookMarked, Copy, Trash2, ArrowLeft
} from 'lucide-react';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSessionHistory[]>([]);
  const [projects, setProjects] = useState<SavedProjectItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [view, setView] = useState<'chats' | 'projects'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedSessions = localStorage.getItem('hulu_sessions');
    const savedProjects = localStorage.getItem('hulu_projects');
    if (savedSessions) setSessions(JSON.parse(savedSessions));
    if (savedProjects) setProjects(JSON.parse(savedProjects));
  }, []);

  useEffect(() => {
    localStorage.setItem('hulu_sessions', JSON.stringify(sessions));
    localStorage.setItem('hulu_projects', JSON.stringify(projects));
  }, [sessions, projects]);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [sessions, currentSessionId, isLoading, selectedProjectId]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    return sessions.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.messages.some(m => m.parts[0].text?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [sessions, searchQuery]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    return projects.filter(p => 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  const ensureActiveSession = (title: string): string => {
    if (currentSessionId) return currentSessionId;
    const newSession: ChatSessionHistory = {
      id: Date.now().toString(),
      title: title.slice(0, 30),
      messages: [],
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    return newSession.id;
  };

  const handleSendMessage = async (text: string, mode: HuluMode) => {
    // Detect image generation intent automatically
    const imgIntents = ['generate image', 'create image', 'draw', 'make a picture', 'show me an image'];
    if (imgIntents.some(intent => text.toLowerCase().startsWith(intent))) {
      const prompt = text.replace(new RegExp(`^(${imgIntents.join('|')})`, 'i'), '').trim();
      if (prompt) {
        handleGenerateImage(prompt);
        return;
      }
    }

    setSelectedProjectId(null);
    const activeId = ensureActiveSession(text);

    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ text }],
      timestamp: Date.now()
    };

    setSessions(prev => prev.map(s => s.id === activeId ? {
      ...s,
      messages: [...s.messages, userMsg],
      updatedAt: Date.now()
    } : s));

    setIsLoading(true);

    try {
      const response = await geminiService.chatWithHistory(
        sessions.find(s => s.id === activeId)?.messages || [],
        text,
        mode
      );

      const botMsg: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        parts: [{ text: response.text }],
        timestamp: Date.now()
      };

      setSessions(prev => prev.map(s => s.id === activeId ? {
        ...s,
        messages: [...s.messages, botMsg],
        updatedAt: Date.now()
      } : s));

      if (mode === 'pro' && response.text.includes('SPEECH_SUMMARY:')) {
        playAudio(botMsg.id, response.text);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async (prompt: string) => {
    const activeId = ensureActiveSession(prompt);
    
    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ text: `Generate image: ${prompt}` }],
      timestamp: Date.now()
    };

    setSessions(prev => prev.map(s => s.id === activeId ? {
      ...s,
      messages: [...s.messages, userMsg],
      updatedAt: Date.now()
    } : s));

    setIsLoading(true);
    try {
      const imageUrl = await geminiService.generateImage(prompt);
      const botMsg: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        parts: [{ text: "Successfully generated your image:" }],
        isMediaGeneration: true,
        mediaType: 'image',
        mediaUrl: imageUrl,
        timestamp: Date.now()
      };
      
      setSessions(prev => prev.map(s => s.id === activeId ? {
        ...s,
        messages: [...s.messages, botMsg],
        updatedAt: Date.now()
      } : s));
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        parts: [{ text: "Failed to generate image. Please try a different prompt or check your connection." }],
        timestamp: Date.now()
      };
      setSessions(prev => prev.map(s => s.id === activeId ? {
        ...s,
        messages: [...s.messages, errorMsg],
        updatedAt: Date.now()
      } : s));
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = async (id: string, text: string) => {
    if (currentAudioSourceRef.current) {
      currentAudioSourceRef.current.stop();
      currentAudioSourceRef.current = null;
      setIsAudioPlaying(false);
      return;
    }

    setAudioLoadingId(id);
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

      const base64 = await geminiService.textToSpeech(text);
      if (base64) {
        const buffer = await decodeAudioData(base64, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
          setIsAudioPlaying(false);
          currentAudioSourceRef.current = null;
        };
        currentAudioSourceRef.current = source;
        setIsAudioPlaying(true);
        source.start();
      }
    } catch (e) {
      console.warn("Audio playback issue:", e);
    } finally {
      setAudioLoadingId(null);
    }
  };

  const handleStarTopic = (msg: ChatMessageType) => {
    if (msg.isStarred) return;
    const newItem: SavedProjectItem = {
      id: Date.now().toString(),
      type: 'topic',
      title: msg.parts[0].text?.slice(0, 40) || 'Important Topic',
      content: msg.parts[0].text || '',
      timestamp: Date.now()
    };
    setProjects(prev => [newItem, ...prev]);
    setSessions(prev => prev.map(s => ({
      ...s,
      messages: s.messages.map(m => m.id === msg.id ? { ...m, isStarred: true } : m)
    })));
  };

  const handleSaveCode = (code: string, lang: string) => {
    const newItem: SavedProjectItem = {
      id: Date.now().toString(),
      type: 'code',
      title: `Code Snippet (${lang})`,
      content: code,
      language: lang,
      timestamp: Date.now()
    };
    setProjects(prev => [newItem, ...prev]);
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProjectId === id) setSelectedProjectId(null);
  };

  const currentSessionMessages = sessions.find(s => s.id === currentSessionId)?.messages || [];
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-jakarta">
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-50 border-r border-slate-200 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-black tracking-tighter text-slate-900">HULU</h1>
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="lg:hidden p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search history..."
                className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-medium focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none transition-all"
              />
            </div>

            <nav className="flex gap-1 bg-slate-200/50 p-1 rounded-xl mb-4">
              <button 
                onClick={() => setView('chats')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${view === 'chats' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <History size={12} /> History
              </button>
              <button 
                onClick={() => setView('projects')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${view === 'projects' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <BookMarked size={12} /> Projects
              </button>
            </nav>

            <button
              onClick={() => { 
                setCurrentSessionId(null); 
                setSelectedProjectId(null);
                setIsSidebarOpen(false); 
                setView('chats'); 
              }}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
            >
              <Plus size={16} /> New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-6">
            {view === 'chats' ? (
              <div className="space-y-1">
                {filteredSessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { 
                      setCurrentSessionId(s.id); 
                      setSelectedProjectId(null);
                      setIsSidebarOpen(false); 
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${currentSessionId === s.id && !selectedProjectId ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-white hover:shadow-sm'}`}
                  >
                    <MessageSquare size={14} className={currentSessionId === s.id ? 'text-green-500' : 'text-slate-400'} />
                    <span className="text-[11px] font-bold text-slate-700 truncate">{s.title || 'Untitled Chat'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProjects.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Projects Found</p>
                  </div>
                )}
                {filteredProjects.filter(p => p.type === 'code').length > 0 && (
                  <div>
                    <h3 className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Project Codes</h3>
                    {filteredProjects.filter(p => p.type === 'code').map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProjectId(p.id); setIsSidebarOpen(false); }}
                        className={`w-full p-3 bg-white rounded-xl border transition-all text-left mb-2 group ${selectedProjectId === p.id ? 'border-green-400 ring-1 ring-green-100' : 'border-slate-100 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black text-green-600 uppercase tracking-tighter">{p.language}</span>
                          <Terminal size={10} className="text-slate-300" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-700 truncate">{p.title}</p>
                      </button>
                    ))}
                  </div>
                )}
                {filteredProjects.filter(p => p.type === 'topic').length > 0 && (
                  <div>
                    <h3 className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Important Topics</h3>
                    {filteredProjects.filter(p => p.type === 'topic').map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProjectId(p.id); setIsSidebarOpen(false); }}
                        className={`w-full p-3 bg-white rounded-xl border transition-all text-left mb-2 ${selectedProjectId === p.id ? 'border-green-400 ring-1 ring-green-100' : 'border-slate-100 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Star size={10} className="text-yellow-500" fill="currentColor" />
                          <span className="text-[8px] text-slate-300">{new Date(p.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-700 line-clamp-2">{p.title}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-white min-w-0">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-100 sticky top-0 z-20 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-slate-600 p-2 hover:bg-slate-50 rounded-lg">
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-black tracking-tighter uppercase">HULU</h2>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
               <User size={16} className="text-slate-400" />
             </div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto min-h-full flex flex-col">
            
            {selectedProject ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                <button 
                  onClick={() => setSelectedProjectId(null)}
                  className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 mb-6 transition-colors"
                >
                  <ArrowLeft size={14} /> Back to Chat
                </button>
                
                <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-xl shadow-slate-200/50">
                  <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {selectedProject.type === 'code' ? (
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-lg border border-green-200">
                            {selectedProject.language || 'Code'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-black uppercase rounded-lg border border-yellow-200">
                            Topic
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(selectedProject.timestamp).toLocaleString()}</span>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{selectedProject.title}</h3>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(selectedProject.content);
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                      >
                        <Copy size={16} /> Copy Content
                      </button>
                      <button 
                        onClick={() => handleDeleteProject(selectedProject.id)}
                        className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-2xl transition-colors border border-red-100"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6 md:p-10">
                    {selectedProject.type === 'code' ? (
                      <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                        <pre className="bg-slate-900 p-6 md:p-8 overflow-x-auto custom-scrollbar font-mono text-sm leading-relaxed text-green-400">
                          <code>{selectedProject.content}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="text-slate-700 text-lg leading-relaxed font-medium whitespace-pre-wrap">
                        {selectedProject.content}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : currentSessionMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 animate-in fade-in duration-1000">
                <div className="w-20 h-20 bg-slate-900 rounded-[30px] flex items-center justify-center shadow-2xl mb-8 transform hover:scale-110 transition-transform cursor-default">
                  <Cpu size={40} className="text-green-400" strokeWidth={1.5} />
                </div>
                <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2 text-center">How can HULU help?</h3>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] text-center">Advanced Intelligence Ready</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl mt-12 px-4">
                  {[
                    "HULU Pro: Analyze local market trends",
                    "Generate a React contact form code",
                    "Explain the theory of relativity simply",
                    "Write a professional email to my boss"
                  ].map((tip, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSendMessage(tip, tip.includes('Pro') ? 'pro' : 'normal')}
                      className="text-left p-5 rounded-2xl border border-slate-200 hover:border-green-400 bg-white hover:bg-green-50 transition-all font-bold text-sm text-slate-700"
                    >
                      "{tip}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pb-10 w-full overflow-hidden">
                {currentSessionMessages.map(m => (
                  <ChatMessage 
                    key={m.id} 
                    message={m} 
                    onPlayAudio={playAudio} 
                    isAudioPlaying={isAudioPlaying} 
                    audioLoadingId={audioLoadingId}
                    onStar={handleStarTopic}
                    onSaveCode={handleSaveCode}
                  />
                ))}
                {isLoading && (
                  <div className="flex items-center gap-3 text-slate-400 animate-pulse mb-8">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">HULU is analyzing...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!selectedProjectId && (
          <ChatInput onSend={handleSendMessage} onGenerateImage={handleGenerateImage} disabled={isLoading} />
        )}
      </main>
    </div>
  );
};

export default App;
