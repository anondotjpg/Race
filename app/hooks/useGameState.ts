'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Race, Bet, HorseWithOdds, RaceResult } from '../types';

interface GameState {
  currentRace: Race | null;
  horses: HorseWithOdds[];
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
    timeRemaining: 0,
    isRacing: false,
    racePositions: [],
    lastResult: null,
    totalPool: 0,
    loading: true,
    error: null
  });

  const currentRaceRef = useRef<Race | null>(null);
  const raceAnimationTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    currentRaceRef.current = state.currentRace;
  }, [state.currentRace]);

  // Fetch current race
  const fetchRace = useCallback(async () => {
    try {
      const res = await fetch('/api/race');
      const data = await res.json();

      if (data.race) {
        const race = data.race as Race;
        
        setState(prev => {
          // If race changed to 'racing', start animation
          if (race.status === 'racing' && prev.currentRace?.status !== 'racing') {
            // Clear any existing timeout
            if (raceAnimationTimeout.current) {
              clearTimeout(raceAnimationTimeout.current);
            }
            
            // Set isRacing immediately, positions will come from race data
            return {
              ...prev,
              currentRace: race,
              isRacing: true,
              racePositions: race.final_positions || [],
              lastResult: null
            };
          }
          
          // If race is finished
          if (race.status === 'finished' && race.winning_horse_id) {
            return {
              ...prev,
              currentRace: race,
              racePositions: race.final_positions || [],
              // Don't set lastResult here - wait for animation
            };
          }
          
          // Normal betting state
          return {
            ...prev,
            currentRace: race,
            isRacing: race.status === 'racing'
          };
        });

        return race;
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

  // Update countdown timer (display only)
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

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('game-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'races' },
        (payload) => {
          if (payload.new) {
            const newRace = payload.new as Race;
            console.log('Race update:', newRace.status, newRace.id);

            if (newRace.status === 'finished' && newRace.winning_horse_id) {
              // Race finished - start animation then show winner
              setState(prev => ({
                ...prev,
                currentRace: newRace,
                isRacing: true,  // Start animation
                racePositions: newRace.final_positions || [],
                lastResult: null
              }));

              // After 10s animation, show winner
              if (raceAnimationTimeout.current) {
                clearTimeout(raceAnimationTimeout.current);
              }
              
              raceAnimationTimeout.current = setTimeout(() => {
                setState(prev => ({
                  ...prev,
                  isRacing: false,
                  lastResult: {
                    raceId: newRace.id,
                    winningHorseId: newRace.winning_horse_id!,
                    winningHorseName: (newRace as any).winning_horse_name || 'Unknown',
                    positions: newRace.final_positions || [],
                    payouts: []
                  }
                }));
              }, 10000);
            } else if (newRace.status === 'betting') {
              // New race started
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
        console.log('Realtime subscription:', status);
      });

    return () => {
      supabase.removeChannel(channel);
      if (raceAnimationTimeout.current) {
        clearTimeout(raceAnimationTimeout.current);
      }
    };
  }, [fetchHorses]);

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

  // Poll for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRace();
      if (state.currentRace && state.currentRace.status === 'betting') {
        fetchHorses(state.currentRace.id);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [state.currentRace?.id, state.currentRace?.status, fetchRace, fetchHorses]);

  return {
    ...state,
    refreshRace: fetchRace,
    refreshHorses: fetchHorses
  };
}