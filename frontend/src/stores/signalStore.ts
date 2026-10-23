import { create } from 'zustand'
import { Signal, SignalDetail, AnalysisSummary, AnalysisDetail } from '../api/client'

interface SignalState {
  signals: Signal[]
  currentSignal: SignalDetail | null
  analyses: AnalysisSummary[]
  currentAnalysis: AnalysisDetail | null
  pagination: { total: number; skip: number; limit: number }
  isLoading: boolean
  error: string | null
  setSignals: (signals: Signal[], pagination: { total: number; skip: number; limit: number }) => void
  setCurrentSignal: (signal: SignalDetail | null) => void
  setAnalyses: (analyses: AnalysisSummary[], pagination: { total: number; skip: number; limit: number }) => void
  setCurrentAnalysis: (analysis: AnalysisDetail | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  addSignal: (signal: Signal) => void
  removeSignal: (id: number) => void
}

export const useSignalStore = create<SignalState>((set) => ({
  signals: [],
  currentSignal: null,
  analyses: [],
  currentAnalysis: null,
  pagination: { total: 0, skip: 0, limit: 50 },
  isLoading: false,
  error: null,
  setSignals: (signals, pagination) => set({ signals, pagination, isLoading: false, error: null }),
  setCurrentSignal: (signal) => set({ currentSignal: signal, isLoading: false, error: null }),
  setAnalyses: (analyses, pagination) => set({ analyses, pagination, isLoading: false, error: null }),
  setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  addSignal: (signal) => set((state) => ({ signals: [signal, ...state.signals], pagination: { ...state.pagination, total: state.pagination.total + 1 } })),
  removeSignal: (id) => set((state) => ({ signals: state.signals.filter((s) => s.id !== id), pagination: { ...state.pagination, total: state.pagination.total - 1 } })),
}))