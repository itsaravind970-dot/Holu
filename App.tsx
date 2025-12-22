
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, UserAccount } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Menu, X, User, Loader2, Cpu, Lock, Smartphone, UserCircle, LogOut, ShieldCheck, Zap, AlertCircle, RefreshCw, Camera, Trash2, Ban, CheckCircle, Fingerprint, Info, Key
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
    <div className="fixed inset-0 flex bg-white text-slate-900 overflow-hidden font-jakarta">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-slate-950 text-white transition-transform duration-500 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-8">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)]"><Cpu size={24} className="text-slate-900" /></div>
            <h1 className="font-black text-lg uppercase tracking-tighter">Hulu assis</h1>
          </div>
          <button onClick={() => { setCurrentSessionId(null); setIsSidebarOpen(false); }} className="w-full bg-white text-slate-900 py-5 rounded-[24px] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-8 shadow-xl active:scale-95 transition-all"><Plus size={18} /> New Uplink</button>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
            {sessions.map(s => (
              <button key={s.id} onClick={() => { setCurrentSessionId(s.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-5 rounded-[24px] text-left transition-all ${currentSessionId === s.id ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5 opacity-60'}`}>
                <MessageSquare size={16} className="text-green-500" />
                <span className="text-[12px] font-bold truncate uppercase tracking-tight">{s.title || 'Uplink active'}</span>
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="mt-8 flex items-center gap-4 p-5 text-red-400 hover:text-red-300 transition-colors group">
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" /> <span className="text-[11px] font-black uppercase tracking-widest">Terminate link</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        <header className="h-20 flex items-center justify-between px-8 border-b border-slate-100 bg-white/80 backdrop-blur-md z-20 shrink-0">
          <div className="flex items-center gap-5">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-3 bg-slate-50 rounded-2xl active:scale-90 transition-all"><Menu size={22} /></button>
            <div className="flex flex-col">
              <h2 className="text-[11px] font-black uppercase text-slate-900 tracking-tighter">Secure Protocol</h2>
              <div className="flex items-center gap-2 mt-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aravind verified</span></div>
            </div>
          </div>
          <button onClick={() => setShowProfile(true)} className="w-12 h-12 rounded-2xl bg-slate-950 flex items-center justify-center text-white border-4 border-white shadow-2xl overflow-hidden active:scale-90 transition-transform">
             {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={28} />}
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 md:px-12 py-10 custom-scrollbar bg-[#fafafa]">
          <div className="max-w-4xl mx-auto w-full min-h-full flex flex-col">
            {currentSessionMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                <div className="w-32 h-32 bg-white border-2 border-slate-100 rounded-[48px] flex items-center justify-center mb-10 shadow-sm"><Cpu size={64} className="text-slate-100 animate-pulse" /></div>
                <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-950 mb-4">Initialize Hulu</h3>
                <p className="text-[11px] uppercase tracking-[0.6em] text-slate-300 font-bold max-w-xs leading-relaxed">System ready for Aravind's instruction node</p>
              </div>
            ) : (
              <div className="pb-12">
                {currentSessionMessages.map(m => (
                  <ChatMessage 
                    key={m.id} 
                    message={m} 
                    onPlayAudio={playAudio} 
                    isAudioPlaying={isAudioPlaying && audioLoadingId === m.id} 
                  />
                ))}
                {isLoading && (
                  <div className="flex items-center gap-4 text-slate-400 animate-pulse px-6 py-8">
                    <Loader2 size={20} className="animate-spin text-green-500" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">Processing neural uplink...</span>
                  </div>
                )}
                {errorMessage && (
                  <div className="mx-6 p-12 bg-white border-2 border-red-50 rounded-[56px] flex flex-col items-center gap-8 text-center shadow-2xl animate-in zoom-in-95">
                    <div className="w-24 h-24 bg-red-600 text-white rounded-[40px] flex items-center justify-center shadow-xl"><AlertCircle size={48} /></div>
                    <div className="space-y-3">
                      <h4 className="font-black text-slate-900 uppercase text-2xl tracking-tighter">Transmission Error</h4>
                      <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest leading-relaxed max-w-[240px]">{errorMessage}</p>
                    </div>
                    <button onClick={() => handleSendMessage(currentSessionMessages[currentSessionMessages.length-1]?.parts[0].text || '')} className="flex items-center gap-3 px-12 py-6 bg-red-600 text-white text-[11px] font-black uppercase rounded-[28px] shadow-2xl active:scale-95 transition-all"><RefreshCw size={16} /> Restore Link</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 border-t border-slate-100 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <ChatInput onSend={handleSendMessage} onStop={() => { abortControllerRef.current?.abort(); setIsLoading(false); }} disabled={isLoading} />
        </div>
      </main>

      {/* Profile Overlay */}
      {showProfile && currentUser && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-8 animate-in fade-in duration-300">
          <div className="bg-white rounded-[64px] w-full max-w-sm overflow-hidden shadow-2xl border border-white animate-in zoom-in-95 duration-500">
             <div className="p-12 bg-slate-50 flex flex-col items-center relative">
                <button onClick={() => setShowProfile(false)} className="absolute top-10 right-10 p-4 bg-white rounded-3xl shadow-lg active:scale-90"><X size={24} /></button>
                <div className="relative mb-10">
                  <div className="w-32 h-32 bg-slate-950 rounded-[48px] flex items-center justify-center text-white overflow-hidden border-8 border-white shadow-2xl">
                    {currentUser.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={64} />}
                  </div>
                  <button onClick={() => profilePicInputRef.current?.click()} className="absolute -bottom-3 -right-3 bg-green-500 text-slate-950 p-4 rounded-3xl border-4 border-white shadow-xl active:scale-90 transition-transform"><Camera size={20} /></button>
                  <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                </div>
                <h3 className="font-black text-3xl uppercase tracking-tighter text-slate-950">{currentUser.username}</h3>
                <p className="text-[12px] font-black text-green-500 uppercase tracking-[0.4em] mt-4">Security Level 1 Node</p>
             </div>
             <div className="p-12 space-y-4">
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">BOT ASSIGNMENT</p>
                    <p className="font-bold text-slate-800 text-sm">{currentUser.chatbotName}</p>
                  </div>
                  <Cpu className="text-slate-200" size={24} />
                </div>
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">UPLINK MOBILE</p>
                    <p className="font-bold text-slate-800 text-sm">{currentUser.phoneNumber}</p>
                  </div>
                  <Smartphone className="text-slate-200" size={24} />
                </div>
                <button onClick={handleLogout} className="w-full py-7 bg-red-600 text-white rounded-[32px] font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl active:scale-95 flex items-center justify-center gap-3 mt-8"><LogOut size={20} /> TERMINATE ACCESS</button>
             </div>
          </div>
        </div>
      )}

      {/* Admin Panel */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-[200] bg-black p-4 flex flex-col animate-in fade-in duration-500">
          <div className="flex items-center justify-between p-10 bg-slate-900 rounded-t-[56px] border-b border-slate-800">
             <div className="flex items-center gap-6">
                <div className="p-5 bg-red-500/10 rounded-3xl text-red-500"><ShieldCheck size={36} /></div>
                <div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Security Master</h2>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em]">Hulu Neural Registry</p>
                </div>
             </div>
             <button onClick={() => setShowAdminPanel(false)} className="p-6 bg-slate-800 text-white rounded-[32px] active:scale-90 transition-all"><X size={28} /></button>
          </div>
          <div className="flex-1 bg-[#090b14] overflow-y-auto p-10 space-y-6 custom-scrollbar">
             {adminAccounts.map((acc, idx) => (
               <div key={idx} className={`p-10 rounded-[48px] border transition-all ${acc.isBlocked ? 'bg-red-900/10 border-red-800/50 opacity-60' : 'bg-slate-900 border-slate-800/50'}`}>
                 <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-6">
                       <div className="w-16 h-16 bg-slate-800 rounded-[28px] flex items-center justify-center text-white overflow-hidden border border-slate-700 shadow-xl">
                          {acc.profilePic ? <img src={acc.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={32} />}
                       </div>
                       <div>
                          <p className="font-black text-white uppercase tracking-tighter text-xl">{acc.username}</p>
                          <p className="text-[11px] font-bold text-slate-500 tracking-widest">{acc.phoneNumber}</p>
                       </div>
                    </div>
                    <div className="flex gap-4">
                       <button onClick={() => {
                         const updated = adminAccounts.map(a => a.id === acc.id ? { ...a, isBlocked: !a.isBlocked } : a);
                         localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                         setAdminAccounts(updated);
                       }} className={`p-5 rounded-2xl ${acc.isBlocked ? 'bg-green-500 text-slate-950' : 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-lg shadow-red-500/10'}`}>
                         {acc.isBlocked ? <CheckCircle size={24} /> : <Ban size={24} />}
                       </button>
                       <button onClick={() => {
                         const updated = adminAccounts.filter(a => a.id !== acc.id);
                         localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                         setAdminAccounts(updated);
                       }} className="p-5 bg-red-600 text-white rounded-2xl shadow-2xl active:scale-90"><Trash2 size={24} /></button>
                    </div>
                 </div>
                 <div className="bg-black/60 p-6 rounded-[32px] flex justify-between items-center border border-white/5">
                    <div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">ACCESS PASSKEY</span>
                      <span className="font-mono text-green-400 font-bold text-2xl tracking-widest">{acc.password}</span>
                    </div>
                    <Key className="text-slate-800" size={32} />
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
  const [formData, setFormData] = useState({ username: '', phoneNumber: '', password: '', confirmPassword: '', chatbotName: '' });
  const [otpValue, setOtpValue] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [error, setError] = useState('');
  const [showOtpHint, setShowOtpHint] = useState(false);

  const triggerSignup = () => {
    if (!formData.username || !formData.phoneNumber || !formData.password || !formData.chatbotName) {
      return setError('REGISTRY DATA INCOMPLETE.');
    }
    if (formData.password !== formData.confirmPassword) {
      return setError('PASSKEYS DO NOT MATCH.');
    }
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setStep('otp');
    setShowOtpHint(true);
    setTimeout(() => setShowOtpHint(false), 25000);
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const accs = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
    if (mode === 'login') {
      const u = accs.find((a: any) => a.phoneNumber === formData.phoneNumber && a.password === formData.password);
      if (u) {
        u.isBlocked ? setError('IDENTITY BLOCKED BY SECURITY.') : onLogin(u);
      } else setError('IDENTITY NOT RECOGNIZED.');
    } else {
      if (otpValue === generatedOtp) {
        const u = { id: Date.now().toString(), ...formData, createdAt: Date.now(), isBlocked: false };
        localStorage.setItem('hulu_accounts', JSON.stringify([...accs, u]));
        onLogin(u);
      } else setError('INVALID UPLINK CODE.');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 bg-[#f8fafc] overflow-y-auto">
      {showOtpHint && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-950 border-4 border-slate-900 p-8 rounded-[48px] shadow-2xl flex items-center gap-8 animate-in slide-in-from-top-12 duration-1000">
          <div className="p-5 bg-green-500 rounded-[24px] text-slate-950 shadow-[0_15px_40px_rgba(34,197,94,0.4)]"><ShieldCheck size={32} /></div>
          <div>
            <p className="text-[11px] font-black uppercase text-green-500 tracking-[0.4em] mb-2">Secure Uplink Verified</p>
            <p className="text-3xl font-black text-white font-mono tracking-[0.6em]">{generatedOtp}</p>
          </div>
          <div className="h-12 w-px bg-slate-800 mx-2"></div>
          <Fingerprint className="text-slate-700 animate-pulse" size={28} />
        </div>
      )}
      <div className="w-full max-w-sm animate-in zoom-in-95 duration-1000">
        <div className="bg-white p-12 rounded-[72px] shadow-[0_50px_120px_rgba(0,0,0,0.12)] border border-slate-100">
          <div className="text-center mb-12">
            <div className="w-24 h-24 bg-slate-950 rounded-[40px] mx-auto mb-10 flex items-center justify-center text-green-400 shadow-2xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-tr from-green-500/30 to-transparent group-hover:scale-150 transition-transform duration-[2000ms]"></div>
               <Cpu size={48} className="relative" />
            </div>
            <h2 className="text-5xl font-black uppercase tracking-tighter text-slate-950">Hulu</h2>
            <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.6em] mt-5">{mode === 'login' ? 'Auth Interface' : step === 'otp' ? 'Uplink Verify' : 'Enroll Identity'}</p>
          </div>

          {step === 'otp' ? (
            <form onSubmit={handleAuth} className="space-y-10">
              <input type="text" maxLength={6} placeholder="000000" className="w-full bg-slate-50 border-4 border-slate-100 rounded-[40px] py-10 text-center text-5xl font-black tracking-[0.6em] outline-none focus:border-green-500/40 focus:bg-white transition-all placeholder:tracking-normal placeholder:opacity-20" value={otpValue} onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))} />
              {error && <p className="text-[11px] font-black text-red-500 text-center uppercase bg-red-50 py-5 rounded-[24px] tracking-widest">{error}</p>}
              <button type="submit" className="w-full bg-slate-950 text-white py-10 rounded-[44px] font-black uppercase tracking-[0.4em] text-[12px] shadow-2xl active:scale-95 transition-all">ESTABLISH LINK</button>
              <div className="flex flex-col gap-5 text-center">
                <button type="button" onClick={() => setStep('details')} className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Back to details</button>
                <button type="button" onClick={triggerSignup} className="text-[11px] font-black uppercase text-green-500 underline tracking-[0.3em]">Resend Code</button>
              </div>
            </form>
          ) : (
            <form onSubmit={mode === 'login' ? handleAuth : (e) => { e.preventDefault(); triggerSignup(); }} className="space-y-5">
              {mode === 'signup' && (
                <>
                  <input placeholder="LEGAL FULL NAME" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[32px] py-6 px-10 text-sm font-bold outline-none focus:border-slate-950 focus:bg-white transition-all" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                  <input placeholder="BOT DESIGNATION" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[32px] py-6 px-10 text-sm font-bold outline-none focus:border-slate-950 focus:bg-white transition-all" value={formData.chatbotName} onChange={e => setFormData({ ...formData, chatbotName: e.target.value })} />
                </>
              )}
              <input placeholder="MOBILE ID NODE" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[32px] py-6 px-10 text-sm font-bold outline-none focus:border-slate-950 focus:bg-white transition-all" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} />
              <input type="password" placeholder="SECURITY PASSKEY" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[32px] py-6 px-10 text-sm font-bold outline-none focus:border-slate-950 focus:bg-white transition-all" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              {mode === 'signup' && <input type="password" placeholder="CONFIRM PASSKEY" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[32px] py-6 px-10 text-sm font-bold outline-none focus:border-slate-950 focus:bg-white transition-all" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} />}
              {error && <p className="text-[11px] font-black text-red-500 text-center uppercase bg-red-50 py-5 rounded-[24px] tracking-widest">{error}</p>}
              <button type="submit" className="w-full bg-slate-950 text-white py-10 rounded-[44px] font-black uppercase tracking-[0.4em] text-[12px] shadow-2xl active:scale-95 transition-all mt-8">INITIATE ACCESS</button>
            </form>
          )}
          <div className="mt-12 text-center">
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setStep('details'); setError(''); }} className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-950 transition-colors">{mode === 'login' ? "New identity? enroll" : "registered? authenticate"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
