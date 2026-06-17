import { useState, useEffect } from "react";

// Standard pub/sub state creator matching Zustand's interface
function createStore<T>(initialState: T) {
  let state = initialState;
  const listeners = new Set<(state: T) => void>();
  
  const getState = () => state;
  const setState = (nextState: Partial<T> | ((state: T) => Partial<T>)) => {
    const next = typeof nextState === "function" ? (nextState as Function)(state) : nextState;
    state = { ...state, ...next };
    listeners.forEach(listener => listener(state));
  };
  
  const subscribe = (listener: (state: T) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  
  const useStore = <U>(selector: (state: T) => U = (s) => s as any) => {
    const [slice, setSlice] = useState(() => selector(state));
    
    useEffect(() => {
      const listener = (s: T) => setSlice(selector(s));
      const unsubscribe = subscribe(listener);
      // Update state in case it changed between initialization and subscribe
      setSlice(selector(state));
      return () => {
        unsubscribe();
      };
    }, [selector]);
    
    return slice;
  };
  
  return Object.assign(useStore, { getState, setState, subscribe });
}

// 1. Auth Store
interface AuthState {
  user: any | null;
  role: string | null;
  agencyId: string | null;
  agencySlug: string | null;
}

export const useAuthStore = createStore<AuthState>({
  user: null,
  role: null,
  agencyId: null,
  agencySlug: null,
});

// 2. Exam Store
interface ExamState {
  activeExam: any | null;
  activeExamId: string | null;
}

export const useExamStore = createStore<ExamState>({
  activeExam: null,
  activeExamId: null,
});

// 3. Realtime Security Alert Store
interface Alert {
  id: string;
  event_type: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  created_at: string;
}

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
}

export const useAlertStore = createStore<AlertState>({
  alerts: [],
  unreadCount: 0,
});

// Helper to push a new alert (can be connected to Supabase Realtime later)
export const addRealtimeAlert = (alert: Alert) => {
  const current = useAlertStore.getState();
  useAlertStore.setState({
    alerts: [alert, ...current.alerts].slice(0, 100), // Keep last 100 alerts
    unreadCount: current.unreadCount + 1
  });
};
