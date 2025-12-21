
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, SavedProjectItem, UserAccount } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Search, Star, 
  Menu, X, Sparkles, User, Loader2, Cpu, Trash2, ArrowLeft, Lock, Smartphone, UserCircle, LogOut, Database, ShieldCheck, Fingerprint, Globe, Ban, CheckCircle, Zap, Camera,
  BookMarked, Copy, AlertCircle, RefreshCw
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
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

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
    // Double trigger for mobile layout shifts
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [sessions, currentSessionId, isLoading, errorMessage]);

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
    setErrorMessage(null);

    let activeId = currentSessionId;
    if (!activeId) {
      const newS: ChatSessionHistory = { id: Date.now().toString(), title: text.slice(0, 30) || "Uplink", messages: [], updatedAt: Date.now() };
      setSessions(p => [newS, ...p]);
      activeId = newS.id;
      setCurrentSessionId(newS.id);
    }
    
    const userMsg: ChatMessageType = { 
      id: Date.now().toString(), 
      role: 'user', 
      parts: file ? [{ text }, { inlineData: file }] : [{ text }], 
      timestamp: Date.now() 
    };
    
    setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, userMsg], updatedAt: Date.now() } : s));
    setIsLoading(true);
    
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;
    
    try {
      const history = sessions.find(s => s.id === activeId)?.messages || [];
      const res = await geminiService.chatWithHistory(history, text, file, ctrl.signal);
      
      const botMsg: ChatMessageType = { 
        id: Date.now().toString(), 
        role: 'model', 
        parts: [{ text: res.text }], 
        timestamp: Date.now() 
      };
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, botMsg], updatedAt: Date.now() } : s));
    } catch (e: any) { 
      if (e.message === 'API_KEY_MISSING') {
        setErrorMessage("CRITICAL: API Key is missing. Add API_KEY to Vercel Environment Variables.");
      } else if (e.message !== 'AbortError') {
        setErrorMessage("Network issue or API error. Please try again.");
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

  const sharedUI = (
    <>
      {showAdminPanel && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black p-4 sm:p-10 animate-in fade-in">
          <div className="bg-[#0b0f19] w-full h-full rounded-[32px] border border-slate-800 flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">System Admin</h2>
              <button onClick={() => setShowAdminPanel(false)} className="p-2 text-slate-400 hover:text-white"><X /></button>
            </div>
            <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adminAccounts.map((acc, i) => (
                <div key={i} className="p-6 bg-slate-900/40 border border-slate-800 rounded-3xl">
                  <p className="text-white font-bold">{acc.username}</p>
                  <p className="text-xs text-slate-500 mb-4">{acc.phoneNumber}</p>
                  <button onClick={() => {
                    const updated = adminAccounts.filter(a => a.id !== acc.id);
                    localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                    refreshAdminData();
                  }} className="text-red-500 text-xs font-bold uppercase tracking-widest hover:underline">Purge Identity</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showProfile && currentUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100">
             <div className="p-8 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-white overflow-hidden shadow-lg border-2 border-white">
                    {currentUser.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={32} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl leading-none">{currentUser.username}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Registry node</p>
                  </div>
                </div>
                <button onClick={() => setShowProfile(false)} className="p-2 bg-white rounded-full border border-slate-200"><X size={18} /></button>
             </div>
             <div className="p-8 space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Mobile</p>
                  <p className="text-sm font-bold">{currentUser.phoneNumber}</p>
                </div>
                <button onClick={handleLogout} className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95">Log Out</button>
             </div>
          </div>
        </div>
      )}
    </>
  );

  if (isAuthView) {
    return (
      <div className="fixed inset-0 bg-[#fafafa] flex flex-col">
        {sharedUI}
        <AuthScreen 
          onShowAdmin={() => { refreshAdminData(); setShowAdminPanel(true); }}
          onLogin={(user) => { setCurrentUser(user); setIsAuthView(false); loadUserData(user.id); }} 
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-white text-slate-900 overflow-hidden font-jakarta">
      {sharedUI}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-50 border-r border-slate-200 transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white overflow-hidden shadow-lg">
                  {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <Cpu size={16} />}
                </div>
                <h1 className="font-black text-sm uppercase tracking-tighter">Hulu assis</h1>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400"><X /></button>
            </div>
            <button onClick={() => { setCurrentSessionId(null); setIsSidebarOpen(false); setView('chats'); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"><Plus size={18} /> New Session</button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-1 pb-6">
            {filteredSessions.map((item: any) => (
              <button key={item.id} onClick={() => { setCurrentSessionId(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all ${currentSessionId === item.id ? 'bg-white shadow-md ring-1 ring-slate-100' : 'hover:bg-white/60'}`}>
                <MessageSquare size={14} className="text-slate-400" />
                <span className="text-[11px] font-bold text-slate-700 truncate uppercase">{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-white relative">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-100 bg-white/90 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-slate-50 rounded-xl"><Menu size={18} /></button>
            <div className="flex flex-col">
               <h2 className="text-[10px] font-black uppercase text-slate-900">Uplink Active</h2>
               <div className="flex items-center gap-1.5 mt-0.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-[8px] font-bold text-slate-400 uppercase">Established</span>
               </div>
            </div>
          </div>
          <button onClick={() => setShowProfile(true)} className="w-10 h-10 rounded-full bg-slate-900 border-2 border-white shadow-lg overflow-hidden">
             {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <User size={16} className="text-white mx-auto mt-2.5" />}
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-6 custom-scrollbar bg-slate-50/20">
          <div className="max-w-4xl mx-auto w-full min-h-full flex flex-col">
            {currentSessionMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-slate-900 rounded-[30px] flex items-center justify-center text-white shadow-2xl mb-8 border-2 border-white">
                  <Cpu size={32} />
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">Protocol Ready</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em]">Ask me anything to begin synthesis</p>
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
                  <div className="flex items-center gap-3 text-slate-400 animate-pulse px-4">
                    <Loader2 size={16} className="animate-spin text-slate-900" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Synthesizing response...</span>
                  </div>
                )}
                {errorMessage && (
                  <div className="mx-4 p-6 bg-red-50 border border-red-200 rounded-3xl flex flex-col items-center gap-3 text-center shadow-lg animate-in slide-in-from-top-4">
                    <AlertCircle className="text-red-500" size={32} />
                    <p className="text-xs font-bold text-red-700 uppercase tracking-tight">{errorMessage}</p>
                    <button onClick={() => handleSendMessage(currentSessionMessages[currentSessionMessages.length-1]?.parts[0].text || '')} className="mt-2 flex items-center gap-2 px-6 py-3 bg-red-600 text-white text-[10px] font-black uppercase rounded-xl">
                      <RefreshCw size={14} /> Retry
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shrink-0">
          <ChatInput onSend={handleSendMessage} onStop={() => { abortControllerRef.current?.abort(); setIsLoading(false); }} disabled={isLoading} />
        </div>
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

  const triggerSignup = () => {
    if (!formData.username || !formData.phoneNumber || !formData.password || !formData.chatbotName) return setError('All fields required.');
    if (formData.password !== formData.confirmPassword) return setError('Passwords mismatch.');
    
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
    const normPhone = formData.phoneNumber.trim().replace(/['"]/g, '');
    if (normPhone === SECRET_ADMIN_CODE) { onShowAdmin(); return; }

    const accs = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
    if (mode === 'login') {
      const u = accs.find((a: any) => a.phoneNumber === formData.phoneNumber && a.password === formData.password);
      if (u) { if (u.isBlocked) setError('Blocked account.'); else onLogin(u); }
      else setError('Invalid credentials.');
    } else {
      if (otpValue === generatedOtp) {
        const u = { id: Date.now().toString(), ...formData, createdAt: Date.now(), isBlocked: false };
        localStorage.setItem('hulu_accounts', JSON.stringify([...accs, u]));
        onLogin(u);
      } else setError('Invalid OTP code.');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 relative overflow-y-auto">
      {showOtpHint && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 p-4 rounded-2xl shadow-2xl flex items-center gap-3">
          <ShieldCheck className="text-green-500" size={20} />
          <span className="text-white font-mono font-bold tracking-[0.4em]">{generatedOtp}</span>
        </div>
      )}
      <div className="w-full max-w-sm">
        <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-slate-900 rounded-[24px] mx-auto mb-4 flex items-center justify-center text-white shadow-xl">
              <Cpu size={32} className="text-green-400" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Hulu assis</h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] mt-2">{mode === 'login' ? 'Authentication' : 'Registration'}</p>
          </div>

          {step === 'otp' ? (
            <form onSubmit={handleAuth} className="space-y-6">
              <input type="text" maxLength={6} placeholder="OTP CODE" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 text-center text-2xl font-black tracking-[0.4em] outline-none" value={otpValue} onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))} />
              {error && <p className="text-[10px] font-bold text-red-500 text-center uppercase">{error}</p>}
              <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl">Verify & Enter</button>
              <button type="button" onClick={() => setStep('details')} className="w-full text-[9px] font-black uppercase text-slate-400">Edit Details</button>
            </form>
          ) : (
            <form onSubmit={mode === 'login' ? handleAuth : (e) => { e.preventDefault(); triggerSignup(); }} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <input placeholder="Username" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold outline-none" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                  <input placeholder="Bot Name" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold outline-none" value={formData.chatbotName} onChange={e => setFormData({ ...formData, chatbotName: e.target.value })} />
                </>
              )}
              <input placeholder="Phone" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold outline-none" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} />
              <input type="password" placeholder="Password" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold outline-none" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              {mode === 'signup' && <input type="password" placeholder="Confirm Password" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold outline-none" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} />}
              {error && <p className="text-[10px] font-bold text-red-500 text-center uppercase">{error}</p>}
              <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl mt-4">Start Uplink</button>
            </form>
          )}
          <div className="mt-8 text-center">
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setStep('details'); setError(''); }} className="text-[9px] font-black uppercase tracking-widest text-slate-400">{mode === 'login' ? "New Identity? Create" : "Already Registered? Login"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
