
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, UserAccount } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Menu, X, Sparkles, User, Loader2, Cpu, Lock, Smartphone, UserCircle, LogOut, Database, ShieldCheck, Zap, AlertCircle, RefreshCw, Camera, Trash2, Ban, CheckCircle
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
      const allAccs: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
      const updatedAccs = allAccs.map(a => a.id === currentUser.id ? currentUser : a);
      localStorage.setItem('hulu_accounts', JSON.stringify(updatedAccs));
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
      setAdminAccounts(JSON.parse(localStorage.getItem('hulu_accounts') || '[]'));
      setShowAdminPanel(true); 
      return; 
    }
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
        setErrorMessage("CRITICAL: API_KEY missing. Please set it in Vercel environment variables.");
      } else if (e.message !== 'AbortError') {
        setErrorMessage("Uplink unstable. Check your connection or API status.");
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
      <div className="fixed inset-0 bg-[#fafafa] flex flex-col">
        <AuthScreen 
          onLogin={(user) => { 
            setCurrentUser(user); 
            setIsAuthView(false); 
            setSessions(JSON.parse(localStorage.getItem(`hulu_sessions_${user.id}`) || '[]')); 
          }} 
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-white text-slate-900 overflow-hidden font-jakarta">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center"><Cpu size={20} className="text-slate-900" /></div>
            <h1 className="font-black text-sm uppercase tracking-tighter">Hulu assis</h1>
          </div>
          <button onClick={() => { setCurrentSessionId(null); setIsSidebarOpen(false); }} className="w-full bg-white text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-6"><Plus size={18} /> New Session</button>
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

      <main className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-100 bg-white z-20 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-slate-50 rounded-xl"><Menu size={18} /></button>
            <div className="flex flex-col">
              <h2 className="text-[10px] font-black uppercase text-slate-900">System Secure</h2>
              <div className="flex items-center gap-1.5 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div><span className="text-[8px] font-bold text-slate-400 uppercase">Hulu established</span></div>
            </div>
          </div>
          <button onClick={() => setShowProfile(true)} className="w-11 h-11 rounded-full bg-slate-900 flex items-center justify-center text-white border-2 border-white shadow-xl overflow-hidden active:scale-90 transition-transform">
             {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <User size={18} />}
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-6 custom-scrollbar bg-slate-50/5">
          <div className="max-w-3xl mx-auto w-full min-h-full flex flex-col">
            {currentSessionMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 opacity-30">
                <div className="w-20 h-20 bg-slate-100 rounded-[30px] flex items-center justify-center mb-6"><Cpu size={40} /></div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Initialize Protocol</h3>
                <p className="text-[10px] uppercase tracking-[0.4em] mt-2">Standing by for Aravind's instructions</p>
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
                  <div className="flex items-center gap-3 text-slate-400 animate-pulse px-4"><Loader2 size={16} className="animate-spin text-slate-900" /><span className="text-[10px] font-black uppercase tracking-widest">Synthesizing...</span></div>
                )}
                {errorMessage && (
                  <div className="mx-4 p-8 bg-red-50 border border-red-200 rounded-[40px] flex flex-col items-center gap-4 text-center shadow-2xl animate-in zoom-in-95">
                    <div className="w-16 h-16 bg-red-500 text-white rounded-3xl flex items-center justify-center shadow-xl"><AlertCircle size={32} /></div>
                    <div className="space-y-1">
                      <h4 className="font-black text-red-700 uppercase text-sm">Transmission Failure</h4>
                      <p className="text-xs font-bold text-red-600/70 uppercase tracking-tight">{errorMessage}</p>
                    </div>
                    <button onClick={() => handleSendMessage(currentSessionMessages[currentSessionMessages.length-1]?.parts[0].text || '')} className="flex items-center gap-2 px-8 py-4 bg-red-600 text-white text-[10px] font-black uppercase rounded-2xl shadow-lg active:scale-95"><RefreshCw size={14} /> Retry Synthesis</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shrink-0 p-4 border-t border-slate-100 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <ChatInput onSend={handleSendMessage} onStop={() => { abortControllerRef.current?.abort(); setIsLoading(false); }} disabled={isLoading} />
        </div>
      </main>

      {/* Profile Modal */}
      {showProfile && currentUser && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[48px] w-full max-w-sm overflow-hidden shadow-2xl border border-white animate-in zoom-in-95">
             <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col items-center">
                <button onClick={() => setShowProfile(false)} className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-md"><X size={18} /></button>
                <div className="relative group mb-6">
                  <div className="w-24 h-24 bg-slate-900 rounded-[36px] flex items-center justify-center text-white overflow-hidden border-4 border-white shadow-2xl transition-transform group-hover:scale-105">
                    {currentUser.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={48} />}
                  </div>
                  <button onClick={() => profilePicInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-green-500 text-slate-900 p-3 rounded-2xl border-2 border-white shadow-xl active:scale-90 transition-transform"><Camera size={16} /></button>
                  <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                </div>
                <h3 className="font-black text-2xl uppercase tracking-tighter text-slate-900 leading-none">{currentUser.username}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3">Elite Node Identity</p>
             </div>
             <div className="p-8 space-y-3">
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100/50">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">DESIGNATION</p>
                  <p className="font-bold text-slate-700">{currentUser.chatbotName}</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100/50">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">MOBILE ID</p>
                  <p className="font-bold text-slate-700">{currentUser.phoneNumber}</p>
                </div>
                <button onClick={handleLogout} className="w-full py-5 bg-red-600 text-white rounded-[28px] font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"><LogOut size={16} /> TERMINATE UPLINK</button>
             </div>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-[200] bg-black p-4 flex flex-col animate-in fade-in duration-500">
          <div className="flex items-center justify-between p-6 bg-slate-900 rounded-t-[40px] border-b border-slate-800">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/10 rounded-2xl text-red-500"><ShieldCheck /></div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">Security Master</h2>
                  <p className="text-[8px] font-black text-red-500 uppercase tracking-widest">Hulu Command Portal</p>
                </div>
             </div>
             <button onClick={() => setShowAdminPanel(false)} className="p-4 bg-slate-800 text-white rounded-2xl"><X /></button>
          </div>
          <div className="flex-1 bg-slate-900/50 overflow-y-auto p-6 space-y-4 custom-scrollbar">
             {adminAccounts.map((acc, idx) => (
               <div key={idx} className={`p-6 rounded-[32px] border transition-all ${acc.isBlocked ? 'bg-red-900/20 border-red-800' : 'bg-slate-800/40 border-slate-800'}`}>
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-slate-700 rounded-2xl flex items-center justify-center text-white overflow-hidden">
                          {acc.profilePic ? <img src={acc.profilePic} className="w-full h-full object-cover" /> : <User />}
                       </div>
                       <div>
                          <p className="font-black text-white uppercase tracking-tight">{acc.username}</p>
                          <p className="text-[10px] font-bold text-slate-500">{acc.phoneNumber}</p>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => {
                         const updated = adminAccounts.map(a => a.id === acc.id ? { ...a, isBlocked: !a.isBlocked } : a);
                         localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                         setAdminAccounts(updated);
                       }} className={`p-3 rounded-xl ${acc.isBlocked ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                         {acc.isBlocked ? <CheckCircle size={18} /> : <Ban size={18} />}
                       </button>
                       <button onClick={() => {
                         const updated = adminAccounts.filter(a => a.id !== acc.id);
                         localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                         setAdminAccounts(updated);
                       }} className="p-3 bg-red-600 text-white rounded-xl shadow-lg active:scale-90"><Trash2 size={18} /></button>
                    </div>
                 </div>
                 <div className="bg-black/40 p-4 rounded-2xl flex justify-between items-center">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Master Password</span>
                    <span className="font-mono text-green-400 font-bold">{acc.password}</span>
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
    if (!formData.username || !formData.phoneNumber || !formData.password || !formData.chatbotName) return setError('Registry incomplete.');
    if (formData.password !== formData.confirmPassword) return setError('Passwords mismatch.');
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setStep('otp');
    setShowOtpHint(true);
    setTimeout(() => setShowOtpHint(false), 15000);
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const accs = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
    if (mode === 'login') {
      const u = accs.find((a: any) => a.phoneNumber === formData.phoneNumber && a.password === formData.password);
      if (u) u.isBlocked ? setError('Identity blocked.') : onLogin(u);
      else setError('Invalid credentials.');
    } else {
      if (otpValue === generatedOtp) {
        const u = { id: Date.now().toString(), ...formData, createdAt: Date.now(), isBlocked: false };
        localStorage.setItem('hulu_accounts', JSON.stringify([...accs, u]));
        onLogin(u);
      } else setError('Incorrect verification code.');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 relative overflow-y-auto">
      {showOtpHint && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 border border-slate-700 p-5 rounded-[28px] shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-12 duration-500">
          <div className="p-3 bg-green-500 rounded-2xl text-slate-900 shadow-xl shadow-green-500/20"><ShieldCheck size={24} /></div>
          <div>
            <p className="text-[10px] font-black uppercase text-green-500 tracking-[0.2em] mb-1">Secure OTP Node</p>
            <p className="text-xl font-bold text-white font-mono tracking-[0.4em]">{generatedOtp}</p>
          </div>
        </div>
      )}
      <div className="w-full max-w-sm animate-in zoom-in-95 duration-700">
        <div className="bg-white p-10 rounded-[48px] shadow-[0_32px_80px_rgba(0,0,0,0.06)] border border-slate-100">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-slate-900 rounded-[24px] mx-auto mb-6 flex items-center justify-center text-green-400 shadow-2xl relative">
               <div className="absolute inset-0 bg-green-500/10 animate-pulse rounded-[24px]"></div>
               <Cpu size={32} />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Hulu assis</h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] mt-3">{mode === 'login' ? 'Authentication' : step === 'otp' ? 'Uplink Verification' : 'Enrollment'}</p>
          </div>

          {step === 'otp' ? (
            <form onSubmit={handleAuth} className="space-y-6">
              <input type="text" maxLength={6} placeholder="6-DIGIT CODE" className="w-full bg-slate-50 border border-slate-100 rounded-3xl py-6 text-center text-3xl font-black tracking-[0.4em] outline-none focus:ring-8 focus:ring-slate-100 transition-all placeholder:tracking-normal placeholder:font-bold" value={otpValue} onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))} />
              {error && <p className="text-[10px] font-black text-red-500 text-center uppercase bg-red-50 py-3 rounded-2xl">{error}</p>}
              <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl active:scale-95 transition-all">ESTABLISH LINK</button>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => setStep('details')} className="w-full text-[9px] font-black uppercase text-slate-400 py-2">Edit Credentials</button>
                <button type="button" onClick={triggerSignup} className="w-full text-[9px] font-black uppercase text-green-500 py-2 underline tracking-widest">Resend Code</button>
              </div>
            </form>
          ) : (
            <form onSubmit={mode === 'login' ? handleAuth : (e) => { e.preventDefault(); triggerSignup(); }} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <input placeholder="Legal Name" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4.5 px-6 text-sm font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                  <input placeholder="Bot Designation" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4.5 px-6 text-sm font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.chatbotName} onChange={e => setFormData({ ...formData, chatbotName: e.target.value })} />
                </>
              )}
              <input placeholder="Mobile ID" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4.5 px-6 text-sm font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} />
              <input type="password" placeholder="Passkey" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4.5 px-6 text-sm font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              {mode === 'signup' && <input type="password" placeholder="Verify Passkey" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4.5 px-6 text-sm font-bold outline-none focus:ring-8 focus:ring-slate-100 transition-all" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} />}
              {error && <p className="text-[10px] font-black text-red-500 text-center uppercase bg-red-50 py-3 rounded-2xl">{error}</p>}
              <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl active:scale-95 transition-all mt-4">INITIATE UPLINK</button>
            </form>
          )}
          <div className="mt-8 text-center">
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setStep('details'); setError(''); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">{mode === 'login' ? "New Identity? Register" : "Registered? Authenticate"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
