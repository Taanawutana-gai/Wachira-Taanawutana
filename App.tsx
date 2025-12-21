
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
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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

  const handleOTRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    try {
      const result = await requestOT({
        staffId: user.password!, // Using staffId from password field as per current setup
        name: user.name,
        siteId: user.siteId,
        date: otDate,
        reason: otReason,
        hours: otHours
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
         <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl">
            <h1 className="text-3xl font-bold text-center text-slate-800 mb-2">SMC Property</h1>
            <p className="text-slate-500 text-center mb-8">Attendance & OT System</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border" placeholder="Username" />
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border" placeholder="Staff ID (Password)" />
              {error && <div className="text-red-500 text-xs font-medium">{error}</div>}
              <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>Log In</Button>
            </form>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white shadow-sm p-4 sticky top-0 z-10 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">{user.name.charAt(0)}</div>
             <div>
               <h2 className="font-bold text-slate-800 text-sm">{user.name}</h2>
               <p className="text-[10px] text-slate-400 uppercase">{user.position} • {user.role} • {user.siteId}</p>
             </div>
          </div>
          <button onClick={() => setUser(null)} className="text-slate-400 hover:text-red-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        {/* Attendance Section */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="grid grid-cols-2 gap-4">
              <Button onClick={() => {}} variant="primary" className="h-24 flex-col text-sm"><span className="text-2xl font-bold">Clock In</span></Button>
              <Button onClick={() => {}} variant="danger" className="h-24 flex-col text-sm"><span className="text-2xl font-bold">Clock Out</span></Button>
          </div>
        </section>

        {/* OT Section */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Overtime Requests</h3>
            <button onClick={() => setIsOTModalOpen(true)} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">+ Request OT</button>
          </div>
          
          <div className="space-y-3">
            {otRequests.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-400 text-sm border border-dashed">No OT requests found</div>
            ) : (
              otRequests.map(req => (
                <div key={req.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-slate-700">{req.date} ({req.hours} hrs)</div>
                    <div className="text-xs text-slate-500 line-clamp-1">{req.reason}</div>
                    {user.role === 'Supervisor' && <div className="text-[10px] text-blue-500 font-bold mt-1">From: {req.name}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      req.status === 'Approved' ? 'bg-green-100 text-green-600' :
                      req.status === 'Rejected' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {req.status}
                    </span>
                    {user.role === 'Supervisor' && req.status === 'Pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => handleApproveReject(req.id, OTStatus.APPROVED)} className="p-1 text-green-500 hover:bg-green-50 rounded"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>
                        <button onClick={() => handleApproveReject(req.id, OTStatus.REJECTED)} className="p-1 text-red-500 hover:bg-red-50 rounded"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Statistics</h3>
          <AttendanceStats logs={logs} />
        </section>
      </main>

      {/* OT Request Modal */}
      {isOTModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Request Overtime</h3>
            <form onSubmit={handleOTRequestSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">OT Date</label>
                <input type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Estimated Hours</label>
                <input type="number" step="0.5" value={otHours} onChange={(e) => setOtHours(parseFloat(e.target.value))} className="w-full px-4 py-3 rounded-xl bg-slate-50 border outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Reason / Task</label>
                <textarea value={otReason} onChange={(e) => setOtReason(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border outline-none h-24" placeholder="Description of work..." required></textarea>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" fullWidth onClick={() => setIsOTModalOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>Submit Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Toast (Simplified) */}
      {(success || error) && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-lg z-50 text-white font-medium text-sm transition-all animate-bounce ${success ? 'bg-green-600' : 'bg-red-600'}`}>
          {success || error}
          <button onClick={() => {setSuccess(null); setError(null)}} className="ml-3 font-bold opacity-70">×</button>
        </div>
      )}
    </div>
  );
};

export default App;
