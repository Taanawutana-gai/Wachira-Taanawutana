
import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, LogType, GeoLocationData, OTRequest, OTStatus } from './types';
import { loginUser, sendClockAction, requestOT, updateOTStatus } from './services/sheetService';
import { getDailyInsight } from './services/geminiService';
import { Button } from './components/Button';
import { AttendanceStats } from './components/AttendanceStats';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [otRequests, setOtRequests] = useState<OTRequest[]>([]);
  
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  
  const [isOTModalOpen, setIsOTModalOpen] = useState(false);
  
  // OT Form State
  const [otDate, setOtDate] = useState(new Date().toISOString().split('T')[0]);
  const [otHours, setOtHours] = useState(2);
  const [otReason, setOtReason] = useState("");

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
        setError(result.message || "Login failed");
      }
    } catch (err) {
      setError("Network error.");
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
          setSuccess(result.message || "Clocked In");
          const insight = await getDailyInsight(user.name, 'in', new Date().toLocaleTimeString());
          setAiInsight(insight);
        } else {
          setError(result.message || "Clock in failed");
        }
        setIsLoading(false);
      }, (err) => {
        setError("Please enable location services.");
        setIsLoading(false);
      });
    } catch (err) {
      setError("Operation failed.");
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
          setSuccess(result.message || "Clocked Out");
          const insight = await getDailyInsight(user.name, 'out', new Date().toLocaleTimeString());
          setAiInsight(insight);
        } else {
          setError(result.message || "Clock out failed");
        }
        setIsLoading(false);
      }, (err) => {
        setError("Please enable location services.");
        setIsLoading(false);
      });
    } catch (err) {
      setError("Operation failed.");
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
        date: otDate,
        reason: otReason,
        hours: otHours,
        role: user.role
      });
      if (result.success) {
        setOtRequests(result.otRequests || []);
        setIsOTModalOpen(false);
        setSuccess(result.message || "OT Requested");
        setOtReason("");
      } else {
        setError(result.message || "Failed to request OT");
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
        setSuccess(`OT ${status} successfully`);
      } else {
        setError(result.message || "Update failed");
      }
    } catch (err) {
      setError("Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
         <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-200">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            </div>
            <h1 className="text-3xl font-bold text-center text-slate-800 mb-2">SMC Property</h1>
            <p className="text-slate-500 text-center mb-8">Attendance & OT System</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Username" />
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Staff ID (Password)" />
              {error && <div className="text-red-500 text-xs font-medium bg-red-50 p-2 rounded-lg">{error}</div>}
              <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>Log In</Button>
            </form>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white shadow-sm p-4 sticky top-0 z-10 flex justify-between items-center border-b border-slate-100">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-100">{user.name.charAt(0)}</div>
             <div>
               <h2 className="font-bold text-slate-800 text-sm leading-tight">{user.name}</h2>
               <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{user.position} • {user.role} • {user.siteId}</p>
             </div>
          </div>
          <button onClick={() => setUser(null)} className="text-slate-400 hover:text-red-500 p-2 rounded-lg transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </button>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        {aiInsight && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-lg text-white animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"></path></svg>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-100">Daily Insight</span>
            </div>
            <p className="text-sm font-medium italic">" {aiInsight} "</p>
          </div>
        )}

        {/* Clock In/Out Section */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="grid grid-cols-2 gap-4">
              <Button onClick={handleClockIn} variant="primary" className="h-28 flex-col text-sm" isLoading={isLoading}>
                <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                <span className="text-xl font-bold">Clock In</span>
              </Button>
              <Button onClick={handleClockOut} variant="danger" className="h-28 flex-col text-sm" isLoading={isLoading}>
                <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                <span className="text-xl font-bold">Clock Out</span>
              </Button>
          </div>
        </section>

        {/* Overtime (OT) Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Overtime Management</h3>
            <button 
              onClick={() => setIsOTModalOpen(true)} 
              className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1 shadow-sm"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              Request OT
            </button>
          </div>
          
          <div className="space-y-3">
            {otRequests.length === 0 ? (
              <div className="bg-white p-10 rounded-3xl text-center text-slate-400 text-sm border border-dashed border-slate-200">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                No active OT requests found
              </div>
            ) : (
              otRequests.map(req => (
                <div key={req.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start transition-all hover:shadow-md">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <span className="text-sm font-bold text-slate-700">{req.date}</span>
                       <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md">{req.hours} Hrs</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">{req.reason}</p>
                    {user.role === 'Supervisor' && (
                       <div className="flex items-center gap-1 mt-2">
                         <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600">{req.name.charAt(0)}</div>
                         <span className="text-[10px] text-blue-600 font-bold tracking-tight">From: {req.name}</span>
                       </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm border ${
                      req.status === 'Approved' ? 'bg-green-50 text-green-600 border-green-100' :
                      req.status === 'Rejected' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100'
                    }`}>
                      {req.status}
                    </span>
                    {user.role === 'Supervisor' && req.status === 'Pending' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleApproveReject(req.id, OTStatus.APPROVED)} 
                          className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-colors shadow-sm"
                          title="Approve"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        </button>
                        <button 
                          onClick={() => handleApproveReject(req.id, OTStatus.REJECTED)} 
                          className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors shadow-sm"
                          title="Reject"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        </button>
                      </div>
                    )}
                    {req.status !== 'Pending' && req.approverName && (
                      <span className="text-[8px] text-slate-400 italic">By: {req.approverName}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Statistics Section */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Weekly Performance</h3>
          <AttendanceStats logs={logs} />
        </section>
      </main>

      {/* OT Request Modal */}
      {isOTModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm p-8 space-y-6 animate-scale-in">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold text-slate-800">Request OT</h3>
              <button onClick={() => setIsOTModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 bg-slate-50 rounded-full">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              </button>
            </div>
            <form onSubmit={handleOTRequestSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">OT Date</label>
                <input type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" required />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Estimated Hours</label>
                <input type="number" step="0.5" value={otHours} onChange={(e) => setOtHours(parseFloat(e.target.value))} className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" required />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Reason / Task</label>
                <textarea 
                  value={otReason} 
                  onChange={(e) => setOtReason(e.target.value)} 
                  className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium h-32 resize-none" 
                  placeholder="What will you be working on?" 
                  required
                ></textarea>
              </div>
              <div className="flex gap-4 pt-2">
                <Button type="button" variant="outline" fullWidth onClick={() => setIsOTModalOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>Submit Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Notifications */}
      {(success || error) && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl z-50 text-white font-bold text-sm flex items-center gap-3 min-w-[300px] transition-all transform animate-bounce-short ${success ? 'bg-green-600' : 'bg-red-600'}`}>
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            {success ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            )}
          </div>
          <span className="flex-1">{success || error}</span>
          <button onClick={() => {setSuccess(null); setError(null)}} className="hover:opacity-70 transition-opacity">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </button>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes bounce-short { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -10px); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .animate-bounce-short { animation: bounce-short 1s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;
