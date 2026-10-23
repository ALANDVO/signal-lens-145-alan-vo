import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL: string
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    })

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        return config
      },
      (error: AxiosError) => Promise.reject(error)
    )

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  async get<T>(url: string, params?: Record<string, unknown>) {
    const response = await this.client.get<T>(url, { params })
    return response.data
  }

  async post<T>(url: string, data?: unknown, config?: { headers?: Record<string, string> }) {
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  async put<T>(url: string, data?: unknown) {
    const response = await this.client.put<T>(url, data)
    return response.data
  }

  async delete<T>(url: string) {
    const response = await this.client.delete<T>(url)
    return response.data
  }

  async upload<T>(url: string, formData: FormData) {
    const response = await this.client.post<T>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  }

  get axiosClient(): AxiosInstance {
    return this.client
  }
}

export const api = new ApiClient()

export interface User {
  id: number
  email: string
  name: string
  role: 'viewer' | 'operator' | 'admin'
}

export interface Signal {
  id: number
  name: string
  sample_rate: number
  duration_seconds: number
  channels: number
  description: string | null
  created_at: string
  analysis_count?: number
  anomaly_count?: number
}

export interface SignalDetail extends Signal {
  data_path: string
  metadata: Record<string, unknown> | null
  analyses: AnalysisSummary[]
}

export interface AnalysisSummary {
  id: number
  method: string
  anomaly_count: number
  status: string
  created_at: string
}

export interface AnalysisDetail {
  id: number
  signal_id: number
  method: string
  results: Record<string, unknown>
  parameters: Record<string, unknown> | null
  anomaly_count: number
  status: string
  created_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  skip: number
  limit: number
}

export const signalsApi = {
  list: (skip = 0, limit = 50) =>
    api.get<PaginatedResponse<Signal>>('/signals', { skip, limit }),

  get: (id: number) =>
    api.get<SignalDetail>(`/signals/${id}`),

  upload: (data: FormData) =>
    api.upload<Signal>('/signals', data),

  delete: (id: number) =>
    api.delete(`/signals/${id}`),

  analyze: (signalId: number, method: string, parameters?: Record<string, unknown>) => {
    const formData = new FormData()
    formData.append('method', method)
    if (parameters) {
      formData.append('parameters', JSON.stringify(parameters))
    }
    return api.post<AnalysisDetail>(`/signals/${signalId}/analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getAnalyses: (signalId: number, skip = 0, limit = 50) =>
    api.get<PaginatedResponse<AnalysisSummary>>(`/signals/${signalId}/analyses`, { skip, limit }),

  export: (analysisId: number, format: 'json' | 'csv' = 'json') => {
    return api.axiosClient.get(`/export/analyses/${analysisId}`, {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json',
    })
  },
}

export const authApi = {
  me: () => api.get<User>('/auth/me'),
  logout: () => api.post('/auth/logout'),
  loginUrl: () => '/api/auth/login',
}