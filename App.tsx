
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, UserAccount } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Menu, X, User, Loader2, Cpu, Lock, Smartphone, UserCircle, LogOut, ShieldCheck, Zap, AlertCircle, RefreshCw, Camera, Trash2, Ban, CheckCircle, Fingerprint, Info, Key, FileText
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
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('hulu_current_user');
      const accounts: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
      setAdminAccounts(accounts);

      if (storedUser) {
        const user = JSON.parse(storedUser);
        const freshUser = accounts.find(a => a.id === user.id);
        if (freshUser && freshUser.isBlocked) {
          handleLogout();
        } else {
          setCurrentUser(freshUser || user);
          setIsAuthView(false);
          setSessions(JSON.parse(localStorage.getItem(`hulu_sessions_${user.id}`) || '[]'));
        }
      }
    } catch (e) { console.error("Storage Error:", e); }
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`hulu_sessions_${currentUser.id}`, JSON.stringify(sessions));
      localStorage.setItem('hulu_current_user', JSON.stringify(currentUser));
      const allAccs: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
      const updatedAccs = allAccs.map(a => a.id === currentUser.id ? currentUser : a);
      localStorage.setItem('hulu_accounts', JSON.stringify(updatedAccs));
      setAdminAccounts(updatedAccs);
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

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentUser({ ...currentUser, profilePic: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (text: string, file?: { data: string; mimeType: string }) => {
    if (text.trim() === SECRET_ADMIN_CODE) { 
      setShowAdminPanel(true); 
      return; 
    }
    setErrorMessage(null);

    let activeId = currentSessionId;
    if (!activeId) {
      const newS: ChatSessionHistory = { id: Date.now().toString(), title: text.slice(0, 30), messages: [], updatedAt: Date.now() };
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
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        parts: [{ text: res.text }], 
        timestamp: Date.now(),
        groundingSources: res.candidates?.[0]?.groundingMetadata?.groundingChunks
      };
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, botMsg], updatedAt: Date.now() } : s));
    } catch (e: any) { 
      if (e.message !== 'AbortError') {
        setErrorMessage(e.message === 'API_KEY_MISSING' ? "API KEY MISSING" : "TRANSMISSION ERROR");
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
    return <AuthScreen onLogin={(user) => { setCurrentUser(user); setIsAuthView(false); }} />;
  }

  return (
    <div className="fixed inset-0 flex bg-white text-slate-900 overflow-hidden font-jakarta text-[10px]">
      {/* Sidebar (Menu) */}
      {(isSidebarOpen || showProfile) && <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[2px]" onClick={() => { setIsSidebarOpen(false); setShowProfile(false); }} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-52 bg-slate-950 text-white transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-3.5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center"><Cpu size={14} className="text-slate-900" /></div>
            <h1 className="font-black text-xs uppercase tracking-tighter">Hulu assis</h1>
          </div>
          <button onClick={() => { setCurrentSessionId(null); setIsSidebarOpen(false); }} className="w-full bg-white text-slate-900 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 mb-3 shadow active:scale-95 transition-all"><Plus size={12} /> New Uplink</button>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5">
            {sessions.map(s => (
              <button key={s.id} onClick={() => { setCurrentSessionId(s.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-left transition-all ${currentSessionId === s.id ? 'bg-white/10 ring-1 ring-white/5' : 'hover:bg-white/5 opacity-60'}`}>
                <MessageSquare size={10} className="text-green-500 shrink-0" />
                <span className="text-[9px] font-bold truncate uppercase tracking-tight">{s.title || 'Uplink active'}</span>
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="mt-2 flex items-center gap-2 p-2 text-red-400 hover:text-red-300 transition-colors">
            <LogOut size={12} /> <span className="text-[8px] font-black uppercase tracking-widest">Terminate link</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        <header className="h-10 flex items-center justify-between px-3 border-b border-slate-100 bg-white/80 backdrop-blur-md z-20 shrink-0">
          <div className="flex items-center gap-2.5">
            <button onClick={() => { setIsSidebarOpen(true); setShowProfile(false); }} className="lg:hidden p-1 bg-slate-50 rounded-md active:scale-90"><Menu size={14} /></button>
            <div className="flex flex-col">
              <h2 className="text-[8px] font-black uppercase text-slate-900 tracking-tighter leading-none">Secure Protocol</h2>
              <div className="flex items-center gap-1 mt-0.5"><div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Verified</span></div>
            </div>
          </div>
          <button onClick={() => { setShowProfile(true); setIsSidebarOpen(false); }} className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center text-white border border-white shadow shadow-slate-200 overflow-hidden active:scale-90">
             {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={16} />}
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar bg-[#fafafa]">
          <div className="max-w-xl mx-auto w-full min-h-full flex flex-col">
            {currentSessionMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center mb-3 shadow-sm"><Cpu size={24} className="text-slate-100 animate-pulse" /></div>
                <h3 className="text-base font-black uppercase tracking-tighter text-slate-950 mb-1">Initialize Hulu</h3>
                <p className="text-[7px] uppercase tracking-[0.2em] text-slate-300 font-bold max-w-[140px] leading-relaxed">System ready for node access</p>
              </div>
            ) : (
              <div className="pb-4">
                {currentSessionMessages.map(m => (
                  <ChatMessage 
                    key={m.id} 
                    message={m} 
                    onPlayAudio={playAudio} 
                    isAudioPlaying={isAudioPlaying && audioLoadingId === m.id} 
                  />
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-slate-400 animate-pulse px-2 py-2">
                    <Loader2 size={12} className="animate-spin text-green-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Neural uplink active...</span>
                  </div>
                )}
                {errorMessage && (
                  <div className="mx-2 p-4 bg-white border border-red-50 rounded-2xl flex flex-col items-center gap-3 text-center shadow animate-in zoom-in-95">
                    <div className="w-10 h-10 bg-red-600 text-white rounded-lg flex items-center justify-center shadow-sm"><AlertCircle size={20} /></div>
                    <div className="space-y-0.5">
                      <h4 className="font-black text-slate-900 uppercase text-xs tracking-tighter">Uplink Failure</h4>
                      <p className="text-[7px] font-bold text-red-500 uppercase tracking-widest leading-relaxed max-w-[140px]">{errorMessage}</p>
                    </div>
                    <button onClick={() => handleSendMessage(currentSessionMessages[currentSessionMessages.length-1]?.parts[0].text || '')} className="flex items-center gap-1.5 px-5 py-2.5 bg-red-600 text-white text-[7px] font-black uppercase rounded-lg shadow active:scale-95 transition-all"><RefreshCw size={10} /> Restore</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-2 border-t border-slate-100 pb-[calc(8px+env(safe-area-inset-bottom))]">
          <ChatInput onSend={handleSendMessage} onStop={() => { abortControllerRef.current?.abort(); setIsLoading(false); }} disabled={isLoading} />
        </div>
      </main>

      {/* Profile Drawer (Right Side) */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-64 bg-white text-slate-950 transition-transform duration-300 shadow-2xl ${showProfile ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
          <div className="p-4 bg-slate-50 flex items-center justify-between border-b border-slate-100 shrink-0">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400">Identity Node</h3>
            <button onClick={() => setShowProfile(false)} className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100 active:scale-90"><X size={14} /></button>
          </div>
          
          {currentUser && (
            <div className="flex-1">
              <div className="p-6 flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="w-20 h-20 bg-slate-950 rounded-2xl flex items-center justify-center text-white overflow-hidden border-4 border-white shadow-lg">
                    {currentUser.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={32} />}
                  </div>
                  <button onClick={() => profilePicInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-green-500 text-slate-950 p-1.5 rounded-lg border-2 border-white active:scale-90"><Camera size={12} /></button>
                  <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                </div>
                <h3 className="font-black text-base uppercase tracking-tighter text-slate-950 leading-none">{currentUser.username}</h3>
                <p className="text-[8px] font-black text-green-500 uppercase tracking-[0.2em] mt-1.5">Verified Identity Node</p>
                {currentUser.bio && (
                  <p className="mt-4 text-[9px] text-slate-500 font-medium leading-relaxed italic border-l-2 border-slate-100 pl-3">"{currentUser.bio}"</p>
                )}
              </div>
              
              <div className="px-5 pb-6 space-y-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">BOT DESIGNATION</p>
                  <div className="flex items-center gap-2">
                    <Cpu size={12} className="text-slate-300 shrink-0" />
                    <p className="font-bold text-slate-800 text-[10px]">{currentUser.chatbotName}</p>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">MOBILE UPLINK</p>
                  <div className="flex items-center gap-2">
                    <Smartphone size={12} className="text-slate-300 shrink-0" />
                    <p className="font-bold text-slate-800 text-[10px]">{currentUser.phoneNumber}</p>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">REGISTRY DATE</p>
                  <div className="flex items-center gap-2">
                    <FileText size={12} className="text-slate-300 shrink-0" />
                    <p className="font-bold text-slate-800 text-[10px]">{new Date(currentUser.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <button onClick={handleLogout} className="w-full py-3.5 bg-red-600 text-white rounded-xl font-black uppercase tracking-[0.2em] text-[8px] shadow-lg active:scale-95 flex items-center justify-center gap-2 mt-6"><LogOut size={12} /> TERMINATE ACCESS</button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Admin Panel */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-[200] bg-black p-2 flex flex-col animate-in fade-in duration-500">
          <div className="flex items-center justify-between p-4 bg-slate-900 rounded-t-xl border-b border-slate-800">
             <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-red-500/10 rounded-lg text-red-500"><ShieldCheck size={16} /></div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Security Master</h2>
                  <p className="text-[6px] font-black text-red-500 uppercase tracking-[0.2em] mt-0.5">Intelligence Registry</p>
                </div>
             </div>
             <button onClick={() => setShowAdminPanel(false)} className="p-2 bg-slate-800 text-white rounded-lg active:scale-90"><X size={14} /></button>
          </div>
          <div className="flex-1 bg-[#090b14] overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
             {adminAccounts.map((acc, idx) => (
               <div key={idx} className={`p-4 rounded-xl border transition-all ${acc.isBlocked ? 'bg-red-900/10 border-red-800/50 opacity-60' : 'bg-slate-900 border-slate-800/50'}`}>
                 <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                       <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-white overflow-hidden border border-slate-700">
                          {acc.profilePic ? <img src={acc.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={16} />}
                       </div>
                       <div>
                          <p className="font-black text-white uppercase tracking-tighter text-xs leading-none">{acc.username}</p>
                          <p className="text-[7px] font-bold text-slate-500 tracking-widest mt-0.5">{acc.phoneNumber}</p>
                       </div>
                    </div>
                    <div className="flex gap-1">
                       <button onClick={() => {
                         const updated = adminAccounts.map(a => a.id === acc.id ? { ...a, isBlocked: !a.isBlocked } : a);
                         localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                         setAdminAccounts(updated);
                       }} className={`p-2 rounded-md ${acc.isBlocked ? 'bg-green-500 text-slate-950' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                         {acc.isBlocked ? <CheckCircle size={12} /> : <Ban size={12} />}
                       </button>
                       <button onClick={() => {
                         const updated = adminAccounts.filter(a => a.id !== acc.id);
                         localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                         setAdminAccounts(updated);
                       }} className="p-2 bg-red-600 text-white rounded-md active:scale-90"><Trash2 size={12} /></button>
                    </div>
                 </div>
                 <div className="bg-black/60 p-2.5 rounded-lg flex justify-between items-center border border-white/5">
                    <div>
                      <span className="text-[6px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-0.5">PASSKEY</span>
                      <span className="font-mono text-green-400 font-bold text-sm tracking-widest leading-none">{acc.password}</span>
                    </div>
                    <Key className="text-slate-800" size={14} />
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AuthScreen: React.FC<{ onLogin: (u: UserAccount) => void }> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [formData, setFormData] = useState({ username: '', phoneNumber: '', password: '', confirmPassword: '', chatbotName: '', bio: '' });
  const [otpValue, setOtpValue] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [error, setError] = useState('');
  const [showOtpHint, setShowOtpHint] = useState(false);

  const triggerSignup = () => {
    if (!formData.username || !formData.phoneNumber || !formData.password || !formData.chatbotName) {
      return setError('DATA INCOMPLETE.');
    }
    if (formData.password !== formData.confirmPassword) {
      return setError('PASSKEYS MISMATCH.');
    }
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setStep('otp');
    setShowOtpHint(true);
    setTimeout(() => setShowOtpHint(false), 20000);
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const accs = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
    if (mode === 'login') {
      const u = accs.find((a: any) => a.phoneNumber === formData.phoneNumber && a.password === formData.password);
      if (u) {
        u.isBlocked ? setError('IDENTITY BLOCKED.') : onLogin(u);
      } else setError('INVALID CREDENTIALS.');
    } else {
      if (otpValue === generatedOtp) {
        const u = { id: Date.now().toString(), ...formData, createdAt: Date.now(), isBlocked: false };
        localStorage.setItem('hulu_accounts', JSON.stringify([...accs, u]));
        onLogin(u);
      } else setError('INVALID CODE.');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-[#f8fafc] overflow-y-auto custom-scrollbar">
      {showOtpHint && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[300] bg-slate-950 border border-slate-900 px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top-3 duration-500 max-w-[180px]">
          <div className="p-1.5 bg-green-500 rounded-md text-slate-950"><ShieldCheck size={14} /></div>
          <div>
            <p className="text-[6px] font-black uppercase text-green-500 tracking-[0.1em] mb-0.5 leading-none">Access Code</p>
            <p className="text-base font-black text-white font-mono tracking-[0.2em] leading-none">{generatedOtp}</p>
          </div>
        </div>
      )}
      <div className="w-full max-w-[260px] animate-in zoom-in-95 duration-500 my-auto">
        <div className="bg-white p-5 rounded-[28px] shadow-lg border border-slate-100">
          <div className="text-center mb-5">
            <div className="w-10 h-10 bg-slate-950 rounded-xl mx-auto mb-3 flex items-center justify-center text-green-400 relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-tr from-green-500/10 to-transparent"></div>
               <Cpu size={20} className="relative" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tighter text-slate-950 leading-none">Hulu</h2>
            <p className="text-[7px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1.5 leading-none">{mode === 'login' ? 'Auth Interface' : step === 'otp' ? 'Verification' : 'Registry'}</p>
          </div>

          {step === 'otp' ? (
            <form onSubmit={handleAuth} className="space-y-3">
              <input type="text" maxLength={6} placeholder="000000" className="w-full bg-slate-50 border border-slate-100 rounded-lg py-3 text-center text-xl font-black tracking-[0.2em] outline-none focus:border-green-500/30 transition-all placeholder:tracking-normal placeholder:opacity-20" value={otpValue} onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))} />
              {error && <p className="text-[8px] font-black text-red-500 text-center uppercase bg-red-50 py-1.5 rounded-md">{error}</p>}
              <button type="submit" className="w-full bg-slate-950 text-white py-3 rounded-lg font-black uppercase tracking-[0.2em] text-[8px] shadow active:scale-95 transition-all">ESTABLISH LINK</button>
              <div className="flex flex-col gap-1.5 text-center">
                <button type="button" onClick={() => setStep('details')} className="text-[7px] font-black uppercase text-slate-400">Back</button>
                <button type="button" onClick={triggerSignup} className="text-[7px] font-black uppercase text-green-500 underline">Resend</button>
              </div>
            </form>
          ) : (
            <form onSubmit={mode === 'login' ? handleAuth : (e) => { e.preventDefault(); triggerSignup(); }} className="space-y-2">
              {mode === 'signup' && (
                <>
                  <input placeholder="LEGAL FULL NAME" className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2.5 px-3.5 text-[9px] font-bold outline-none focus:border-slate-950 transition-all" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                  <input placeholder="BOT DESIGNATION" className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2.5 px-3.5 text-[9px] font-bold outline-none focus:border-slate-950 transition-all" value={formData.chatbotName} onChange={e => setFormData({ ...formData, chatbotName: e.target.value })} />
                </>
              )}
              <input placeholder="MOBILE ID" className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2.5 px-3.5 text-[9px] font-bold outline-none focus:border-slate-950 transition-all" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} />
              <input type="password" placeholder="PASSKEY" className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2.5 px-3.5 text-[9px] font-bold outline-none focus:border-slate-950 transition-all" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              {mode === 'signup' && (
                <>
                  <input type="password" placeholder="CONFIRM" className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2.5 px-3.5 text-[9px] font-bold outline-none focus:border-slate-950 transition-all" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} />
                  <textarea placeholder="USER BIO (OPTIONAL)" className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2 px-3.5 text-[9px] font-bold outline-none focus:border-slate-950 transition-all resize-none h-12" value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} />
                </>
              )}
              {error && <p className="text-[8px] font-black text-red-500 text-center uppercase bg-red-50 py-1.5 rounded-md">{error}</p>}
              <button type="submit" className="w-full bg-slate-950 text-white py-3.5 rounded-xl font-black uppercase tracking-[0.2em] text-[8px] shadow active:scale-95 transition-all mt-2">INITIATE ACCESS</button>
            </form>
          )}
          <div className="mt-5 text-center">
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setStep('details'); setError(''); }} className="text-[7px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-950 transition-colors">{mode === 'login' ? "New identity? enroll" : "registered? authenticate"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
