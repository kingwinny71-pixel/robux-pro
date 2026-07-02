import React, { useState } from "react";
import { Gift, Users, Copy, Check, AlertCircle, Sparkles, Share2 } from "lucide-react";
import { PlayerProfile } from "../types";
import { doc, runTransaction, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase";

interface DailyAndReferralProps {
  profile: PlayerProfile;
  onProfileUpdated: (updatedProfile: PlayerProfile) => void;
  mode?: "both" | "daily" | "referral";
}

export default function DailyAndReferral({ profile, onProfileUpdated, mode = "both" }: DailyAndReferralProps) {
  // Daily Bonus States
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);
  const [dailyError, setDailyError] = useState<string | null>(null);

  // Referral States
  const [referralCode, setReferralCode] = useState("");
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralMessage, setReferralMessage] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Daily Bonus Configurations
  const DAILY_BONUS_COINS = 20;
  const COOLDOWN_24H = 24 * 60 * 60 * 1000; // 24 hours in ms

  const lastClaimed = profile.lastDailyBonusClaimedAt || 0;
  const timeSinceLastClaim = Date.now() - lastClaimed;
  const isDailyClaimable = timeSinceLastClaim >= COOLDOWN_24H;

  // Calculate remaining time for daily cooldown
  const getRemainingTimeStr = () => {
    if (isDailyClaimable) return "";
    const remainingMs = COOLDOWN_24H - timeSinceLastClaim;
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  const handleClaimDaily = async () => {
    if (!isDailyClaimable) return;
    setDailyLoading(true);
    setDailyMessage(null);
    setDailyError(null);

    try {
      const userRef = doc(db, "users", profile.username.toLowerCase());
      const now = Date.now();

      await updateDoc(userRef, {
        coins: increment(DAILY_BONUS_COINS),
        totalEarnedCoins: increment(DAILY_BONUS_COINS),
        lastDailyBonusClaimedAt: now,
        lastActive: now,
      });

      const updated: PlayerProfile = {
        ...profile,
        coins: profile.coins + DAILY_BONUS_COINS,
        totalEarnedCoins: profile.totalEarnedCoins + DAILY_BONUS_COINS,
        lastDailyBonusClaimedAt: now,
        lastActive: now,
      };

      onProfileUpdated(updated);
      setDailyMessage(`Successfully claimed +${DAILY_BONUS_COINS} Coins! Come back in 24 hours for more!`);
    } catch (err: any) {
      console.error("Failed to claim daily bonus:", err);
      setDailyError(err.message || "Failed to claim reward. Please try again.");
    } finally {
      setDailyLoading(false);
    }
  };

  const handleApplyReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReferrer = referralCode.trim().toLowerCase();

    if (!cleanReferrer) {
      setReferralError("Please enter a valid Roblox username.");
      return;
    }

    if (cleanReferrer === profile.username.toLowerCase()) {
      setReferralError("You cannot use your own username as a referral code!");
      return;
    }

    setReferralLoading(true);
    setReferralError(null);
    setReferralMessage(null);

    try {
      const myUserRef = doc(db, "users", profile.username.toLowerCase());
      const referrerUserRef = doc(db, "users", cleanReferrer);

      await runTransaction(db, async (transaction) => {
        // 1. Check if I already have a referrer
        const myDoc = await transaction.get(myUserRef);
        if (!myDoc.exists()) {
          throw new Error("Your account profile was not found.");
        }
        if (myDoc.data().referredBy) {
          throw new Error("You have already applied a referral code.");
        }

        // 2. Check if referrer exists
        const referrerDoc = await transaction.get(referrerUserRef);
        if (!referrerDoc.exists()) {
          throw new Error(`The Roblox username "${referralCode}" is not registered on this platform yet! Tell them to sign up so you can use their code.`);
        }

        // 3. Grant rewards: +25 to me, +25 to referrer
        const REFERRAL_REWARD = 25;
        
        transaction.update(myUserRef, {
          referredBy: cleanReferrer,
          coins: increment(REFERRAL_REWARD),
          totalEarnedCoins: increment(REFERRAL_REWARD),
          lastActive: Date.now(),
        });

        transaction.update(referrerUserRef, {
          coins: increment(REFERRAL_REWARD),
          totalEarnedCoins: increment(REFERRAL_REWARD),
          referralCount: increment(1),
          lastActive: Date.now(),
        });
      });

      const updated: PlayerProfile = {
        ...profile,
        referredBy: cleanReferrer,
        coins: profile.coins + 25,
        totalEarnedCoins: profile.totalEarnedCoins + 25,
        lastActive: Date.now(),
      };

      onProfileUpdated(updated);
      setReferralMessage(`Success! Referral applied. You and @${referralCode} both received +25 Coins!`);
      setReferralCode("");
    } catch (err: any) {
      console.error("Referral transaction failed:", err);
      setReferralError(err.message || "Failed to submit referral. Please check spelling.");
    } finally {
      setReferralLoading(false);
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(profile.username);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderDaily = () => (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-full" id="daily-bonus-card">
      <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 rounded-full blur-2xl"></div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Gift className="text-red-500" size={20} />
          <h3 className="text-md font-bold text-white uppercase tracking-tight">Daily Reward</h3>
        </div>
        <p className="text-xs text-neutral-400 mb-4 leading-normal">
          Claim free coins once every 24 hours just for being an active player!
        </p>

        <div className="bg-neutral-950 p-4 border border-neutral-850 rounded-xl text-center mb-4">
          <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">Today's Gift</span>
          <div className="text-2xl font-black text-yellow-500 flex items-center justify-center gap-1 mt-1 font-mono">
            <Sparkles size={20} className="text-yellow-500 animate-pulse" />
            +{DAILY_BONUS_COINS} Coins
          </div>
        </div>

        {dailyError && (
          <div className="p-3 mb-3 bg-red-950/40 border border-red-500/20 rounded-xl text-xs text-red-400 flex gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{dailyError}</span>
          </div>
        )}

        {dailyMessage && (
          <div className="p-3 mb-3 bg-green-950/40 border border-green-500/20 rounded-xl text-xs text-green-400 flex gap-2">
            <Check size={16} className="shrink-0 mt-0.5" />
            <span>{dailyMessage}</span>
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          disabled={!isDailyClaimable || dailyLoading}
          onClick={handleClaimDaily}
          className={`w-full py-3 px-4 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            isDailyClaimable
              ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/25"
              : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
          }`}
        >
          {dailyLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-neutral-400 border-t-white rounded-full animate-spin"></div>
              <span>Claiming Reward...</span>
            </>
          ) : isDailyClaimable ? (
            <>
              <Gift size={15} />
              <span>Claim Free {DAILY_BONUS_COINS} Coins</span>
            </>
          ) : (
            <span>Claimed • {getRemainingTimeStr()}</span>
          )}
        </button>
      </div>
    </div>
  );

  const renderReferral = () => (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-full" id="referral-system-card">
      <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 rounded-full blur-2xl"></div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users className="text-red-500" size={20} />
          <h3 className="text-md font-bold text-white uppercase tracking-tight">Referral Program</h3>
        </div>
        <p className="text-xs text-neutral-400 mb-4 leading-normal">
          Invite your friends to watch ads! When they sign up, you both receive bonus coins.
        </p>

        {/* Share code box */}
        <div className="bg-neutral-950 p-3 border border-neutral-850 rounded-xl flex items-center justify-between gap-3 mb-4">
          <div className="text-left">
            <span className="text-[9px] text-neutral-500 uppercase tracking-wider font-mono">Your Referral Code</span>
            <p className="text-xs font-bold text-white font-mono mt-0.5">@{profile.username}</p>
          </div>
          <button
            type="button"
            onClick={copyReferralCode}
            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-xs font-bold border border-neutral-700 hover:text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={12} className="text-green-500" />
                <span className="text-green-400 text-[10px]">Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span className="text-[10px]">Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Enter referral code form if not already referred */}
        {!profile.referredBy ? (
          <form onSubmit={handleApplyReferral} className="space-y-2 mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter friend's Roblox username"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                disabled={referralLoading}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-600 flex-1 focus:outline-none focus:border-red-600 transition-all font-mono"
              />
              <button
                type="submit"
                disabled={referralLoading}
                className="px-4 bg-neutral-850 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Apply
              </button>
            </div>
            <p className="text-[10px] text-neutral-500">
              Apply a referrer's username to immediately earn <strong className="text-yellow-500">+25 Coins</strong>!
            </p>
          </form>
        ) : (
          <div className="bg-neutral-950/60 p-3 border border-neutral-850 rounded-xl mb-4 flex items-center gap-2 text-xs text-neutral-400">
            <Check size={15} className="text-green-500" />
            <span>
              Referrer Applied: <strong className="text-white font-mono">@{profile.referredBy}</strong>
            </span>
          </div>
        )}

        {referralError && (
          <div className="p-3 mb-3 bg-red-950/40 border border-red-500/20 rounded-xl text-xs text-red-400 flex gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{referralError}</span>
          </div>
        )}

        {referralMessage && (
          <div className="p-3 mb-3 bg-green-950/40 border border-green-500/20 rounded-xl text-xs text-green-400 flex gap-2">
            <Check size={16} className="shrink-0 mt-0.5" />
            <span>{referralMessage}</span>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-neutral-850 flex justify-between items-center text-[10px] text-neutral-500 font-mono">
        <span>Active Invites:</span>
        <span className="text-white font-bold">{profile.referralCount || 0} friends</span>
      </div>
    </div>
  );

  if (mode === "daily") {
    return renderDaily();
  }

  if (mode === "referral") {
    return renderReferral();
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="daily-referral-widgets">
      {renderDaily()}
      {renderReferral()}
    </div>
  );
}
