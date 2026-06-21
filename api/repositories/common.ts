import { getDb } from '../db/index.js';
import type { Vehicle, Driver, Application, Dispatch, Trip, Budget, CarTypePricing } from '../../shared/types.js';

export function findPricingByType(carType: string): CarTypePricing | undefined {
  return getDb().prepare(`
    SELECT id, car_type as carType, base_cost as baseCost, per_km_cost as perKmCost,
           per_minute_cost as perMinuteCost, description
    FROM car_type_pricing WHERE car_type = ?
  `).get(carType) as CarTypePricing | undefined;
}

export function findBudgetByDept(departmentId: number): Budget | undefined {
  const row = getDb().prepare(`
    SELECT id, department_id as departmentId, monthly_budget as monthlyBudget,
           current_month as currentMonth, used_budget as usedBudget, alert_threshold as alertThreshold
    FROM budgets WHERE department_id = ?
  `).get(departmentId) as Budget | undefined;
  if (row) {
    row.remainingBudget = +(row.monthlyBudget - row.usedBudget).toFixed(2);
    row.usagePercent = +((row.usedBudget / row.monthlyBudget) * 100).toFixed(2);
  }
  return row;
}

export function findAvailableVehicles(startTime: string, endTime: string, carTypePreference?: string | null): Vehicle[] {
  const db = getDb();
  const params: unknown[] = [];
  let carTypeSql = '';
  if (carTypePreference) {
    carTypeSql = 'AND v.car_type = ?';
    params.push(carTypePreference);
  }
  params.push(startTime, endTime);
  return db.prepare(`
    SELECT v.*,
      v.current_mileage as currentMileage,
      v.maintenance_interval as maintenanceInterval,
      v.last_maintenance_mileage as lastMaintenanceMileage,
      v.plate_number as plateNumber,
      v.seating_capacity as seatingCapacity,
      v.car_type as carType,
      v.insurance_expiry as insuranceExpiry,
      v.annual_inspection_expiry as annualInspectionExpiry,
      (v.last_maintenance_mileage + v.maintenance_interval - v.current_mileage) as distanceToMaintenance
    FROM vehicles v
    WHERE v.status = 'idle'
    ${carTypeSql}
    AND v.id NOT IN (
      SELECT d.vehicle_id FROM dispatches d
      JOIN applications a ON d.application_id = a.id
      WHERE d.status IN ('assigned','in_progress')
      AND NOT (a.end_time <= ? OR a.start_time >= ?)
    )
    ORDER BY v.current_mileage ASC
  `).all(...params) as Vehicle[];
}

export function findAvailableDrivers(startTime: string, endTime: string): Driver[] {
  const db = getDb();
  const startDate = startTime.slice(0, 10);
  return db.prepare(`
    SELECT d.*,
      d.user_id as userId,
      d.license_number as licenseNumber,
      d.license_type as licenseType,
      d.license_expiry as licenseExpiry,
      d.hire_date as hireDate,
      d.avg_rating as avgRating,
      d.total_trips as totalTrips
    FROM drivers d
    WHERE d.status = 'on_duty'
    AND d.id NOT IN (
      SELECT dp.driver_id FROM dispatches dp
      JOIN applications a ON dp.application_id = a.id
      WHERE dp.status IN ('assigned','in_progress')
      AND NOT (a.end_time <= ? OR a.start_time >= ?)
    )
    AND EXISTS (
      SELECT 1 FROM schedules s
      WHERE s.driver_id = d.id AND s.schedule_date = ?
      AND s.shift_type IN ('morning','afternoon','night','full') AND s.status = 'active'
    )
    ORDER BY d.avg_rating DESC, d.total_trips DESC
  `).all(startTime, endTime, startDate) as Driver[];
}

export function checkUserTimeConflict(userId: number, startTime: string, endTime: string, excludeAppId?: number): boolean {
  const db = getDb();
  let sql = `
    SELECT COUNT(*) as cnt FROM applications
    WHERE applicant_id = ? AND status NOT IN ('rejected','cancelled','completed')
    AND NOT (end_time <= ? OR start_time >= ?)
  `;
  const params: unknown[] = [userId, startTime, endTime];
  if (excludeAppId) {
    sql += ' AND id != ?';
    params.push(excludeAppId);
  }
  const row = db.prepare(sql).get(...params) as { cnt: number };
  return row.cnt > 0;
}

export function findVehicleById(id: number): Vehicle | undefined {
  return getDb().prepare(`
    SELECT *, plate_number as plateNumber, seating_capacity as seatingCapacity,
      car_type as carType, current_mileage as currentMileage,
      maintenance_interval as maintenanceInterval,
      last_maintenance_mileage as lastMaintenanceMileage,
      insurance_expiry as insuranceExpiry,
      annual_inspection_expiry as annualInspectionExpiry
    FROM vehicles WHERE id = ?
  `).get(id) as Vehicle | undefined;
}

export function findDriverById(id: number): Driver | undefined {
  return getDb().prepare(`
    SELECT *, user_id as userId, license_number as licenseNumber,
      license_type as licenseType, license_expiry as licenseExpiry,
      hire_date as hireDate, avg_rating as avgRating, total_trips as totalTrips
    FROM drivers WHERE id = ?
  `).get(id) as Driver | undefined;
}

export function findApplicationById(id: number): Application | undefined {
  return getDb().prepare(`
    SELECT *, applicant_id as applicantId, department_id as departmentId,
      estimated_distance_km as estimatedDistanceKm, start_time as startTime,
      end_time as endTime, passengers, car_type_preference as carTypePreference,
      rejection_reason as rejectionReason, created_at as createdAt
    FROM applications WHERE id = ?
  `).get(id) as Application | undefined;
}

export function findDispatchByApplicationId(appId: number): Dispatch | undefined {
  return getDb().prepare(`
    SELECT *, application_id as applicationId, vehicle_id as vehicleId,
      driver_id as driverId, estimated_cost as estimatedCost,
      estimated_mileage as estimatedMileage, match_score as matchScore,
      qr_code as qrCode, created_at as createdAt
    FROM dispatches WHERE application_id = ?
  `).get(appId) as Dispatch | undefined;
}

export function findTripByDispatchId(dispatchId: number): Trip | undefined {
  return getDb().prepare(`
    SELECT *, dispatch_id as dispatchId, odometer_start as odometerStart,
      odometer_end as odometerEnd, actual_departure as actualDeparture,
      actual_arrival as actualArrival, actual_duration_min as actualDurationMin,
      actual_mileage as actualMileage, mileage_anomaly as mileageAnomaly,
      actual_cost as actualCost
    FROM trips WHERE dispatch_id = ?
  `).get(dispatchId) as Trip | undefined;
}

export function enrichMaintenanceInfo(v: Vehicle): Vehicle {
  const nextMil = v.lastMaintenanceMileage + v.maintenanceInterval;
  v.distanceToMaintenance = nextMil - v.currentMileage;
  if (v.distanceToMaintenance <= 0) v.maintenanceAlertLevel = 'danger';
  else if (v.distanceToMaintenance <= 1000) v.maintenanceAlertLevel = 'warning';
  else v.maintenanceAlertLevel = 'normal';
  return v;
}
