
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, UserAccount } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Menu, X, User, Loader2, Waves, Lock, Smartphone, UserCircle, LogOut, ShieldCheck, Zap, AlertCircle, RefreshCw, Camera, Trash2, Ban, CheckCircle, Fingerprint, Info, Key, FileText, Save, Edit3, ClipboardList, Copy, Database, Cloud, Wifi, WifiOff, Search, ArrowRight
} from 'lucide-react';

const SECRET_ADMIN_CODE = 'Aravind63091309709705371970';

/** 
 * GLOBAL NEURAL REGISTRY - CROSS-DEVICE SYNC
 * This endpoint allows users on different phones to share a single "Master Registry".
 */
const CLOUD_STORAGE_KEY = 'aravind_bot_v3_master_global_sync';
const CLOUD_ENDPOINT = `https://kvdb.io/MWpXp2A1oB6yq7X9Z4Y8R/${CLOUD_STORAGE_KEY}`;

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'online' | 'offline' | 'syncing'>('online');
  
  const [tempProfileData, setTempProfileData] = useState({ username: '', chatbotName: '', bio: '' });

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- CLOUD SYNC CORE ENGINE ---

  const broadcastToCloud = async (accounts: UserAccount[]) => {
    setCloudStatus('syncing');
    try {
      await fetch(CLOUD_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(accounts),
        headers: { 'Content-Type': 'application/json' }
      });
      setCloudStatus('online');
    } catch (e) {
      setCloudStatus('offline');
    }
  };

  const syncWithGlobalRegistry = async () => {
    setIsSyncing(true);
    setCloudStatus('syncing');
    try {
      const res = await fetch(CLOUD_ENDPOINT);
      if (res.ok) {
        const cloudData: UserAccount[] = await res.json();
        if (Array.isArray(cloudData)) {
          const local: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
          const mergedMap = new Map();
          // Local first, then Cloud (Cloud overwrites local to ensure latest from other devices)
          local.forEach(a => mergedMap.set(a.phoneNumber, a));
          cloudData.forEach(a => mergedMap.set(a.phoneNumber, a));
          
          const mergedArray = Array.from(mergedMap.values());
          localStorage.setItem('hulu_accounts', JSON.stringify(mergedArray));
          setAdminAccounts(mergedArray);
          setCloudStatus('online');
          return mergedArray;
        }
      }
    } catch (e) {
      setCloudStatus('offline');
    } finally {
      setIsSyncing(false);
    }
    return JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        const storedUser = localStorage.getItem('hulu_current_user');
        const localAccs = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
        setAdminAccounts(localAccs);

        if (storedUser) {
          const user = JSON.parse(storedUser);
          setCurrentUser(user);
          setIsAuthView(false);
          setSessions(JSON.parse(localStorage.getItem(`hulu_sessions_${user.id}`) || '[]'));
        }
        // Background fetch global data
        await syncWithGlobalRegistry();
      } catch (e) { console.error(e); }
    };
    initApp();
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`hulu_sessions_${currentUser.id}`, JSON.stringify(sessions));
      localStorage.setItem('hulu_current_user', JSON.stringify(currentUser));
      const allAccs: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
      const updatedAccs = allAccs.map(a => a.phoneNumber === currentUser.phoneNumber ? currentUser : a);
      localStorage.setItem('hulu_accounts', JSON.stringify(updatedAccs));
      // Optionally broadcast on every internal state change, but better to do it on explicit updates
    }
  }, [sessions, currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('hulu_current_user');
    setCurrentUser(null);
    setIsAuthView(true);
    setSessions([]);
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const updated = { ...currentUser, profilePic: reader.result as string };
        setCurrentUser(updated);
        const latestList = await syncWithGlobalRegistry() || [];
        const broadcastList = latestList.map(a => a.phoneNumber === updated.phoneNumber ? updated : a);
        await broadcastToCloud(broadcastList);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async () => {
    if (currentUser) {
      const updated = { ...currentUser, ...tempProfileData };
      setCurrentUser(updated);
      const latestList = await syncWithGlobalRegistry() || [];
      const broadcastList = latestList.map(a => a.phoneNumber === updated.phoneNumber ? updated : a);
      await broadcastToCloud(broadcastList);
      alert('IDENTITY BROADCASTED GLOBALLY.');
    }
  };

  const handleSendMessage = async (text: string, file?: { data: string; mimeType: string }) => {
    if (text.trim() === SECRET_ADMIN_CODE) { 
      setIsLoading(true);
      await syncWithGlobalRegistry(); // Block until we have everyone's latest data
      setIsLoading(false);
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
    const userMsg: ChatMessageType = { id: Date.now().toString(), role: 'user', parts: file ? [{ text }, { inlineData: file }] : [{ text }], timestamp: Date.now() };
    setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, userMsg], updatedAt: Date.now() } : s));
    setIsLoading(true);
    try {
      const history = sessions.find(s => s.id === activeId)?.messages || [];
      const res = await geminiService.chatWithHistory(history, text, file);
      const botMsg: ChatMessageType = { id: Date.now().toString(), role: 'model', parts: [{ text: res.text }], timestamp: Date.now(), groundingSources: res.candidates?.[0]?.groundingMetadata?.groundingChunks };
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, botMsg], updatedAt: Date.now() } : s));
    } catch (e: any) { setErrorMessage(e.message); } finally { setIsLoading(false); }
  };

  if (isAuthView) {
    return <AuthScreen onLogin={(u) => { setCurrentUser(u); setIsAuthView(false); }} onSync={syncWithGlobalRegistry} onPush={broadcastToCloud} />;
  }

  return (
    <div className="fixed inset-0 flex bg-white text-slate-900 overflow-hidden font-jakarta text-[10px]">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-52 bg-slate-950 text-white transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-3.5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center"><Waves size={14} className="text-slate-900" /></div>
            <h1 className="font-black text-xs uppercase tracking-tighter">Aravind's bot</h1>
          </div>
          <button onClick={() => { setCurrentSessionId(null); setIsSidebarOpen(false); }} className="w-full bg-white text-slate-900 py-2 rounded-lg text-[8px] font-black uppercase mb-3"><Plus size={12} className="inline mr-1" /> New Uplink</button>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5">
            {sessions.map(s => (
              <button key={s.id} onClick={() => { setCurrentSessionId(s.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-left ${currentSessionId === s.id ? 'bg-white/10' : 'opacity-60'}`}>
                <MessageSquare size={10} className="text-green-500 shrink-0" />
                <span className="text-[9px] font-bold truncate uppercase">{s.title}</span>
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="mt-2 flex items-center gap-2 p-2 text-red-400 text-[8px] font-black uppercase"><LogOut size={12} /> Terminate</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-white relative">
        <header className="h-10 flex items-center justify-between px-3 border-b border-slate-100 bg-white/80 backdrop-blur-md shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-1 bg-slate-50 rounded-md"><Menu size={14} /></button>
          <div className="flex flex-col items-center">
            <h2 className="text-[8px] font-black uppercase text-slate-900 tracking-tighter leading-none">Global Network</h2>
            <div className="flex items-center gap-1 mt-0.5"><div className={`w-1 h-1 rounded-full ${cloudStatus === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">{cloudStatus}</span></div>
          </div>
          <button onClick={() => setShowProfile(true)} className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center text-white overflow-hidden border border-white">
             {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={16} />}
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar bg-[#fafafa]">
          <div className="max-w-xl mx-auto">
            {currentSessionId ? sessions.find(s => s.id === currentSessionId)?.messages.map(m => (
               <ChatMessage key={m.id} message={m} />
            )) : (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-20">
                <Waves size={40} className="mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Neural link ready</p>
              </div>
            )}
            {isLoading && <div className="p-4 text-center"><Loader2 className="animate-spin inline mr-2" size={12} /><span className="text-[8px] font-black uppercase">Processing Global Node...</span></div>}
          </div>
        </div>

        <div className="bg-white p-2 border-t border-slate-100 pb-safe">
          <ChatInput onSend={handleSendMessage} onStop={() => setIsLoading(false)} disabled={isLoading} />
        </div>
      </main>

      {/* Global Admin Panel (The Harvest) */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-[200] bg-[#02040a] flex flex-col animate-in fade-in duration-500">
           <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-white/10">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-red-600 rounded-xl text-white"><ShieldCheck size={20} /></div>
                 <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-tighter">Master Neural Overseer</h2>
                    <p className="text-[6px] font-black text-red-500 uppercase tracking-[0.2em] animate-pulse">Live Cloud Sync Active • All Mobile Nodes Visible</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <button onClick={syncWithGlobalRegistry} className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20"><RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /></button>
                 <button onClick={() => setShowAdminPanel(false)} className="p-2 bg-slate-800 text-white rounded-lg"><X size={16} /></button>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {adminAccounts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-20">
                   <Cloud size={40} className="mb-2" />
                   <p className="text-[8px] font-black uppercase tracking-widest">No nodes found in cloud memory</p>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                  {adminAccounts.map((acc, idx) => (
                    <div key={idx} className={`p-4 rounded-3xl border transition-all ${acc.isBlocked ? 'bg-red-900/10 border-red-800/30' : 'bg-[#0b0e1a] border-white/5 shadow-xl'}`}>
                       <div className="flex items-start gap-4">
                          <div className="w-16 h-16 bg-slate-800 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl shrink-0">
                             {acc.profilePic ? <img src={acc.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={32} className="text-slate-600 m-auto mt-2" />}
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="font-black text-white uppercase text-sm truncate">{acc.username}</p>
                             <p className="text-[7px] font-black text-green-500 uppercase tracking-widest mt-0.5">@{acc.chatbotName}</p>
                             <div className="mt-3 space-y-1">
                                <p className="text-[8px] font-bold text-slate-400 flex items-center gap-1.5"><Smartphone size={8} /> {acc.phoneNumber}</p>
                                <p className="text-[8px] font-bold text-green-400 flex items-center gap-1.5"><Key size={8} /> {acc.password}</p>
                             </div>
                          </div>
                          <div className="flex flex-col gap-2">
                             <button onClick={() => {
                                const up = adminAccounts.map(a => a.phoneNumber === acc.phoneNumber ? { ...a, isBlocked: !a.isBlocked } : a);
                                setAdminAccounts(up);
                                broadcastToCloud(up);
                             }} className={`p-2 rounded-xl ${acc.isBlocked ? 'bg-green-500 text-black' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                               {acc.isBlocked ? <CheckCircle size={14} /> : <Ban size={14} />}
                             </button>
                             <button onClick={() => {
                                if(confirm('Delete user globally?')) {
                                   const up = adminAccounts.filter(a => a.phoneNumber !== acc.phoneNumber);
                                   setAdminAccounts(up);
                                   broadcastToCloud(up);
                                }
                             }} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-red-600 transition-colors"><Trash2 size={14} /></button>
                          </div>
                       </div>
                       {acc.bio && <p className="mt-3 p-2 bg-black/40 rounded-xl text-[7px] text-slate-400 italic">"{acc.bio}"</p>}
                       <div className="mt-2 text-[6px] font-black text-slate-700 text-right uppercase tracking-widest">Registered: {new Date(acc.createdAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
           </div>
           <div className="p-2 bg-slate-950 border-t border-white/5 text-center"><p className="text-[6px] font-black text-slate-600 uppercase tracking-[0.4em]">Aravind Cloud Oversight v3.0</p></div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="w-full max-w-[280px] bg-white rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Your Identity</h3>
                 <button onClick={() => setShowProfile(false)} className="p-1.5 bg-slate-100 rounded-xl"><X size={14} /></button>
              </div>
              <div className="flex flex-col items-center mb-6">
                 <div className="relative mb-4">
                   <div className="w-20 h-20 bg-slate-950 rounded-3xl overflow-hidden border-4 border-white shadow-xl flex items-center justify-center">
                      {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={32} className="text-white" />}
                   </div>
                   <button onClick={() => profilePicInputRef.current?.click()} className="absolute -bottom-1 -right-1 p-2 bg-green-500 text-white rounded-xl border-2 border-white shadow-lg"><Camera size={12} /></button>
                   <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                 </div>
                 <div className="w-full space-y-3">
                    <input placeholder="Full Name" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-[9px] font-bold" value={tempProfileData.username} onChange={e => setTempProfileData({...tempProfileData, username: e.target.value})} />
                    <input placeholder="Bot Name" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-[9px] font-bold" value={tempProfileData.chatbotName} onChange={e => setTempProfileData({...tempProfileData, chatbotName: e.target.value})} />
                    <textarea placeholder="Bio" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-[9px] font-medium h-16 resize-none" value={tempProfileData.bio} onChange={e => setTempProfileData({...tempProfileData, bio: e.target.value})} />
                    <button onClick={handleUpdateProfile} className="w-full bg-slate-950 text-white py-2.5 rounded-xl font-black uppercase text-[8px] tracking-widest shadow-lg"><Save size={10} className="inline mr-1" /> Save Globally</button>
                 </div>
              </div>
              <button onClick={handleLogout} className="w-full py-3 border border-red-100 text-red-500 rounded-2xl font-black uppercase text-[8px] tracking-widest">Logout</button>
           </div>
        </div>
      )}
    </div>
  );
};

const AuthScreen: React.FC<{ onLogin: (u: UserAccount) => void; onSync: () => Promise<UserAccount[] | null>; onPush: (a: UserAccount[]) => Promise<void>; }> = ({ onLogin, onSync, onPush }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({ username: '', phoneNumber: '', password: '', chatbotName: '' });
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsBusy(true);
    
    // Always sync with the world before doing any auth
    const globalAccs = await onSync() || [];
    
    if (mode === 'login') {
      const u = globalAccs.find(a => a.phoneNumber === formData.phoneNumber && a.password === formData.password);
      if (u) {
        if (u.isBlocked) setError('IDENTITY BLOCKED BY MASTER.');
        else {
          localStorage.setItem('hulu_current_user', JSON.stringify(u));
          onLogin(u);
        }
      } else setError('INVALID CREDENTIALS.');
    } else {
      if (!formData.username || !formData.phoneNumber || !formData.password) {
        setError('FILL ALL FIELDS.');
        setIsBusy(false);
        return;
      }
      if (globalAccs.some(a => a.phoneNumber === formData.phoneNumber)) {
        setError('MOBILE ID ALREADY REGISTERED.');
        setIsBusy(false);
        return;
      }
      const newUser: UserAccount = { id: Date.now().toString(), ...formData, createdAt: Date.now(), isBlocked: false, bio: '' };
      const updatedList = [...globalAccs, newUser];
      localStorage.setItem('hulu_accounts', JSON.stringify(updatedList));
      localStorage.setItem('hulu_current_user', JSON.stringify(newUser));
      await onPush(updatedList);
      onLogin(newUser);
    }
    setIsBusy(false);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-[260px] bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 animate-in zoom-in-95">
         <div className="text-center mb-8">
            <div className="w-12 h-12 bg-slate-950 rounded-2xl mx-auto mb-4 flex items-center justify-center text-green-400 shadow-xl"><Waves size={24} /></div>
            <h2 className="text-xl font-black uppercase text-slate-950 tracking-tighter">Aravind's bot</h2>
            <p className="text-[7px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1.5">{mode === 'login' ? 'Authentication' : 'Neural Enrollment'}</p>
         </div>
         <form onSubmit={handleAuth} className="space-y-2.5">
            {mode === 'signup' && (
               <>
                 <input placeholder="FULL NAME" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-[9px] font-bold" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                 <input placeholder="BOT NAME" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-[9px] font-bold" value={formData.chatbotName} onChange={e => setFormData({...formData, chatbotName: e.target.value})} />
               </>
            )}
            <input placeholder="MOBILE ID" maxLength={10} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-[9px] font-bold" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value.replace(/\D/g, '')})} />
            <input type="password" placeholder="PASSKEY" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-[9px] font-bold" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            {error && <p className="text-[7px] font-black text-red-500 text-center uppercase tracking-widest">{error}</p>}
            <button type="submit" disabled={isBusy} className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black uppercase text-[8px] tracking-widest shadow-xl flex items-center justify-center gap-2">
               {isBusy && <Loader2 size={10} className="animate-spin" />} {mode === 'login' ? 'ESTABLISH LINK' : 'INITIATE REGISTRY'}
            </button>
         </form>
         <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="w-full mt-6 text-[7px] font-black uppercase text-slate-400 tracking-widest">{mode === 'login' ? 'New identity? enroll' : 'Registered? login'}</button>
      </div>
    </div>
  );
};

export default App;
