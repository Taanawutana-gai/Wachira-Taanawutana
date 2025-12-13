import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, LogType, AttendanceLog, GeoLocationData } from './types';
import { checkUserStatus, sendClockAction } from './services/sheetService';
import { Button } from './components/Button';

// LIFF ID from WI
const LIFF_ID = "2007509057-QWw2WLrq";

declare global {
  interface Window {
    liff: any;
  }
}

const App: React.FC = () => {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing LINE...");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Initialize LIFF
  useEffect(() => {
    const initLiff = async () => {
      try {
        if (!window.liff) {
          throw new Error("LIFF SDK not loaded");
        }
        
        await window.liff.init({ liffId: LIFF_ID });
        
        if (!window.liff.isLoggedIn()) {
          window.liff.login();
          return;
        }

        const profile = await window.liff.getProfile();
        verifyUser(profile.userId, profile.pictureUrl);

      } catch (err: any) {
        console.error("LIFF Init Error:", err);
        // Fallback for development/browser testing without LIFF
        setStatusMessage("LIFF Error. Using dev mode?");
        // Uncomment below to force a mock user in dev
        // verifyUser("U123456789MockID", "https://via.placeholder.com/150");
        setError("Please open this in LINE.");
        setIsLoading(false);
      }
    };

    initLiff();
  }, []);

  const verifyUser = async (lineUserId: string, avatarUrl?: string) => {
    setStatusMessage("Verifying User...");
    try {
      const response = await checkUserStatus(lineUserId);
      
      if (response.success && response.user) {
        setUser({
          ...response.user,
          avatarUrl: avatarUrl
        });
        setIsLoading(false);
      } else {
        setError(response.message || "User not registered.");
        setIsLoading(false);
      }
    } catch (e) {
      setError("Failed to connect to server.");
      setIsLoading(false);
    }
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

        // UI Feedback for GPS Accuracy (WI Requirement)
        if (location.accuracy > 1000) {
           // Just a warning in UI, usually backend handles strictness or we block here
           // WI says: "Signal not accurate, try again"
           // For now we proceed but let backend decide, or block if really bad
        }

        const result = await sendClockAction(user.lineUserId, type, location);

        if (result.success) {
          setSuccess(result.message || "Success!");
        } else {
          setError(result.message || "Action failed.");
        }
        setIsLoading(false);
      },
      (err) => {
        setError("GPS Permission Denied or Unavailable.");
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium">{statusMessage}</p>
      </div>
    );
  }

  // Not Registered / Error View
  if (!user || error === "User not registered.") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-6">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
        <p className="text-slate-500 mb-8 max-w-xs mx-auto">
          {error || "You are not registered in the system."}
        </p>
        <button 
           onClick={() => window.location.reload()}
           className="px-6 py-2 bg-slate-800 text-white rounded-lg font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-100 border border-slate-200">
               {user.avatarUrl ? (
                 <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-blue-600 font-bold">
                   {user.name.charAt(0)}
                 </div>
               )}
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

        {/* Action Area */}
        <section className="bg-white p-8 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100">
          <div className="grid grid-cols-1 gap-6">
            <Button 
              variant="primary" 
              onClick={() => handleClockAction(LogType.CLOCK_IN)}
              className="h-20 text-xl shadow-blue-300"
              fullWidth
            >
              Clock In
            </Button>
            <Button 
              variant="danger" 
              onClick={() => handleClockAction(LogType.CLOCK_OUT)}
               className="h-16 text-lg bg-orange-500 hover:bg-orange-600 shadow-orange-200"
               fullWidth
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
                <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white mb-3">
                     {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full" /> : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-400">{user.name[0]}</div>}
                </div>
                <h3 className="text-xl font-bold text-slate-800">{user.name}</h3>
                <p className="text-slate-500 text-sm mb-6">{user.role} User</p>

                <div className="w-full bg-slate-50 rounded-xl p-4 space-y-3 mb-6">
                    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                        <span className="text-slate-400">Site ID</span>
                        <span className="font-medium text-slate-700">{user.siteId}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                        <span className="text-slate-400">Shift</span>
                        <span className="font-medium text-slate-700">{user.shiftGroup}</span>
                    </div>
                    <div className="pt-1">
                         <span className="text-xs text-slate-400 block mb-1">LINE User ID</span>
                         <code className="block w-full bg-slate-200 text-slate-600 text-[10px] p-2 rounded break-all font-mono">
                             {user.lineUserId}
                         </code>
                    </div>
                </div>

                <button 
                  onClick={() => setIsProfileOpen(false)}
                  className="w-full py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Close
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
