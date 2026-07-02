export interface RobloxUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  isSimulated?: boolean;
}

export interface PlayerProfile {
  username: string; // Document ID (lowercase)
  displayName: string;
  robloxId: number;
  avatarUrl: string;
  coins: number;
  totalEarnedCoins: number;
  totalRedeemedRobux: number;
  lastActive: number;
  googleUid?: string;
  googleEmail?: string;
  lastDailyBonusClaimedAt?: number;
  referredBy?: string;
  referralCount?: number;
}

export interface CashoutTransaction {
  id: string; // Firestore Auto-generated ID
  username: string;
  avatarUrl: string;
  coinsSpent: number;
  robuxAmount: number;
  status: "Pending" | "Completed" | "Rejected";
  createdAt: number;
  processedAt?: number;
}

export interface AdCampaign {
  id: string;
  title: string;
  brandName: string;
  tagline: string;
  description: string;
  duration: number; // in seconds
  rewardCoins: number;
  type: "video" | "interactive" | "slideshow";
  accentColor: string;
}
