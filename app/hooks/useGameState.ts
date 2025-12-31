// hooks/useGameState.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  const currentRaceRef = useRef<Race | null>(null);
  
  useEffect(() => {
    currentRaceRef.current = state.currentRace;
  }, [state.currentRace]);

  // Fetch current race
  const fetchRace = useCallback(async () => {
    try {
      const res = await fetch('/api/race');
      const data = await res.json();
      
      if (data.race) {
        const race = data.race;
        const wasRacing = state.isRacing;
        const nowRacing = race.status === 'racing';
        
        setState(prev => ({
          ...prev,
          currentRace: race,
          isRacing: nowRacing,
          // If race just finished, get the result
          ...(race.status === 'finished' && race.winner_horse_id ? {
            lastResult: {
              winnerId: race.winner_horse_id,
              positions: race.final_positions || []
            },
            racePositions: race.final_positions || []
          } : {})
        }));
        
        return race;
      }
    } catch (error) {
      console.error('Failed to fetch race:', error);
      setState(prev => ({ ...prev, error: 'Failed to load race' }));
    }
    return null;
  }, [state.isRacing]);

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

  // Update countdown timer (display only - doesn't trigger race)
  useEffect(() => {
    if (!state.currentRace || state.currentRace.status !== 'betting') return;

    const updateTimer = () => {
      const endTime = new Date(state.currentRace!.betting_ends_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setState(prev => ({ ...prev, timeRemaining: remaining }));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [state.currentRace]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('game-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'races' },
        (payload) => {
          if (payload.new) {
            const newRace = payload.new as Race;
            console.log('Race update:', newRace.status);
            
            // Update state based on race status
            if (newRace.status === 'racing') {
              setState(prev => ({
                ...prev,
                currentRace: newRace,
                isRacing: true,
                lastResult: null,
                racePositions: []
              }));
            } else if (newRace.status === 'finished') {
              // Race finished - show result after animation
              setState(prev => ({
                ...prev,
                currentRace: newRace,
                racePositions: newRace.final_positions || [],
              }));
              
              // Wait for animation then show winner
              setTimeout(() => {
                setState(prev => ({
                  ...prev,
                  isRacing: false,
                  lastResult: newRace.winner_horse_id ? {
                    winnerId: newRace.winner_horse_id,
                    positions: newRace.final_positions || []
                  } : null
                }));
              }, 10000);
              
              // Fetch new race after 30 seconds
              setTimeout(() => {
                fetchRace().then(race => {
                  if (race) fetchHorses(race.id);
                });
              }, 35000);
            } else if (newRace.status === 'betting') {
              setState(prev => ({
                ...prev,
                currentRace: newRace,
                isRacing: false,
                lastResult: null,
                racePositions: []
              }));
              fetchHorses(newRace.id);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bets' },
        () => {
          const race = currentRaceRef.current;
          if (race) fetchHorses(race.id);
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchHorses, fetchRace]);

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

  // Poll for race updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRace();
      if (state.currentRace && !state.isRacing) {
        fetchHorses(state.currentRace.id);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [state.currentRace?.id, state.isRacing, fetchRace, fetchHorses]);

  return {
    ...state,
    refreshRace: fetchRace,
    refreshHorses: fetchHorses
  };
}