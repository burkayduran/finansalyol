// App state via Context + reducer. Persists to localStorage on every change.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  emptyState,
  loadState,
  newId,
  saveState,
} from "../core/storage";
import type { AppState, Debt, Profile, Strategy } from "../core/types";

type Action =
  | { type: "ADD_DEBT"; debt: Omit<Debt, "id"> }
  | { type: "UPDATE_DEBT"; id: string; patch: Partial<Debt> }
  | { type: "REMOVE_DEBT"; id: string }
  | { type: "SET_PROFILE"; patch: Partial<Profile> }
  | { type: "SET_STRATEGY"; strategy: Strategy }
  | { type: "SET_REMINDER"; debtId: string; dueDay: number }
  | { type: "LOG_PAYMENT"; debtId: string; amount: number }
  | { type: "LOAD"; state: AppState }
  | { type: "RESET" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "ADD_DEBT":
      return { ...state, debts: [...state.debts, { ...action.debt, id: newId() }] };
    case "UPDATE_DEBT":
      return {
        ...state,
        debts: state.debts.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)),
      };
    case "REMOVE_DEBT":
      return { ...state, debts: state.debts.filter((d) => d.id !== action.id) };
    case "SET_PROFILE":
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case "SET_STRATEGY":
      return { ...state, strategy: action.strategy };
    case "SET_REMINDER":
      return {
        ...state,
        reminders: [
          ...state.reminders.filter((r) => r.debtId !== action.debtId),
          { debtId: action.debtId, dueDay: action.dueDay, createdAt: new Date().toISOString() },
        ],
      };
    case "LOG_PAYMENT":
      return {
        ...state,
        payments: [
          ...state.payments,
          { debtId: action.debtId, amount: action.amount, loggedAt: new Date().toISOString() },
        ],
      };
    case "LOAD":
      return action.state;
    case "RESET":
      return structuredClone(emptyState);
    default:
      return state;
  }
}

interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
