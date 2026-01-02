
import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, LogType, GeoLocationData, OTRequest, OTStatus } from './types';
import { loginUser, sendClockAction, requestOT, updateOTStatus } from './services/sheetService';
import { getDailyInsight } from './services/geminiService';
import { initLiff, getLineProfile, LineProfile } from './services/lineService';
import { Button } from './components/Button';
import { AttendanceStats } from './components/AttendanceStats';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [lineProfile, setLineProfile] = useState<LineProfile | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [otRequests, setOtRequests] = useState<OTRequest[]>([]);
  
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  
  const [isOTModalOpen, setIsOTModalOpen] = useState(false);
  
  const defaultStart = new Date();
  defaultStart.setHours(18, 0, 0, 0);
  const defaultEnd = new Date();
  defaultEnd.setHours(20, 0, 0, 0);

  const [otStartTime, setOtStartTime] = useState(defaultStart.toISOString().slice(0, 16));
  const [otEndTime, setOtEndTime] = useState(defaultEnd.toISOString().slice(0, 16));
  const [otReason, setOtReason] = useState("");

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
    setError(null);
    try {
      const result = await loginUser(usernameInput, passwordInput);
      if (result.success && result.user) {
        setUser(result.user);
        setLogs(result.logs || []);
        setOtRequests(result.otRequests || []);
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
    setIsLoading(true);
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const result = await sendClockAction(user.username, LogType.CLOCK_IN, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        if (result.success) {
          setLogs(result.logs || []);
          setOtRequests(result.otRequests || []);
          setSuccess(result.message || "บันทึกเข้างานสำเร็จ");
          const insight = await getDailyInsight(user.name, 'in', new Date().toLocaleTimeString());
          setAiInsight(insight);
        } else {
          setError(result.message || "บันทึกเข้างานไม่สำเร็จ");
        }
        setIsLoading(false);
      }, (err) => {
        setError("กรุณาเปิดการเข้าถึงพิกัด (Location Services)");
        setIsLoading(false);
      });
    } catch (err) {
      setError("การดำเนินการล้มเหลว");
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const result = await sendClockAction(user.username, LogType.CLOCK_OUT, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        if (result.success) {
          setLogs(result.logs || []);
          setOtRequests(result.otRequests || []);
          setSuccess(result.message || "บันทึกออกงานสำเร็จ");
          const insight = await getDailyInsight(user.name, 'out', new Date().toLocaleTimeString());
          setAiInsight(insight);
        } else {
          setError(result.message || "บันทึกออกงานไม่สำเร็จ");
        }
        setIsLoading(false);
      }, (err) => {
        setError("กรุณาเปิดการเข้าถึงพิกัด (Location Services)");
        setIsLoading(false);
      });
    } catch (err) {
      setError("การดำเนินการล้มเหลว");
      setIsLoading(false);
    }
  };

  const handleOTRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    try {
      const result = await requestOT({
        staffId: user.password!,
        name: user.name,
        siteId: user.siteId,
        startTime: otStartTime.replace('T', ' '),
        endTime: otEndTime.replace('T', ' '),
        reason: otReason,
        role: user.role
      });
      if (result.success) {
        setOtRequests(result.otRequests || []);
        setIsOTModalOpen(false);
        setSuccess(result.message || "ส่งคำขอ OT เรียบร้อยแล้ว");
        setOtReason("");
      } else {
        setError(result.message || "ส่งคำขอ OT ล้มเหลว");
      }
    } catch (err) {
      setError("Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveReject = async (requestId: string, status: OTStatus) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const result = await updateOTStatus({
        requestId,
        status,
        approverName: user.name,
        staffId: user.password!,
        role: user.role,
        siteId: user.siteId
      });
      if (result.success) {
        setOtRequests(result.otRequests || []);
        setSuccess(`ดำเนินการ ${status === OTStatus.APPROVED ? 'อนุมัติ' : 'ปฏิเสธ'} เรียบร้อยแล้ว`);
      } else {
        setError(result.message || "การอัปเดตล้มเหลว");
      }
    } catch (err) {
      setError("Network error.");
    } finally {
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
              
              <h1 className="text-2xl font-black text-slate-800 mt-5 mb-0.5 tracking-tight">GeoClock</h1>
              <p className="text-slate-400 text-xs font-medium italic">SMC Attendance System</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-5">
              {/* USE ID Field */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 ml-1">
                  <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">USE ID</label>
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
                    placeholder="2624" 
                  />
                </div>
              </div>

              {error && <div className="text-red-500 text-[10px] font-bold bg-red-50 p-2.5 rounded-xl border border-red-100">{error}</div>}

              {/* Login Button */}
              <Button 
                type="submit" 
                variant="primary" 
                fullWidth 
                className="py-4.5 rounded-[24px] text-base font-black shadow-xl shadow-blue-100 uppercase tracking-widest gap-2.5" 
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

        <section className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Active Requests</h3>
            <button 
              onClick={() => setIsOTModalOpen(true)} 
              className="text-[11px] font-black text-blue-600 bg-blue-50 px-5 py-2.5 rounded-full hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              REQUEST OT
            </button>
          </div>
          
          <div className="space-y-4">
            {otRequests.length === 0 ? (
              <div className="bg-white p-12 rounded-[40px] text-center text-slate-400 text-sm border-2 border-dashed border-slate-100">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
                <p className="font-bold tracking-tight">ไม่พบคำขอที่อยู่ระหว่างดำเนินการ</p>
              </div>
            ) : (
              otRequests.map(req => (
                <div key={req.id} className="bg-white p-5 rounded-[32px] shadow-lg shadow-slate-100/50 border border-slate-50 flex justify-between items-start transition-all hover:translate-y-[-2px]">
                  <div className="space-y-1">
                    <div className="flex flex-col mb-1">
                       <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-0.5">Time Range</span>
                       <span className="text-xs font-black text-slate-800">{req.startTime} น.</span>
                       <span className="text-xs font-black text-slate-400 flex items-center gap-1">
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                         {req.endTime} น.
                       </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[210px] mt-2">{req.reason}</p>
                    {user.role === 'Supervisor' && (
                       <div className="flex items-center gap-2 mt-3 p-1.5 bg-slate-50 rounded-2xl w-fit">
                         <div className="w-6 h-6 rounded-xl bg-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm">{req.name.charAt(0)}</div>
                         <span className="text-[10px] text-slate-600 font-black tracking-tight">{req.name}</span>
                       </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-4">
                    <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm border-2 ${
                      req.status === 'Approved' ? 'bg-green-50 text-green-600 border-green-100' :
                      req.status === 'Rejected' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100 animate-pulse'
                    }`}>
                      {req.status === 'Approved' ? 'อนุมัติแล้ว' : req.status === 'Rejected' ? 'ปฏิเสธ' : 'รออนุมัติ'}
                    </span>
                    {user.role === 'Supervisor' && req.status === 'Pending' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleApproveReject(req.id, OTStatus.APPROVED)} 
                          className="p-3 bg-green-500 text-white hover:bg-green-600 rounded-2xl transition-all shadow-lg shadow-green-100 active:scale-90"
                          title="Approve"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        </button>
                        <button 
                          onClick={() => handleApproveReject(req.id, OTStatus.REJECTED)} 
                          className="p-3 bg-red-500 text-white hover:bg-red-600 rounded-2xl transition-all shadow-lg shadow-red-100 active:scale-90"
                          title="Reject"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5 ml-2">Monthly Stats</h3>
          <AttendanceStats logs={logs} />
        </section>
      </main>

      {/* OT Request Modal */}
      {isOTModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-sm p-10 space-y-8 animate-scale-in relative border border-slate-100">
            <button onClick={() => setIsOTModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 transition-colors p-2 bg-slate-50 rounded-2xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            </button>
            
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-slate-800">New Request</h3>
              <p className="text-slate-400 font-medium text-sm">ระบุช่วงเวลาที่คุณจะทำ OT</p>
            </div>

            <form onSubmit={handleOTRequestSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">เวลาเริ่มต้น</label>
                <input 
                  type="datetime-local" 
                  value={otStartTime} 
                  onChange={(e) => setOtStartTime(e.target.value)} 
                  className="w-full px-6 py-4 rounded-[24px] bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-50 transition-all font-bold text-sm" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">เวลาสิ้นสุด</label>
                <input 
                  type="datetime-local" 
                  value={otEndTime} 
                  onChange={(e) => setOtEndTime(e.target.value)} 
                  className="w-full px-6 py-4 rounded-[24px] bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-50 transition-all font-bold text-sm" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">รายละเอียด / เหตุผล</label>
                <textarea 
                  value={otReason} 
                  onChange={(e) => setOtReason(e.target.value)} 
                  className="w-full px-6 py-5 rounded-[24px] bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-50 transition-all font-bold h-28 resize-none text-sm" 
                  placeholder="คุณกำลังจะทำงานอะไร?" 
                  required
                ></textarea>
              </div>
              <div className="flex gap-4 pt-2">
                <Button type="submit" variant="primary" fullWidth className="py-5 text-lg" isLoading={isLoading}>ส่งคำขอ</Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes bounce-short { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -15px); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
        .animate-scale-in { animation: scale-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .animate-bounce-short { animation: bounce-short 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;
