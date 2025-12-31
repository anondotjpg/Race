// lib/race-engine.ts
import { createServerSupabaseClient } from './supabase';
import { sendPayout, getWalletBalance } from './solana';
import type { Horse, Race, Bet, RaceResult } from '../types';

const HOUSE_FEE_PERCENT = 5; // 5% house fee

// Determine race winner (weighted random based on bets - more bets = slightly worse odds)
export function determineWinner(horseBets: { horseId: number; totalBets: number }[]): number {
  // Inverse weighting: horses with fewer bets have better odds
  const totalPool = horseBets.reduce((sum, h) => sum + h.totalBets, 0);
  
  if (totalPool === 0) {
    // If no bets, random winner
    const randomIndex = Math.floor(Math.random() * horseBets.length);
    return horseBets[randomIndex].horseId;
  }
  
  // Calculate inverse weights
  const weights = horseBets.map(h => ({
    horseId: h.horseId,
    // Horses with fewer bets get higher weight
    weight: totalPool - h.totalBets + (totalPool / horseBets.length)
  }));
  
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const w of weights) {
    random -= w.weight;
    if (random <= 0) {
      return w.horseId;
    }
  }
  
  return weights[weights.length - 1].horseId;
}

// Generate random race positions for animation
export function generateRacePositions(winnerHorseId: number, horseIds: number[]): number[] {
  const positions = [...horseIds];
  
  // Remove winner and shuffle remaining
  const winnerIndex = positions.indexOf(winnerHorseId);
  positions.splice(winnerIndex, 1);
  
  // Shuffle remaining horses for positions 2-5
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  
  // Winner at position 0
  return [winnerHorseId, ...positions];
}

// Calculate payouts for winners
export function calculatePayouts(
  winningHorseId: number,
  bets: Bet[],
  totalPool: number
): { betId: string; wallet: string; amount: number }[] {
  const winningBets = bets.filter(b => b.horse_id === winningHorseId && b.status === 'confirmed');
  const losingBets = bets.filter(b => b.horse_id !== winningHorseId && b.status === 'confirmed');
  
  if (winningBets.length === 0) {
    return []; // House keeps all if no winners
  }
  
  const losingPool = losingBets.reduce((sum, b) => sum + b.amount, 0);
  const houseFee = losingPool * (HOUSE_FEE_PERCENT / 100);
  const winnerPool = losingPool - houseFee;
  
  const totalWinningBets = winningBets.reduce((sum, b) => sum + b.amount, 0);
  
  return winningBets.map(bet => ({
    betId: bet.id,
    wallet: bet.bettor_wallet,
    // Return original bet + proportional share of losing pool
    amount: bet.amount + (bet.amount / totalWinningBets) * winnerPool
  }));
}

// Main race execution function
export async function executeRace(raceId: string): Promise<RaceResult | null> {
  const supabase = createServerSupabaseClient();
  
  try {
    // Get race and verify it's ready
    const { data: race, error: raceError } = await supabase
      .from('races')
      .select('*')
      .eq('id', raceId)
      .single();
    
    if (raceError || !race || race.status !== 'betting') {
      console.error('Race not found or not in betting state');
      return null;
    }
    
    // Update race status to racing
    await supabase
      .from('races')
      .update({ status: 'racing' })
      .eq('id', raceId);
    
    // Get all horses
    const { data: horses } = await supabase
      .from('horses')
      .select('*');
    
    if (!horses) return null;
    
    // Get all confirmed bets for this race
    const { data: bets } = await supabase
      .from('bets')
      .select('*')
      .eq('race_id', raceId)
      .eq('status', 'confirmed');
    
    const confirmedBets = bets || [];
    
    // Calculate total bets per horse
    const horseBets = horses.map(horse => ({
      horseId: horse.id,
      totalBets: confirmedBets
        .filter(b => b.horse_id === horse.id)
        .reduce((sum, b) => sum + b.amount, 0)
    }));
    
    // Determine winner
    const winningHorseId = determineWinner(horseBets);
    const winningHorse = horses.find(h => h.id === winningHorseId)!;
    
    // Generate final positions
    const positions = generateRacePositions(winningHorseId, horses.map(h => h.id));
    
    // Calculate payouts
    const payouts = calculatePayouts(winningHorseId, confirmedBets, race.total_pool);
    
    // Update race as finished
    await supabase
      .from('races')
      .update({
        status: 'finished',
        winning_horse_id: winningHorseId,
        finished_at: new Date().toISOString()
      })
      .eq('id', raceId);
    
    // Update bet statuses
    for (const bet of confirmedBets) {
      const status = bet.horse_id === winningHorseId ? 'paid' : 'lost';
      const payout = payouts.find(p => p.betId === bet.id)?.amount || 0;
      
      await supabase
        .from('bets')
        .update({ status, payout })
        .eq('id', bet.id);
    }
    
    // Process payouts (in production, this would be done via a separate secure process)
    for (const payout of payouts) {
      // Find the house wallet or use aggregated funds
      // For simplicity, payouts come from individual horse wallets that received bets
      
      await supabase
        .from('payouts')
        .insert({
          bet_id: payout.betId,
          race_id: raceId,
          recipient_wallet: payout.wallet,
          amount: payout.amount,
          status: 'pending'
        });
    }
    
    return {
      raceId,
      winningHorseId,
      winningHorseName: winningHorse.name,
      positions,
      payouts: payouts.map(p => ({ wallet: p.wallet, amount: p.amount }))
    };
  } catch (error) {
    console.error('Race execution error:', error);
    return null;
  }
}

// Start a new race
export async function startNewRace(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  
  try {
    const bettingEndsAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    
    const { data, error } = await supabase
      .from('races')
      .insert({
        status: 'betting',
        betting_ends_at: bettingEndsAt.toISOString(),
        total_pool: 0
      })
      .select('id')
      .single();
    
    if (error) throw error;
    
    return data.id;
  } catch (error) {
    console.error('Failed to start new race:', error);
    return null;
  }
}

// Record a confirmed bet
export async function recordBet(
  raceId: string,
  horseId: number,
  bettorWallet: string,
  amount: number,
  txSignature: string
): Promise<boolean> {
  const supabase = createServerSupabaseClient();
  
  try {
    // Verify race is still in betting phase
    const { data: race } = await supabase
      .from('races')
      .select('status, betting_ends_at')
      .eq('id', raceId)
      .single();
    
    if (!race || race.status !== 'betting') {
      return false;
    }
    
    if (new Date(race.betting_ends_at) < new Date()) {
      return false;
    }
    
    // Record the bet
    const { error } = await supabase
      .from('bets')
      .insert({
        race_id: raceId,
        horse_id: horseId,
        bettor_wallet: bettorWallet,
        amount,
        tx_signature: txSignature,
        status: 'confirmed'
      });
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Failed to record bet:', error);
    return false;
  }
}