
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, SavedProjectItem, UserAccount } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Search, Terminal, Star, 
  Menu, X, Sparkles, User, AlertTriangle, Loader2, Cpu, History, BookMarked, Copy, Trash2, ArrowLeft, CheckCircle2, Lock, Smartphone, UserCircle, LogOut, Eye, EyeOff, Database, ShieldCheck, Activity, Fingerprint, Globe, ShieldAlert, Ban, CheckCircle, Shield, Info, RefreshCcw, Zap, Camera, Upload, SearchCode
} from 'lucide-react';

const SECRET_ADMIN_CODE = 'Aravind63091309709705371970';

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAuthView, setIsAuthView] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [adminAccounts, setAdminAccounts] = useState<UserAccount[]>([]);
  
  // App State
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
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Persistence & Security Check
  useEffect(() => {
    const storedUser = localStorage.getItem('hulu_current_user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      const accounts: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
      const freshUser = accounts.find(a => a.id === user.id);
      
      if (freshUser && freshUser.isBlocked) {
        handleLogout();
      } else {
        setCurrentUser(freshUser || user);
        setIsAuthView(false);
        loadUserData(user.id);
      }
    }
    refreshAdminData();
  }, []);

  const refreshAdminData = () => {
    const accounts = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
    setAdminAccounts(accounts);
  };

  const loadUserData = (userId: string) => {
    const savedSessions = localStorage.getItem(`hulu_sessions_${userId}`);
    const savedProjects = localStorage.getItem(`hulu_projects_${userId}`);
    if (savedSessions) setSessions(JSON.parse(savedSessions));
    else setSessions([]);
    if (savedProjects) setProjects(JSON.parse(savedProjects));
    else setProjects([]);
  };

  // Sync state to local storage safely
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`hulu_sessions_${currentUser.id}`, JSON.stringify(sessions));
      localStorage.setItem(`hulu_projects_${currentUser.id}`, JSON.stringify(projects));
      localStorage.setItem('hulu_current_user', JSON.stringify(currentUser));
      
      const accounts: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
      const updatedAccounts = accounts.map(a => a.id === currentUser.id ? currentUser : a);
      localStorage.setItem('hulu_accounts', JSON.stringify(updatedAccounts));
    }
  }, [sessions, projects, currentUser]);

  useEffect(() => {
    if (scrollRef.current) {
      const scroll = scrollRef.current;
      setTimeout(() => {
        scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [sessions, currentSessionId, isLoading, selectedProjectId]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(s => 
      s.title.toLowerCase().includes(query) ||
      s.messages.some(m => m.parts.some(p => p.text?.toLowerCase().includes(query)))
    );
  }, [sessions, searchQuery]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(p => 
      p.title.toLowerCase().includes(query) ||
      p.content.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  const ensureActiveSession = (title: string): string => {
    if (currentSessionId) return currentSessionId;
    const newSession: ChatSessionHistory = {
      id: Date.now().toString(),
      title: title.slice(0, 40),
      messages: [],
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    return newSession.id;
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (text: string, file?: { data: string; mimeType: string }) => {
    const normalizedInput = text.trim().replace(/['"]/g, '');
    if (normalizedInput === SECRET_ADMIN_CODE) {
      refreshAdminData();
      setShowAdminPanel(true);
      return;
    }

    setSelectedProjectId(null);
    const activeId = ensureActiveSession(text || "Visual Analysis Request");

    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      parts: file ? [{ text }, { inlineData: file }] : [{ text }],
      timestamp: Date.now()
    };

    setSessions(prev => prev.map(s => s.id === activeId ? {
      ...s,
      messages: [...s.messages, userMsg],
      updatedAt: Date.now()
    } : s));

    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const historyForReq = sessions.find(s => s.id === activeId)?.messages || [];
      const response = await geminiService.chatWithHistory(
        historyForReq,
        text,
        file,
        controller.signal
      );

      if (controller.signal.aborted) return;

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

    } catch (error: any) {
      if (error.message === 'AbortError') {
        console.log("Hulu assis: Request cancelled by user.");
      } else {
        console.error(error);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const playAudio = async (id: string, text: string) => {
    if (currentAudioSourceRef.current && id === audioLoadingId) {
      currentAudioSourceRef.current.stop();
      currentAudioSourceRef.current = null;
      setIsAudioPlaying(false);
      setAudioLoadingId(null);
      return;
    }
    
    if (currentAudioSourceRef.current) {
      currentAudioSourceRef.current.stop();
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
          setAudioLoadingId(null);
        };
        currentAudioSourceRef.current = source;
        setIsAudioPlaying(true);
        source.start();
      }
    } catch (e) {
      console.warn(e);
      setAudioLoadingId(null);
    }
  };

  const handleStarTopic = (msg: ChatMessageType) => {
    if (msg.isStarred) return;
    const newItem: SavedProjectItem = {
      id: Date.now().toString(),
      type: 'topic',
      title: msg.parts[msg.parts.length - 1].text?.slice(0, 40) || 'Pinned Content',
      content: msg.parts[msg.parts.length - 1].text || '',
      timestamp: Date.now()
    };
    setProjects(prev => [newItem, ...prev]);
    setSessions(prev => prev.map(s => ({
      ...s,
      messages: s.messages.map(m => m.id === msg.id ? { ...m, isStarred: true } : m)
    })));
  };

  const handleLogout = () => {
    localStorage.removeItem('hulu_current_user');
    setCurrentUser(null);
    setIsAuthView(true);
    setSessions([]);
    setProjects([]);
    setShowProfile(false);
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && currentUser) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCurrentUser({ ...currentUser, profilePic: base64String });
        refreshAdminData();
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const currentSessionMessages = sessions.find(s => s.id === currentSessionId)?.messages || [];
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // SHARED UI ELEMENTS
  const sharedUI = (
    <>
      {/* Admin Panel */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-10 bg-black/98 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="bg-[#0b0f19] w-full h-full md:rounded-[40px] shadow-[0_0_150px_rgba(34,197,94,0.15)] flex flex-col border border-slate-800 overflow-hidden">
            <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-green-500/10 rounded-3xl text-green-500 border border-green-500/20 shadow-inner">
                  <ShieldCheck size={36} />
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Security Command Center</h2>
                  <p className="text-[10px] font-black text-green-500 uppercase tracking-[0.4em] mt-1">ARAVIND MASTER PORTAL</p>
                </div>
              </div>
              <button onClick={() => setShowAdminPanel(false)} className="p-5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-[24px] transition-all">
                <X size={28} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-8 bg-[#080b13]">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {adminAccounts.map((acc, idx) => (
                  <div key={idx} className={`p-8 border rounded-[40px] transition-all relative overflow-hidden flex flex-col ${acc.isBlocked ? 'bg-red-950/20 border-red-900/50' : 'bg-slate-900/40 border-slate-800'}`}>
                    <div className="absolute top-0 right-0 p-6 flex gap-3">
                       <button onClick={() => {
                          const updated = adminAccounts.map(a => a.phoneNumber === acc.phoneNumber ? { ...a, isBlocked: !a.isBlocked } : a);
                          localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                          refreshAdminData();
                       }} className={`p-3 rounded-2xl border ${acc.isBlocked ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                         {acc.isBlocked ? <CheckCircle size={20} /> : <Ban size={20} />}
                       </button>
                       <button onClick={() => { if(confirm(`Purge identity?`)) {
                          const updated = adminAccounts.filter(a => a.phoneNumber !== acc.phoneNumber);
                          localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                          refreshAdminData();
                       }}} className="p-3 bg-slate-800 text-slate-400 rounded-2xl hover:bg-red-600 border border-slate-700">
                         <Trash2 size={20} />
                       </button>
                    </div>
                    <div className="flex items-start gap-5 mb-8">
                      <div className="w-16 h-16 rounded-[24px] bg-slate-800 flex items-center justify-center text-green-500 border border-slate-700 shadow-2xl overflow-hidden">
                        {acc.profilePic ? (
                          <img src={acc.profilePic} alt={acc.username} className="w-full h-full object-cover" />
                        ) : (
                          <Fingerprint size={32} />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-white truncate max-w-[150px]">{acc.username}</h4>
                        <p className="text-[11px] font-black text-slate-500 uppercase mt-1">Bot Variant: {acc.chatbotName}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between p-4 bg-black/40 rounded-[20px] border border-slate-800">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Uplink ID</span>
                        <span className="text-sm font-bold text-slate-300">{acc.phoneNumber}</span>
                      </div>
                      <div className="flex justify-between p-4 bg-green-500/5 rounded-[20px] border border-green-500/10">
                        <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Master Key</span>
                        <span className="text-sm font-black text-green-400 font-mono tracking-widest">{acc.password}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {showProfile && currentUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[48px] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
             <div className="p-10 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-5">
                   <div className="relative group">
                     <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-xl overflow-hidden border-4 border-white">
                        {currentUser.profilePic ? (
                          <img src={currentUser.profilePic} alt={currentUser.username} className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle size={40} />
                        )}
                     </div>
                     <button 
                       onClick={() => profilePicInputRef.current?.click()}
                       className="absolute bottom-0 right-0 bg-slate-900 text-white p-2 rounded-full shadow-lg border-2 border-white hover:scale-110 transition-transform active:scale-95"
                     >
                       <Camera size={16} />
                     </button>
                     <input 
                       type="file" 
                       ref={profilePicInputRef} 
                       className="hidden" 
                       accept="image/*" 
                       onChange={handleProfilePicChange}
                     />
                   </div>
                   <div>
                      <h3 className="text-2xl font-black tracking-tighter uppercase">{currentUser.username}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Active Security Node</p>
                   </div>
                </div>
                <button onClick={() => setShowProfile(false)} className="p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
                  <X size={20} />
                </button>
             </div>
             <div className="p-10 space-y-5">
                {[
                  { label: 'Uplink Phone', value: currentUser.phoneNumber, icon: Smartphone },
                  { label: 'Proxy Identity', value: currentUser.chatbotName, icon: Sparkles },
                  { label: 'Access Key', value: currentUser.password, icon: Lock },
                  { label: 'Registry ID', value: currentUser.id, icon: Database },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-5 p-5 bg-slate-50/80 rounded-[28px] border border-slate-100/50 group hover:border-slate-300 transition-all">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-slate-900 transition-colors border border-slate-100">
                      <item.icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">{item.label}</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{item.value}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-3 py-5 bg-red-500 text-white rounded-[28px] text-xs font-black uppercase tracking-[0.3em] hover:bg-red-600 transition-all shadow-xl shadow-red-100 active:scale-[0.98]"
                  >
                    <LogOut size={16} /> Terminate Uplink
                  </button>
                  <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest mt-2">Hulu assis Secure Protocol v1.0</p>
                </div>
             </div>
          </div>
        </div>
      )}
    </>
  );

  if (isAuthView) {
    return (
      <>
        {sharedUI}
        <AuthScreen 
          onShowAdmin={() => { refreshAdminData(); setShowAdminPanel(true); }}
          onLogin={(user) => { 
            setCurrentUser(user); 
            setIsAuthView(false); 
            loadUserData(user.id); 
            localStorage.setItem('hulu_current_user', JSON.stringify(user)); 
          }} 
        />
      </>
    );
  }

  const isSearching = searchQuery.length > 0;

  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-jakarta">
      {sharedUI}

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-slate-50 border-r border-slate-200 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-8 pb-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl overflow-hidden">
                   {currentUser?.profilePic ? (
                     <img src={currentUser.profilePic} alt="profile" className="w-full h-full object-cover" />
                   ) : (
                     <Cpu size={20} />
                   )}
                 </div>
                 <h1 className="text-xl font-black tracking-tighter text-slate-900 uppercase">Hulu assis</h1>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-500">
                <X size={20} />
              </button>
            </div>
            
            <div className="relative mb-6">
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isSearching ? 'text-green-500' : 'text-slate-400'}`} size={14} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search encrypted nodes..."
                className="w-full bg-white border border-slate-200 rounded-[20px] py-3 pl-11 pr-10 text-[11px] font-bold outline-none transition-all focus:ring-4 focus:ring-slate-100"
              />
              {isSearching && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <nav className="flex gap-1 bg-slate-200/40 p-1.5 rounded-[20px] mb-6">
              <button onClick={() => setView('chats')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[10px] font-black uppercase tracking-wider transition-all ${view === 'chats' && !isSearching ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><History size={12} /> History</button>
              <button onClick={() => setView('projects')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[10px] font-black uppercase tracking-wider transition-all ${view === 'projects' && !isSearching ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><BookMarked size={12} /> Pins</button>
            </nav>
            <button onClick={() => { setCurrentSessionId(null); setSelectedProjectId(null); setIsSidebarOpen(false); setView('chats'); setSearchQuery(''); }} className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 rounded-[20px] text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-[0.98]"><Plus size={18} /> New Session</button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-8">
            {isSearching ? (
              <div className="space-y-6">
                {filteredSessions.length > 0 && (
                  <div>
                    <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3 px-4">Chats ({filteredSessions.length})</h3>
                    <div className="space-y-1.5">
                      {filteredSessions.map(s => (
                        <button key={s.id} onClick={() => { setCurrentSessionId(s.id); setSelectedProjectId(null); setIsSidebarOpen(false); setSearchQuery(''); }} className="w-full flex items-center gap-4 p-4 rounded-[20px] text-left transition-all hover:bg-white/60">
                          <div className="p-2 rounded-xl bg-slate-100 text-slate-400">
                            <MessageSquare size={14} />
                          </div>
                          <span className="text-[11px] font-black text-slate-700 truncate uppercase tracking-tighter">{s.title || 'Blank Uplink'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {filteredProjects.length > 0 && (
                  <div>
                    <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3 px-4">Pinned ({filteredProjects.length})</h3>
                    <div className="space-y-1.5">
                      {filteredProjects.map(p => (
                        <button key={p.id} onClick={() => { setSelectedProjectId(p.id); setIsSidebarOpen(false); setSearchQuery(''); }} className="w-full p-4 bg-white rounded-[20px] border border-slate-100 hover:border-slate-300 transition-all text-left">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black text-green-600 uppercase">{p.type}</span>
                            <Star size={10} fill="currentColor" className="text-yellow-500" />
                          </div>
                          <p className="text-[11px] font-bold text-slate-800 truncate">{p.title}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {filteredSessions.length === 0 && filteredProjects.length === 0 && (
                  <div className="text-center py-10 px-4">
                    <SearchCode size={32} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No nodes found for your query.</p>
                  </div>
                )}
              </div>
            ) : view === 'chats' ? (
              <div className="space-y-1.5">
                {filteredSessions.map(s => (
                  <button key={s.id} onClick={() => { setCurrentSessionId(s.id); setSelectedProjectId(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-[20px] text-left transition-all ${currentSessionId === s.id && !selectedProjectId ? 'bg-white shadow-md ring-1 ring-slate-200/50' : 'hover:bg-white/60'}`}>
                    <div className={`p-2 rounded-xl ${currentSessionId === s.id ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                      <MessageSquare size={14} />
                    </div>
                    <span className="text-[11px] font-black text-slate-700 truncate uppercase tracking-tighter">{s.title || 'Blank Uplink'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map(p => (
                  <button key={p.id} onClick={() => { setSelectedProjectId(p.id); setIsSidebarOpen(false); }} className={`w-full p-5 bg-white rounded-[24px] border transition-all text-left group ${selectedProjectId === p.id ? 'border-green-400 shadow-lg' : 'border-slate-100 hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">{p.type}</span>
                      {p.type === 'code' ? <Terminal size={12} className="text-slate-400" /> : <Star size={12} fill="currentColor" className="text-yellow-500" />}
                    </div>
                    <p className="text-[12px] font-bold text-slate-800 truncate">{p.title}</p>
                    <p className="text-[9px] text-slate-400 mt-1 uppercase font-black">{new Date(p.timestamp).toLocaleDateString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-white min-w-0">
        <header className="h-20 flex items-center justify-between px-8 border-b border-slate-100 sticky top-0 z-20 bg-white/90 backdrop-blur-xl">
          <div className="flex items-center gap-5">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-slate-600 p-3 bg-slate-50 rounded-2xl"><Menu size={20} /></button>
            <div className="flex flex-col">
               <h2 className="text-lg font-black tracking-tighter uppercase leading-none">Hulu assis</h2>
               <div className="flex items-center gap-1.5 mt-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">System Operational</span>
               </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <Globe size={14} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cloud Encrypted</span>
             </div>
             <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 pl-4 border-l border-slate-100 hover:opacity-80 transition-all active:scale-95">
               <div className="flex flex-col items-end">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">{currentUser?.username}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">View Profile</span>
               </div>
               <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-lg border-2 border-white overflow-hidden">
                 {currentUser?.profilePic ? (
                   <img src={currentUser.profilePic} alt="profile" className="w-full h-full object-cover" />
                 ) : (
                   <User size={18} />
                 )}
               </div>
             </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 md:px-10 py-12 custom-scrollbar bg-[#fdfdfd]">
          <div className="max-w-4xl mx-auto min-h-full flex flex-col">
            {selectedProject ? (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 pb-20">
                <button onClick={() => setSelectedProjectId(null)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 mb-8 transition-colors"><ArrowLeft size={16} /> Close Document</button>
                <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-2xl">
                  <div className="p-10 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <div>
                       <span className="text-[10px] font-black text-green-600 uppercase tracking-widest block mb-1">Archived Content</span>
                       <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{selectedProject.title}</h3>
                    </div>
                    <button onClick={() => {
                       navigator.clipboard.writeText(selectedProject.content);
                       alert("Content secured to clipboard.");
                    }} className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-[20px] text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95"><Copy size={18} /> Copy Data</button>
                  </div>
                  <div className="p-10"><pre className="bg-slate-900 p-8 rounded-[32px] overflow-x-auto text-green-400 font-mono text-sm leading-relaxed border border-slate-800 shadow-inner"><code>{selectedProject.content}</code></pre></div>
                </div>
              </div>
            ) : currentSessionMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 animate-in fade-in duration-1000">
                <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center shadow-2xl mb-10 transform hover:scale-110 transition-transform cursor-default relative overflow-hidden">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping opacity-20"></div>
                  {currentUser?.profilePic ? (
                    <img src={currentUser.profilePic} alt="profile" className="w-full h-full object-cover" />
                  ) : (
                    <Cpu size={48} className="text-green-400" />
                  )}
                </div>
                <h3 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase mb-3 text-center">Ready for input.</h3>
                <p className="text-slate-500 font-bold uppercase text-[11px] tracking-[0.5em] text-center mb-16">The most powerful AI at your service.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-6">
                  {[`Analyze my source code`, `Deconstruct this visual image`, `Optimize my research strategy`, `Synthesize complex concepts`].map((tip, i) => (
                    <button key={i} onClick={() => handleSendMessage(tip)} className="text-left p-6 rounded-[28px] border border-slate-200 hover:border-slate-900 hover:bg-white bg-slate-50/30 transition-all font-bold text-sm text-slate-800 flex items-center justify-between group">
                      "{tip}"
                      <Zap size={14} className="text-slate-300 group-hover:text-green-500 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pb-16 w-full">
                {currentSessionMessages.map(m => (
                  <ChatMessage 
                    key={m.id} 
                    message={m} 
                    onPlayAudio={playAudio} 
                    isAudioPlaying={isAudioPlaying && audioLoadingId === m.id} 
                    audioLoadingId={audioLoadingId}
                    onStar={handleStarTopic}
                    onSaveCode={(code, lang) => {
                      const newItem: SavedProjectItem = { id: Date.now().toString(), type: 'code', title: `Snippet (${lang})`, content: code, language: lang, timestamp: Date.now() };
                      setProjects(prev => [newItem, ...prev]);
                    }}
                  />
                ))}
                {isLoading && (
                  <div className="flex items-center gap-4 text-slate-400 animate-pulse mb-10 px-4">
                    <Loader2 size={20} className="animate-spin text-slate-900" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em]">Hulu assis is thinking...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!selectedProjectId && <ChatInput onSend={handleSendMessage} onStop={handleStopGeneration} disabled={isLoading} />}
      </main>
    </div>
  );
};

interface AuthProps {
  onLogin: (user: UserAccount) => void;
  onShowAdmin: () => void;
}

const AuthScreen: React.FC<AuthProps> = ({ onLogin, onShowAdmin }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [formData, setFormData] = useState({ username: '', chatbotName: '', phoneNumber: '', password: '', confirmPassword: '' });
  const [otpValue, setOtpValue] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpHint, setShowOtpHint] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const validatePhone = (phone: string) => phone.replace(/[^\d]/g, '').length >= 10;

  const startSignupVerification = () => {
    if (!formData.username || !formData.chatbotName || !formData.phoneNumber || !formData.password) { setError('Mandatory fields required.'); return; }
    if (!validatePhone(formData.phoneNumber)) { setError('Invalid phone length. Verification required.'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Key verification mismatch.'); return; }
    const accounts: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
    if (accounts.some(a => a.phoneNumber === formData.phoneNumber)) { setError('Phone uplink already active.'); return; }
    generateAndSendOtp();
  };

  const generateAndSendOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setStep('otp');
    setError('');
    setShowOtpHint(true);
    setResendTimer(30);
    setTimeout(() => setShowOtpHint(false), 10000);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpValue === generatedOtp) {
      const accounts: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
      const newUser: UserAccount = { id: Date.now().toString(), username: formData.username, chatbotName: formData.chatbotName, phoneNumber: formData.phoneNumber, password: formData.password, createdAt: Date.now(), isBlocked: false };
      accounts.push(newUser);
      localStorage.setItem('hulu_accounts', JSON.stringify(accounts));
      onLogin(newUser);
    } else { setError('Authorization code invalid. Access denied.'); }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedPhone = formData.phoneNumber.trim().replace(/['"]/g, '');
    if (normalizedPhone === SECRET_ADMIN_CODE) { onShowAdmin(); return; }
    const accounts: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
    const user = accounts.find(a => a.phoneNumber === formData.phoneNumber && a.password === formData.password);
    if (user) {
      if (user.isBlocked) { setError('Identity revoked by security command.'); return; }
      onLogin(user);
    } else { setError('Invalid credentials. Uplink rejected.'); }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6 font-jakarta relative">
      {showOtpHint && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 w-full max-w-sm z-[300] animate-in slide-in-from-top-12 duration-700">
          <div className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700 p-6 rounded-[32px] shadow-[0_0_60px_rgba(0,0,0,0.4)] flex items-center gap-5">
            <div className="p-3.5 bg-green-500 rounded-2xl text-white shadow-xl shadow-green-500/20"><ShieldCheck size={24} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase text-green-500 tracking-[0.3em] mb-1">Security Transmission</p>
              <p className="text-sm font-bold text-white">OTP Code: <span className="text-green-400 font-mono text-lg tracking-[0.3em] ml-2">{generatedOtp}</span></p>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-lg animate-in fade-in zoom-in-95 duration-700">
        <div className="bg-white rounded-[60px] shadow-[0_30px_100px_rgba(0,0,0,0.08)] overflow-hidden border border-slate-100 p-12 md:p-16">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-slate-900 rounded-[30px] flex items-center justify-center mx-auto mb-8 shadow-2xl relative">
               <div className="absolute inset-0 bg-green-400/10 rounded-[30px] animate-pulse"></div>
               <Cpu size={36} className="text-green-400" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Hulu assis</h1>
            <p className="text-slate-400 font-bold uppercase text-[11px] tracking-[0.4em]">{mode === 'login' ? 'Authentication Terminal' : step === 'otp' ? 'Uplink Verification' : 'Identity Creation'}</p>
          </div>
          {mode === 'signup' && step === 'otp' ? (
            <form onSubmit={handleVerifyOtp} className="space-y-8">
              <div className="p-6 bg-red-50 border border-red-100 rounded-[32px] flex items-start gap-4">
                <ShieldAlert className="text-red-500 shrink-0 mt-1" size={20} />
                <div className="min-w-0">
                   <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Security Warning</p>
                   <p className="text-[12px] font-bold text-red-700 leading-relaxed">System logs detect fake uplinks. Entering fraudulent data leads to permanent node termination.</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-500">Sent verification code to</p>
                <p className="text-sm font-black text-slate-900 mt-1 uppercase tracking-widest">{formData.phoneNumber}</p>
              </div>
              <div className="relative">
                <input type="text" maxLength={6} placeholder="6-Digit OTP" className="w-full bg-slate-50 border border-slate-100 rounded-[24px] py-6 text-center text-2xl font-black tracking-[0.8em] outline-none focus:ring-8 focus:ring-slate-100 transition-all placeholder:tracking-normal placeholder:font-bold" value={otpValue} onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))} />
              </div>
              {error && <div className="flex items-center gap-3 text-red-500 bg-red-50 p-4 rounded-2xl text-[11px] font-black uppercase tracking-widest"><AlertTriangle size={16} /> {error}</div>}
              <div className="flex flex-col gap-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-[24px] text-xs font-black uppercase tracking-[0.3em] shadow-2xl shadow-slate-200 hover:bg-black transition-all active:scale-[0.98]">Authorize Node</button>
                <button type="button" onClick={generateAndSendOtp} disabled={resendTimer > 0} className={`w-full py-4 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${resendTimer > 0 ? 'text-slate-300' : 'text-slate-500 hover:text-slate-900'}`}><RefreshCcw size={14} className={resendTimer > 0 ? '' : 'animate-spin'} /> {resendTimer > 0 ? `Retry Uplink in ${resendTimer}s` : 'Resend Verification Code'}</button>
                <button type="button" onClick={() => setStep('details')} className="w-full text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Edit Details</button>
              </div>
            </form>
          ) : (
            <form onSubmit={mode === 'login' ? handleLoginSubmit : (e) => { e.preventDefault(); startSignupVerification(); }} className="space-y-5">
              {mode === 'signup' && (
                <>
                  <div className="relative"><UserCircle className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="Your Display Identity" className="w-full bg-slate-50 border border-slate-100 rounded-[24px] py-5 pl-14 pr-6 text-sm font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} /></div>
                  <div className="relative"><Sparkles className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="Bot Persona Name" className="w-full bg-slate-50 border border-slate-100 rounded-[24px] py-5 pl-14 pr-6 text-sm font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.chatbotName} onChange={e => setFormData({ ...formData, chatbotName: e.target.value })} /></div>
                </>
              )}
              <div className="relative"><Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="Uplink Phone Number" className="w-full bg-slate-50 border border-slate-100 rounded-[24px] py-5 pl-14 pr-6 text-sm font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} /></div>
              <div className="relative"><Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type={showPassword ? 'text' : 'password'} placeholder="Secure Access Key" className="w-full bg-slate-50 border border-slate-100 rounded-[24px] py-5 pl-14 pr-16 text-sm font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
              {mode === 'signup' && <div className="relative"><Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="password" placeholder="Verify Access Key" className="w-full bg-slate-50 border border-slate-100 rounded-[24px] py-5 pl-14 pr-6 text-sm font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} /></div>}
              {error && <div className="flex items-center gap-3 text-red-500 bg-red-50 p-4 rounded-2xl text-[11px] font-black uppercase tracking-widest"><AlertTriangle size={16} /> {error}</div>}
              <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-[24px] text-xs font-black uppercase tracking-[0.4em] shadow-2xl shadow-slate-200 hover:bg-black transition-all active:scale-[0.98] mt-4">{mode === 'login' ? 'Authorize Session' : 'Request Uplink'}</button>
            </form>
          )}
          <div className="mt-12 text-center"><button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setStep('details'); setError(''); }} className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-900 transition-colors">{mode === 'login' ? "New Identity? Begin Registry" : "Existing Identity? Authenticate"}</button></div>
        </div>
      </div>
    </div>
  );
};

export default App;
