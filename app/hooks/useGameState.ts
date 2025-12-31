// hooks/useGameState.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Race, Horse, Bet, HorseWithOdds, RaceResult } from '../types';

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
    error: null
  });

  // Fetch current race
  const fetchRace = useCallback(async () => {
    try {
      const res = await fetch('/api/race');
      const data = await res.json();
      
      if (data.race) {
        setState(prev => ({
          ...prev,
          currentRace: data.race,
          isRacing: data.race.status === 'racing'
        }));
        return data.race;
      }
    } catch (error) {
      console.error('Failed to fetch race:', error);
      setState(prev => ({ ...prev, error: 'Failed to load race' }));
    }
    return null;
  }, []);

  // Fetch horses with odds
  const fetchHorses = useCallback(async (raceId?: string) => {
    try {
      const url = raceId ? `/api/horses?raceId=${raceId}` : '/api/horses';
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.horses) {
        setState(prev => ({
          ...prev,
          horses: data.horses.map((h: any, i: number) => ({
            ...h,
            position: i + 1,
            progress: 0
          })),
          totalPool: data.totalPool || 0,
          loading: false
        }));
      }
    } catch (error) {
      console.error('Failed to fetch horses:', error);
    }
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!state.currentRace || state.currentRace.status !== 'betting') return;

    const updateTimer = () => {
      const endTime = new Date(state.currentRace!.betting_ends_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      
      setState(prev => ({ ...prev, timeRemaining: remaining }));
      
      // If timer hits 0, trigger race
      if (remaining === 0 && state.currentRace?.status === 'betting') {
        triggerRace();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [state.currentRace]);

  // Trigger race execution
  const triggerRace = async () => {
    if (!state.currentRace) return;
    
    setState(prev => ({ ...prev, isRacing: true }));
    
    try {
      const res = await fetch('/api/race', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          raceId: state.currentRace.id
        })
      });
      
      const data = await res.json();
      
      if (data.result) {
        setState(prev => ({
          ...prev,
          lastResult: data.result,
          racePositions: data.result.positions
        }));
      }
    } catch (error) {
      console.error('Failed to execute race:', error);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('race-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'races' },
        (payload) => {
          if (payload.new) {
            const newRace = payload.new as Race;
            setState(prev => ({
              ...prev,
              currentRace: newRace,
              isRacing: newRace.status === 'racing'
            }));
            
            // If race finished, fetch horses for next race
            if (newRace.status === 'finished') {
              setTimeout(() => {
                fetchRace().then(race => {
                  if (race) fetchHorses(race.id);
                });
              }, 30000); // Wait for new race to start
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bets' },
        (payload) => {
          // Refresh odds when new bet comes in
          if (state.currentRace) {
            fetchHorses(state.currentRace.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.currentRace?.id, fetchHorses, fetchRace]);

  // Initial load
  useEffect(() => {
    fetchRace().then(race => {
      if (race) {
        fetchHorses(race.id);
      } else {
        fetchHorses();
      }
    });
  }, [fetchRace, fetchHorses]);

  // Refresh odds periodically
  useEffect(() => {
    if (!state.currentRace || state.isRacing) return;
    
    const interval = setInterval(() => {
      fetchHorses(state.currentRace!.id);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [state.currentRace, state.isRacing, fetchHorses]);

  return {
    ...state,
    refreshRace: fetchRace,
    refreshHorses: fetchHorses
  };
}