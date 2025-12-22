
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, UserAccount } from './types';
import { geminiService } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Menu, X, Loader2, Waves, Smartphone, UserCircle, LogOut, Zap, AlertCircle, Camera, Save, Eye, EyeOff, Fingerprint, ShieldCheck
} from 'lucide-react';

const CLOUD_STORAGE_KEY = 'aravind_user_registry_v18_final';
const CLOUD_URL = `https://kvdb.io/MWpXp2A1oB6yq7X9Z4Y8R/${CLOUD_STORAGE_KEY}`;

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount & { lastSearch?: string } | null>(null);
  const [isAuthView, setIsAuthView] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionHistory[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'online' | 'offline' | 'syncing'>('online');
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  
  const [tempProfileData, setTempProfileData] = useState({ username: '', chatbotName: '', bio: '' });

  const scrollRef = useRef<HTMLDivElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [sessions, isLoading]);

  const syncUserToGlobalHub = async (userToSync: UserAccount) => {
    setCloudStatus('syncing');
    try {
      const res = await fetch(CLOUD_URL);
      let registry: UserAccount[] = [];
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) registry = data;
      }
      
      const index = registry.findIndex(a => a.phoneNumber === userToSync.phoneNumber);
      const updatedEntry = { ...userToSync, lastLoginAt: Date.now() };
      
      if (index > -1) {
        registry[index] = { ...registry[index], ...updatedEntry };
      } else {
        registry.push(updatedEntry);
      }

      await fetch(CLOUD_URL, {
        method: 'POST',
        body: JSON.stringify(registry),
        headers: { 'Content-Type': 'application/json' }
      });
      
      setCloudStatus('online');
      return registry;
    } catch (e) {
      setCloudStatus('offline');
      return [];
    }
  };

  useEffect(() => {
    const startup = async () => {
      const storedUser = localStorage.getItem('hulu_current_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        setIsAuthView(false);
        const saved = JSON.parse(localStorage.getItem(`hulu_sessions_${user.id}`) || '[]');
        setSessions(saved);
        await syncUserToGlobalHub(user);
      }
    };
    startup();
  }, []);

  const handleSendMessage = async (text: string, file?: { data: string; mimeType: string }) => {
    if (isLoading) return;
    setRuntimeError(null);
    setIsLoading(true);

    const timestamp = Date.now();
    const userMsg: ChatMessageType = {
      id: timestamp.toString(),
      role: 'user',
      parts: file ? [{ text }, { inlineData: file }] : [{ text }],
      timestamp,
    };

    let targetSessionId = currentSessionId || timestamp.toString();
    
    // Get correct history snapshot for the API
    const sessionToUpdate = sessions.find(s => s.id === targetSessionId);
    const historyForApi = sessionToUpdate ? sessionToUpdate.messages : [];

    // 1. Update session state locally with User message
    setSessions(prev => {
      if (!currentSessionId) {
        setCurrentSessionId(targetSessionId);
        return [{
          id: targetSessionId,
          title: text.slice(0, 30) || 'New Project',
          messages: [userMsg],
          updatedAt: timestamp
        }, ...prev];
      }
      return prev.map(s => 
        s.id === targetSessionId 
          ? { ...s, messages: [...s.messages, userMsg], updatedAt: timestamp } 
          : s
      );
    });

    try {
      // 2. Execute Intelligence Request (Gemini 2.0 Flash)
      const res = await geminiService.chatWithHistory(historyForApi, text, file);
      const generatedText = res.text || "I was unable to synthesize a response at this moment.";
      
      const botMsg: ChatMessageType = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        parts: [{ text: generatedText }], 
        timestamp: Date.now(), 
        groundingSources: res.candidates?.[0]?.groundingMetadata?.groundingChunks 
      };
      
      // 3. Persist and display AI response
      setSessions(prev => {
        const finalSessions = prev.map(s => s.id === targetSessionId ? { ...s, messages: [...s.messages, botMsg], updatedAt: Date.now() } : s);
        if (currentUser) {
          localStorage.setItem(`hulu_sessions_${currentUser.id}`, JSON.stringify(finalSessions));
        }
        return finalSessions;
      });
    } catch (e: any) { 
      setRuntimeError(e.message || "Intelligence Uplink Offline.");
      console.error("API Failure:", e);
    } finally { 
      setIsLoading(false); 
    }
  };

  if (isAuthView) {
    return <AuthScreen onLogin={(u) => { setCurrentUser(u); setIsAuthView(false); }} onGlobalSync={syncUserToGlobalHub} />;
  }

  return (
    <div className="fixed inset-0 flex bg-white text-slate-900 overflow-hidden font-jakarta text-[10px]">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-xl" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-slate-950 text-white transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center shadow-xl shadow-green-500/10"><Waves size={20} className="text-slate-900" /></div>
            <h1 className="font-black text-sm uppercase tracking-tighter">Aravind Bot</h1>
          </div>
          <button onClick={() => { setCurrentSessionId(null); setIsSidebarOpen(false); }} className="w-full bg-white text-slate-900 py-3.5 rounded-2xl text-[10px] font-black uppercase mb-8 shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"><Plus size={16} /> New Project</button>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
            {sessions.map(s => (
              <button key={s.id} onClick={() => { setCurrentSessionId(s.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all ${currentSessionId === s.id ? 'bg-white/10 ring-1 ring-white/10 shadow-lg' : 'opacity-40 hover:opacity-100 hover:bg-white/5'}`}>
                <MessageSquare size={14} className="text-green-500 shrink-0" />
                <span className="text-[10px] font-bold truncate uppercase">{s.title || 'Uplink Ready'}</span>
              </button>
            ))}
          </div>
          <button onClick={() => { localStorage.removeItem('hulu_current_user'); setCurrentUser(null); setIsAuthView(true); }} className="mt-8 flex items-center justify-center gap-3 p-4 text-red-400 hover:text-red-300 transition-colors text-[10px] font-black uppercase tracking-widest bg-red-500/5 rounded-2xl"><LogOut size={16} /> Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-100 bg-white/95 backdrop-blur-2xl z-20 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2.5 bg-slate-50 rounded-2xl active:scale-90 transition-all"><Menu size={20} /></button>
          <div className="flex flex-col items-center">
            <h2 className="text-[10px] font-black uppercase text-slate-900 tracking-tighter leading-none">Intelligence Hub</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${cloudStatus === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{cloudStatus}</span>
            </div>
          </div>
          <button onClick={() => { setShowProfile(true); setTempProfileData({ username: currentUser?.username || '', chatbotName: currentUser?.chatbotName || '', bio: currentUser?.bio || '' }); }} className="w-10 h-10 rounded-2xl bg-slate-950 flex items-center justify-center text-white border-2 border-white shadow-xl active:scale-90 transition-all overflow-hidden">
             {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={22} />}
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar bg-[#fafafa]">
          <div className="max-w-xl mx-auto min-h-full">
            {currentSessionId ? sessions.find(s => s.id === currentSessionId)?.messages.map(m => (
               <ChatMessage key={m.id} message={m} />
            )) : (
              <div className="h-full flex flex-col items-center justify-center py-40 text-center opacity-30 select-none">
                <div className="w-24 h-24 bg-white border border-slate-100 rounded-[44px] flex items-center justify-center mb-8 shadow-sm"><Waves size={48} className="text-slate-100 animate-pulse" /></div>
                <h3 className="text-lg font-black uppercase tracking-[0.6em] text-slate-400 leading-tight">Gemini 2.0<br/>Flash Activated</h3>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-4">Awaiting Command Input</p>
              </div>
            )}
            
            {runtimeError && (
              <div className="p-4 mb-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <p className="text-[9px] font-black text-red-600 uppercase tracking-widest">{runtimeError}</p>
              </div>
            )}

            {isLoading && (
              <div className="p-10 flex flex-col items-center gap-4">
                 <Loader2 className="animate-spin text-green-500" size={28} />
                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">Synthesizing...</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-5 border-t border-slate-100 pb-safe">
          <ChatInput onSend={handleSendMessage} onStop={() => setIsLoading(false)} disabled={isLoading} />
        </div>
      </main>

      {showProfile && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-8" onClick={() => setShowProfile(false)}>
           <div className="w-full max-w-[360px] bg-white rounded-[56px] p-10 shadow-2xl animate-in zoom-in-95 duration-400" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Global Identity</h3>
                 <button onClick={() => setShowProfile(false)} className="p-2.5 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"><X size={18} /></button>
              </div>
              <div className="flex flex-col items-center gap-8">
                 <div className="relative cursor-pointer" onClick={() => profilePicInputRef.current?.click()}>
                   <div className="w-28 h-28 bg-slate-950 rounded-[40px] overflow-hidden border-[8px] border-slate-50 shadow-2xl flex items-center justify-center">
                      {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={56} className="text-white opacity-10" />}
                   </div>
                   <div className="absolute -bottom-1 -right-1 p-3.5 bg-green-500 text-white rounded-[22px] border-[4px] border-white shadow-2xl active:scale-90 transition-all"><Camera size={16} /></div>
                   <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if(f && currentUser) {
                        const r = new FileReader();
                        r.onloadend = async () => {
                          const up = { ...currentUser, profilePic: r.result as string };
                          setCurrentUser(up);
                          await syncUserToGlobalHub(up);
                        };
                        r.readAsDataURL(f);
                      }
                   }} />
                 </div>
                 <div className="w-full space-y-5">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-5">Identifier Name</label>
                       <input className="w-full bg-slate-50 border border-slate-100 rounded-[24px] py-4 px-7 text-[13px] font-bold outline-none focus:border-slate-950 transition-all shadow-inner" value={tempProfileData.username} onChange={e => setTempProfileData({...tempProfileData, username: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-5">AI Designation</label>
                       <input className="w-full bg-slate-50 border border-slate-100 rounded-[24px] py-4 px-7 text-[13px] font-bold outline-none focus:border-slate-950 transition-all shadow-inner" value={tempProfileData.chatbotName} onChange={e => setTempProfileData({...tempProfileData, chatbotName: e.target.value})} />
                    </div>
                    <button onClick={async () => {
                      if(currentUser) {
                        const up = { ...currentUser, ...tempProfileData };
                        setCurrentUser(up);
                        await syncUserToGlobalHub(up);
                        alert('Identity Synced Successfully.');
                      }
                    }} className="w-full bg-slate-950 text-white py-5 rounded-[28px] font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 mt-4"><Save size={18} /> Sync Globally</button>
                 </div>
              </div>
              <button onClick={() => { localStorage.removeItem('hulu_current_user'); setCurrentUser(null); setIsAuthView(true); setShowProfile(false); }} className="w-full mt-10 py-5 text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-red-50 rounded-[28px] transition-all"><LogOut size={18} /> Kill Session</button>
           </div>
        </div>
      )}
    </div>
  );
};

const AuthScreen: React.FC<{ 
  onLogin: (u: UserAccount) => void; 
  onGlobalSync: (u: UserAccount) => Promise<any>;
}> = ({ onLogin, onGlobalSync }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [formData, setFormData] = useState({ username: '', phoneNumber: '', password: '', confirmPassword: '', chatbotName: '' });
  const [otpValue, setOtpValue] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpSplash, setOtpSplash] = useState(false);
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) interval = setInterval(() => setResendTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const initiateOtp = () => {
    if (!formData.username || !formData.phoneNumber || !formData.password || !formData.confirmPassword || !formData.chatbotName) return setError('Incomplete details.');
    if (formData.phoneNumber.length !== 10) return setError('Invalid ID length.');
    if (formData.password !== formData.confirmPassword) return setError('Security keys mismatch.');
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setStep('otp');
    setOtpSplash(true);
    setResendTimer(15);
    setError('');
    
    setTimeout(() => setOtpSplash(false), 12000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsBusy(true);
    
    try {
      const res = await fetch(CLOUD_URL);
      const registry: UserAccount[] = res.ok ? await res.json() : [];
      
      if (mode === 'login') {
        const match = registry.find(a => a.phoneNumber === formData.phoneNumber && a.password === formData.password);
        if (match) {
          if (match.isBlocked) {
            setError('Account Isolated.');
          } else {
            const updatedUser = { ...match, lastLoginAt: Date.now() };
            await onGlobalSync(updatedUser);
            localStorage.setItem('hulu_current_user', JSON.stringify(updatedUser));
            onLogin(updatedUser);
          }
        } else setError('Invalid Node Details.');
      } else {
        if (otpValue === generatedOtp) {
          if (registry.some(a => a.phoneNumber === formData.phoneNumber)) {
            setError('ID already registered.');
          } else {
            const newUser: UserAccount = { id: Date.now().toString(), ...formData, createdAt: Date.now(), lastLoginAt: Date.now(), searchCount: 0, isBlocked: false, bio: '' };
            await onGlobalSync(newUser);
            localStorage.setItem('hulu_current_user', JSON.stringify(newUser));
            onLogin(newUser);
          }
        } else setError('Cipher Mismatch.');
      }
    } catch (e) {
      setError('Uplink failed.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-10 bg-slate-50 overflow-y-auto">
      {/* FLOATING TOP-LEVEL OTP */}
      {otpSplash && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[300] w-[220px] animate-in slide-in-from-top-12 duration-500">
           <div className="bg-slate-950 p-4 rounded-[24px] shadow-2xl border border-white/10 text-center relative overflow-hidden ring-1 ring-slate-900">
              <p className="text-[7px] font-black text-green-500 uppercase tracking-widest mb-2">Security Cipher</p>
              <h4 className="text-2xl font-black text-white font-mono tracking-widest">{generatedOtp}</h4>
              <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                 <div className="h-full bg-green-500 animate-[shrink_12s_linear_forwards]" style={{width: '100%'}}></div>
              </div>
           </div>
        </div>
      )}

      {/* ULTRA-COMPACT PREMIUM AUTH BOX */}
      <div className="w-full max-w-[260px] bg-white p-6 rounded-[44px] shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-500 my-auto mx-auto ring-1 ring-slate-200/40">
         <div className="text-center mb-6">
            <div className="w-10 h-10 bg-slate-950 rounded-[18px] mx-auto mb-4 flex items-center justify-center text-green-400 shadow-xl shadow-green-400/5">
               <Waves size={20} />
            </div>
            <h2 className="text-base font-black uppercase text-slate-950 tracking-tighter leading-none mb-1">Aravind Bot</h2>
            <p className="text-[6px] text-slate-400 font-black uppercase tracking-[0.3em] leading-none">
              {mode === 'login' ? 'Authorized Access' : 'Create Identity'}
            </p>
         </div>

         {step === 'otp' ? (
           <form onSubmit={handleAuth} className="space-y-4">
             <div className="space-y-2 text-center">
                <label className="text-[7px] font-black uppercase text-slate-400 tracking-widest block">Input Cipher</label>
                <input placeholder="000000" maxLength={6} className="w-full bg-slate-50 border border-slate-100 rounded-[16px] py-2.5 text-center text-xl font-black tracking-widest outline-none focus:bg-white focus:border-slate-950 font-mono shadow-inner transition-all" value={otpValue} onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))} />
             </div>
             {error && <p className="text-[7px] font-black text-red-500 uppercase text-center tracking-widest">{error}</p>}
             <button type="submit" disabled={isBusy || otpValue.length < 6} className="w-full bg-slate-950 text-white py-3.5 rounded-[20px] font-black uppercase text-[9px] tracking-[0.3em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                {isBusy ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Verify Node
             </button>
             <button type="button" disabled={resendTimer > 0} onClick={() => { 
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                setGeneratedOtp(code);
                setOtpSplash(true);
                setResendTimer(15);
                setTimeout(() => setOtpSplash(false), 12000);
             }} className="w-full text-[7px] font-black text-slate-400 uppercase tracking-widest text-center hover:text-slate-900 transition-colors">
               {resendTimer > 0 ? `Resend ${resendTimer}s` : 'Request Cipher'}
             </button>
           </form>
         ) : (
           <form onSubmit={mode === 'login' ? handleAuth : (e) => { e.preventDefault(); initiateOtp(); }} className="space-y-2.5">
              {mode === 'signup' && (
                 <>
                   <div className="space-y-1">
                      <label className="text-[6px] font-black uppercase text-slate-400 tracking-widest ml-3">Full Name</label>
                      <input placeholder="Identity" className="w-full bg-slate-50 border border-slate-100 rounded-[14px] py-2 px-3 text-[9px] font-bold outline-none focus:bg-white focus:border-slate-950 shadow-sm" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[6px] font-black uppercase text-slate-400 tracking-widest ml-3">Bot Persona</label>
                      <input placeholder="Designation" className="w-full bg-slate-50 border border-slate-100 rounded-[14px] py-2 px-3 text-[9px] font-bold outline-none focus:bg-white focus:border-slate-950 shadow-sm" value={formData.chatbotName} onChange={e => setFormData({...formData, chatbotName: e.target.value})} />
                   </div>
                 </>
              )}
              <div className="space-y-1">
                 <label className="text-[6px] font-black uppercase text-slate-400 tracking-widest ml-3">Mobile ID</label>
                 <div className="relative">
                    <Smartphone size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input placeholder="10 Digits" maxLength={10} className="w-full bg-slate-50 border border-slate-100 rounded-[14px] py-2 pl-8 pr-3 text-[9px] font-bold outline-none focus:bg-white focus:border-slate-950 shadow-sm" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value.replace(/\D/g, '')})} />
                 </div>
              </div>
              <div className="space-y-1">
                 <label className="text-[6px] font-black uppercase text-slate-400 tracking-widest ml-3">Passkey</label>
                 <div className="relative">
                    <Fingerprint size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type={showPass ? "text" : "password"} placeholder="••••" className="w-full bg-slate-50 border border-slate-100 rounded-[14px] py-2 pl-8 pr-8 text-[9px] font-bold outline-none focus:bg-white focus:border-slate-950 shadow-sm" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-950">{showPass ? <EyeOff size={10} /> : <Eye size={10} />}</button>
                 </div>
              </div>
              {mode === 'signup' && (
                <div className="space-y-1">
                   <label className="text-[6px] font-black uppercase text-slate-400 tracking-widest ml-3">Verify Key</label>
                   <input type="password" placeholder="••••" className="w-full bg-slate-50 border border-slate-100 rounded-[14px] py-2 px-3 text-[9px] font-bold outline-none focus:bg-white focus:border-slate-950 shadow-sm" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                </div>
              )}
              {error && <p className="text-[6px] font-black text-red-500 uppercase tracking-widest text-center mt-1">{error}</p>}
              <button type="submit" disabled={isBusy} className="w-full bg-slate-950 text-white py-3 rounded-[18px] font-black uppercase text-[8px] tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mt-3">
                 {isBusy ? <Loader2 size={12} className="animate-spin" /> : mode === 'login' ? <Zap size={12} /> : <Plus size={12} />} 
                 {mode === 'login' ? 'Login Node' : 'Register Identity'} 
              </button>
           </form>
         )}
         <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setStep('details'); setError(''); }} className="w-full mt-6 text-[7px] font-black uppercase text-slate-400 tracking-[0.4em] hover:text-slate-950 transition-all text-center">
           {mode === 'login' ? 'New node? Register' : 'Existing node? Login'}
         </button>
      </div>
      
      <style>{` @keyframes shrink { from { width: 100%; } to { width: 0%; } } `}</style>
    </div>
  );
};

export default App;
