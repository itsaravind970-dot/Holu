
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, SavedProjectItem, UserAccount } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Search, Star, 
  Menu, X, Sparkles, User, Loader2, Cpu, Trash2, ArrowLeft, Lock, Smartphone, UserCircle, LogOut, Database, ShieldCheck, Fingerprint, Globe, Ban, CheckCircle, Zap, Camera,
  BookMarked, Copy
} from 'lucide-react';

const SECRET_ADMIN_CODE = 'Aravind63091309709705371970';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAuthView, setIsAuthView] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [adminAccounts, setAdminAccounts] = useState<UserAccount[]>([]);
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

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('hulu_current_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const accounts: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
        const freshUser = accounts.find(a => a.id === user.id);
        if (freshUser && freshUser.isBlocked) handleLogout();
        else {
          setCurrentUser(freshUser || user);
          setIsAuthView(false);
          loadUserData(user.id);
        }
      }
      refreshAdminData();
    } catch (e) { console.error("Storage Fault:", e); }
  }, []);

  const refreshAdminData = () => {
    try { setAdminAccounts(JSON.parse(localStorage.getItem('hulu_accounts') || '[]')); } 
    catch (e) { setAdminAccounts([]); }
  };

  const loadUserData = (userId: string) => {
    setSessions(JSON.parse(localStorage.getItem(`hulu_sessions_${userId}`) || '[]'));
    setProjects(JSON.parse(localStorage.getItem(`hulu_projects_${userId}`) || '[]'));
  };

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`hulu_sessions_${currentUser.id}`, JSON.stringify(sessions));
      localStorage.setItem(`hulu_projects_${currentUser.id}`, JSON.stringify(projects));
      localStorage.setItem('hulu_current_user', JSON.stringify(currentUser));
      const accounts: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
      localStorage.setItem('hulu_accounts', JSON.stringify(accounts.map(a => a.id === currentUser.id ? currentUser : a)));
    }
  }, [sessions, projects, currentUser]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [sessions, currentSessionId, isLoading]);

  const currentSessionMessages = useMemo(() => {
    return currentSessionId ? (sessions.find(s => s.id === currentSessionId)?.messages || []) : [];
  }, [sessions, currentSessionId]);

  const filteredSessions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return sessions.filter(s => s.title.toLowerCase().includes(query));
  }, [sessions, searchQuery]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return projects.filter(p => p.title.toLowerCase().includes(query));
  }, [projects, searchQuery]);

  const handleLogout = () => {
    localStorage.removeItem('hulu_current_user');
    setCurrentUser(null);
    setIsAuthView(true);
    setSessions([]);
    setProjects([]);
    setShowProfile(false);
  };

  const handleSendMessage = async (text: string, file?: { data: string; mimeType: string }) => {
    if (text.trim().replace(/['"]/g, '') === SECRET_ADMIN_CODE) { setShowAdminPanel(true); return; }
    setSelectedProjectId(null);
    let activeId = currentSessionId;
    if (!activeId) {
      const newS: ChatSessionHistory = { id: Date.now().toString(), title: text.slice(0, 30) || "Uplink", messages: [], updatedAt: Date.now() };
      setSessions(p => [newS, ...p]);
      activeId = newS.id;
      setCurrentSessionId(newS.id);
    }
    const userMsg: ChatMessageType = { id: Date.now().toString(), role: 'user', parts: file ? [{ text }, { inlineData: file }] : [{ text }], timestamp: Date.now() };
    setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, userMsg], updatedAt: Date.now() } : s));
    setIsLoading(true);
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;
    try {
      const history = sessions.find(s => s.id === activeId)?.messages || [];
      const res = await geminiService.chatWithHistory(history, text, file, ctrl.signal);
      const botMsg: ChatMessageType = { 
        id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: res.text }], timestamp: Date.now(),
        groundingSources: res.candidates?.[0]?.groundingMetadata?.groundingChunks as any
      };
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, botMsg], updatedAt: Date.now() } : s));
    } catch (e: any) { 
      if (e.message !== 'AbortError') console.error(e); 
    } finally { 
      setIsLoading(false); 
      abortControllerRef.current = null; 
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
    setAudioLoadingId(id);
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      const base64 = await geminiService.textToSpeech(text);
      if (base64) {
        const buffer = await decodeAudioData(base64, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => { setIsAudioPlaying(false); setAudioLoadingId(null); };
        currentAudioSourceRef.current = source;
        setIsAudioPlaying(true);
        source.start();
      }
    } catch (e) { setAudioLoadingId(null); }
  };

  const sharedUI = (
    <>
      {showAdminPanel && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/98 p-0 sm:p-4 md:p-10 animate-in fade-in">
          <div className="bg-[#0b0f19] w-full h-full sm:rounded-[32px] md:rounded-[48px] border border-slate-800 flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 md:p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3 md:gap-6">
                <div className="p-3 md:p-4 bg-green-500/10 rounded-2xl text-green-500 border border-green-500/20"><ShieldCheck size={24} className="md:w-9 md:h-9" /></div>
                <div>
                  <h2 className="text-base md:text-2xl font-black uppercase tracking-tight text-white leading-tight">Security Command</h2>
                  <p className="text-[7px] md:text-[10px] font-black text-green-500 uppercase tracking-widest mt-0.5">MASTER PORTAL ACCESS</p>
                </div>
              </div>
              <button onClick={() => setShowAdminPanel(false)} className="p-3 md:p-5 bg-slate-800 text-slate-400 rounded-xl md:rounded-2xl hover:text-white transition-all"><X size={20} className="md:w-6 md:h-6" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                {adminAccounts.map((acc, i) => (
                  <div key={i} className={`p-4 md:p-6 rounded-[24px] md:rounded-[32px] border transition-all flex flex-col ${acc.isBlocked ? 'bg-red-950/20 border-red-900/50' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}>
                    <div className="flex justify-between items-start mb-4 md:mb-6">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-green-500 overflow-hidden shadow-lg">
                          {acc.profilePic ? <img src={acc.profilePic} className="w-full h-full object-cover" /> : <Fingerprint size={20} className="md:w-7 md:h-7" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-bold text-xs md:text-base truncate max-w-[100px] md:max-w-[150px]">{acc.username}</p>
                          <p className="text-[8px] md:text-[10px] text-slate-500 uppercase tracking-tighter mt-0.5">{acc.chatbotName}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 md:gap-2">
                        <button onClick={() => {
                          const updated = adminAccounts.map(a => a.id === acc.id ? { ...a, isBlocked: !a.isBlocked } : a);
                          localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                          refreshAdminData();
                        }} className={`p-2 rounded-xl ${acc.isBlocked ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}`}>{acc.isBlocked ? <CheckCircle size={14} /> : <Ban size={14} />}</button>
                        <button onClick={() => { if(confirm('Purge identity node?')) {
                          const updated = adminAccounts.filter(a => a.id !== acc.id);
                          localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                          refreshAdminData();
                        }}} className="p-2 bg-slate-800 text-slate-400 rounded-xl hover:bg-red-600 hover:text-white transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-black/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-800/50 flex justify-between items-center">
                        <span className="text-[7px] md:text-[9px] text-slate-500 uppercase font-black">Uplink ID</span>
                        <span className="text-[10px] md:text-sm font-bold text-slate-300">{acc.phoneNumber}</span>
                      </div>
                      <div className="bg-green-500/5 p-3 md:p-4 rounded-xl md:rounded-2xl border border-green-500/10 flex justify-between items-center">
                        <span className="text-[7px] md:text-[9px] text-green-500 uppercase font-black">Access Pass</span>
                        <span className="text-[10px] md:text-sm font-mono text-green-400 font-bold tracking-widest">{acc.password}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showProfile && currentUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-900/90 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white rounded-[32px] md:rounded-[48px] w-full max-w-sm overflow-hidden shadow-2xl border border-white animate-in zoom-in-95">
             <div className="p-6 md:p-10 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-900 rounded-full flex items-center justify-center text-white overflow-hidden border-4 border-white shadow-xl">
                      {currentUser.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={32} className="md:w-10 md:h-10" />}
                    </div>
                    <button onClick={() => profilePicInputRef.current?.click()} className="absolute bottom-0 right-0 bg-slate-900 text-white p-2 rounded-full border-2 border-white shadow-lg active:scale-90 transition-transform"><Camera size={12} /></button>
                    <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const r = new FileReader();
                        r.onloadend = () => setCurrentUser({ ...currentUser, profilePic: r.result as string });
                        r.readAsDataURL(f);
                      }
                    }} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg md:text-2xl uppercase tracking-tighter leading-none">{currentUser.username}</h3>
                    <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">SECURE REGISTRY NODE</p>
                  </div>
                </div>
                <button onClick={() => setShowProfile(false)} className="p-3 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all active:scale-95"><X size={18} /></button>
             </div>
             <div className="p-6 md:p-10 space-y-3">
                {[
                  { label: 'Uplink Phone', value: currentUser.phoneNumber, icon: Smartphone },
                  { label: 'Bot Identity', value: currentUser.chatbotName, icon: Sparkles },
                  { label: 'Access Pass', value: currentUser.password, icon: Lock },
                  { label: 'Registry ID', value: currentUser.id, icon: Database },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 md:p-5 bg-slate-50/80 rounded-[20px] md:rounded-[28px] border border-slate-100/50">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm text-slate-400"><item.icon size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{item.label}</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{item.value}</p>
                    </div>
                  </div>
                ))}
                <button onClick={handleLogout} className="w-full mt-4 py-5 bg-red-500 text-white rounded-[24px] md:rounded-[28px] text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-red-100 hover:bg-red-600 transition-all flex items-center justify-center gap-2 active:scale-95"><LogOut size={16} /> TERMINATE UPLINK</button>
             </div>
          </div>
        </div>
      )}
    </>
  );

  if (isAuthView) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        {sharedUI}
        <AuthScreen 
          onShowAdmin={() => { refreshAdminData(); setShowAdminPanel(true); }}
          onLogin={(user) => { setCurrentUser(user); setIsAuthView(false); loadUserData(user.id); }} 
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-jakarta">
      {sharedUI}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 md:w-80 bg-slate-50 border-r border-slate-200 transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-5 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-full flex items-center justify-center text-white overflow-hidden shadow-lg">
                  {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <Cpu size={16} />}
                </div>
                <h1 className="font-black text-sm md:text-lg uppercase tracking-tighter text-slate-900">Hulu assis</h1>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400"><X size={20} /></button>
            </div>
            
            <div className="relative mb-5 md:mb-6">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search nodes..." className="w-full bg-white border border-slate-200 rounded-[20px] py-2.5 md:py-3.5 pl-10 pr-4 text-[10px] md:text-[12px] font-bold outline-none focus:ring-4 focus:ring-slate-100 transition-all" />
            </div>

            <button onClick={() => { setCurrentSessionId(null); setSelectedProjectId(null); setIsSidebarOpen(false); setView('chats'); }} className="w-full bg-slate-900 text-white py-4 rounded-[20px] md:rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"><Plus size={18} /> New Session</button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-1.5 pb-6">
            {(view === 'chats' ? filteredSessions : filteredProjects).map((item: any) => (
              <button key={item.id} onClick={() => { 
                if (view === 'chats') { setCurrentSessionId(item.id); setSelectedProjectId(null); }
                else { setSelectedProjectId(item.id); }
                setIsSidebarOpen(false);
              }} className={`w-full flex items-center gap-3 p-3.5 md:p-4 rounded-[20px] text-left transition-all ${((view === 'chats' && currentSessionId === item.id && !selectedProjectId) || (view === 'projects' && selectedProjectId === item.id)) ? 'bg-white shadow-md ring-1 ring-slate-200' : 'hover:bg-white/60'}`}>
                <div className={`p-2 rounded-xl ${((view === 'chats' && currentSessionId === item.id) || (view === 'projects' && selectedProjectId === item.id)) ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                  {view === 'chats' ? <MessageSquare size={14} /> : <BookMarked size={14} />}
                </div>
                <span className="text-[10px] md:text-[11px] font-black text-slate-700 truncate uppercase tracking-tighter">{item.title}</span>
              </button>
            ))}
          </div>
          
          <div className="p-5 md:p-6 border-t border-slate-100 flex gap-2">
             <button onClick={() => setView('chats')} className={`flex-1 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-[16px] transition-all ${view === 'chats' ? 'bg-slate-200 text-slate-900 shadow-inner' : 'text-slate-400'}`}>History</button>
             <button onClick={() => setView('projects')} className={`flex-1 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-[16px] transition-all ${view === 'projects' ? 'bg-slate-200 text-slate-900 shadow-inner' : 'text-slate-400'}`}>Pins</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-white">
        <header className="h-16 md:h-20 flex items-center justify-between px-5 md:px-10 border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-xl z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2.5 bg-slate-50 text-slate-600 rounded-xl"><Menu size={18} /></button>
            <div className="flex flex-col">
               <h2 className="text-[10px] md:text-sm font-black uppercase tracking-tighter text-slate-900">NODE: ACTIVE</h2>
               <div className="flex items-center gap-1.5 mt-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Uplink Established</span>
               </div>
            </div>
          </div>
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 hover:opacity-80 transition-all active:scale-95 pl-4 border-l border-slate-100">
             <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-900 leading-none">{currentUser?.username}</span>
                <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Registry Profile</span>
             </div>
             <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-slate-900 overflow-hidden border-2 border-white shadow-lg">
               {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <User size={16} className="text-white mx-auto mt-2.5" />}
             </div>
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-8 md:py-12 custom-scrollbar bg-[#fdfdfd]">
          <div className="max-w-4xl mx-auto min-h-full flex flex-col">
            {selectedProjectId ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <button onClick={() => setSelectedProjectId(null)} className="mb-6 md:mb-10 flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors"><ArrowLeft size={16} /> Exit Archive</button>
                 <div className="bg-white rounded-[32px] md:rounded-[48px] overflow-hidden border border-slate-200 shadow-2xl">
                    <div className="p-8 md:p-12 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                       <h3 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter">{projects.find(p => p.id === selectedProjectId)?.title}</h3>
                       <button onClick={() => navigator.clipboard.writeText(projects.find(p => p.id === selectedProjectId)?.content || '')} className="p-4 bg-slate-900 text-white rounded-2xl md:rounded-[24px] shadow-lg active:scale-95 transition-all"><Copy size={20} /></button>
                    </div>
                    <div className="p-8 md:p-12">
                       <pre className="bg-slate-900 p-6 md:p-10 rounded-[24px] md:rounded-[32px] text-green-400 font-mono text-xs md:text-sm overflow-x-auto leading-relaxed border border-slate-800 shadow-inner"><code>{projects.find(p => p.id === selectedProjectId)?.content}</code></pre>
                    </div>
                 </div>
              </div>
            ) : currentSessionMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 md:py-20 animate-in fade-in duration-700">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-900 rounded-[24px] md:rounded-[32px] flex items-center justify-center text-white shadow-2xl mb-8 relative overflow-hidden border-2 border-white">
                  <div className="absolute inset-0 bg-green-500/20 animate-pulse"></div>
                  {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <Cpu size={32} className="md:w-12 md:h-12 text-green-400" />}
                </div>
                <h3 className="text-2xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase mb-2 md:mb-4 text-center">Protocol Interface</h3>
                <p className="text-[9px] md:text-[11px] text-slate-400 font-black uppercase tracking-[0.4em] text-center mb-10 md:mb-16">SECURE INTELLIGENCE UPLINK ACTIVE</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full max-w-2xl px-4">
                  {[`Analyze security reports`, `Synthesize localized data`, `Propose strategic plans`, `Interpret code variants`].map((tip, i) => (
                    <button key={i} onClick={() => handleSendMessage(tip)} className="text-left p-4 md:p-6 rounded-[22px] md:rounded-[32px] border border-slate-100 hover:border-slate-900 hover:bg-white bg-slate-50/50 transition-all font-bold text-xs md:text-sm text-slate-800 flex items-center justify-between group">
                      "{tip}"
                      <Zap size={14} className="text-slate-200 group-hover:text-green-500 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pb-16 md:pb-24">
                {currentSessionMessages.map(m => (
                  <ChatMessage 
                    key={m.id} 
                    message={m} 
                    onPlayAudio={playAudio} 
                    isAudioPlaying={isAudioPlaying && audioLoadingId === m.id} 
                    onStar={(msg) => {
                       const p = { id: Date.now().toString(), type: 'topic', title: msg.parts[0].text?.slice(0, 30) || 'Pinned Note', content: msg.parts[0].text || '', timestamp: Date.now() };
                       setProjects(prev => [p as any, ...prev]);
                    }}
                  />
                ))}
                {isLoading && (
                  <div className="flex items-center gap-3 text-slate-400 animate-pulse text-[10px] md:text-[11px] uppercase font-black tracking-widest px-4">
                    <Loader2 size={16} className="animate-spin text-slate-900" /> Hulu assis is analyzing...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!selectedProjectId && <ChatInput onSend={handleSendMessage} onStop={() => { abortControllerRef.current?.abort(); setIsLoading(false); }} disabled={isLoading} />}
      </main>
    </div>
  );
};

const AuthScreen: React.FC<{ onLogin: (u: UserAccount) => void; onShowAdmin: () => void }> = ({ onLogin, onShowAdmin }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [formData, setFormData] = useState({ username: '', phoneNumber: '', password: '', confirmPassword: '', chatbotName: '' });
  const [otpValue, setOtpValue] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [error, setError] = useState('');
  const [showOtpHint, setShowOtpHint] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let t: any;
    if (resendTimer > 0) t = setInterval(() => setResendTimer(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  const validatePhone = (phone: string) => {
    // Basic international phone format or at least 10 digits
    return /^\d{10,}$/.test(phone.replace(/\D/g, ''));
  };

  const triggerSignup = () => {
    if (!formData.username || !formData.phoneNumber || !formData.password || !formData.chatbotName) return setError('ALL FIELDS MANDATORY.');
    if (!validatePhone(formData.phoneNumber)) return setError('WRONG MOBILE NUMBER FORMAT.');
    if (formData.password !== formData.confirmPassword) return setError('ACCESS PASS MISMATCH.');
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setStep('otp');
    setShowOtpHint(true);
    setResendTimer(30);
    setTimeout(() => setShowOtpHint(false), 10000);
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedPhone = formData.phoneNumber.trim().replace(/['"]/g, '');
    if (normalizedPhone === SECRET_ADMIN_CODE) { onShowAdmin(); return; }

    const accs = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
    if (mode === 'login') {
      const u = accs.find((a: any) => a.phoneNumber === formData.phoneNumber && a.password === formData.password);
      if (u) { if (u.isBlocked) setError('IDENTITY BLACKLISTED.'); else onLogin(u); }
      else setError('INCORRECT MOBILE OR PASSCODE.');
    } else {
      if (otpValue === generatedOtp) {
        const u = { id: Date.now().toString(), ...formData, createdAt: Date.now(), isBlocked: false };
        localStorage.setItem('hulu_accounts', JSON.stringify([...accs, u]));
        onLogin(u);
      } else setError('AUTHORIZATION CODE MISMATCH.');
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4 sm:p-6 relative overflow-y-auto">
      {showOtpHint && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 w-full max-w-xs md:max-w-sm z-[300] animate-in slide-in-from-top-12 duration-500">
          <div className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700 p-5 rounded-[24px] shadow-2xl flex items-center gap-4">
            <div className="p-3 bg-green-500 rounded-xl text-white"><ShieldCheck size={20} /></div>
            <div>
              <p className="text-[8px] font-black uppercase text-green-500 tracking-widest mb-1">Transmission OTP</p>
              <p className="text-sm font-bold text-white font-mono tracking-[0.3em]">{generatedOtp}</p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-[92%] sm:max-w-md lg:max-w-lg animate-in zoom-in-95 duration-700 my-10">
        <div className="bg-white p-6 sm:p-10 md:p-14 rounded-[32px] sm:rounded-[48px] md:rounded-[60px] shadow-[0_30px_100px_rgba(0,0,0,0.06)] border border-slate-100">
          <div className="text-center mb-8 md:mb-12">
            <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-slate-900 rounded-[18px] sm:rounded-[24px] md:rounded-[30px] mx-auto mb-5 md:mb-6 flex items-center justify-center text-white shadow-2xl relative">
              <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
              <Cpu size={24} className="sm:w-10 sm:h-10 text-green-400" />
            </div>
            <h2 className="text-xl sm:text-2xl md:text-4xl font-black uppercase tracking-tighter">Hulu assis</h2>
            <p className="text-[8px] sm:text-[9px] md:text-[11px] text-slate-400 font-black uppercase tracking-[0.4em] mt-2">{mode === 'login' ? 'IDENTITY AUTHENTICATION' : step === 'otp' ? 'UPLINK VERIFICATION' : 'REGISTRY ENROLLMENT'}</p>
          </div>

          {mode === 'signup' && step === 'otp' ? (
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="relative">
                <input type="text" maxLength={6} placeholder="6-DIGIT CODE" className="w-full bg-slate-50 border border-slate-100 rounded-[18px] py-5 sm:py-6 text-center text-xl sm:text-2xl font-black tracking-[0.4em] outline-none focus:ring-8 focus:ring-slate-100 transition-all placeholder:tracking-normal placeholder:font-bold" value={otpValue} onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))} />
              </div>
              {error && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[9px] font-black text-red-500 uppercase text-center bg-red-50 py-3 rounded-xl w-full">{error}</p>
                  <button type="button" onClick={triggerSignup} className="text-[10px] font-black uppercase text-green-500 underline py-2">Resend OTP Now</button>
                </div>
              )}
              <div className="space-y-3">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 sm:py-6 rounded-[18px] sm:rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] sm:text-[11px] shadow-2xl active:scale-95 transition-all">AUTHORIZE UPLINK</button>
                <div className="flex flex-col gap-2">
                   <button type="button" onClick={() => setStep('details')} className="w-full text-[9px] font-black uppercase text-slate-400 hover:text-black tracking-widest transition-colors py-2">Modify Registry</button>
                   {resendTimer === 0 && !error && (
                     <button type="button" onClick={triggerSignup} className="text-[9px] font-black uppercase text-green-500 hover:text-green-600 tracking-widest transition-colors py-2 underline">New Code Request</button>
                   )}
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={mode === 'login' ? handleAuth : (e) => { e.preventDefault(); triggerSignup(); }} className="space-y-3 sm:space-y-5">
              {mode === 'signup' && (
                <>
                  <div className="relative"><UserCircle className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input placeholder="Legal Identity" className="w-full bg-slate-50 border border-slate-100 rounded-[16px] sm:rounded-[24px] py-4 sm:py-5 pl-12 sm:pl-14 pr-4 text-xs font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} /></div>
                  <div className="relative"><Sparkles className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input placeholder="Bot Designation" className="w-full bg-slate-50 border border-slate-100 rounded-[16px] sm:rounded-[24px] py-4 sm:py-5 pl-12 sm:pl-14 pr-4 text-xs font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.chatbotName} onChange={e => setFormData({ ...formData, chatbotName: e.target.value })} /></div>
                </>
              )}
              <div className="relative"><Smartphone className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input placeholder="Phone ID" className="w-full bg-slate-50 border border-slate-100 rounded-[16px] sm:rounded-[24px] py-4 sm:py-5 pl-12 sm:pl-14 pr-4 text-xs font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} /></div>
              <div className="relative"><Lock className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input type="password" placeholder="Passkey" className="w-full bg-slate-50 border border-slate-100 rounded-[16px] sm:rounded-[24px] py-4 sm:py-5 pl-12 sm:pl-14 pr-4 text-xs font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} /></div>
              {mode === 'signup' && <div className="relative"><ShieldCheck className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input type="password" placeholder="Verify Passkey" className="w-full bg-slate-50 border border-slate-100 rounded-[16px] sm:rounded-[24px] py-4 sm:py-5 pl-12 sm:pl-14 pr-4 text-xs font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} /></div>}
              {error && <p className="text-[9px] font-black text-red-500 uppercase text-center bg-red-50 py-3 rounded-xl">{error}</p>}
              <button type="submit" className="w-full bg-slate-900 text-white py-4 sm:py-6 rounded-[16px] sm:rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl active:scale-95 transition-all mt-4">ESTABLISH LINK</button>
            </form>
          )}
          <div className="mt-8 text-center"><button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setStep('details'); setError(''); }} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-black transition-colors">{mode === 'login' ? "Registry Required? Join" : "Identity Verified? Authenticate"}</button></div>
        </div>
      </div>
    </div>
  );
};

export default App;
