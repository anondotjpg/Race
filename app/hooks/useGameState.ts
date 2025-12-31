'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Race, Bet, HorseWithOdds, RaceResult } from '../types';

interface GameState {
  currentRace: Race | null;
  horses: HorseWithOdds[];
  bets: Bet[];
  timeRemaining: number;
  isRacing: boolean;
  racePositions: number[];
  lastResult: RaceResult | null;
  totalPool: number;
  loading: boolean;
  error: string | null;
}

function asNumberId(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asStringId(v: unknown): string {
  return v == null ? '' : String(v);
}

function buildRaceResult(args: {
  race: Race;
  horses: HorseWithOdds[];
}): RaceResult | null {
  if (!args.race.winning_horse_id) return null;

  const winnerId = asNumberId(args.race.winning_horse_id);
  const winnerName =
    args.horses.find(h => asNumberId(h.id) === winnerId)?.name ?? 'Unknown';

  return {
    raceId: args.race.id,
    winningHorseId: winnerId,
    winningHorseName: winnerName,
    positions: args.race.final_positions ?? [],
    payouts: [], // payouts are informational only here
  };
}

export function useGameState() {
  const [state, setState] = useState<GameState>({
    currentRace: null,
    horses: [],
    bets: [],
    timeRemaining: 0,
    isRacing: false,
    racePositions: [],
    lastResult: null,
    totalPool: 0,
    loading: true,
    error: null,
  });

  const currentRaceRef = useRef<Race | null>(null);
  const horsesRef = useRef<HorseWithOdds[]>([]);

  useEffect(() => {
    currentRaceRef.current = state.currentRace;
  }, [state.currentRace]);

  useEffect(() => {
    horsesRef.current = state.horses;
  }, [state.horses]);

  // ─────────────────────────────────────────────
  // Fetch current race (READ ONLY)
  // ─────────────────────────────────────────────
  const fetchRace = useCallback(async () => {
    try {
      const res = await fetch('/api/race');
      const data = await res.json();

      if (!data?.race) return null;

      const race: Race = data.race;

      setState(prev => ({
        ...prev,
        currentRace: race,
        isRacing: race.status === 'racing',
      }));

      return race;
    } catch {
      setState(prev => ({ ...prev, error: 'Failed to load race' }));
      return null;
    }
  }, []);

  // ─────────────────────────────────────────────
  // Fetch horses + odds
  // ─────────────────────────────────────────────
  const fetchHorses = useCallback(async (raceId?: string) => {
    try {
      const url = raceId ? `/api/horses?raceId=${raceId}` : '/api/horses';
      const res = await fetch(url);
      const data = await res.json();

      if (!data?.horses) return;

      setState(prev => ({
        ...prev,
        horses: data.horses.map((h: any, i: number) => ({
          ...h,
          position: i + 1,
          progress: 0,
        })),
        totalPool: data.totalPool ?? 0,
        loading: false,
      }));
    } catch {}
  }, []);

  // ─────────────────────────────────────────────
  // Countdown (READ ONLY)
  // ─────────────────────────────────────────────
  useEffect(() => {
    const race = state.currentRace;
    if (!race || race.status !== 'betting') return;

    const tick = () => {
      const end = new Date(race.betting_ends_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((end - now) / 1000));

      setState(prev => ({ ...prev, timeRemaining: remaining }));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.currentRace]);

  // ─────────────────────────────────────────────
  // REALTIME — SINGLE SOURCE OF TRUTH
  // ─────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('game-updates')

      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'races' },
        payload => {
          if (!payload.new) return;
          const race = payload.new as Race;

          setState(prev => ({
            ...prev,
            currentRace: race,
            isRacing: race.status === 'racing',
          }));

          if (race.status === 'finished') {
            const result = buildRaceResult({
              race,
              horses: horsesRef.current,
            });

            if (result) {
              setState(prev => ({
                ...prev,
                racePositions: result.positions,
              }));

              setTimeout(() => {
                setState(prev => ({
                  ...prev,
                  isRacing: false,
                  lastResult: result,
                }));
              }, 10_000);
            }

            setTimeout(() => {
              fetchRace().then(r => {
                if (r) fetchHorses(asStringId(r.id));
              });
            }, 30_000);
          }

          if (race.status === 'betting') {
            setState(prev => ({
              ...prev,
              lastResult: null,
              racePositions: [],
            }));
            fetchHorses(asStringId(race.id));
          }
        }
      )

      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bets' },
        () => {
          const race = currentRaceRef.current;
          if (race) fetchHorses(asStringId(race.id));
        }
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchHorses, fetchRace]);

  // ─────────────────────────────────────────────
  // Initial load
  // ─────────────────────────────────────────────
  useEffect(() => {
    fetchRace().then(r => {
      if (r) fetchHorses(asStringId(r.id));
      else fetchHorses();
    });
  }, [fetchRace, fetchHorses]);

  return {
    ...state,
    refreshRace: fetchRace,
    refreshHorses: fetchHorses,
  };
}
