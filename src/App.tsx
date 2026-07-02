import React, { useState, useEffect } from "react";
import { Coins, Sparkles, TrendingUp, LogOut, Tv, Shield, Gamepad2, AlertCircle, HelpCircle, Users } from "lucide-react";
import { doc, onSnapshot, setDoc, getDoc, updateDoc, increment, query, collection, where, orderBy, getDocs, limit } from "firebase/firestore";
import { db, auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { RobloxUser, PlayerProfile, CashoutTransaction, AdCampaign } from "./types";

// Import custom sub-components
import RobloxLogin from "./components/RobloxLogin";
import CashoutForm from "./components/CashoutForm";
import AdPlayerModal from "./components/AdPlayerModal";
import AdminPanel from "./components/AdminPanel";
import DailyAndReferral from "./components/DailyAndReferral";

const AD_OFFERS: AdCampaign[] = [
  {
    id: "bloxtypoon",
    title: "Blox Tycoon Simulator",
    brandName: "Blox Games Corp",
    tagline: "Build the tallest skyscraper on Roblox!",
    description: "Click your droppers, accumulate cash, and hire managers to construct the absolute ultimate Roblox high-rise! Fully interactive simulator gameplay.",
    duration: 20,
    rewardCoins: 10,
    type: "interactive",
    accentColor: "from-red-600 to-red-800"
  },
  {
    id: "adoptpet",
    title: "Baby Unicorn Pet Care",
    brandName: "Adopt Me Studios",
    tagline: "Can you keep Sparkle happy and healthy?",
    description: "Feed, play, and pamper Sparkle the Baby Unicorn. Fill up her happiness bar before the ad timer runs out to secure your coins!",
    duration: 15,
    rewardCoins: 10,
    type: "interactive",
    accentColor: "from-neutral-900 to-neutral-800"
  },
  {
    id: "obbydodge",
    title: "Lava Lava Obby Dodge",
    brandName: "Obby Masters Ltd",
    tagline: "Jump, dodge, and conquer the lava path!",
    description: "Dodge the active laser grids and jumping blocks by making split-second decisions! Simple, adrenaline-filled interactive obby gameplay.",
    duration: 20,
    rewardCoins: 10,
    type: "interactive",
    accentColor: "from-red-500 to-neutral-900"
  },
  {
    id: "bloxycola",
    title: "Bloxy Soda Advert",
    brandName: "Bloxy Beverages",
    tagline: "Sip the legendary Red Cola powerup!",
    description: "Watch a high-energy animated advertisement introducing the brand new carbonated Bloxy Soda. Guaranteed thirst-quenching Blox powerups!",
    duration: 12,
    rewardCoins: 10,
    type: "video",
    accentColor: "from-neutral-900 to-neutral-800"
  },
  {
    id: "premiumclub",
    title: "Join Robux Elite Club",
    brandName: "Premium Creators",
    tagline: "Discover premium Roblox maps and tips!",
    description: "Unlock exclusive walkthrough guides, tips, and custom developer products designed by Roblox Elite Club's high ranking developers.",
    duration: 15,
    rewardCoins: 10,
    type: "slideshow",
    accentColor: "from-red-600 to-red-800"
  }
];

export default function App() {
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeUser, setActiveUser] = useState<RobloxUser | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [transactions, setTransactions] = useState<CashoutTransaction[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tempRobloxUser, setTempRobloxUser] = useState<RobloxUser | null>(null);
  
  // Modals / Panels
  const [activeAd, setActiveAd] = useState<AdCampaign | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [justEarnedCoins, setJustEarnedCoins] = useState<number | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<"users" | "exchange_rates" | "watch_ads">("watch_ads");
  const [recentUsers, setRecentUsers] = useState<PlayerProfile[]>([]);
  const [loadingRecentUsers, setLoadingRecentUsers] = useState(false);

  const fetchRecentUsers = async () => {
    setLoadingRecentUsers(true);
    try {
      const q = query(collection(db, "users"), limit(12));
      const snap = await getDocs(q);
      const list: PlayerProfile[] = [];
      snap.forEach((doc) => {
        list.push(doc.data() as PlayerProfile);
      });
      list.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
      setRecentUsers(list);
    } catch (err) {
      console.error("Failed to fetch recent active users:", err);
    } finally {
      setLoadingRecentUsers(false);
    }
  };

  useEffect(() => {
    if (activeUser && activeTab === "users") {
      fetchRecentUsers();
    }
  }, [activeUser, activeTab]);

  // Load Google Auth state and query associated Roblox profile
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (gUser) => {
      setGoogleUser(gUser);
      if (gUser) {
        try {
          const q = query(
            collection(db, "users"),
            where("googleUid", "==", gUser.uid),
            limit(1)
          );
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const profileDoc = querySnap.docs[0];
            const profileData = profileDoc.data() as PlayerProfile;
            setActiveUser({
              id: profileData.robloxId,
              username: profileData.username,
              displayName: profileData.displayName,
              avatarUrl: profileData.avatarUrl
            });
          } else {
            setActiveUser(null);
          }
        } catch (err) {
          console.error("Error checking linked Roblox user:", err);
          setActiveUser(null);
        }
      } else {
        setActiveUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // When Google user signs in, if we have a pending temp Roblox user, let's link them!
  useEffect(() => {
    const linkAccounts = async () => {
      if (googleUser && tempRobloxUser && !activeUser) {
        const usernameLower = tempRobloxUser.username.toLowerCase();
        const userRef = doc(db, "users", usernameLower);
        
        try {
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            const existingProfile = docSnap.data() as PlayerProfile;
            if (existingProfile.googleUid && existingProfile.googleUid !== googleUser.uid) {
              setAuthError(`This Roblox username (${tempRobloxUser.username}) is already linked to a different Google account.`);
              setTempRobloxUser(null);
              return;
            }
            
            // Link existing Roblox user to this Google UID
            await updateDoc(userRef, {
              googleUid: googleUser.uid,
              googleEmail: googleUser.email || "",
              lastActive: Date.now()
            });
          } else {
            // Create initial profile with Google link
            const initialProfile: PlayerProfile = {
              username: tempRobloxUser.username,
              displayName: tempRobloxUser.displayName,
              robloxId: tempRobloxUser.id,
              avatarUrl: tempRobloxUser.avatarUrl,
              coins: 0,
              totalEarnedCoins: 0,
              totalRedeemedRobux: 0,
              lastActive: Date.now(),
              googleUid: googleUser.uid,
              googleEmail: googleUser.email || "",
            };
            await setDoc(userRef, initialProfile);
          }
          
          setActiveUser(tempRobloxUser);
          setTempRobloxUser(null);
        } catch (err: any) {
          console.error("Error auto-linking accounts:", err);
          setAuthError(err.message || "Failed to link your account.");
        }
      }
    };
    
    linkAccounts();
  }, [googleUser, tempRobloxUser, activeUser]);

  // Sync Profile and Transactions with Firestore in real-time
  useEffect(() => {
    if (!activeUser) {
      setProfile(null);
      setTransactions([]);
      return;
    }

    const usernameLower = activeUser.username.toLowerCase();
    const userRef = doc(db, "users", usernameLower);

    // 1. Listen to user profile changes
    const unsubProfile = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as PlayerProfile);
      } else if (auth.currentUser) {
        // Create initial profile in Firestore if it doesn't exist (safety fallback)
        const initialProfile: PlayerProfile = {
          username: activeUser.username,
          displayName: activeUser.displayName,
          robloxId: activeUser.id,
          avatarUrl: activeUser.avatarUrl,
          coins: 0,
          totalEarnedCoins: 0,
          totalRedeemedRobux: 0,
          lastActive: Date.now(),
          googleUid: auth.currentUser.uid,
          googleEmail: auth.currentUser.email || "",
        };
        await setDoc(userRef, initialProfile);
        setProfile(initialProfile);
      }
    });

    // 2. Fetch/listen to user cashouts
    const transactionsQuery = query(
      collection(db, "transactions"),
      where("username", "==", activeUser.username)
    );

    const unsubTransactions = onSnapshot(transactionsQuery, (querySnapshot) => {
      const txs: CashoutTransaction[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<CashoutTransaction, "id">;
        txs.push({
          ...data,
          id: doc.id,
        });
      });
      // Sort in frontend by createdAt desc
      txs.sort((a, b) => b.createdAt - a.createdAt);
      setTransactions(txs);
    });

    return () => {
      unsubProfile();
      unsubTransactions();
    };
  }, [activeUser]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google sign in failed:", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes("auth/popup-closed-by-user")) {
        setAuthError("The sign-in popup was closed or blocked. Because this preview runs in a secure iframe sandbox, Google's secure popup was blocked or closed. Opening the app in a new tab will solve this instantly!");
      } else if (errMsg.includes("auth/popup-blocked")) {
        setAuthError("The sign-in popup was blocked by your browser. Please click 'Open App in New Tab' to sign in directly without restrictions.");
      } else if (errMsg.includes("auth/cancelled-popup-request")) {
        setAuthError("The sign-in request was cancelled. Please try again or open the app in a new tab.");
      } else {
        setAuthError(errMsg || "Failed to sign in with Google. If popups are blocked, please open the app in a new tab.");
      }
    }
  };

  const handleLoginSuccess = async (user: RobloxUser) => {
    setAuthError(null);
    if (!auth.currentUser) {
      setTempRobloxUser(user);
      return;
    }

    const usernameLower = user.username.toLowerCase();
    const userRef = doc(db, "users", usernameLower);

    try {
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const existingProfile = docSnap.data() as PlayerProfile;
        if (existingProfile.googleUid && existingProfile.googleUid !== auth.currentUser.uid) {
          setAuthError(`This Roblox username (${user.username}) is already linked to a different Google account.`);
          return;
        }

        // Link existing Roblox user to this Google UID
        await updateDoc(userRef, {
          googleUid: auth.currentUser.uid,
          googleEmail: auth.currentUser.email || "",
          lastActive: Date.now()
        });
      } else {
        // Create initial profile with Google link
        const initialProfile: PlayerProfile = {
          username: user.username,
          displayName: user.displayName,
          robloxId: user.id,
          avatarUrl: user.avatarUrl,
          coins: 0,
          totalEarnedCoins: 0,
          totalRedeemedRobux: 0,
          lastActive: Date.now(),
          googleUid: auth.currentUser.uid,
          googleEmail: auth.currentUser.email || "",
        };
        await setDoc(userRef, initialProfile);
      }

      setActiveUser(user);
    } catch (err: any) {
      console.error("Error during Roblox login association:", err);
      setAuthError(err.message || "Something went wrong linking your Roblox account.");
    }
  };

  const handleLogout = async () => {
    try {
      setAuthError(null);
      await signOut(auth);
      setActiveUser(null);
      setProfile(null);
      setTransactions([]);
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  const handleAdCompleted = async (coinsEarned: number) => {
    if (!activeUser || !profile) return;

    try {
      const userRef = doc(db, "users", activeUser.username.toLowerCase());
      
      // Update coins atomized in Firestore
      await updateDoc(userRef, {
        coins: increment(coinsEarned),
        totalEarnedCoins: increment(coinsEarned),
        lastActive: Date.now()
      });

      // Show success notification banner
      setJustEarnedCoins(coinsEarned);
      setTimeout(() => setJustEarnedCoins(null), 5000);
    } catch (err) {
      console.error("Failed to credit coins:", err);
    } finally {
      setActiveAd(null);
    }
  };

  const refreshTransactionsList = async () => {
    if (!activeUser) return;
    try {
      const transactionsQuery = query(
        collection(db, "transactions"),
        where("username", "==", activeUser.username)
      );
      const snapshot = await getDocs(transactionsQuery);
      const txs: CashoutTransaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<CashoutTransaction, "id">;
        txs.push({
          ...data,
          id: doc.id,
        });
      });
      txs.sort((a, b) => b.createdAt - a.createdAt);
      setTransactions(txs);
    } catch (err) {
      console.error("Failed to refresh transactions:", err);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans" id="app-root-container">
      
      {/* Top Navbar */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-black text-white">
              R
            </div>
            <span className="text-lg font-black tracking-tight text-white uppercase font-sans">
              Robux <span className="text-red-500">Reward</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {activeUser && profile && (
              <div className="flex items-center gap-3 bg-neutral-900 px-3 py-1.5 border border-neutral-800 rounded-xl">
                <img
                  src={profile.avatarUrl}
                  alt={profile.username}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full border border-neutral-700 bg-neutral-950 object-contain"
                />
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-white leading-tight">
                    {profile.displayName}
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono">
                    @{profile.username}
                  </div>
                </div>
                
                <div className="w-px h-6 bg-neutral-800"></div>

                <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                  <Coins size={16} />
                  <span>{profile.coins}</span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-neutral-500 hover:text-red-500 transition-all p-1 cursor-pointer"
                  title="Logout"
                >
                  <LogOut size={15} />
                </button>
              </div>
            )}

            {googleUser && googleUser.email === "kingwinny71@gmail.com" && (
              <button
                id="admin-console-trigger"
                type="button"
                onClick={() => setIsAdminOpen(true)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 border border-red-500/20 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-lg shadow-red-900/10"
              >
                <Shield size={14} />
                <span>Admin Panel</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
        
        {/* Dynamic Coins Earned Notification Banner */}
        {justEarnedCoins !== null && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex items-center justify-between text-yellow-400 text-xs font-bold animate-fadeIn">
            <span className="flex items-center gap-2">
              <Sparkles className="animate-spin" />
              <span>Congratulations! Credited +{justEarnedCoins} Coins to your Roblox balance!</span>
            </span>
            <span className="text-[10px] uppercase tracking-wide font-mono opacity-80">Refreshed</span>
          </div>
        )}

        {authLoading ? (
          <div className="text-center py-20 text-neutral-400 font-mono">
            <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4"></div>
            <span>Synchronizing security status...</span>
          </div>
        ) : !activeUser ? (
          /* Onboarding / Flowchart Home Page */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch animate-fadeIn max-w-5xl mx-auto w-full py-4" id="flowchart-onboarding-container">
            
            {/* Left Panel: Flowchart Timeline */}
            <div className="lg:col-span-5 bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-between shadow-xl relative overflow-hidden" id="flowchart-timeline-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-2xl"></div>
              
              <div>
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-neutral-800">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="text-xs font-black uppercase tracking-widest text-neutral-300 font-mono">
                    Robux Reward Flowchart
                  </span>
                </div>

                {/* Steps List */}
                <div className="space-y-6 relative pl-4 border-l border-neutral-800/80 ml-2">
                  
                  {/* Step 1: Home Welcome */}
                  <div className="relative" id="step-home">
                    <div className="absolute -left-7.5 top-0.5 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs border-2 border-neutral-900">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase">Home / Welcome</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">Explore the hub where players earn free Robux easily.</p>
                    </div>
                  </div>

                  {/* Step 2: Enter Roblox Username */}
                  <div className="relative" id="step-roblox-username">
                    <div className={`absolute -left-7.5 top-0.5 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 border-neutral-900 transition-all ${
                      activeUser || tempRobloxUser 
                        ? "bg-green-500 text-white" 
                        : "bg-red-600 text-white animate-pulse shadow-lg shadow-red-900/50"
                    }`}>
                      {activeUser || tempRobloxUser ? "✓" : "2"}
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold uppercase transition-colors ${
                        activeUser || tempRobloxUser ? "text-neutral-300" : "text-white"
                      }`}>
                        Enter Roblox Username
                      </h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">Search & link your avatar without any passwords.</p>
                    </div>
                  </div>

                  {/* Step 3: Create Account */}
                  <div className="relative" id="step-create-account">
                    <div className={`absolute -left-7.5 top-0.5 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 border-neutral-900 transition-all ${
                      activeUser 
                        ? "bg-green-500 text-white" 
                        : tempRobloxUser 
                          ? "bg-red-600 text-white animate-pulse shadow-lg shadow-red-900/50" 
                          : "bg-neutral-800 text-neutral-500"
                    }`}>
                      {activeUser ? "✓" : "3"}
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold uppercase transition-colors ${
                        activeUser ? "text-neutral-300" : tempRobloxUser ? "text-white" : "text-neutral-500"
                      }`}>
                        Create Account
                      </h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">Link your verified username to a secure Google login to prevent loss of coins.</p>
                    </div>
                  </div>

                  {/* Step 4: Watch Rewarded Ads */}
                  <div className="relative" id="step-watch-ads">
                    <div className="absolute -left-7.5 top-0.5 w-6 h-6 rounded-full bg-neutral-800 text-neutral-500 flex items-center justify-center font-bold text-[10px] border-2 border-neutral-900">
                      4
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 uppercase">Watch Rewarded Ads</h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">Play sponsoring games and interactive video displays.</p>
                    </div>
                  </div>

                  {/* Step 5: +10 Coins per ad */}
                  <div className="relative" id="step-coins-per-ad">
                    <div className="absolute -left-7.5 top-0.5 w-6 h-6 rounded-full bg-neutral-800 text-neutral-500 flex items-center justify-center font-bold text-[10px] border-2 border-neutral-900">
                      5
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 uppercase">+10 Coins per Completed Ad</h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">Earn identical coin bundles for every ad you complete!</p>
                    </div>
                  </div>

                  {/* Step 6: Coin Balance & Redeem */}
                  <div className="relative" id="step-redeem-robux">
                    <div className="absolute -left-7.5 top-0.5 w-6 h-6 rounded-full bg-neutral-800 text-neutral-500 flex items-center justify-center font-bold text-[10px] border-2 border-neutral-900">
                      6
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 uppercase">Coin Balance & Redeem</h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">Submit simple cashout requests to transfer coins to Robux.</p>
                    </div>
                  </div>

                  {/* Step 7: Admin Panel (Owner Review) */}
                  <div className="relative" id="step-admin-payout">
                    <div className="absolute -left-7.5 top-0.5 w-6 h-6 rounded-full bg-neutral-800 text-neutral-500 flex items-center justify-center font-bold text-[10px] border-2 border-neutral-900">
                      7
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 uppercase">Admin Panel & Payout</h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">Owner reviews and completes the Robux payout manually!</p>
                    </div>
                  </div>

                </div>
              </div>

              <div className="pt-4 border-t border-neutral-800 text-[10px] text-neutral-500 font-mono leading-normal">
                Status: {tempRobloxUser ? "Roblox Verified • Google Verification Pending" : "Roblox Username Entry Required"}
              </div>
            </div>

            {/* Right Panel: Interactive Active Form */}
            <div className="lg:col-span-7 flex flex-col justify-center items-center" id="active-step-form-area">
              {!tempRobloxUser ? (
                /* Step 2 Form: Roblox Username entry */
                <div className="w-full max-w-md animate-fadeIn" id="step-roblox-form-container">
                  <div className="text-center mb-6">
                    <h2 className="text-3xl font-extrabold text-white tracking-tight uppercase">
                      Enter Your <span className="text-red-500">Username</span>
                    </h2>
                    <p className="text-neutral-400 text-xs mt-1.5 leading-normal">
                      Provide your public Roblox handle to identify your account skin. No passwords or downloads required!
                    </p>
                  </div>
                  
                  {authError && (
                    <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-400 text-left flex gap-2" id="auth-error-banner">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {/* If already signed into Google but Roblox not linked, display quick identity */}
                  {googleUser && (
                    <div className="mb-4 p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-left flex items-center justify-between gap-2" id="google-session-info">
                      <div>
                        <p className="text-[10px] text-neutral-400 font-mono uppercase">Google Session</p>
                        <p className="text-xs font-bold text-white">{googleUser.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="text-[10px] text-red-400 hover:text-red-300 font-bold hover:underline cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}

                  <RobloxLogin onLoginSuccess={handleLoginSuccess} />
                </div>
              ) : (
                /* Step 3 Form: Create Account / Connect with Google */
                <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-fadeIn text-center" id="step-create-account-card">
                  <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-red-600 blur-md opacity-70"></div>
                  
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700 text-red-500 mb-4 shadow-inner relative">
                    <Sparkles size={24} className="text-red-500 animate-pulse" />
                  </div>

                  <h3 className="text-2xl font-black text-white uppercase mb-1">Create Account</h3>
                  <p className="text-xs text-neutral-400 mb-6 leading-normal">
                    Secure your earnings! Link your verified Roblox avatar to a secure Google login to save coin balances in our Firestore database.
                  </p>

                  {/* Character Avatar Showcase */}
                  <div className="mb-6 p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center gap-4 text-left" id="avatar-showcase">
                    <img
                      src={tempRobloxUser.avatarUrl}
                      alt={tempRobloxUser.username}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full border border-neutral-800 bg-neutral-900 object-contain"
                    />
                    <div className="space-y-0.5 flex-1">
                      <span className="text-[9px] uppercase font-mono tracking-widest text-red-500 font-bold">Verified Roblox Account</span>
                      <h4 className="text-sm font-bold text-white leading-tight">{tempRobloxUser.displayName}</h4>
                      <p className="text-xs text-neutral-400 font-mono">@{tempRobloxUser.username}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTempRobloxUser(null)}
                      className="text-xs text-red-400 hover:text-red-300 hover:underline font-bold cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {authError && (
                    <div className="mb-5 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-left text-xs text-red-400 flex gap-2" id="create-account-auth-error">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-neutral-100 text-neutral-900 font-bold rounded-xl transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    id="google-signin-btn"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Connect Google & Create Account</span>
                  </button>

                  <p className="text-[10px] text-neutral-500 mt-5 leading-normal">
                    Having trouble with the popups? Try opening the app in its own tab!
                  </p>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 font-bold hover:underline mt-2"
                  >
                    Open App in New Tab ↗
                  </a>
                </div>
              )}
            </div>

          </div>
        ) : profile ? (
          /* Main Dashboard layout with 3 tabs: Users, exchange rates, Watch Ads & Play Quests */
          <div className="space-y-6 animate-fadeIn" id="authenticated-dashboard">
            
            {/* Elegant Tab Headers */}
            <div className="flex border-b border-neutral-800 gap-1 pb-px overflow-x-auto scrollbar-none" id="dashboard-tab-headers">
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={`px-5 py-3 border-b-2 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "users"
                    ? "border-red-600 text-white bg-red-600/5 rounded-t-xl"
                    : "border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900/40 rounded-t-xl"
                }`}
              >
                <Users size={15} />
                <span>Users</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("exchange_rates")}
                className={`px-5 py-3 border-b-2 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "exchange_rates"
                    ? "border-red-600 text-white bg-red-600/5 rounded-t-xl"
                    : "border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900/40 rounded-t-xl"
                }`}
              >
                <TrendingUp size={15} />
                <span>exchange rates</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("watch_ads")}
                className={`px-5 py-3 border-b-2 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "watch_ads"
                    ? "border-red-600 text-white bg-red-600/5 rounded-t-xl"
                    : "border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900/40 rounded-t-xl"
                }`}
              >
                <Tv size={15} />
                <span>Watch Ads & Play Quests</span>
              </button>
            </div>

            {/* TAB CONTENTS */}
            {activeTab === "users" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
                {/* Left Column - User Profile & Referral (Col span 7) */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Detailed Passport Card */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden" id="user-passport-card">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-3xl"></div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-neutral-850">
                      <div className="relative">
                        <img
                          src={profile.avatarUrl}
                          alt={profile.username}
                          referrerPolicy="no-referrer"
                          className="w-20 h-20 rounded-full border-2 border-red-500 bg-neutral-950 object-contain p-1"
                        />
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 border-2 border-neutral-900 w-5 h-5 rounded-full flex items-center justify-center" title="Logged In">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                        </div>
                      </div>

                      <div className="text-center sm:text-left flex-1 space-y-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-widest bg-red-500/10 text-red-400 border border-red-500/10 inline-block">
                          Active Roblox Player
                        </span>
                        <h2 className="text-xl font-extrabold text-white leading-tight">
                          {profile.displayName}
                        </h2>
                        <p className="text-xs text-neutral-400 font-mono">
                          @{profile.username} • ID: {profile.robloxId}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 text-xs text-neutral-400">
                      <div className="bg-neutral-950 p-3.5 border border-neutral-850 rounded-xl space-y-1">
                        <span className="text-[10px] text-neutral-500 font-mono uppercase">Google Authenticator</span>
                        <p className="font-semibold text-white truncate">{profile.googleEmail || "Connected"}</p>
                      </div>
                      <div className="bg-neutral-950 p-3.5 border border-neutral-850 rounded-xl space-y-1">
                        <span className="text-[10px] text-neutral-500 font-mono uppercase">Last Synchronization</span>
                        <p className="font-semibold text-white font-mono">
                          {profile.lastActive ? new Date(profile.lastActive).toLocaleTimeString() : "Just now"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Referral Program */}
                  <DailyAndReferral
                    profile={profile}
                    onProfileUpdated={(updatedProfile) => setProfile(updatedProfile)}
                    mode="referral"
                  />

                </div>

                {/* Right Column - Active Players Feed (Col span 5) */}
                <div className="lg:col-span-5">
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <h3 className="text-sm font-bold text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                      <Users className="text-red-500" size={16} />
                      <span>Recent Active Players</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mb-4">
                      See who else is active and earning Robux on our network in real-time.
                    </p>

                    {loadingRecentUsers ? (
                      <div className="space-y-3 py-12 text-center text-xs text-neutral-500 font-mono">
                        <div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-2"></div>
                        <span>Syncing live community feed...</span>
                      </div>
                    ) : recentUsers.length === 0 ? (
                      <p className="text-xs text-neutral-500 font-mono py-8 text-center border border-dashed border-neutral-800 rounded-xl">
                        No active users loaded.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                        {recentUsers.map((user) => (
                          <div
                            key={user.username}
                            className="flex items-center justify-between gap-3 p-2.5 bg-neutral-950/40 hover:bg-neutral-950 border border-neutral-850/30 hover:border-neutral-800 rounded-xl transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={user.avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.username}`}
                                alt={user.username}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-full border border-neutral-800 bg-neutral-950 object-contain"
                              />
                              <div className="text-left min-w-0">
                                <h4 className="text-xs font-bold text-white truncate leading-snug">{user.displayName}</h4>
                                <p className="text-[10px] text-neutral-500 font-mono truncate">@{user.username}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-black text-yellow-500 flex items-center gap-0.5 justify-end font-mono">
                                <Coins size={12} />
                                <span>{user.coins}</span>
                              </div>
                              <p className="text-[9px] text-neutral-600 font-mono">
                                {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : "Online"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "exchange_rates" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
                
                {/* Left Column - Conversion Rates Visuals & Balance (Col span 5) */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Balance Summary Card */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono font-bold">My Active Coins</span>
                      <div className="text-3xl font-black text-yellow-500 flex items-center gap-1.5">
                        <Coins size={28} />
                        <span>{profile.coins}</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 font-mono">
                        Total Earned: {profile.totalEarnedCoins || 0} Coins
                      </p>
                    </div>

                    <div className="w-px h-12 bg-neutral-800"></div>

                    <div className="space-y-1 text-right">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono font-bold">Robux Redeemed</span>
                      <div className="text-3xl font-black text-red-500 flex items-center justify-end gap-1">
                        <img
                          src="https://api.dicebear.com/7.x/pixel-art/svg?seed=robux"
                          alt="Robux"
                          className="w-6 h-6 rounded-md inline"
                        />
                        <span>{profile.totalRedeemedRobux || 0}</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 font-mono">
                        Pending + Completed
                      </p>
                    </div>
                  </div>

                  {/* exchange rates Calculator card */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden" id="exchange-rates-calculator-card">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 rounded-full blur-2xl"></div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-tight mb-3 flex items-center gap-1.5">
                      <TrendingUp className="text-red-500" size={16} />
                      <span>Coin Exchange Rates</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mb-5 leading-normal">
                      Exchanging coins for Robux is super straightforward! Check out our guaranteed exchange rate tables below:
                    </p>

                    <div className="bg-neutral-950 p-4 border border-neutral-850 rounded-xl text-center mb-5">
                      <span className="text-[9px] text-neutral-500 uppercase tracking-wider font-mono">Standard Conversion Ratio</span>
                      <div className="text-lg font-black text-white mt-1 flex items-center justify-center gap-2">
                        <span className="text-yellow-500 flex items-center gap-0.5 font-mono"><Coins size={16} /> 10 Coins</span>
                        <span className="text-neutral-500">=</span>
                        <span className="text-red-500 flex items-center gap-1 font-mono">
                          <img
                            src="https://api.dicebear.com/7.x/pixel-art/svg?seed=robux"
                            alt="Robux"
                            className="w-4 h-4 rounded"
                          />
                          R$ 1 Robux
                        </span>
                      </div>
                    </div>

                    {/* Pre-calculated packages list */}
                    <span className="text-[10px] text-neutral-500 uppercase font-mono tracking-widest block mb-2.5">Popular Conversions</span>
                    <div className="space-y-2 text-xs">
                      {[
                        { coins: 100, robux: 10 },
                        { coins: 500, robux: 50 },
                        { coins: 1000, robux: 100 },
                        { coins: 5000, robux: 500 },
                      ].map((pkg) => (
                        <div
                          key={pkg.coins}
                          className="flex items-center justify-between p-2.5 bg-neutral-950/60 hover:bg-neutral-950 border border-neutral-850/60 rounded-xl transition-all"
                        >
                          <div className="flex items-center gap-1 text-yellow-500 font-mono font-bold">
                            <Coins size={13} />
                            <span>{pkg.coins} Coins</span>
                          </div>
                          <div className="text-neutral-500">→</div>
                          <div className="font-mono font-black text-red-400 flex items-center gap-1">
                            <span>R$ {pkg.robux} Robux</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Right Column - Cashout Form & History (Col span 7) */}
                <div className="lg:col-span-7">
                  <CashoutForm
                    profile={profile}
                    onCashoutRequested={(updatedProfile) => setProfile(updatedProfile)}
                    transactions={transactions}
                    onRefreshTransactions={refreshTransactionsList}
                  />
                </div>

              </div>
            )}

            {activeTab === "watch_ads" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
                
                {/* Left Column - Sponsoring Ads portal (Col span 7) */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 rounded-full blur-xl"></div>
                    
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                      <Tv className="text-red-500" />
                      <span>Watch Ads & Play Quests</span>
                    </h2>
                    <p className="text-xs text-neutral-400 mb-6">
                      Complete these quick sponsorships to instantly earn Reward Coins. You can watch as many as you like!
                    </p>

                    {/* Ad cards list */}
                    <div className="space-y-4">
                      {AD_OFFERS.map((ad) => (
                        <div
                          key={ad.id}
                          className="group bg-neutral-950 border border-neutral-850/80 hover:border-neutral-700 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-all"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-mono font-bold bg-neutral-900 text-neutral-400 border border-neutral-800`}>
                                {ad.type} ad
                              </span>
                              <span className="text-xs text-neutral-500 font-mono">⌛ {ad.duration}s</span>
                            </div>
                            <h3 className="text-sm font-extrabold text-white group-hover:text-red-400 transition-all">
                              {ad.title}
                            </h3>
                            <p className="text-xs text-neutral-400 leading-normal line-clamp-2">
                              {ad.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 shrink-0 pt-3 sm:pt-0 border-t border-neutral-850 sm:border-t-0">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] text-neutral-500 font-mono">Reward</span>
                              <div className="text-yellow-500 font-black text-md flex items-center gap-1 font-mono">
                                <Coins size={16} />
                                +{ad.rewardCoins} Coins
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setActiveAd(ad)}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-red-900/10 active:scale-95"
                            >
                              Watch Ad
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* Informational Help Banner */}
                  <div className="p-4 bg-neutral-900 border border-neutral-850 rounded-2xl flex gap-3 text-xs leading-relaxed text-neutral-400">
                    <HelpCircle className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-white mb-1">How do I get my Robux on Roblox?</h4>
                      <p>
                        Once you submit a Cashout Request, it enters our queue. The administrator of this website will manually payout your Robux to your Roblox username using Group funds or buy your Roblox gamepass/clothing. Please ensure your username is spelled correctly!
                      </p>
                    </div>
                  </div>

                </div>

                {/* Right Column - Daily Rewards & Coins Info (Col span 5) */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Balance Summary Header card */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono font-bold">My Active Coins</span>
                      <div className="text-3xl font-black text-yellow-500 flex items-center gap-1.5">
                        <Coins size={28} />
                        <span>{profile.coins}</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 font-mono">
                        Total Earned: {profile.totalEarnedCoins || 0} Coins
                      </p>
                    </div>

                    <div className="w-px h-12 bg-neutral-800"></div>

                    <div className="space-y-1 text-right">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono font-bold">Robux Redeemed</span>
                      <div className="text-3xl font-black text-red-500 flex items-center justify-end gap-1">
                        <img
                          src="https://api.dicebear.com/7.x/pixel-art/svg?seed=robux"
                          alt="Robux"
                          className="w-6 h-6 rounded-md inline"
                        />
                        <span>{profile.totalRedeemedRobux || 0}</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 font-mono">
                        Pending + Completed
                      </p>
                    </div>
                  </div>

                  {/* Daily Reward card */}
                  <DailyAndReferral
                    profile={profile}
                    onProfileUpdated={(updatedProfile) => setProfile(updatedProfile)}
                    mode="daily"
                  />

                </div>

              </div>
            )}

          </div>
        ) : (
          <div className="text-center py-20 text-neutral-400 font-mono">
            <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4"></div>
            <span>Synchronizing user details...</span>
          </div>
        )}

      </main>

      {/* Simulated Ad Player overlay */}
      {activeAd && (
        <AdPlayerModal
          campaign={activeAd}
          onClose={() => setActiveAd(null)}
          onAdCompleted={handleAdCompleted}
        />
      )}

      {/* Admin Panel Console overlay */}
      {isAdminOpen && (
        <AdminPanel
          onClose={() => setIsAdminOpen(false)}
        />
      )}

      {/* Footer bar */}
      <footer className="border-t border-neutral-900 py-6 mt-12 bg-neutral-950 text-center text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 Robux Reward Network. All simulated rights reserved.</p>
          <div className="flex gap-4">
            {googleUser && googleUser.email === "kingwinny71@gmail.com" && (
              <>
                <button
                  type="button"
                  onClick={() => setIsAdminOpen(true)}
                  className="text-neutral-500 hover:text-red-400 font-mono transition-all cursor-pointer"
                >
                  🔒 Administrative Login
                </button>
                <span className="text-neutral-700">|</span>
              </>
            )}
            <span className="text-neutral-500 font-mono">V1.0.4 - Cloud Native</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
