import React, { useState, useEffect } from "react";
import { Play, Pause, X, AlertCircle, Award, CheckCircle2, Volume2, VolumeX, Sparkles, Trophy, Gamepad2 } from "lucide-react";
import { AdCampaign } from "../types";

interface AdPlayerModalProps {
  campaign: AdCampaign;
  onClose: () => void;
  onAdCompleted: (coinsEarned: number) => void;
}

export default function AdPlayerModal({ campaign, onClose, onAdCompleted }: AdPlayerModalProps) {
  const [timeLeft, setTimeLeft] = useState(campaign.duration);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [completed, setCompleted] = useState(false);
  
  // State for interactive mini-games
  const [tycoonCash, setTycoonCash] = useState(0);
  const [tycoonDroppers, setTycoonDroppers] = useState(1);
  const [petHappy, setPetHappy] = useState(40);
  const [lavaDodgeScore, setLavaDodgeScore] = useState(0);
  const [lavaPath, setLavaPath] = useState<number | null>(null);
  const [lavaMessage, setLavaMessage] = useState("Tap left or right path to dodge lava!");

  // Background timer ticking down
  useEffect(() => {
    if (!isPlaying || completed) return;

    if (timeLeft <= 0) {
      setCompleted(true);
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, isPlaying, completed]);

  // Tycoon interactive ad logic
  const handleTycoonClick = () => {
    setTycoonCash((prev) => prev + tycoonDroppers * 10);
  };
  const handleBuyDropper = () => {
    if (tycoonCash >= 50) {
      setTycoonCash((prev) => prev - 50);
      setTycoonDroppers((prev) => prev + 1);
    }
  };

  // Pet interactive ad logic
  const handleFeedPet = () => {
    setPetHappy((prev) => Math.min(prev + 15, 100));
  };
  const handlePlayWithPet = () => {
    setPetHappy((prev) => Math.min(prev + 20, 100));
  };

  // Obby path dodging logic
  const choosePath = (side: "left" | "right") => {
    const obstacleIndex = Math.random() > 0.5 ? "left" : "right";
    if (side === obstacleIndex) {
      setLavaDodgeScore(0);
      setLavaMessage("🔥 Splatted! You hit a laser grid! Choose path to retry!");
    } else {
      setLavaDodgeScore((prev) => prev + 1);
      setLavaMessage("✓ Safely jumped! Next grid ready!");
    }
  };

  const handleClaimReward = () => {
    onAdCompleted(campaign.rewardCoins);
  };

  // Progress Bar percentage
  const progressPercent = ((campaign.duration - timeLeft) / campaign.duration) * 100;

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn" id="ad-player-modal">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col h-[520px]">
        
        {/* Ad Header Info */}
        <div className="bg-neutral-950 px-5 py-3 border-b border-neutral-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-red-600/20 text-red-500 font-bold uppercase tracking-wider text-[9px] font-mono animate-pulse">
              Sponsored Ad
            </span>
            <div className="text-white font-semibold">
              {campaign.brandName} • <span className="text-neutral-400 font-normal">{campaign.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="text-neutral-400 hover:text-white transition-all p-1 cursor-pointer"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            
            {/* Close button - only active if completed or alert confirm */}
            <button
              type="button"
              onClick={() => {
                if (completed) {
                  onClose();
                } else if (confirm("If you close this ad now, you won't get your reward coins. Close anyway?")) {
                  onClose();
                }
              }}
              className="text-neutral-500 hover:text-red-500 transition-all p-1 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Ad Video / Playable Stage */}
        <div className="flex-1 bg-neutral-950 relative flex flex-col justify-center items-center overflow-hidden p-6">
          
          {/* Progress Overlay */}
          {!completed && (
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-neutral-800">
              <div
                className="h-full bg-red-500 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          )}

          {/* Time & Reward Indicator overlay */}
          <div className="absolute top-4 left-4 bg-neutral-900/90 px-3 py-1.5 rounded-lg border border-neutral-800 text-[11px] font-bold text-white flex items-center gap-2 font-sans">
            {completed ? (
              <span className="text-green-500 flex items-center gap-1">
                <CheckCircle2 size={13} />
                Finished!
              </span>
            ) : (
              <span>⌛ {timeLeft}s remaining</span>
            )}
            <span className="text-neutral-600">|</span>
            <span className="text-yellow-500 flex items-center gap-1">
              <Sparkles size={12} />
              +{campaign.rewardCoins} Coins
            </span>
          </div>

          {/* Ad Campaign Interactive Simulation Content */}
          <div className="w-full max-w-lg h-full flex flex-col justify-center items-center select-none mt-4">
            {completed ? (
              /* Reward Completion Screen */
              <div className="text-center space-y-4 animate-scaleIn">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 border border-green-500/30 text-green-500 rounded-full animate-bounce">
                  <Award size={48} />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                  Ad Completed!
                </h3>
                <p className="text-sm text-neutral-400">
                  Thanks for supporting our sponsors. You have unlocked your coins.
                </p>
                <div className="pt-2">
                  <button
                    id="claim-coins-btn"
                    type="button"
                    onClick={handleClaimReward}
                    className="px-8 py-3 bg-yellow-500 hover:bg-yellow-600 text-neutral-950 font-extrabold rounded-xl text-md flex items-center gap-2 mx-auto cursor-pointer shadow-lg shadow-yellow-500/20 active:scale-95 transition-all"
                  >
                    <Sparkles size={18} />
                    <span>Claim {campaign.rewardCoins} Reward Coins</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Interactive Gameplay Stage based on Campaign Type */
              <div className="w-full text-center space-y-4">
                
                {campaign.type === "interactive" && campaign.id === "bloxtypoon" && (
                  /* Mini game: Tycoon Simulator */
                  <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl w-full max-w-sm space-y-4 mx-auto shadow-inner relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] uppercase tracking-wider font-extrabold px-3 py-0.5 rounded-full border border-red-500 shadow-md">
                      Playable Game
                    </div>

                    <div className="flex justify-between items-center text-xs mt-1">
                      <span className="text-neutral-400 font-mono">My Tycoon Cash:</span>
                      <span className="text-green-400 font-bold font-mono">${tycoonCash}</span>
                    </div>

                    <div className="flex gap-2 justify-center py-2">
                      <div className="px-3 py-1 bg-neutral-950 rounded border border-neutral-800 text-[10px] text-neutral-400 font-mono">
                        🏭 {tycoonDroppers} Droppers
                      </div>
                      <div className="px-3 py-1 bg-neutral-950 rounded border border-neutral-800 text-[10px] text-neutral-400 font-mono">
                        ⚙️ Auto Earnings: ${tycoonDroppers * 10}/sec
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleTycoonClick}
                        className="py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        <span>🔴 TAP DROPPER</span>
                        <span className="text-[9px] font-normal opacity-80">Earn $10</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleBuyDropper}
                        disabled={tycoonCash < 50}
                        className="py-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-neutral-800 text-white font-extrabold rounded-xl text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        <span>🏭 BUY DROPPER</span>
                        <span className="text-[9px] text-yellow-500">Cost: $50</span>
                      </button>
                    </div>

                    <p className="text-[10px] text-neutral-500 italic">
                      Build your tycoon and earn reward coins while the timer counts down!
                    </p>
                  </div>
                )}

                {campaign.type === "interactive" && campaign.id === "adoptpet" && (
                  /* Mini game: Adopt Me Pet Care */
                  <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl w-full max-w-sm space-y-4 mx-auto shadow-inner relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] uppercase tracking-wider font-extrabold px-3 py-0.5 rounded-full border border-red-500 shadow-md">
                      Interactive Care
                    </div>

                    <div className="flex flex-col items-center space-y-2 pt-2">
                      <div className="text-5xl animate-bounce">🦄</div>
                      <span className="text-xs font-bold text-white">Sparkle the Baby Unicorn</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-400">
                        <span>Happiness & Hunger:</span>
                        <span className="font-bold text-pink-400">{petHappy}%</span>
                      </div>
                      <div className="h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-850">
                        <div
                          className="h-full bg-pink-500 transition-all duration-300"
                          style={{ width: `${petHappy}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleFeedPet}
                        className="py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        🍼 Feed Milk
                      </button>
                      <button
                        type="button"
                        onClick={handlePlayWithPet}
                        className="py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        🧶 Throw Yarn
                      </button>
                    </div>

                    <p className="text-[10px] text-neutral-500 italic">
                      Keep your virtual pet happy while the ad timer runs out!
                    </p>
                  </div>
                )}

                {campaign.type === "interactive" && campaign.id === "obbydodge" && (
                  /* Mini game: Lava Path Dodge */
                  <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl w-full max-w-sm space-y-4 mx-auto shadow-inner relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] uppercase tracking-wider font-extrabold px-3 py-0.5 rounded-full border border-red-500 shadow-md">
                      Dodge Challenge
                    </div>

                    <div className="flex justify-between items-center text-xs mt-1">
                      <span className="text-neutral-400">Dodge Score:</span>
                      <span className="text-yellow-500 font-bold font-mono">🏆 {lavaDodgeScore} Jumps</span>
                    </div>

                    <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850 text-xs text-neutral-300 font-sans min-h-12 flex items-center justify-center text-center">
                      {lavaMessage}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => choosePath("left")}
                        className="py-3 bg-red-650 hover:bg-red-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-all border border-red-600"
                      >
                        ⬅ Jump Left Path
                      </button>
                      <button
                        type="button"
                        onClick={() => choosePath("right")}
                        className="py-3 bg-red-650 hover:bg-red-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-all border border-red-600"
                      >
                        Jump Right Path ➡
                      </button>
                    </div>

                    <p className="text-[10px] text-neutral-500 italic">
                      Choose the safe path to jump and avoid falling into lava!
                    </p>
                  </div>
                )}

                {(campaign.type === "video" || campaign.type === "slideshow") && (
                  /* Mock Video Player Display */
                  <div className="w-full max-w-sm mx-auto space-y-4">
                    <div className="aspect-video bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col justify-center items-center relative overflow-hidden group shadow-inner">
                      
                      {/* Stylized background lines mimicking actual video streaming */}
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black opacity-80"></div>
                      
                      {/* Dynamic simulation UI elements */}
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/60 border border-neutral-800 text-[9px] text-neutral-400 font-mono">
                        1080p HD
                      </div>

                      <div className="z-10 flex flex-col items-center space-y-3">
                        <div className="relative">
                          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-900/40 relative">
                            <Gamepad2 size={32} className="text-white animate-pulse" />
                          </div>
                          <span className="absolute -bottom-1 -right-1 bg-yellow-500 text-neutral-950 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider font-mono">
                            FREE
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white uppercase tracking-tight">{campaign.brandName}</p>
                          <p className="text-[10px] text-red-500 font-mono tracking-wide mt-0.5">{campaign.tagline}</p>
                        </div>
                      </div>

                      {/* Video Scanlines/Visual Noise Filter */}
                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-neutral-950/10 to-neutral-950/30 opacity-50 mix-blend-overlay"></div>
                    </div>

                    {/* Fun informative text to read while ad runs */}
                    <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-xl">
                      <p className="text-xs text-white font-semibold leading-normal">{campaign.description}</p>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

        {/* Ad Player Controls Bar */}
        <div className="bg-neutral-950 px-5 py-4 border-t border-neutral-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            {!completed && (
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold cursor-pointer transition-all"
              >
                {isPlaying ? (
                  <>
                    <Pause size={13} />
                    <span>Pause Ad</span>
                  </>
                ) : (
                  <>
                    <Play size={13} />
                    <span>Resume Ad</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="text-neutral-500 text-[11px]">
            Coins value guaranteed by Roblox Cashout Network • Secure Connection
          </div>
        </div>

      </div>
    </div>
  );
}
