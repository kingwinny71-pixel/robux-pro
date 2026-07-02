import React, { useState, useEffect } from "react";
import { Shield, Users, Coins, TrendingUp, Check, X, Search, RefreshCw, AlertCircle, PlusCircle, MinusCircle, Database } from "lucide-react";
import { PlayerProfile, CashoutTransaction } from "../types";
import { collection, getDocs, doc, updateDoc, writeBatch, query, where, limit, runTransaction } from "firebase/firestore";
import { db, auth } from "../firebase";

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const isOwner = auth.currentUser?.email === "kingwinny71@gmail.com";
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(isOwner);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"cashouts" | "players" | "settings">("cashouts");

  // Stats State
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [pendingRobux, setPendingRobux] = useState(0);
  const [completedRobux, setCompletedRobux] = useState(0);

  // Data Lists
  const [cashouts, setCashouts] = useState<CashoutTransaction[]>([]);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);

  // Search/Edit Player State
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustCoinsUsername, setAdjustCoinsUsername] = useState("");
  const [adjustCoinsAmount, setAdjustCoinsAmount] = useState(0);
  const [adjustMessage, setAdjustMessage] = useState<string | null>(null);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersList: PlayerProfile[] = [];
      let totalC = 0;
      let totalP = 0;
      usersSnap.forEach((doc) => {
        const d = doc.data() as PlayerProfile;
        usersList.push(d);
        totalC += d.coins || 0;
        totalP += 1;
      });
      setPlayers(usersList);
      setTotalPlayers(totalP);
      setTotalCoins(totalC);

      // 2. Fetch Transactions
      const txSnap = await getDocs(collection(db, "transactions"));
      const txList: CashoutTransaction[] = [];
      let pendR = 0;
      let compR = 0;
      txSnap.forEach((doc) => {
        const d = doc.data() as Omit<CashoutTransaction, "id">;
        const tx: CashoutTransaction = {
          ...d,
          id: doc.id,
        };
        txList.push(tx);
        if (d.status === "Pending") {
          pendR += d.robuxAmount || 0;
        } else if (d.status === "Completed") {
          compR += d.robuxAmount || 0;
        }
      });
      // Sort transactions by date descending
      txList.sort((a, b) => b.createdAt - a.createdAt);
      setCashouts(txList);
      setPendingRobux(pendR);
      setCompletedRobux(compR);

    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchAdminData();
    }
  }, [isAdminAuthenticated]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "admin" || adminPassword === "admin123") {
      setIsAdminAuthenticated(true);
      setPasswordError("");
    } else {
      setPasswordError("Invalid Admin Password. Tip: Try 'admin'!");
    }
  };

  const handleUpdateStatus = async (txId: string, username: string, coinsSpent: number, status: "Completed" | "Rejected") => {
    setAdminError(null);
    try {
      const txRef = doc(db, "transactions", txId);

      if (status === "Rejected") {
        // Refund coins to the player
        const userRef = doc(db, "users", username.toLowerCase());
        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(userRef);
          const currentCoins = userDoc.exists() ? (userDoc.data().coins || 0) : 0;
          
          transaction.update(userRef, {
            coins: currentCoins + coinsSpent,
            // Deduct from redeemed
            totalRedeemedRobux: Math.max(0, (userDoc.data().totalRedeemedRobux || 0) - Math.floor(coinsSpent / 10))
          });

          transaction.update(txRef, {
            status: "Rejected",
            processedAt: Date.now()
          });
        });
      } else {
        // Just mark transaction as Completed (Paid)
        await updateDoc(txRef, {
          status: "Completed",
          processedAt: Date.now()
        });
      }

      // Refresh the records
      await fetchAdminData();
    } catch (err) {
      console.error("Error updating transaction:", err);
      setAdminError("Failed to update status. Please try again.");
    }
  };

  const handleAdjustCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustMessage(null);
    if (!adjustCoinsUsername || adjustCoinsAmount === 0) return;

    try {
      const userRef = doc(db, "users", adjustCoinsUsername.trim().toLowerCase());
      
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("Roblox user profile not found on this platform.");
        }

        const currentCoins = userDoc.data().coins || 0;
        const newCoins = Math.max(0, currentCoins + adjustCoinsAmount);

        transaction.update(userRef, {
          coins: newCoins,
          totalEarnedCoins: adjustCoinsAmount > 0 
            ? (userDoc.data().totalEarnedCoins || 0) + adjustCoinsAmount 
            : (userDoc.data().totalEarnedCoins || 0),
          lastActive: Date.now()
        });
      });

      setAdjustMessage(`Successfully adjusted coins for @${adjustCoinsUsername}.`);
      setAdjustCoinsUsername("");
      setAdjustCoinsAmount(0);
      await fetchAdminData();
    } catch (err: any) {
      setAdjustMessage(`Error: ${err.message}`);
    }
  };

  const filteredPlayers = players.filter(p => 
    p.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOwner) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn" id="admin-restricted-modal">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-600"></div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
          
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2 uppercase">Access Restricted</h3>
          <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
            Only the registered owner (<span className="text-white font-semibold font-mono">kingwinny71@gmail.com</span>) can see and use the Admin Panel.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
          >
            Close Panel
          </button>
        </div>
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4" id="admin-login-modal">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-600/10 text-red-500 mb-4 border border-red-500/20">
            <Shield size={24} />
          </div>
          
          <h2 className="text-xl font-bold text-white mb-1">Admin Cashout Portal</h2>
          <p className="text-xs text-neutral-400 mb-6">Enter the administrator password to send Robux.</p>

          <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs uppercase text-neutral-500 font-bold mb-1.5 font-mono">
                Admin Password
              </label>
              <input
                type="password"
                required
                placeholder="Enter password (try: admin)"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-red-600 font-sans"
              />
            </div>

            {passwordError && (
              <div className="flex items-center gap-1.5 p-2 bg-red-950/30 border border-red-900/50 rounded-lg text-[11px] text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-red-900/20"
            >
              Unlock Terminal
            </button>
          </form>

          <p className="text-[10px] text-neutral-500 mt-4 font-mono">
            Default password: <span className="text-red-400 font-semibold">admin</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-neutral-950/95 z-50 overflow-y-auto" id="admin-panel-container">
      <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto flex flex-col">
        
        {/* Navigation / Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-850 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Robux Reward System Admin</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold font-mono">
                  Database Live
                </span>
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">Manage player accounts and complete Robux transfers</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAdminData}
              disabled={loading}
              className="p-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white rounded-lg cursor-pointer transition-all disabled:opacity-50"
              title="Refresh Firestore"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white font-bold rounded-lg text-xs cursor-pointer transition-all"
            >
              Close Console
            </button>
          </div>
        </div>

        {adminError && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center justify-between gap-4 text-left animate-fadeIn">
            <div className="flex gap-2.5 items-start">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
              <div>
                <p className="text-xs font-bold text-red-400">Admin Console Alert</p>
                <p className="text-[11px] text-neutral-300 mt-0.5 leading-normal">{adminError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAdminError(null)}
              className="text-neutral-500 hover:text-neutral-300 font-bold text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dynamic Metric Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-neutral-900 border border-neutral-850 p-4 rounded-xl">
            <div className="flex justify-between items-start text-neutral-500 mb-2">
              <span className="text-xs uppercase tracking-wider font-semibold">Total Players</span>
              <Users size={16} />
            </div>
            <div className="text-2xl font-black text-white">{totalPlayers}</div>
            <p className="text-[10px] text-neutral-500 mt-1 font-mono">Linked Roblox Users</p>
          </div>

          <div className="bg-neutral-900 border border-neutral-850 p-4 rounded-xl">
            <div className="flex justify-between items-start text-neutral-500 mb-2">
              <span className="text-xs uppercase tracking-wider font-semibold">Total Coin Ledger</span>
              <Coins size={16} />
            </div>
            <div className="text-2xl font-black text-yellow-500">{totalCoins}</div>
            <p className="text-[10px] text-neutral-500 mt-1 font-mono">Held by active players</p>
          </div>

          <div className="bg-neutral-900 border border-neutral-850 p-4 rounded-xl">
            <div className="flex justify-between items-start text-neutral-500 mb-2">
              <span className="text-xs uppercase tracking-wider font-semibold">Pending Robux</span>
              <TrendingUp size={16} className="text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-500">R$ {pendingRobux}</div>
            <p className="text-[10px] text-neutral-500 mt-1 font-mono">Awaiting your transfer</p>
          </div>

          <div className="bg-neutral-900 border border-neutral-850 p-4 rounded-xl">
            <div className="flex justify-between items-start text-neutral-500 mb-2">
              <span className="text-xs uppercase tracking-wider font-semibold">Paid Robux</span>
              <Check size={16} className="text-green-500" />
            </div>
            <div className="text-2xl font-black text-green-500">R$ {completedRobux}</div>
            <p className="text-[10px] text-neutral-500 mt-1 font-mono">Successfully dispatched</p>
          </div>
        </div>

        {/* Dashboard Sections Toggle */}
        <div className="flex border-b border-neutral-850 gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("cashouts")}
            className={`px-4 py-2 border-b-2 font-bold text-xs cursor-pointer transition-all ${
              activeTab === "cashouts"
                ? "border-red-600 text-white"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            ⌛ Pending Cashouts ({cashouts.filter(c => c.status === "Pending").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("players")}
            className={`px-4 py-2 border-b-2 font-bold text-xs cursor-pointer transition-all ${
              activeTab === "players"
                ? "border-red-600 text-white"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            👥 Registered Players ({players.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 border-b-2 font-bold text-xs cursor-pointer transition-all ${
              activeTab === "settings"
                ? "border-red-600 text-white"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            🔧 Admin Tools
          </button>
        </div>

        {/* Section Content */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-neutral-400">
            <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-4"></div>
            <span className="text-xs font-mono">Synchronizing Firestore Ledger...</span>
          </div>
        ) : (
          <div className="flex-1">
            {activeTab === "cashouts" && (
              <div className="bg-neutral-900 border border-neutral-850 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Active Cashout Queue
                </h3>
                <p className="text-xs text-neutral-400">
                  Below are players who have requested Robux. Copy their username, send them Robux on Roblox, and click <strong>Mark as Sent</strong>.
                </p>

                {cashouts.filter(c => c.status === "Pending").length === 0 ? (
                  <div className="text-center py-12 bg-neutral-950 border border-neutral-850/40 rounded-xl text-neutral-500 text-xs font-sans">
                    ✨ Clear queue! No pending cashouts currently.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cashouts
                      .filter((c) => c.status === "Pending")
                      .map((tx) => (
                        <div
                          key={tx.id}
                          className="bg-neutral-950 border border-neutral-800/80 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs hover:border-neutral-700 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={tx.avatarUrl}
                              alt={tx.username}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-full border border-neutral-800 bg-neutral-900 object-contain"
                            />
                            <div>
                              <div className="font-extrabold text-white text-sm flex items-center gap-2">
                                <span>@{tx.username}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(tx.username);
                                    setCopiedTxId(tx.id);
                                    setTimeout(() => setCopiedTxId(null), 2000);
                                  }}
                                  className={`px-1.5 py-0.5 rounded font-mono text-[9px] cursor-pointer transition-colors ${
                                    copiedTxId === tx.id 
                                      ? "bg-green-950 text-green-400 border border-green-500/30" 
                                      : "bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800"
                                  }`}
                                >
                                  {copiedTxId === tx.id ? "COPIED!" : "COPY USERNAME"}
                                </button>
                              </div>
                              <div className="text-neutral-500 text-[10px] mt-1">
                                Requested: {new Date(tx.createdAt).toLocaleDateString()} at{" "}
                                {new Date(tx.createdAt).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-1">
                            <span className="text-neutral-400 uppercase tracking-wide text-[9px] font-mono">Redemption Amount</span>
                            <div className="font-black text-md text-red-500 flex items-center gap-1">
                              <img
                                src="https://api.dicebear.com/7.x/pixel-art/svg?seed=robux"
                                alt="Robux"
                                className="w-4 h-4 rounded-sm"
                              />
                              R$ {tx.robuxAmount}
                            </div>
                            <span className="text-[10px] text-neutral-500">Cost: {tx.coinsSpent} Coins</span>
                          </div>

                          <div className="flex items-center gap-2 border-t border-neutral-850/40 sm:border-t-0 pt-3 sm:pt-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(tx.id, tx.username, tx.coinsSpent, "Rejected")}
                              className="px-3 py-2 border border-red-900/50 hover:bg-red-950/20 text-red-400 font-bold rounded-lg cursor-pointer text-xs transition-all flex items-center gap-1"
                            >
                              <X size={13} />
                              <span>Reject / Refund</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(tx.id, tx.username, tx.coinsSpent, "Completed")}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-extrabold rounded-lg cursor-pointer text-xs transition-all flex items-center gap-1 shadow-lg shadow-green-950/20"
                            >
                              <Check size={13} />
                              <span>Mark as Sent (Paid)</span>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Historic payouts panel */}
                <div className="pt-6 border-t border-neutral-850">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4 font-mono">
                    Processed Transfers Log
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {cashouts
                      .filter((c) => c.status !== "Pending")
                      .map((tx) => (
                        <div
                          key={tx.id}
                          className="p-3 bg-neutral-950 border border-neutral-850/60 rounded-lg flex justify-between items-center text-xs opacity-75"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-neutral-500">@{tx.username}</span>
                            <span className="text-neutral-600">•</span>
                            <span className="text-neutral-400 font-bold flex items-center gap-0.5">
                              R$ {tx.robuxAmount}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 font-mono text-[10px]">
                            {tx.status === "Completed" ? (
                              <span className="text-green-500">✓ Paid Out</span>
                            ) : (
                              <span className="text-red-500">✗ Rejected</span>
                            )}
                            <span className="text-neutral-600">
                              {tx.processedAt ? new Date(tx.processedAt).toLocaleDateString() : ""}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "players" && (
              <div className="bg-neutral-900 border border-neutral-850 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Registered Players Ledger
                  </h3>
                  
                  {/* Search Bar */}
                  <div className="relative max-w-xs w-full">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-500">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      placeholder="Filter by username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-500 uppercase tracking-wider font-mono">
                        <th className="py-3 px-2">Player</th>
                        <th className="py-3 px-2">Active Coins</th>
                        <th className="py-3 px-2">Total Earned</th>
                        <th className="py-3 px-2">Total Redeemed</th>
                        <th className="py-3 px-2">Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850">
                      {filteredPlayers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-neutral-500 font-sans">
                            No players matched your filter.
                          </td>
                        </tr>
                      ) : (
                        filteredPlayers.map((p) => (
                          <tr key={p.username} className="hover:bg-neutral-950/40">
                            <td className="py-3 px-2 flex items-center gap-2">
                              <img
                                src={p.avatarUrl}
                                alt={p.username}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full border border-neutral-850 bg-neutral-950 object-contain"
                              />
                              <div>
                                <div className="font-bold text-white">@{p.username}</div>
                                <div className="text-[10px] text-neutral-500 font-mono">
                                  ID: {p.robloxId} {p.googleEmail && `• G: ${p.googleEmail}`}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-yellow-500 font-bold font-mono">
                              {p.coins}
                            </td>
                            <td className="py-3 px-2 text-neutral-400 font-mono">
                              {p.totalEarnedCoins || 0}
                            </td>
                            <td className="py-3 px-2 text-red-400 font-bold font-mono">
                              R$ {p.totalRedeemedRobux || 0}
                            </td>
                            <td className="py-3 px-2 text-neutral-500 font-mono">
                              {new Date(p.lastActive).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Adjust coins tool */}
                <div className="bg-neutral-900 border border-neutral-850 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Database size={16} className="text-red-500" />
                    <span>Adjust Player Balances</span>
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Use this form to manually reward a loyal player or correct an error by adding or deducting coins directly.
                  </p>

                  <form onSubmit={handleAdjustCoins} className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase text-neutral-500 font-bold mb-1 font-mono">
                        Roblox Username
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Builderman"
                        value={adjustCoinsUsername}
                        onChange={(e) => setAdjustCoinsUsername(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase text-neutral-500 font-bold mb-1 font-mono">
                        Coin Amount (Negative to Deduct)
                      </label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 50 or -50"
                        value={adjustCoinsAmount || ""}
                        onChange={(e) => setAdjustCoinsAmount(parseInt(e.target.value) || 0)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                      />
                    </div>

                    {adjustMessage && (
                      <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-yellow-500 font-sans">
                        {adjustMessage}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={!adjustCoinsUsername || adjustCoinsAmount === 0}
                        className="w-full py-2 bg-red-650 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-650 text-white font-bold rounded-lg text-xs transition-all cursor-pointer"
                      >
                        Execute Adjustment
                      </button>
                    </div>
                  </form>
                </div>

                {/* Info and help section */}
                <div className="bg-neutral-900 border border-neutral-850 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    System Information
                  </h3>
                  
                  <div className="space-y-2.5 text-xs text-neutral-400 leading-relaxed">
                    <p>
                      <strong>Database Provider:</strong> Google Cloud Firestore (Live Provisioned).
                    </p>
                    <p>
                      <strong>How Transfers Work:</strong> Roblox doesn't support public automated Robux payouts via API without group funds. For this platform, you (the admin) pay them manually through your Roblox Group or Roblox Developer Products using their verified username, and then mark it paid here.
                    </p>
                    <p>
                      <strong>Minimum Cashout:</strong> 50 Coins (= R$ 5) to protect against instant cashouts, keeping players highly active.
                    </p>
                    <p className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-[10px] font-mono text-neutral-500">
                      Firestore Node: {db.app.options.projectId} <br />
                      Session Version: 1.0.4 <br />
                      Status: Ready
                    </p>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
