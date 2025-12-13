import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, LogType, GeoLocationData } from './types';
import { loginUser, sendClockAction } from './services/sheetService';
import { Button } from './components/Button';

const App: React.FC = () => {
  // State
  const [user, setUser] = useState<User | null>(null);
  
  // Login Form State
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modals
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLineModalOpen, setIsLineModalOpen] = useState(false); // For Login Screen
  
  const [lineUserId, setLineUserId] = useState<string>("");

  // --- Effects ---
  useEffect(() => {
    const initLiff = async () => {
      try {
        // @ts-ignore
        const liff = window.liff;
        if (liff) {
          await liff.init({ liffId: '2007509057-QWw2WLrq' });
          if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            setLineUserId(profile.userId);
            // Auto-fill username with LINE ID
            setUsernameInput(profile.userId);
          }
        }
      } catch (err) {
        console.error("LIFF Initialization failed", err);
      }
    };
    initLiff();
  }, []);

  // Sync usernameInput if lineUserId changes later
  useEffect(() => {
    if (lineUserId) {
      setUsernameInput(lineUserId);
    }
  }, [lineUserId]);

  const handleLiffLogin = () => {
    // @ts-ignore
    if (window.liff) {
      // @ts-ignore
      window.liff.login();
    }
  };

  // --- Handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) {
      setError("Please connect LINE and enter password");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await loginUser(usernameInput, passwordInput);
      if (result.success && result.user) {
        setUser(result.user);
        setSuccess("Login successful!");
      } else {
        // This displays the "Access Denied" / Error message from backend
        setError(result.message || "Invalid username or password");
      }
    } catch (err) {
      setError("Network error connecting to server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    // Keep the username filled if LINE ID is present
    if (lineUserId) {
        setUsernameInput(lineUserId);
    } else {
        setUsernameInput("");
    }
    setPasswordInput("");
    setSuccess(null);
    setError(null);
    setIsProfileOpen(false);
  };

  const handleClockAction = async (type: LogType) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (!navigator.geolocation) {
      setError("Geolocation not supported.");
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

        const result = await sendClockAction(user.username, type, location);

        if (result.success) {
          setSuccess(result.message || "Success!");
        } else {
          setError(result.message || "Action failed.");
        }
        setIsLoading(false);
      },
      (err) => {
        setError("GPS Permission Denied. Please enable location services.");
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // --- UI Components ---

  const LoginScreen = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 relative">
       {/* Login Header Icon */}
       <div className="absolute top-0 right-0 p-6">
          <button
            onClick={() => setIsLineModalOpen(true)}
            className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors border border-slate-100"
            title="Check LINE ID"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          </button>
       </div>

       <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">GeoClock AI</h1>
            <p className="text-slate-500">Employee Attendance</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Username (LINE ID)</label>
              <input 
                type="text" 
                value={usernameInput}
                readOnly
                className="w-full px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 cursor-not-allowed outline-none font-medium font-mono text-sm"
                placeholder={lineUserId ? "LINE ID" : "Click icon ↗ to Connect LINE"}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Password</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-medium text-slate-700"
                placeholder="Enter password"
              />
            </div>
            
            {/* Error / Access Denied Message */}
            {error && (
              <div className="bg-red-50 p-3 rounded-lg flex items-center gap-2 border border-red-100 animate-pulse">
                <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <span className="text-red-600 text-sm font-medium">{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              variant="primary" 
              fullWidth 
              isLoading={isLoading}
              className="mt-4"
              disabled={!usernameInput}
            >
              Log In
            </Button>
          </form>
       </div>

       {/* Line ID Modal for Login Screen */}
       {isLineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-xs w-full p-6 animate-in zoom-in-95">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">User Identification</h3>
                    <p className="text-slate-400 text-xs mt-1">Check your LINE ID for registration</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">My LINE User ID</p>
                    <div className="relative group">
                        <code className="block font-mono text-sm text-slate-700 break-all bg-white p-3 rounded-lg border border-slate-200 select-all">
                            {lineUserId || "Not Connected"}
                        </code>
                    </div>
                </div>

                <div className="space-y-3">
                     {!lineUserId && (
                        <Button 
                            fullWidth 
                            onClick={handleLiffLogin}
                            className="bg-[#06C755] hover:bg-[#05b34c] text-white"
                        >
                            Connect LINE
                        </Button>
                     )}
                    <Button variant="outline" fullWidth onClick={() => setIsLineModalOpen(false)}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
       )}
    </div>
  );

  if (!user) {
    return <LoginScreen />;
  }

  // --- Main Dashboard (Authorized) ---

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-100 border border-slate-200 flex items-center justify-center text-blue-600 font-bold">
                {user.name.charAt(0)}
             </div>
             <div>
               <h2 className="font-bold text-slate-800 text-sm">{user.name}</h2>
               <p className="text-[10px] text-slate-400 uppercase tracking-wide">{user.role} • {user.siteId}</p>
             </div>
          </div>
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="p-2 text-slate-400 hover:text-blue-600 transition-colors bg-slate-50 rounded-full"
            title="Profile"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        
        <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-700">Attendance</h1>
            <p className="text-slate-400 text-sm">
                {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
        </div>

        {/* Action Buttons */}
        <section className="bg-white p-8 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100">
          <div className="grid grid-cols-1 gap-6">
              <Button 
              variant="primary" 
              onClick={() => handleClockAction(LogType.CLOCK_IN)}
              className="h-20 text-xl shadow-blue-300"
              fullWidth
              disabled={isLoading}
              >
              Clock In
              </Button>
              <Button 
              variant="danger" 
              onClick={() => handleClockAction(LogType.CLOCK_OUT)}
              className="h-16 text-lg bg-orange-500 hover:bg-orange-600 shadow-orange-200"
              fullWidth
              disabled={isLoading}
              >
              Clock Out
              </Button>
          </div>

          {/* Messages */}
          {error && (
              <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm flex items-start gap-3 border border-red-100 animate-pulse">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <div>
                  <span className="font-bold block mb-1">Alert</span>
                  {error}
              </div>
              </div>
          )}

          {success && (
              <div className="mt-6 p-4 bg-green-50 text-green-800 rounded-2xl border border-green-100 animate-bounce-short">
              <div className="font-bold flex items-center gap-2 text-lg mb-1">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Success
              </div>
              <div className="text-sm opacity-90 pl-8">{success}</div>
              </div>
          )}
        </section>

      </main>

      {/* Profile Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
            
            <div className="relative pt-8 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white mb-3 flex items-center justify-center text-3xl font-bold text-slate-300">
                     {user.name.charAt(0)}
                </div>
                <h3 className="text-xl font-bold text-slate-800">{user.name}</h3>
                <p className="text-slate-500 text-sm mb-6">{user.role}</p>

                <div className="w-full bg-slate-50 rounded-xl p-4 space-y-3 mb-6">
                    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                        <span className="text-slate-400">Username</span>
                        <span className="font-medium text-slate-700">{user.username}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                        <span className="text-slate-400">Site ID</span>
                        <span className="font-medium text-slate-700">{user.siteId}</span>
                    </div>
                    {/* Shift removed as it was Col F, now replaced by LINE ID logic, or empty */}
                    
                    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                        <span className="text-slate-400">LINE ID</span>
                        <div className="flex items-center gap-2">
                            {/* Display user.lineId from DB if available, else local lineUserId */}
                            <span className="font-medium text-slate-700 text-xs truncate max-w-[120px]" title={user.lineId || lineUserId}>
                                {user.lineId || lineUserId || 'Not connected'}
                            </span>
                            {!user.lineId && !lineUserId && (
                                <button 
                                    onClick={handleLiffLogin}
                                    className="text-[10px] bg-[#06C755] hover:bg-[#05b34c] text-white px-2 py-0.5 rounded shadow-sm"
                                >
                                    Connect
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => setIsProfileOpen(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="flex-1 py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    Logout
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;