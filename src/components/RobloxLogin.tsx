import React, { useState } from "react";
import { User, Search, Check, AlertCircle, Sparkles } from "lucide-react";
import { RobloxUser } from "../types";

interface RobloxLoginProps {
  onLoginSuccess: (user: RobloxUser) => void;
}

export default function RobloxLogin({ onLoginSuccess }: RobloxLoginProps) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<RobloxUser | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError(null);
    setFoundUser(null);

    try {
      const res = await fetch(`/api/roblox/user?username=${encodeURIComponent(username.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to find Roblox account");
      }

      setFoundUser(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Please check spelling.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto" id="roblox-login-container">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl text-center relative overflow-hidden">
        {/* Decorative ambient gradients */}
        <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-red-600 blur-md opacity-70"></div>
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-red-600/10 rounded-full blur-xl"></div>
        <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-yellow-600/10 rounded-full blur-xl"></div>

        {/* Header Branding */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 text-red-500 mb-4 shadow-inner relative">
            <User size={32} />
            <Sparkles size={16} className="absolute -top-1 -right-1 text-yellow-500 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white font-sans uppercase">
            Robux <span className="text-red-500">Reward</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-2 tracking-wide uppercase font-mono">
            Get 10 Coins per Ad • Cashout directly to Robux
          </p>
        </div>

        {!foundUser ? (
          /* Search Form */
          <form onSubmit={handleSearch} className="space-y-4 text-left">
            <div>
              <label htmlFor="roblox-username" className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 font-sans">
                Enter Roblox Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <User size={18} />
                </div>
                <input
                  id="roblox-username"
                  type="text"
                  required
                  placeholder="e.g. Builderman"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all font-sans"
                />
              </div>
              <p className="text-[10px] text-neutral-500 mt-1.5 font-mono">
                No password required. We only need your username to send your Robux.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 animate-fadeIn">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="search-username-btn"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 disabled:bg-neutral-800 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 active:scale-98 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Searching Roblox...</span>
                </>
              ) : (
                <>
                  <Search size={18} />
                  <span>Verify Roblox Account</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Account Confirmation */
          <div className="space-y-6 animate-fadeIn">
            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col items-center">
              <div className="relative mb-3">
                <img
                  src={foundUser.avatarUrl}
                  alt={foundUser.username}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 rounded-full border-4 border-neutral-800 bg-neutral-900 shadow-lg object-contain"
                />
                <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1 rounded-full border-2 border-neutral-950">
                  <Check size={14} />
                </div>
              </div>
              <h3 className="text-lg font-bold text-white leading-tight">
                {foundUser.displayName}
              </h3>
              <p className="text-xs text-neutral-500 font-mono">@{foundUser.username}</p>
              
              {foundUser.isSimulated && (
                <span className="mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                  Offline Fallback Profile
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-400">
              Is this your Roblox account? We will save your earned coins to this profile.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                id="reject-avatar-btn"
                type="button"
                onClick={() => setFoundUser(null)}
                className="py-2.5 border border-neutral-800 hover:bg-neutral-800/50 text-neutral-400 font-semibold rounded-xl text-sm transition-all cursor-pointer"
              >
                No, Change
              </button>
              <button
                id="confirm-avatar-btn"
                type="button"
                onClick={() => onLoginSuccess(foundUser)}
                className="py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-green-900/20 transition-all cursor-pointer"
              >
                Yes, Start Earning
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
