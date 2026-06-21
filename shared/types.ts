export type UserRole = 'admin' | 'employee' | 'supervisor' | 'driver' | 'dispatcher' | 'finance';

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  departmentId: number | null;
  phone: string | null;
  createdAt: string;
}

export interface Department {
  id: number;
  name: string;
  supervisorId: number | null;
}

export interface Budget {
  id: number;
  departmentId: number;
  monthlyBudget: number;
  currentMonth: string;
  usedBudget: number;
  alertThreshold: number;
  remainingBudget?: number;
  usagePercent?: number;
}

export type CarType = 'sedan' | 'suv' | 'van' | 'business';

export type VehicleStatus = 'idle' | 'in_use' | 'maintenance' | 'repair';

export interface Vehicle {
  id: number;
  plateNumber: string;
  brand: string;
  model: string;
  carType: CarType;
  seatingCapacity: number;
  currentMileage: number;
  maintenanceInterval: number;
  lastMaintenanceMileage: number;
  status: VehicleStatus;
  insuranceExpiry: string | null;
  annualInspectionExpiry: string | null;
  purchasePrice?: number | null;
  distanceToMaintenance?: number;
  maintenanceAlertLevel?: 'normal' | 'warning' | 'danger';
}

export type DriverStatus = 'on_duty' | 'off_duty' | 'leave' | 'suspended';

export interface Driver {
  id: number;
  userId: number | null;
  name: string;
  phone: string;
  licenseNumber: string;
  licenseType: string;
  licenseExpiry: string;
  hireDate: string;
  avgRating: number;
  totalTrips: number;
  status: DriverStatus;
}

export type ApplicationStatus = 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';

export interface Application {
  id: number;
  applicantId: number;
  departmentId: number;
  origin: string;
  destination: string;
  estimatedDistanceKm: number | null;
  startTime: string;
  endTime: string;
  passengers: number;
  carTypePreference: CarType | null;
  reason: string;
  status: ApplicationStatus;
  rejectionReason: string | null;
  createdAt: string;
  applicantName?: string;
  departmentName?: string;
  vehicle?: Vehicle;
  driver?: Driver;
  trip?: Trip;
  approval?: Approval;
  dispatch?: Dispatch;
  estimatedCost?: number;
  bill?: Bill;
}

export type ApprovalDecision = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: number;
  applicationId: number;
  supervisorId: number;
  estimatedCost: number;
  remainingBudget: number;
  overAmount: number;
  decision: ApprovalDecision | null;
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
  application?: Application;
  supervisorName?: string;
}

export type DispatchStatus = 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export interface Dispatch {
  id: number;
  applicationId: number;
  vehicleId: number;
  driverId: number;
  estimatedCost: number;
  estimatedMileage: number | null;
  matchScore: number | null;
  qrCode: string | null;
  status: DispatchStatus;
  createdAt: string;
  vehicle?: Vehicle;
  driver?: Driver;
  application?: Application;
  trip?: Trip;
}

export type TripStatus = 'pending' | 'departed' | 'arrived' | 'completed' | 'cancelled';

export interface Trip {
  id: number;
  dispatchId: number;
  odometerStart: number | null;
  odometerEnd: number | null;
  actualDeparture: string | null;
  actualArrival: string | null;
  actualDurationMin: number | null;
  actualMileage: number | null;
  mileageAnomaly: number;
  actualCost: number | null;
  status: TripStatus;
  dispatch?: Dispatch;
  rating?: Rating;
}

export interface Rating {
  id: number;
  tripId: number;
  raterId: number;
  punctuality: number;
  safety: number;
  service: number;
  vehicleCondition: number;
  overallScore: number;
  comment: string | null;
  createdAt: string;
}

export type BillAuditStatus = 'pending' | 'approved' | 'rejected';

export interface Bill {
  id: number;
  billNo: string;
  tripId: number;
  departmentId: number;
  applicantId: number;
  baseCost: number;
  mileageCost: number;
  overtimeCost: number;
  totalCost: number;
  auditStatus: BillAuditStatus;
  auditorId: number | null;
  auditComment: string | null;
  auditedAt: string | null;
  createdAt: string;
  applicantName?: string;
  departmentName?: string;
  trip?: Trip;
  actualMileage?: number | null;
  actualDurationMin?: number | null;
  plateNumber?: string | null;
  carType?: string | null;
}

export type MaintenanceType = 'routine' | 'repair' | 'inspection' | 'other';

export interface MaintenanceRecord {
  id: number;
  vehicleId: number;
  type: MaintenanceType;
  cost: number;
  description: string;
  mileageAtService: number;
  nextMaintenanceMileage: number | null;
  maintenanceDate: string;
  createdAt: string;
  vehicle?: Vehicle;
  plateNumber?: string;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  content: string;
  relatedType: string | null;
  relatedId: number | null;
  isRead: number;
  createdAt: string;
}

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'full' | 'rest' | 'leave';
export type ScheduleStatus = 'active' | 'cancelled' | 'changed';

export interface Schedule {
  id: number;
  driverId: number;
  scheduleDate: string;
  shiftType: ShiftType;
  status: ScheduleStatus;
  remark: string | null;
  driver?: Driver;
}

export interface CarTypePricing {
  id: number;
  carType: CarType;
  baseCost: number;
  perKmCost: number;
  perMinuteCost: number;
  description: string | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface LoginResponse {
  token: string;
  user: User;
  department?: Department;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  size: number;
}

export interface MatchSuggestion {
  vehicles: Array<{ vehicle: Vehicle; score: number; reason: string; conflicts?: string[]; conflict?: string }>;
  drivers: Array<{ driver: Driver; score: number; reason: string; conflicts?: string[]; conflict?: string }>;
}

export interface DriverTask {
  tripId: number;
  dispatchId: number;
  applicationId: number;
  qrCode: string | null;
  origin: string;
  destination: string;
  startTime: string;
  endTime: string;
  passengers: number;
  estimatedDistance: number;
  estimatedCost: number;
  applicantName: string;
  applicantPhone: string | null;
  vehiclePlateNumber: string;
  vehicleBrand: string;
  vehicleModel: string;
  status: TripStatus;
  odometerStart: number | null;
  odometerEnd: number | null;
  actualDeparture: string | null;
  actualArrival: string | null;
  actualMileage: number | null;
  actualDurationMin: number | null;
  actualCost: number | null;
  mileageAnomaly: number;
  baseCost: number | null;
  mileageCost: number | null;
  overtimeCost: number | null;
}

export interface StatisticsData {
  label: string;
  value: number;
  color?: string;
}

export interface MaintenanceAlert {
  vehicle: Vehicle;
  currentMileage: number;
  nextMaintenanceMileage: number;
  distanceToMaintenance: number;
  alertLevel: 'normal' | 'warning' | 'danger';
  lastMaintenanceDate: string | null;
}
