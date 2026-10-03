
import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, LogType, Site } from './types';
import { loginUser, sendClockAction } from './services/sheetService';
import { getDailyInsight } from './services/greetingService';
import { initLiff, getLineProfile, LineProfile } from './services/lineService';
import { Button } from './components/Button';
import { AttendanceStats } from './components/AttendanceStats';

const GEO_OPTIONS: PositionOptions = { timeout: 20000, maximumAge: 0 };

const geoErrorMessage = (err: GeolocationPositionError) =>
  err.code === err.PERMISSION_DENIED
    ? "กรุณาเปิดการเข้าถึงพิกัด (Location Services)"
    : "หาตำแหน่งไม่สำเร็จ กรุณาลองใหม่ในที่โล่งหรือใกล้หน้าต่าง";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [lineProfile, setLineProfile] = useState<LineProfile | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  useEffect(() => {
    const startLiff = async () => {
      const ok = await initLiff();
      if (ok) {
        try {
          // @ts-ignore
          if (window.liff.isLoggedIn()) {
            const profile = await getLineProfile();
            if (profile) {
              setLineProfile(profile);
              setUsernameInput(profile.userId);
            }
          }
        } catch (e) {
          console.log("LIFF check failed", e);
        }
      }
    };
    startLiff();
  }, []);

  // ปิดกล่องแจ้งเตือนอัตโนมัติหลัง 4 วินาที
  useEffect(() => {
    if (!success && !error) return;
    const t = setTimeout(() => { setSuccess(null); setError(null); }, 4000);
    return () => clearTimeout(t);
  }, [success, error]);

  const clearMessages = () => { setSuccess(null); setError(null); };

  const handleLineConnect = async () => {
    setIsLoading(true);
    const profile = await getLineProfile();
    if (profile) {
      setLineProfile(profile);
      setUsernameInput(profile.userId);
      setSuccess("เชื่อมต่อ LINE สำเร็จ!");
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearMessages();
    try {
      const result = await loginUser(usernameInput, passwordInput);
      if (result.success && result.user) {
        setUser(result.user);
        setLogs(result.logs || []);
        setSites(result.sites || []);
        if (result.sites && result.sites.length > 0) {
          setSelectedSiteId(result.sites[0].id);
        }
      } else {
        setError(result.message || "การเข้าสู่ระบบล้มเหลว ตรวจสอบรหัสพนักงานของคุณ");
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!user) return;
    clearMessages();

    // ตรวจสอบการบันทึกซ้ำภายใน 6 ชั่วโมง (Client-side check) - ยกเว้น Supervisor
    if (user.role !== 'Supervisor') {
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
      const now = new Date();
      
      const lastLog = logs[logs.length - 1];
      if (lastLog && lastLog.dateIn && lastLog.timeIn) {
        const lastClockIn = new Date(`${lastLog.dateIn}T${lastLog.timeIn}+07:00`);
        if (!isNaN(lastClockIn.getTime())) {
          const diff = now.getTime() - lastClockIn.getTime();
          if (diff < SIX_HOURS_MS) {
            setError("คุณได้บันทึกเข้างานไปแล้วในช่วง 6 ชั่วโมงที่ผ่านมา");
            return;
          }
        }
      }
    }

    setIsLoading(true);
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const result = await sendClockAction(user.username, LogType.CLOCK_IN, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }, user.role === 'Supervisor' ? selectedSiteId : undefined);
        if (result.success) {
          if (result.logs) setLogs(result.logs);
          setSuccess(result.message || "บันทึกเข้างานสำเร็จ");
          setAiInsight(getDailyInsight(user.name, 'in'));
        } else {
          setError(result.message || "บันทึกเข้างานไม่สำเร็จ");
        }
        setIsLoading(false);
      }, (err) => {
        setError(geoErrorMessage(err));
        setIsLoading(false);
      }, GEO_OPTIONS);
    } catch (err) {
      setError("การดำเนินการล้มเหลว");
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user) return;
    clearMessages();
    setIsLoading(true);
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const result = await sendClockAction(user.username, LogType.CLOCK_OUT, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }, user.role === 'Supervisor' ? selectedSiteId : undefined);
        if (result.success) {
          if (result.logs) setLogs(result.logs);
          setSuccess(result.message || "บันทึกออกงานสำเร็จ");
          setAiInsight(getDailyInsight(user.name, 'out'));
        } else {
          setError(result.message || "บันทึกออกงานไม่สำเร็จ");
        }
        setIsLoading(false);
      }, (err) => {
        setError(geoErrorMessage(err));
        setIsLoading(false);
      }, GEO_OPTIONS);
    } catch (err) {
      setError("การดำเนินการล้มเหลว");
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6">
         <div className="w-full max-w-[340px] bg-white p-7 pt-12 rounded-[48px] shadow-2xl shadow-slate-200/50 relative border border-slate-100">
            
            {/* Profile Section */}
            <div className="flex flex-col items-center mb-6 relative">
              <div className="relative inline-block group cursor-pointer" onClick={handleLineConnect}>
                <div className="w-24 h-24 rounded-[32px] overflow-hidden border-4 border-white shadow-xl bg-slate-50 flex items-center justify-center">
                  {lineProfile?.pictureUrl ? (
                    <img src={lineProfile.pictureUrl} className="w-full h-full object-cover" alt="Profile" />
                  ) : (
                    <svg className="w-10 h-10 text-slate-200" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  )}
                </div>
                {/* Verified Icon */}
                <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-lg p-1 border-4 border-white shadow-lg">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.9L9.03 1.05a2 2 0 011.939 0L17.833 4.9a2 2 0 011.167 1.787V11a8.96 8.96 0 01-2.341 6.023 2 2 0 01-2.261.439l-4.031-2.02a2 2 0 00-1.794 0l-4.031 2.02a2 2 0 01-2.261-.439A8.96 8.96 0 011 11V6.687c0-.737.405-1.41 1.166-1.787zM13.707 8.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              
              <h1 className="text-2xl font-black text-slate-800 mt-5 mb-0.5 tracking-tight">Time Clock IN-OUT</h1>
              <p className="text-slate-400 text-xs font-medium italic">SMC Attendance System</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-5">
              {/* USE ID Field */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 ml-1">
                  <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">USER ID</label>
                </div>
                <div className="bg-[#f5f9ff] rounded-[20px] px-5 py-4 border border-blue-50">
                  <input 
                    type="text" 
                    value={usernameInput} 
                    onChange={(e) => setUsernameInput(e.target.value)} 
                    readOnly={!!lineProfile}
                    className="w-full bg-transparent outline-none text-slate-500 font-bold text-xs truncate" 
                    placeholder="กรุณาเชื่อมต่อ LINE" 
                  />
                </div>
              </div>

              {/* STAFF ID Field */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 ml-1">
                  <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">STAFF ID</label>
                </div>
                <div className="bg-white rounded-[20px] px-5 py-5 border-2 border-slate-50 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex items-center gap-2.5">
                  <span className="text-slate-300 text-xl font-light">#</span>
                  <input 
                    type="text" 
                    value={passwordInput} 
                    onChange={(e) => setPasswordInput(e.target.value)} 
                    className="w-full bg-transparent outline-none text-slate-800 font-black text-xl tracking-tight placeholder:text-slate-200" 
                    placeholder="รหัสพนักงาน" 
                  />
                </div>
              </div>

              {error && <div className="text-red-500 text-[10px] font-bold bg-red-50 p-2.5 rounded-xl border border-red-100">{error}</div>}

              {/* Login Button */}
              <Button 
                type="submit" 
                variant="primary" 
                fullWidth 
                className="py-[18px] rounded-[24px] text-base font-black shadow-xl shadow-blue-100 uppercase tracking-widest gap-2.5" 
                isLoading={isLoading} 
                disabled={!usernameInput}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                Login
              </Button>
            </form>
            
            <p className="mt-8 text-center text-[9px] text-slate-300 font-black uppercase tracking-[0.2em]">Management By SMC Property Soft</p>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white/80 backdrop-blur-md shadow-sm p-4 sticky top-0 z-10 flex justify-between items-center border-b border-slate-100">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 overflow-hidden">
               {lineProfile?.pictureUrl ? (
                 <img src={lineProfile.pictureUrl} className="w-full h-full object-cover" alt="LINE" />
               ) : (
                 <span className="text-white font-bold text-xl">{user.name.charAt(0)}</span>
               )}
             </div>
             <div>
               <h2 className="font-black text-slate-800 text-sm leading-tight">{user.name}</h2>
               <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black opacity-70">{user.position} • {user.siteId}</p>
             </div>
          </div>
          <button onClick={() => {setUser(null); setLineProfile(null);}} className="text-slate-300 hover:text-red-500 p-2.5 bg-slate-50 rounded-2xl transition-all hover:bg-red-50">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </button>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        {aiInsight && (
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-5 rounded-[32px] shadow-2xl shadow-blue-200 text-white animate-fade-in relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <svg className="w-4 h-4 text-blue-100" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"></path></svg>
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-100">Smart Insight</span>
            </div>
            <p className="text-lg font-bold leading-tight italic drop-shadow-md">" {aiInsight} "</p>
          </div>
        )}

        <section className="bg-white p-8 rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-50">
          {user.role === 'Supervisor' && sites.length > 0 && (
            <div className="mb-6 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeWidth="2.5"></path><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2.5"></path></svg>
                Select Site (Site_Config)
              </label>
              <select 
                value={selectedSiteId} 
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 appearance-none shadow-inner"
              >
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
              <Button onClick={handleClockIn} variant="primary" className="h-32 flex-col text-sm rounded-[32px]" isLoading={isLoading}>
                <div className="p-3 bg-white/20 rounded-2xl mb-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
                <span className="text-xl font-black">Clock In</span>
              </Button>
              <Button onClick={handleClockOut} variant="danger" className="h-32 flex-col text-sm rounded-[32px]" isLoading={isLoading}>
                <div className="p-3 bg-white/20 rounded-2xl mb-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
                <span className="text-xl font-black">Clock Out</span>
              </Button>
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5 ml-2">Monthly Stats</h3>
          <AttendanceStats logs={logs} />
        </section>
      </main>

      {/* Floating Notifications */}
      {(success || error) && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-8 py-5 rounded-[28px] shadow-2xl z-50 text-white font-black text-sm flex items-center gap-4 min-w-[320px] transition-all transform animate-bounce-short border-4 border-white/20 ${success ? 'bg-green-500' : 'bg-red-500'}`}>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            {success ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            )}
          </div>
          <span className="flex-1 uppercase tracking-tight">{success || error}</span>
          <button onClick={() => {setSuccess(null); setError(null)}} className="hover:scale-125 transition-transform p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </button>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bounce-short { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -15px); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
        .animate-bounce-short { animation: bounce-short 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;
