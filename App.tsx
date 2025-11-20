import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, LogType, AttendanceLog, GeoLocationData } from './types';
import { saveUser, getUser, logoutUser, saveLog, getLogsByUser, saveSheetUrl, getSheetUrl } from './services/storage';
import { getDailyInsight } from './services/geminiService';
import { sendToGoogleSheet } from './services/sheetService';
import { Button } from './components/Button';
import { AttendanceStats } from './components/AttendanceStats';

// Simple UUID generator
const generateId = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

const App: React.FC = () => {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<{ title: string; message: string; ai?: string } | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState('');

  // Init
  useEffect(() => {
    const storedUser = getUser();
    if (storedUser) {
      setUser(storedUser);
      setView('dashboard');
      refreshLogs(storedUser.username);
    }
    setSheetUrlInput(getSheetUrl());
  }, []);

  const refreshLogs = (username: string) => {
    setLogs(getLogsByUser(username).reverse()); // Newest first
  };

  // Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput && passwordInput) {
      // Mock Auth
      const newUser: User = {
        username: usernameInput,
        fullName: usernameInput.charAt(0).toUpperCase() + usernameInput.slice(1), // Capitalize
      };
      saveUser(newUser);
      setUser(newUser);
      setView('dashboard');
      refreshLogs(newUser.username);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setUsernameInput('');
    setPasswordInput('');
    setView('login');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSheetUrl(sheetUrlInput);
    setIsSettingsOpen(false);
  };

  const handleClockAction = async (type: LogType) => {
    if (!user) return;
    setIsLoading(true);
    setLocationError(null);
    setSuccessMessage(null);

    if (!('geolocation' in navigator)) {
      setLocationError("Geolocation is not supported by this device.");
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location: GeoLocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Call AI for a message
        let aiMsg = '';
        // Basic check for API key presence to avoid unnecessary calls
        if (process.env.API_KEY) {
            aiMsg = await getDailyInsight(user.fullName, type === LogType.CLOCK_IN ? 'in' : 'out', timeString);
        }

        const newLog: AttendanceLog = {
          id: generateId(),
          userId: user.username,
          type,
          timestamp: now.getTime(),
          location,
          aiMessage: aiMsg
        };

        // Save locally
        saveLog(newLog);
        
        // Sync to Google Sheet (Fire and forget)
        const sheetUrl = getSheetUrl();
        if (sheetUrl) {
           sendToGoogleSheet(sheetUrl, newLog).catch(err => console.error("Background sync error", err));
        }

        refreshLogs(user.username);
        
        setSuccessMessage({
          title: type === LogType.CLOCK_IN ? "Clocked In Successfully" : "Clocked Out Successfully",
          message: `Recorded at ${timeString}`,
          ai: aiMsg
        });
        setIsLoading(false);
      },
      (error) => {
        console.error(error);
        let msg = "Unable to retrieve location.";
        if (error.code === error.PERMISSION_DENIED) msg = "Location permission denied. Please enable it.";
        if (error.code === error.POSITION_UNAVAILABLE) msg = "Location information is unavailable.";
        if (error.code === error.TIMEOUT) msg = "The request to get user location timed out.";
        setLocationError(msg);
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Render Login
  if (view === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">GeoClock AI</h1>
            <p className="text-slate-500 mt-2">Smart Attendance System</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                placeholder="Enter username"
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                placeholder="••••••••"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
              />
            </div>
            <Button type="submit" fullWidth>Sign In</Button>
          </form>
        </div>
      </div>
    );
  }

  // Render Dashboard
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
               {user?.fullName.charAt(0)}
             </div>
             <div>
               <h2 className="font-bold text-slate-800">{user?.fullName}</h2>
               <p className="text-xs text-slate-500">Employee</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
              title="Settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </button>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        
        {/* Stats Chart */}
        <section>
           <AttendanceStats logs={logs} />
        </section>

        {/* Action Area */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="grid grid-cols-2 gap-4">
            <Button 
              variant="primary" 
              onClick={() => handleClockAction(LogType.CLOCK_IN)}
              isLoading={isLoading}
            >
              Clock In
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => handleClockAction(LogType.CLOCK_OUT)}
              isLoading={isLoading}
            >
              Clock Out
            </Button>
          </div>

          {/* Messages */}
          {locationError && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-2">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              {locationError}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-xl border border-green-100 animate-in fade-in slide-in-from-bottom-2">
              <div className="font-bold flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {successMessage.title}
              </div>
              <div className="text-sm mt-1 opacity-90">{successMessage.message}</div>
              {successMessage.ai && (
                <div className="mt-3 pt-3 border-t border-green-200/50 text-sm italic text-green-700 flex gap-2">
                  <span className="text-lg">✨</span>
                  "{successMessage.ai}"
                </div>
              )}
            </div>
          )}
        </section>

        {/* Recent Logs */}
        <section>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Recent Activity</h3>
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm bg-white rounded-2xl border border-slate-100 border-dashed">
                No records found today.
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${log.type === LogType.CLOCK_IN ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {log.type === LogType.CLOCK_IN ? (
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
                      ) : (
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-700">
                        {log.type === LogType.CLOCK_IN ? 'Clocked In' : 'Clocked Out'}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                         {log.location.latitude.toFixed(4)}, {log.location.longitude.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-800">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Settings</h3>
            <form onSubmit={handleSaveSettings}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Google Script Web App URL</label>
                <input 
                  type="url" 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://script.google.com/macros/s/..."
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">Deploy your Apps Script as a Web App and paste the URL here to sync data.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;