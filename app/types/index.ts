// types/index.ts

export interface Horse {
  id: number;
  name: string;
  color: string;
  emoji: string;
  wallet_address: string;
  wallet_private_key?: string; // Only available server-side
  api_key?: string;
  created_at: string;
}

export interface Race {
  id: string;
  race_number: number;
  status: 'betting' | 'racing' | 'finished';
  winning_horse_id: number | null;
  total_pool: number;
  started_at: string;
  betting_ends_at: string;
  finished_at: string | null;
  created_at: string;
}

export interface Bet {
  id: string;
  race_id: string;
  horse_id: number;
  bettor_wallet: string;
  amount: number;
  tx_signature: string | null;
  status: 'pending' | 'confirmed' | 'paid' | 'lost';
  payout: number;
  created_at: string;
}

export interface Payout {
  id: string;
  bet_id: string;
  race_id: string;
  recipient_wallet: string;
  amount: number;
  tx_signature: string | null;
  status: 'pending' | 'sent' | 'confirmed' | 'failed';
  created_at: string;
}

export interface RaceOdds {
  race_id: string;
  horse_id: number;
  horse_name: string;
  horse_color: string;
  horse_emoji: string;
  wallet_address: string;
  total_bets: number;
  total_pool: number;
  odds: number;
}

export interface HorseWithOdds extends Horse {
  totalBets: number;
  odds: number;
  position: number;
  progress: number;
}

export interface PumpPortalWallet {
  publicKey: string;
  privateKey: string;
  apiKey?: string;
}

export interface RaceResult {
  raceId: string;
  winningHorseId: number;
  winningHorseName: string;
  positions: number[];
  payouts: {
    wallet: string;
    amount: number;
  }[];
}

export interface GameState {
  currentRace: Race | null;
  horses: HorseWithOdds[];
  timeRemaining: number;
  isRacing: boolean;
  lastResults: RaceResult | null;
}