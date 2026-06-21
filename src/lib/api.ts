import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE || '/api';

const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res.data,
  (err: AxiosError<{ error?: { code: string; message: string } }>) => {
    const data = err.response?.data;
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (location.pathname !== '/login') location.href = '/login';
    }
    const msg = data?.error?.message || err.message || '请求失败';
    return Promise.reject({ code: data?.error?.code || 'NETWORK_ERROR', message: msg, status: err.response?.status });
  }
);

export interface ApiRequestConfig extends AxiosRequestConfig {}

export function get<T = unknown>(url: string, params?: Record<string, unknown>, config?: ApiRequestConfig): Promise<T> {
  return http.get(url, { params, ...config });
}
export function post<T = unknown>(url: string, data?: unknown, config?: ApiRequestConfig): Promise<T> {
  return http.post(url, data, config);
}
export function put<T = unknown>(url: string, data?: unknown, config?: ApiRequestConfig): Promise<T> {
  return http.put(url, data, config);
}
export function del<T = unknown>(url: string, config?: ApiRequestConfig): Promise<T> {
  return http.delete(url, config);
}

export default http;

import type {
  User, LoginResponse, Application, Approval, Vehicle, Driver,
  Dispatch, Trip, Rating, Bill, Budget, Department, MaintenanceRecord,
  Notification, Schedule, DriverTask, MatchSuggestion, MaintenanceAlert,
  StatisticsData, PaginatedResponse
} from '../../shared/types.js';

export const api = {
  auth: {
    login: (data: { username: string; password: string; role: User['role'] }) => post<LoginResponse>('/auth/login', data),
    profile: () => get<{ user: User }>('/auth/profile'),
  },
  dashboard: { summary: () => get<Record<string, unknown>>('/dashboard/summary') },
  applications: {
    list: (params: Record<string, unknown> = {}) => get<PaginatedResponse<Application>>('/applications', params),
    detail: (id: number) => get<Application>(`/applications/${id}`),
    create: (data: Record<string, unknown>) => post<{ id: number; needApproval: boolean; estimatedCost: number }>('/applications', data),
  },
  approvals: {
    list: (params?: Record<string, unknown>) => get<Approval[]>('/approvals', params),
    decide: (id: number, data: { approved: boolean; comment?: string }) => post(`/approvals/${id}/decision`, data),
  },
  dispatch: {
    pending: () => get<Application[]>('/dispatch/pending-applications'),
    suggest: (appId: number) => get<MatchSuggestion>(`/dispatch/suggest/${appId}`),
    assign: (appId: number, data: { vehicleId: number; driverId: number }) => post(`/dispatch/assign/${appId}`, data),
  },
  driver: {
    todayTasks: () => get<DriverTask[]>('/driver/tasks/today'),
    trips: (params?: Record<string, unknown>) => get<PaginatedResponse<Trip>>('/driver/trips', params),
    depart: (tripId: number, odometerStart: number) => post<{ success: boolean; time: string }>(`/driver/trips/${tripId}/depart`, { odometerStart }),
    arrive: (tripId: number, odometerEnd: number) => post<{ success: boolean; anomaly: boolean; anomalyMessage?: string; cost: { mileage: number; durationMin: number; totalCost: number } }>(`/driver/trips/${tripId}/arrive`, { odometerEnd }),
  },
  schedules: { list: (params?: Record<string, unknown>) => get<Schedule[]>('/schedules', params) },
  ratings: {
    create: (data: Record<string, unknown>) => post<{ success: boolean; overallScore: number }>('/ratings', data),
    getByTrip: (tripId: number) => get<Rating | null>(`/ratings/trip/${tripId}`),
  },
  vehicles: {
    list: (params?: Record<string, unknown>) => get<Vehicle[]>('/vehicles', params),
    create: (data: Record<string, unknown>) => post('/vehicles', data),
    update: (id: number, data: Record<string, unknown>) => put(`/vehicles/${id}`, data),
    remove: (id: number) => del(`/vehicles/${id}`),
  },
  drivers: {
    list: (params?: Record<string, unknown>) => get<Driver[]>('/drivers', params),
    create: (data: Record<string, unknown>) => post('/drivers', data),
  },
  maintenance: {
    alerts: () => get<MaintenanceAlert[]>('/maintenance/alerts'),
    records: (params?: Record<string, unknown>) => get<MaintenanceRecord[]>('/maintenance/records', params),
    createRecord: (data: Record<string, unknown>) => post('/maintenance/records', data),
  },
  finance: {
    bills: (params?: Record<string, unknown>) => get<PaginatedResponse<Bill> & { kpi?: Record<string, number> }>('/finance/bills', params),
    billsSummary: (params?: Record<string, unknown>) => get<{ list: Array<Record<string, unknown>>; kpi?: Record<string, number> }>('/finance/bills/summary', params),
    budgetAnalysis: (params?: Record<string, unknown>) => get<{ list: Array<Record<string, unknown>>; kpi: Record<string, number> }>('/finance/budget-analysis', params),
    audit: (id: number, data: { approved: boolean; comment?: string }) => post(`/finance/bills/${id}/audit`, data),
    statistics: (params?: Record<string, unknown>) => get<{ data: Array<{ label: string; value: number; color?: string }>; summary: { totalBills: number; totalCost: number; avgCost: number } }>('/finance/statistics', params),
  },
  budgets: {
    get: (deptId: number) => get<Budget & { departmentName?: string } | null>(`/budgets/${deptId}`),
    update: (deptId: number, data: Record<string, unknown>) => put(`/budgets/${deptId}`, data),
  },
  departments: { list: () => get<Department[]>('/departments') },
  notifications: {
    list: (params?: Record<string, unknown>) => get<{ list: Notification[]; unreadCount: number }>('/notifications', params),
    read: (id: number) => post(`/notifications/${id}/read`),
    readAll: () => post('/notifications/read-all'),
  },
};

export type { User, LoginResponse, Application, Approval, Vehicle, Driver, Dispatch, Trip, Rating, Bill, Budget, Department, MaintenanceRecord, Notification, Schedule, DriverTask, MatchSuggestion, MaintenanceAlert, StatisticsData, PaginatedResponse };
