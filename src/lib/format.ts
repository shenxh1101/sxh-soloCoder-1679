import type { UserRole, ApplicationStatus, VehicleStatus, DriverStatus, BillAuditStatus, TripStatus, ShiftType, CarType } from '../../shared/types.js';

export const formatMoney = (n: number | null | undefined): string => `¥${Number(n ?? 0).toFixed(2)}`;
export const formatDate = (d: string | Date | null | undefined, fmt = 'YYYY-MM-DD'): string => {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return fmt.replace('YYYY', String(y)).replace('MM', m).replace('DD', day).replace('HH', hh).replace('mm', mm);
};
export const formatDateTime = (d: string | Date | null | undefined): string => formatDate(d, 'YYYY-MM-DD HH:mm');
export const formatDuration = (min: number | null | undefined): string => {
  if (!min) return '-';
  const h = Math.floor(min / 60); const m = min % 60;
  return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
};
export const getInitials = (name: string): string => {
  if (!name) return '?';
  const t = name.trim();
  return t.length <= 2 ? t : t.slice(-2);
};

export const roleLabel: Record<UserRole, string> = {
  admin: '系统管理员', employee: '员工', supervisor: '主管',
  driver: '司机', dispatcher: '调度员', finance: '财务'
};
export const roleColor: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  employee: 'bg-blue-100 text-blue-700',
  supervisor: 'bg-indigo-100 text-indigo-700',
  driver: 'bg-green-100 text-green-700',
  dispatcher: 'bg-amber-100 text-amber-700',
  finance: 'bg-rose-100 text-rose-700',
};
export const applicationStatusLabel: Record<ApplicationStatus, string> = {
  pending: '待派车', pending_approval: '待审批', approved: '审批通过',
  rejected: '已拒绝', dispatched: '已派车', in_progress: '进行中',
  completed: '已完成', cancelled: '已取消',
};
export const applicationStatusColor: Record<ApplicationStatus, string> = {
  pending: 'bg-slate-100 text-slate-700',
  pending_approval: 'bg-warning-500/15 text-warning-600',
  approved: 'bg-accent-500/15 text-accent-600',
  rejected: 'bg-danger-500/15 text-danger-600',
  dispatched: 'bg-primary-100 text-primary-700',
  in_progress: 'bg-accent-100 text-accent-700',
  completed: 'bg-success-500/15 text-success-600',
  cancelled: 'bg-slate-100 text-slate-500',
};
export const vehicleStatusLabel: Record<VehicleStatus, string> = {
  idle: '空闲', in_use: '出车中', maintenance: '保养中', repair: '维修中',
};
export const vehicleStatusColor: Record<VehicleStatus, string> = {
  idle: 'bg-success-500/15 text-success-600',
  in_use: 'bg-accent-100 text-accent-700',
  maintenance: 'bg-warning-500/15 text-warning-600',
  repair: 'bg-danger-500/15 text-danger-600',
};
export const driverStatusLabel: Record<DriverStatus, string> = {
  on_duty: '在岗', off_duty: '休息', leave: '请假', suspended: '暂停',
};
export const driverStatusColor: Record<DriverStatus, string> = {
  on_duty: 'bg-success-500/15 text-success-600',
  off_duty: 'bg-slate-100 text-slate-600',
  leave: 'bg-warning-500/15 text-warning-600',
  suspended: 'bg-danger-500/15 text-danger-600',
};
export const billAuditStatusLabel: Record<BillAuditStatus, string> = {
  pending: '待审核', approved: '已通过', rejected: '已驳回',
};
export const billAuditStatusColor: Record<BillAuditStatus, string> = {
  pending: 'bg-warning-500/15 text-warning-600',
  approved: 'bg-success-500/15 text-success-600',
  rejected: 'bg-danger-500/15 text-danger-600',
};
export const tripStatusLabel: Record<TripStatus, string> = {
  pending: '待出发', departed: '已出发', arrived: '已到达', completed: '已完成', cancelled: '已取消',
};
export const tripStatusColor: Record<TripStatus, string> = {
  pending: 'bg-slate-100 text-slate-600',
  departed: 'bg-accent-100 text-accent-700 animate-pulseRing',
  arrived: 'bg-primary-100 text-primary-700',
  completed: 'bg-success-500/15 text-success-600',
  cancelled: 'bg-slate-100 text-slate-500',
};
export const shiftLabel: Record<ShiftType, string> = {
  morning: '早班', afternoon: '午班', night: '晚班', full: '全天', rest: '休息', leave: '请假',
};
export const shiftColor: Record<ShiftType, string> = {
  morning: 'bg-sky-100 text-sky-700',
  afternoon: 'bg-orange-100 text-orange-700',
  night: 'bg-indigo-100 text-indigo-700',
  full: 'bg-primary-100 text-primary-700',
  rest: 'bg-slate-100 text-slate-500',
  leave: 'bg-warning-500/15 text-warning-600',
};
export const carTypeLabel: Record<CarType, string> = {
  sedan: '普通轿车', suv: 'SUV越野车', van: '商务面包车', business: '豪华商务车',
};
export const carTypeColor: Record<CarType, string> = {
  sedan: 'bg-slate-100 text-slate-700',
  suv: 'bg-emerald-100 text-emerald-700',
  van: 'bg-blue-100 text-blue-700',
  business: 'bg-amber-100 text-amber-700',
};

export const ratingStars = (score: number) => {
  const full = Math.floor(score);
  const half = score - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + '⯨'.repeat(half) + '☆'.repeat(empty);
};

export const maintenanceAlertLevelColor = (l?: string) => {
  if (l === 'danger') return 'bg-danger-500/15 text-danger-600';
  if (l === 'warning') return 'bg-warning-500/15 text-warning-600';
  return 'bg-success-500/15 text-success-600';
};

export const defaultHomeRoute = (role: UserRole): string => {
  const map: Record<UserRole, string> = {
    admin: '/dispatcher/dashboard',
    employee: '/employee/dashboard',
    supervisor: '/supervisor/dashboard',
    driver: '/driver/dashboard',
    dispatcher: '/dispatcher/dashboard',
    finance: '/finance/dashboard',
  };
  return map[role];
};
