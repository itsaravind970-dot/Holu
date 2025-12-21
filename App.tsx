
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, SavedProjectItem, UserAccount } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Menu, X, Sparkles, User, Loader2, Cpu, ArrowLeft, Lock, Smartphone, UserCircle, LogOut, Database, ShieldCheck, Zap, AlertCircle, RefreshCw
} from 'lucide-react';

const SECRET_ADMIN_CODE = 'Aravind63091309709705371970';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAuthView, setIsAuthView] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [adminAccounts, setAdminAccounts] = useState<UserAccount[]>([]);
  const [sessions, setSessions] = useState<ChatSessionHistory[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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
          setSessions(JSON.parse(localStorage.getItem(`hulu_sessions_${user.id}`) || '[]'));
        }
      }
      setAdminAccounts(JSON.parse(localStorage.getItem('hulu_accounts') || '[]'));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`hulu_sessions_${currentUser.id}`, JSON.stringify(sessions));
      localStorage.setItem('hulu_current_user', JSON.stringify(currentUser));
    }
  }, [sessions, currentUser]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
    const t = setTimeout(scrollToBottom, 200);
    return () => clearTimeout(t);
  }, [sessions, currentSessionId, isLoading, errorMessage]);

  const currentSessionMessages = useMemo(() => {
    return currentSessionId ? (sessions.find(s => s.id === currentSessionId)?.messages || []) : [];
  }, [sessions, currentSessionId]);

  const handleLogout = () => {
    localStorage.removeItem('hulu_current_user');
    setCurrentUser(null);
    setIsAuthView(true);
    setSessions([]);
    setShowProfile(false);
  };

  const handleSendMessage = async (text: string, file?: { data: string; mimeType: string }) => {
    if (text.trim().replace(/['"]/g, '') === SECRET_ADMIN_CODE) { setShowAdminPanel(true); return; }
    setErrorMessage(null);

    let activeId = currentSessionId;
    if (!activeId) {
      const newS: ChatSessionHistory = { id: Date.now().toString(), title: text.slice(0, 20), messages: [], updatedAt: Date.now() };
      setSessions(p => [newS, ...p]);
      activeId = newS.id;
      setCurrentSessionId(newS.id);
    }
    
    const userMsg: ChatMessageType = { 
      id: Date.now().toString(), role: 'user', parts: file ? [{ text }, { inlineData: file }] : [{ text }], timestamp: Date.now() 
    };
    
    setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, userMsg], updatedAt: Date.now() } : s));
    setIsLoading(true);
    
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;
    
    try {
      const history = sessions.find(s => s.id === activeId)?.messages || [];
      const res = await geminiService.chatWithHistory(history, text, file, ctrl.signal);
      
      const botMsg: ChatMessageType = { 
        id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: res.text }], timestamp: Date.now() 
      };
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, botMsg], updatedAt: Date.now() } : s));
    } catch (e: any) { 
      if (e.message === 'API_KEY_MISSING') {
        setErrorMessage("API Key is missing. Please add API_KEY to Vercel Project Settings.");
      } else if (e.message !== 'AbortError') {
        setErrorMessage("Protocol Link Error. Please check your connection or API status.");
      }
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

  if (isAuthView) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col">
        <AuthScreen onLogin={(user) => { setCurrentUser(user); setIsAuthView(false); setSessions(JSON.parse(localStorage.getItem(`hulu_sessions_${user.id}`) || '[]')); }} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-white text-slate-900 overflow-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><Cpu size={20} className="text-green-400" /></div>
            <h1 className="font-black text-sm uppercase tracking-tighter">Hulu assis</h1>
          </div>
          <button onClick={() => { setCurrentSessionId(null); setIsSidebarOpen(false); }} className="w-full bg-green-500 hover:bg-green-600 text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-6"><Plus size={18} /> New Session</button>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
            {sessions.map(s => (
              <button key={s.id} onClick={() => { setCurrentSessionId(s.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all ${currentSessionId === s.id ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                <MessageSquare size={14} className="text-white/40" />
                <span className="text-[11px] font-bold truncate uppercase">{s.title || 'Uplink Node'}</span>
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="mt-4 flex items-center gap-3 p-4 text-white/40 hover:text-white transition-colors">
            <LogOut size={16} /> <span className="text-[10px] font-black uppercase">Terminate</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-white relative">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-100 bg-white z-20 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-slate-50 rounded-xl"><Menu size={18} /></button>
            <div className="flex flex-col">
              <h2 className="text-[10px] font-black uppercase tracking-tight">System Online</h2>
              <div className="flex items-center gap-1.5 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div><span className="text-[8px] font-bold text-slate-400 uppercase">Secure Uplink</span></div>
            </div>
          </div>
          <button onClick={() => setShowProfile(true)} className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white border-2 border-white shadow-lg overflow-hidden">
             {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <User size={16} />}
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-6 custom-scrollbar bg-slate-50/10">
          <div className="max-w-3xl mx-auto w-full min-h-full flex flex-col">
            {currentSessionMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                <Cpu size={48} className="mb-6" />
                <h3 className="text-xl font-black uppercase tracking-tighter">Ready for Input</h3>
                <p className="text-[10px] uppercase tracking-[0.4em] mt-2">Standing by for synthesis</p>
              </div>
            ) : (
              <div className="pb-10">
                {currentSessionMessages.map(m => (
                  <ChatMessage 
                    key={m.id} 
                    message={m} 
                    onPlayAudio={playAudio} 
                    isAudioPlaying={isAudioPlaying && audioLoadingId === m.id} 
                  />
                ))}
                {isLoading && (
                  <div className="flex items-center gap-3 text-slate-400 animate-pulse px-4"><Loader2 size={16} className="animate-spin text-slate-900" /><span className="text-[10px] font-black uppercase tracking-widest">Generating...</span></div>
                )}
                {errorMessage && (
                  <div className="mx-4 p-6 bg-red-50 border border-red-200 rounded-3xl flex flex-col items-center gap-3 text-center animate-in slide-in-from-top-4 shadow-xl">
                    <AlertCircle className="text-red-500" size={32} />
                    <p className="text-xs font-bold text-red-700 uppercase">{errorMessage}</p>
                    <button onClick={() => handleSendMessage(currentSessionMessages[currentSessionMessages.length-1]?.parts[0].text || '')} className="mt-2 flex items-center gap-2 px-6 py-3 bg-red-600 text-white text-[10px] font-black uppercase rounded-xl"><RefreshCw size={14} /> Retry Synthesis</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shrink-0 p-4 border-t border-slate-100">
          <ChatInput onSend={handleSendMessage} onStop={() => { abortControllerRef.current?.abort(); setIsLoading(false); }} disabled={isLoading} />
        </div>
      </main>

      {showProfile && currentUser && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-sm p-8 shadow-2xl">
            <div className="flex justify-between mb-8">
              <h3 className="text-xl font-black uppercase tracking-tight">Identity Node</h3>
              <button onClick={() => setShowProfile(false)}><X /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl"><p className="text-[8px] font-black text-slate-400 uppercase">Username</p><p className="font-bold">{currentUser.username}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl"><p className="text-[8px] font-black text-slate-400 uppercase">Mobile ID</p><p className="font-bold">{currentUser.phoneNumber}</p></div>
              <button onClick={handleLogout} className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold uppercase tracking-widest mt-4">Terminate Link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AuthScreen: React.FC<{ onLogin: (u: UserAccount) => void }> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({ username: '', phoneNumber: '', password: '', chatbotName: '' });
  const [error, setError] = useState('');

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const accs = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
    if (mode === 'login') {
      const u = accs.find((a: any) => a.phoneNumber === formData.phoneNumber && a.password === formData.password);
      if (u) u.isBlocked ? setError('Identity blocked.') : onLogin(u);
      else setError('Invalid credentials.');
    } else {
      if (!formData.username || !formData.phoneNumber || !formData.password) return setError('Fill all fields.');
      const u = { id: Date.now().toString(), ...formData, createdAt: Date.now() };
      localStorage.setItem('hulu_accounts', JSON.stringify([...accs, u]));
      onLogin(u);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-sm bg-white p-8 rounded-[40px] shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-900 rounded-3xl mx-auto mb-4 flex items-center justify-center text-green-400 shadow-xl"><Cpu size={32} /></div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Hulu assis</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase mt-2 tracking-widest">{mode === 'login' ? 'Authenticating Identity' : 'Registering Identity'}</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'signup' && <input placeholder="Identity Name" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold outline-none" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />}
          <input placeholder="Mobile ID" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold outline-none" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} />
          <input type="password" placeholder="Passkey" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold outline-none" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
          {error && <p className="text-[10px] font-bold text-red-500 text-center uppercase tracking-tight">{error}</p>}
          <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl mt-4">Initiate Link</button>
        </form>
        <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="w-full mt-6 text-[9px] font-black uppercase text-slate-400 tracking-widest">{mode === 'login' ? "New identity? Register" : "Existing identity? Login"}</button>
      </div>
    </div>
  );
};

export default App;
