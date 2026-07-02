import React, { useState } from "react";
import { Coins, ArrowRight, Check, AlertCircle, RefreshCw, Send } from "lucide-react";
import { PlayerProfile, CashoutTransaction } from "../types";
import { doc, runTransaction, collection, addDoc, getDocs, query, where, orderBy, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase";

interface CashoutFormProps {
  profile: PlayerProfile;
  onCashoutRequested: (updatedProfile: PlayerProfile) => void;
  transactions: CashoutTransaction[];
  onRefreshTransactions: () => void;
}

export default function CashoutForm({
  profile,
  onCashoutRequested,
  transactions,
  onRefreshTransactions,
}: CashoutFormProps) {
  const [coinsToRedeem, setCoinsToRedeem] = useState<number>(Math.min(profile.coins, 100));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Exchange rate: 10 Coins = 1 Robux
  const COINS_PER_ROBUX = 10;
  const MIN_COINS = 50; // Minimum 5 Robux

  const robuxReceived = Math.floor(coinsToRedeem / COINS_PER_ROBUX);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setCoinsToRedeem(value);
  };

  const handleMaxClick = () => {
    setCoinsToRedeem(profile.coins);
  };

  const handleCashoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (profile.coins < MIN_COINS) {
      setError(`You need at least ${MIN_COINS} Coins (5 Robux) to make a cashout request.`);
      return;
    }

    if (coinsToRedeem < MIN_COINS) {
      setError(`The minimum cashout is ${MIN_COINS} Coins (5 Robux).`);
      return;
    }

    if (coinsToRedeem > profile.coins) {
      setError("You do not have enough coins for this amount.");
      return;
    }

    setLoading(true);

    try {
      const userRef = doc(db, "users", profile.username.toLowerCase());
      const transactionsColRef = collection(db, "transactions");

      const finalCoinsToRedeem = coinsToRedeem;
      const finalRobuxAmount = Math.floor(finalCoinsToRedeem / COINS_PER_ROBUX);

      // Perform a Firestore transaction to subtract coins and save the transaction safely
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("Player profile does not exist.");
        }

        const currentCoins = userDoc.data().coins || 0;
        if (currentCoins < finalCoinsToRedeem) {
          throw new Error("Insufficient coins for redemption.");
        }

        // Subtract coins and add to redeemed
        transaction.update(userRef, {
          coins: currentCoins - finalCoinsToRedeem,
          totalRedeemedRobux: (userDoc.data().totalRedeemedRobux || 0) + finalRobuxAmount,
          lastActive: Date.now(),
        });

        // Store the cashout request
        const newTxDocRef = doc(collection(db, "transactions"));
        transaction.set(newTxDocRef, {
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          coinsSpent: finalCoinsToRedeem,
          robuxAmount: finalRobuxAmount,
          status: "Pending",
          createdAt: Date.now(),
        });
      });

      // Update local state
      const updatedProfile: PlayerProfile = {
        ...profile,
        coins: profile.coins - finalCoinsToRedeem,
        totalRedeemedRobux: profile.totalRedeemedRobux + finalRobuxAmount,
        lastActive: Date.now(),
      };

      setSuccess(`Your cashout request for ${finalRobuxAmount} Robux was successfully submitted! Our team will send it to your Roblox account shortly.`);
      setCoinsToRedeem(0);
      onCashoutRequested(updatedProfile);
      onRefreshTransactions();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to submit cashout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="cashout-form-container">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/5 rounded-full blur-xl"></div>
        
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Coins className="text-yellow-500" />
          <span>Exchange Coins to Robux</span>
        </h2>
        <p className="text-xs text-neutral-400 mb-6">
          Convert your accumulated reward coins into actual Roblox Robux. Minimum payout: <span className="text-yellow-500 font-semibold">{MIN_COINS} Coins</span> (5 Robux).
        </p>

        <form onSubmit={handleCashoutSubmit} className="space-y-6">
          {/* Exchange rate visual */}
          <div className="grid grid-cols-7 items-center gap-2 bg-neutral-950 p-4 border border-neutral-800/60 rounded-xl text-center">
            <div className="col-span-3 flex flex-col items-center">
              <span className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Coins Spent</span>
              <span className="text-xl font-extrabold text-yellow-500 mt-1 flex items-center gap-1">
                <Coins size={18} />
                {coinsToRedeem}
              </span>
            </div>
            
            <div className="col-span-1 flex justify-center text-neutral-600">
              <ArrowRight size={20} />
            </div>

            <div className="col-span-3 flex flex-col items-center">
              <span className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Robux Received</span>
              <span className="text-xl font-extrabold text-red-500 mt-1 flex items-center gap-1">
                <img
                  src="https://api.dicebear.com/7.x/pixel-art/svg?seed=robux"
                  alt="Robux"
                  className="w-5 h-5 rounded-md inline"
                />
                R$ {robuxReceived}
              </span>
            </div>
          </div>

          {/* Amount slider / range */}
          {profile.coins >= MIN_COINS ? (
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-neutral-400">
                <span>Min: {MIN_COINS} Coins</span>
                <span>Your Balance: {profile.coins} Coins</span>
              </div>
              <input
                type="range"
                min={MIN_COINS}
                max={profile.coins}
                step={10}
                value={coinsToRedeem}
                onChange={handleSliderChange}
                className="w-full h-2 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-neutral-500">
                  Slide to select exchange amount
                </span>
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="px-2.5 py-1 text-xs bg-neutral-850 hover:bg-neutral-800 text-yellow-500 border border-neutral-700 rounded-lg cursor-pointer transition-all"
                >
                  Use Max
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl text-xs text-yellow-500/90 leading-relaxed">
              ⚠️ You do not have enough coins yet. Earn at least <strong>{MIN_COINS - profile.coins} more coins</strong> to request your first cashout! Watch more ads below to accumulate coins.
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 p-3 bg-green-950/40 border border-green-900/50 rounded-xl text-xs text-green-400">
              <Check size={16} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || profile.coins < MIN_COINS || coinsToRedeem < MIN_COINS}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-green-900/10"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Processing Cashout...</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>Request {robuxReceived} Robux Cashout</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Cashout History panel */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-bold text-white flex items-center gap-1.5">
            <RefreshCw size={16} className="text-neutral-400" />
            <span>Your Cashout Status</span>
          </h3>
          <button
            type="button"
            onClick={onRefreshTransactions}
            className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 cursor-pointer transition-all"
          >
            Refresh List
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-6 bg-neutral-950 border border-neutral-800/40 rounded-xl text-neutral-500 text-xs">
            No previous cashouts. Submit your first request above!
          </div>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl flex justify-between items-center text-xs"
              >
                <div>
                  <div className="flex items-center gap-1 font-bold text-white">
                    <img
                      src="https://api.dicebear.com/7.x/pixel-art/svg?seed=robux"
                      alt="Robux"
                      className="w-3.5 h-3.5 rounded-sm inline"
                    />
                    <span>R$ {tx.robuxAmount}</span>
                    <span className="text-neutral-500 font-normal">({tx.coinsSpent} Coins)</span>
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-1 font-mono">
                    {new Date(tx.createdAt).toLocaleDateString()} at{" "}
                    {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                <div>
                  {tx.status === "Pending" ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      ⌛ Pending Transfer
                    </span>
                  ) : tx.status === "Completed" ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                      ✓ Sent successfully
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                      ✗ Rejected
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
