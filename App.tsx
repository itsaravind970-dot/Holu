
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ChatSessionHistory, UserAccount } from './types';
import { geminiService, decodeAudioData } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { 
  MessageSquare, Plus, Menu, X, User, Loader2, Waves, Lock, Smartphone, UserCircle, LogOut, ShieldCheck, Zap, AlertCircle, RefreshCw, Camera, Trash2, Ban, CheckCircle, Fingerprint, Info, Key, FileText, Save, Edit3, ClipboardList, Copy, Download, Share2, Database
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
  
  // Profile editing state
  const [tempProfileData, setTempProfileData] = useState({ username: '', chatbotName: '', bio: '' });
  // Admin Sync state
  const [syncInput, setSyncInput] = useState('');
  const [showSyncPanel, setShowSyncPanel] = useState(false);

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

  // Sync temp profile data when drawer opens
  useEffect(() => {
    if (showProfile && currentUser) {
      setTempProfileData({
        username: currentUser.username,
        chatbotName: currentUser.chatbotName,
        bio: currentUser.bio || ''
      });
    }
  }, [showProfile, currentUser]);

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

  const handleUpdateProfile = () => {
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        username: tempProfileData.username,
        chatbotName: tempProfileData.chatbotName,
        bio: tempProfileData.bio
      });
    }
  };

  const handleSendMessage = async (text: string, file?: { data: string; mimeType: string }) => {
    if (text.trim() === SECRET_ADMIN_CODE) { 
      const accounts: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
      setAdminAccounts(accounts);
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

  const handleExportData = () => {
    const data = JSON.stringify(adminAccounts, null, 2);
    navigator.clipboard.writeText(data);
    alert('Registry copied to clipboard. You can now paste this on another device to sync users.');
  };

  const handleImportData = () => {
    try {
      const parsed: UserAccount[] = JSON.parse(syncInput);
      if (Array.isArray(parsed)) {
        const existing: UserAccount[] = JSON.parse(localStorage.getItem('hulu_accounts') || '[]');
        // Merge without duplicates (using phoneNumber as unique ID)
        const mergedMap = new Map();
        existing.forEach(a => mergedMap.set(a.phoneNumber, a));
        parsed.forEach(a => mergedMap.set(a.phoneNumber, a));
        const mergedArray = Array.from(mergedMap.values());
        
        localStorage.setItem('hulu_accounts', JSON.stringify(mergedArray));
        setAdminAccounts(mergedArray);
        setSyncInput('');
        setShowSyncPanel(false);
        alert('Global Registry Updated Successfully.');
      }
    } catch (e) {
      alert('INVALID REGISTRY FORMAT.');
    }
  };

  if (isAuthView) {
    return <AuthScreen onLogin={(user) => { setCurrentUser(user); setIsAuthView(false); }} />;
  }

  return (
    <div className="fixed inset-0 flex bg-white text-slate-900 overflow-hidden font-jakarta text-[10px]">
      {/* Overlay for drawers */}
      {(isSidebarOpen || showProfile) && <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]" onClick={() => { setIsSidebarOpen(false); setShowProfile(false); }} />}
      
      {/* Sidebar Menu */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-52 bg-slate-950 text-white transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-3.5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center"><Waves size={14} className="text-slate-900" /></div>
            <h1 className="font-black text-xs uppercase tracking-tighter text-nowrap">Aravind's bot</h1>
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
          <button onClick={() => { setShowProfile(true); setIsSidebarOpen(false); }} className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center text-white border border-white shadow shadow-slate-200 overflow-hidden active:scale-90 transition-all">
             {currentUser?.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={16} />}
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar bg-[#fafafa]">
          <div className="max-w-xl mx-auto w-full min-h-full flex flex-col">
            {currentSessionMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center mb-3 shadow-sm"><Waves size={24} className="text-slate-100 animate-pulse" /></div>
                <h3 className="text-base font-black uppercase tracking-tighter text-slate-950 mb-1">Initialize Node</h3>
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
      <aside className={`fixed inset-y-0 right-0 z-50 w-64 bg-white text-slate-950 transition-transform duration-300 shadow-2xl border-l border-slate-100 ${showProfile ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
          <div className="p-3.5 bg-slate-50 flex items-center justify-between border-b border-slate-100 shrink-0">
            <h3 className="font-black text-[9px] uppercase tracking-widest text-slate-400">Identity Registry</h3>
            <button onClick={() => setShowProfile(false)} className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100 active:scale-90"><X size={14} /></button>
          </div>
          
          {currentUser && (
            <div className="flex-1 pb-6">
              <div className="p-5 flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center text-white overflow-hidden border-4 border-white shadow-md">
                    {currentUser.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" /> : <UserCircle size={24} />}
                  </div>
                  <button onClick={() => profilePicInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-green-500 text-slate-950 p-1 rounded-lg border-2 border-white shadow active:scale-90"><Camera size={12} /></button>
                  <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                </div>
                
                <div className="w-full space-y-3 px-1 text-left">
                  <div>
                    <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 block px-1">Legal Name</label>
                    <div className="relative group">
                      <input 
                        className="w-full bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 text-[9px] font-bold outline-none focus:border-slate-300 focus:bg-white transition-all"
                        value={tempProfileData.username}
                        onChange={e => setTempProfileData({...tempProfileData, username: e.target.value})}
                      />
                      <Edit3 size={8} className="absolute right-2.5 top-2.5 text-slate-300 group-hover:text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 block px-1">Bot Designation</label>
                    <div className="relative group">
                      <input 
                        className="w-full bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 text-[9px] font-bold outline-none focus:border-slate-300 focus:bg-white transition-all"
                        value={tempProfileData.chatbotName}
                        onChange={e => setTempProfileData({...tempProfileData, chatbotName: e.target.value})}
                      />
                      <Edit3 size={8} className="absolute right-2.5 top-2.5 text-slate-300 group-hover:text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 block px-1">Identity Bio</label>
                    <textarea 
                      placeholder="Add a bio describing your node..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2 px-2.5 text-[9px] font-medium outline-none focus:border-slate-300 focus:bg-white transition-all resize-none h-16 leading-relaxed"
                      value={tempProfileData.bio}
                      onChange={e => setTempProfileData({...tempProfileData, bio: e.target.value})}
                    />
                  </div>
                  
                  <button 
                    onClick={handleUpdateProfile} 
                    className="w-full py-2 bg-slate-950 text-white rounded-lg font-black uppercase tracking-widest text-[8px] flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md mt-1"
                  >
                    <Save size={10} /> Update Identity
                  </button>
                </div>
              </div>
              
              <div className="px-5 space-y-2.5 border-t border-slate-100 pt-5">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between opacity-80">
                  <div>
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Immutable Mobile</p>
                    <p className="font-bold text-slate-500 text-[9px]">{currentUser.phoneNumber}</p>
                  </div>
                  <Smartphone className="text-slate-300" size={12} />
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between opacity-80">
                  <div>
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Registry Date</p>
                    <p className="font-bold text-slate-500 text-[9px]">{new Date(currentUser.createdAt).toLocaleDateString()}</p>
                  </div>
                  <FileText className="text-slate-300" size={12} />
                </div>
                
                <button onClick={handleLogout} className="w-full py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-[0.2em] text-[8px] shadow-lg active:scale-95 flex items-center justify-center gap-2 mt-4"><LogOut size={12} /> TERMINATE ACCESS</button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Master Secret Admin Panel */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-[200] bg-[#02040a] flex flex-col animate-in fade-in duration-500 overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-white/10 shrink-0">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-red-600 rounded-xl text-white shadow-lg shadow-red-900/20"><ShieldCheck size={20} /></div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Master Control Center</h2>
                  <p className="text-[6px] font-black text-red-500 uppercase tracking-[0.3em] mt-1 animate-pulse">Global Identity Node Surveillance • {adminAccounts.length} Connected</p>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <button onClick={() => setShowSyncPanel(!showSyncPanel)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border ${showSyncPanel ? 'bg-green-500 text-slate-950 border-green-500' : 'bg-white/10 text-white border-white/5 hover:bg-white/20'}`}><Database size={12} /> Sync Registry</button>
                <button onClick={() => { setShowAdminPanel(false); setShowSyncPanel(false); }} className="p-2 bg-slate-800 text-white rounded-lg active:scale-90 transition-all hover:bg-slate-700"><X size={16} /></button>
             </div>
          </div>

          {showSyncPanel && (
            <div className="p-4 bg-slate-900 border-b border-white/10 animate-in slide-in-from-top duration-300">
               <div className="max-w-xl mx-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cross-Device Synchronization Hub</h4>
                    <span className="text-[6px] text-slate-500 italic">Paste JSON from another device to merge registries</span>
                  </div>
                  <textarea 
                    placeholder="Paste master registry JSON here..."
                    className="w-full bg-black/50 border border-white/5 rounded-xl p-3 text-[10px] text-green-400 font-mono h-24 outline-none focus:border-green-500/30 transition-all resize-none"
                    value={syncInput}
                    onChange={e => setSyncInput(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleImportData} className="flex-1 bg-green-500 text-slate-950 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5"><RefreshCw size={12} /> Execute Merge</button>
                    <button onClick={handleExportData} className="flex-1 bg-white/10 text-white py-2 rounded-lg text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-white/5"><Share2 size={12} /> Copy Local Registry</button>
                  </div>
               </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
             {adminAccounts.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
                  <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center mb-4"><ClipboardList size={32} className="text-slate-700" /></div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Identity Memory Empty</p>
                  <p className="text-[7px] text-slate-600 mt-2">NO NODES DETECTED IN LOCAL REGISTRY</p>
               </div>
             ) : (
               <div className="max-w-2xl mx-auto space-y-4">
                 {adminAccounts.map((acc, idx) => (
                   <div key={idx} className={`group p-4 rounded-3xl border transition-all duration-300 relative overflow-hidden ${acc.isBlocked ? 'bg-red-900/5 border-red-800/30' : 'bg-[#0b0e1a] border-white/5 hover:border-white/10 shadow-2xl shadow-black/50'}`}>
                     <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-5">
                           <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-white overflow-hidden border-2 border-slate-700 shadow-2xl shadow-black ring-4 ring-black/50 group-hover:ring-green-500/20 transition-all duration-500 shrink-0">
                              {acc.profilePic ? (
                                <img src={acc.profilePic} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" alt={acc.username} />
                              ) : (
                                <UserCircle size={40} className="text-slate-600" />
                              )}
                           </div>
                           <div className="space-y-1.5">
                              <div>
                                <p className="font-black text-white uppercase tracking-tighter text-base leading-tight group-hover:text-green-400 transition-colors">{acc.username}</p>
                                <p className="text-[8px] font-black text-green-500 tracking-[0.3em] uppercase flex items-center gap-1.5 mt-0.5">
                                  <Waves size={10} className="animate-pulse" /> {acc.chatbotName}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
                                <div className="flex items-center gap-2 text-slate-400">
                                  <Smartphone size={10} className="text-slate-600" />
                                  <span className="text-[8px] font-bold tracking-widest">{acc.phoneNumber}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400">
                                  <FileText size={10} className="text-slate-600" />
                                  <span className="text-[8px] font-bold tracking-widest">{new Date(acc.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                              {acc.bio && (
                                <div className="mt-3 bg-black/60 p-2.5 rounded-xl border border-white/5 max-w-[280px]">
                                   <p className="text-[8px] text-slate-400 font-medium italic leading-relaxed">"{acc.bio}"</p>
                                </div>
                              )}
                           </div>
                        </div>
                        <div className="flex flex-col gap-2">
                           <button onClick={() => {
                             const updated = adminAccounts.map(a => a.id === acc.id ? { ...a, isBlocked: !a.isBlocked } : a);
                             localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                             setAdminAccounts(updated);
                           }} className={`p-3 rounded-2xl transition-all shadow-lg ${acc.isBlocked ? 'bg-green-500 text-slate-950 scale-110' : 'bg-red-600/10 text-red-500 border border-red-600/20 hover:bg-red-600 hover:text-white'}`}>
                             {acc.isBlocked ? <CheckCircle size={18} /> : <Ban size={18} />}
                           </button>
                           <button onClick={() => {
                             if(confirm('TERMINATE IDENTITY PERMANENTLY?')) {
                               const updated = adminAccounts.filter(a => a.id !== acc.id);
                               localStorage.setItem('hulu_accounts', JSON.stringify(updated));
                               setAdminAccounts(updated);
                             }
                           }} className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-90 hover:bg-red-600 transition-all border border-white/5"><Trash2 size={18} /></button>
                        </div>
                     </div>

                     <div className="mt-5 bg-black/80 p-4 rounded-2xl flex justify-between items-center border border-white/5 relative group/pass overflow-hidden shadow-inner">
                        <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover/pass:opacity-100 transition-opacity"></div>
                        <div className="relative z-10">
                          <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-1 leading-none">IDENTITY PASSKEY</span>
                          <span className="font-mono text-green-400 font-black text-lg tracking-[0.35em] leading-none">{acc.password}</span>
                        </div>
                        <div className="flex items-center gap-2 relative z-10">
                           <button onClick={() => { 
                             navigator.clipboard.writeText(acc.password || '');
                             const btn = document.activeElement;
                             if(btn) btn.innerHTML = '<span class="text-[8px]">COPIED</span>';
                             setTimeout(() => { if(btn) btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'; }, 2000);
                           }} className="p-2 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all active:scale-90 border border-white/5"><Copy size={12} /></button>
                           <Key className="text-slate-700 group-hover/pass:text-green-500 transition-colors" size={24} />
                        </div>
                     </div>
                     
                     <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                   </div>
                 ))}
               </div>
             )}
          </div>
          
          <div className="p-4 bg-slate-950 border-t border-white/10 shrink-0 text-center">
             <p className="text-[7px] font-black text-slate-600 uppercase tracking-[0.4em]">ARAVIND MASTER PRIVILEGE • ENCRYPTED OVERSIGHT</p>
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
      return setError('DATA INCOMPLETE.');
    }
    if (formData.phoneNumber.length !== 10) {
      return setError('INVALID MOBILE ID (10 DIGITS).');
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
        const u = { id: Date.now().toString(), ...formData, createdAt: Date.now(), isBlocked: false, bio: '' };
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
               <Waves size={20} className="relative" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tighter text-slate-950 leading-none">Aravind's bot</h2>
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
              <input 
                placeholder="MOBILE ID" 
                maxLength={10}
                className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2.5 px-3.5 text-[9px] font-bold outline-none focus:border-slate-950 transition-all" 
                value={formData.phoneNumber} 
                onChange={e => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') })} 
              />
              <input type="password" placeholder="PASSKEY" className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2.5 px-3.5 text-[9px] font-bold outline-none focus:border-slate-950 transition-all" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              {mode === 'signup' && (
                <input type="password" placeholder="CONFIRM" className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2.5 px-3.5 text-[9px] font-bold outline-none focus:border-slate-950 transition-all" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} />
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
