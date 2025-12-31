// hooks/useGameState.ts
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
  // works for number|string ids
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asStringId(v: unknown): string {
  return v == null ? '' : String(v);
}

/**
 * Build a *real* RaceResult from raw server/db payloads.
 * - Ensures required keys exist (per your TS error)
 * - Resolves winningHorseName from horses if missing
 */
function buildRaceResult(args: {
  raceId: unknown;
  winnerHorseId: unknown;
  positions?: unknown;
  payouts?: unknown;
  horses?: HorseWithOdds[];
  winningHorseName?: unknown;
}): RaceResult | null {
  const winningHorseId = asNumberId(args.winnerHorseId);
  if (!winningHorseId) return null;

  const horses = args.horses ?? [];
  const resolvedName =
    typeof args.winningHorseName === 'string' && args.winningHorseName.trim()
      ? args.winningHorseName
      : horses.find(h => asNumberId(h.id) === winningHorseId)?.name ?? '';

  // positions: ensure number[]
  const positionsRaw = Array.isArray(args.positions) ? args.positions : [];
  const positions = positionsRaw.map(asNumberId).filter(n => n > 0);

  // payouts: keep as the type your RaceResult expects
  const payouts = (args.payouts ?? {}) as RaceResult['payouts'];

  const result: RaceResult = {
    raceId: asStringId(args.raceId),
    winningHorseId,
    winningHorseName: resolvedName,
    payouts,
    // If your RaceResult type includes positions, this is correct.
    // If it doesn't, remove this line and rely on state.racePositions.
    positions,
  } as RaceResult;

  return result;
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
  const triggerLockRef = useRef(false);

  // keep refs in sync to avoid stale closures
  useEffect(() => {
    currentRaceRef.current = state.currentRace;
  }, [state.currentRace]);

  useEffect(() => {
    horsesRef.current = state.horses;
  }, [state.horses]);

  /* ─────────────────────────────────────────────────────────────
     Fetch current race
     ───────────────────────────────────────────────────────────── */

  const fetchRace = useCallback(async () => {
    try {
      const res = await fetch('/api/race');
      const data = await res.json();

      if (data?.race) {
        const race: Race = data.race;

        setState(prev => ({
          ...prev,
          currentRace: race,
          isRacing: race.status === 'racing',
        }));

        return race;
      }
    } catch (error) {
      console.error('Failed to fetch race:', error);
      setState(prev => ({ ...prev, error: 'Failed to load race' }));
    }
    return null;
  }, []);

  /* ─────────────────────────────────────────────────────────────
     Fetch horses with odds
     ───────────────────────────────────────────────────────────── */

  const fetchHorses = useCallback(async (raceId?: string) => {
    try {
      const url = raceId ? `/api/horses?raceId=${raceId}` : '/api/horses';
      const res = await fetch(url);
      const data = await res.json();

      if (data?.horses) {
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
      }
    } catch (error) {
      console.error('Failed to fetch horses:', error);
    }
  }, []);

  /* ─────────────────────────────────────────────────────────────
     Trigger race execution (server-authoritative)
     ───────────────────────────────────────────────────────────── */

  const triggerRace = useCallback(async () => {
    const race = currentRaceRef.current;
    if (!race) return;

    // prevent double-execute (timer tick, realtime, polling edge)
    if (triggerLockRef.current) return;
    triggerLockRef.current = true;

    // Start animation immediately
    setState(prev => ({
      ...prev,
      isRacing: true,
      lastResult: null,
      racePositions: [],
    }));

    try {
      const res = await fetch('/api/race', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', raceId: race.id }),
      });

      const data = await res.json();

      // Expect server returns a RaceResult (or enough to build one)
      const result =
        (data?.result as RaceResult | undefined) ??
        buildRaceResult({
          raceId: race.id,
          winnerHorseId: data?.result?.winningHorseId ?? data?.result?.winnerId ?? data?.result?.winner_horse_id,
          winningHorseName: data?.result?.winningHorseName,
          payouts: data?.result?.payouts,
          positions: data?.result?.positions ?? data?.result?.final_positions,
          horses: horsesRef.current,
        });

      if (result) {
        // Let animation converge to positions ASAP
        const positions =
          Array.isArray((result as any).positions) ? ((result as any).positions as number[]) : [];
        setState(prev => ({
          ...prev,
          racePositions: positions,
        }));

        // Reveal after animation duration
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            isRacing: false,
            lastResult: result,
          }));
        }, 10_000);
      } else {
        // no result returned
        setState(prev => ({ ...prev, isRacing: false }));
      }
    } catch (error) {
      console.error('Failed to execute race:', error);
      setState(prev => ({ ...prev, isRacing: false }));
    } finally {
      // allow next race trigger later (but not immediately on same race)
      setTimeout(() => {
        triggerLockRef.current = false;
      }, 2000);
    }
  }, []);

  /* ─────────────────────────────────────────────────────────────
     Countdown timer (accurate, avoids stale state)
     ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    const race = state.currentRace;
    if (!race || race.status !== 'betting') return;

    const updateTimer = () => {
      const endTime = new Date(race.betting_ends_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));

      setState(prev => ({ ...prev, timeRemaining: remaining }));

      // Trigger once when hits zero while still betting
      const liveRace = currentRaceRef.current;
      if (remaining === 0 && liveRace?.status === 'betting') {
        triggerRace();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [state.currentRace, triggerRace]);

  /* ─────────────────────────────────────────────────────────────
     Realtime subscriptions
     ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    const channel = supabase
      .channel('game-updates')

      // races updates
      .on('postgres_changes', { event: '*', schema: 'public', table: 'races' }, payload => {
        if (!payload.new) return;
        const newRace = payload.new as Race;

        setState(prev => ({
          ...prev,
          currentRace: newRace,
          isRacing: newRace.status === 'racing',
        }));

        // If finished, capture result accurately if DB contains it
        if (newRace.status === 'finished') {
          const result = buildRaceResult({
            raceId: newRace.id,
            winnerHorseId: (newRace as any).winner_horse_id,
            positions: (newRace as any).final_positions,
            payouts: (newRace as any).payouts,
            horses: horsesRef.current,
            winningHorseName: (newRace as any).winner_horse_name,
          });

          if (result) {
            // positions immediately available for track to snap/render
            const positions = Array.isArray((result as any).positions) ? ((result as any).positions as number[]) : [];
            setState(prev => ({
              ...prev,
              racePositions: positions,
            }));

            // reveal after animation (keeps UX consistent)
            setTimeout(() => {
              setState(prev => ({
                ...prev,
                isRacing: false,
                lastResult: result,
              }));
            }, 10_000);
          }

          // fetch next race/horses after a pause
          setTimeout(() => {
            fetchRace().then(race => {
              if (race) fetchHorses(asStringId(race.id));
            });
          }, 30_000);
        }

        // new betting race -> refresh horses immediately
        if (newRace.status === 'betting') {
          setState(prev => ({
            ...prev,
            lastResult: null,
            racePositions: [],
          }));
          fetchHorses(asStringId(newRace.id));
        }
      })

      // bets inserts -> refresh odds/pool
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bets' }, () => {
        const race = currentRaceRef.current;
        if (race) fetchHorses(asStringId(race.id));
      })

      .subscribe(status => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchHorses, fetchRace]);

  /* ─────────────────────────────────────────────────────────────
     Initial load
     ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    fetchRace().then(race => {
      if (race) fetchHorses(asStringId(race.id));
      else fetchHorses();
    });
  }, [fetchRace, fetchHorses]);

  /* ─────────────────────────────────────────────────────────────
     Poll odds updates every 3s (fallback)
     ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!state.currentRace || state.isRacing) return;

    const interval = setInterval(() => {
      fetchHorses(asStringId(state.currentRace!.id));
    }, 3000);

    return () => clearInterval(interval);
  }, [state.currentRace?.id, state.isRacing, fetchHorses]);

  return {
    ...state,
    refreshRace: fetchRace,
    refreshHorses: fetchHorses,
  };
}
