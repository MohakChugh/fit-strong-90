import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDuration } from '@/lib/utils';

/**
 * Rest timer hook
 *
 * Provides a countdown timer with start, pause, and reset functionality
 * Returns the current time in seconds, control functions, and formatted time string
 */
export function useTimer(initialSeconds: number = 90) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback((newSeconds?: number) => {
    setIsRunning(false);
    setSeconds(newSeconds ?? initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = window.setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, seconds]);

  const formatted = formatDuration(seconds);

  return {
    seconds,
    isRunning,
    start,
    pause,
    reset,
    formatted,
  };
}
