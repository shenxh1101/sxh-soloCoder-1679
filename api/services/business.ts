import { getDb } from '../db/index.js';
import type { Application, Vehicle, Driver, MatchSuggestion } from '../../shared/types.js';
import { findAvailableVehicles, findAvailableDrivers, findPricingByType, findBudgetByDept, enrichMaintenanceInfo } from '../repositories/common.js';

export function estimateCost(carType: string, distanceKm: number, durationMin = 60): number {
  const p = findPricingByType(carType);
  if (!p) return 0;
  const base = p.baseCost;
  const mileage = +(p.perKmCost * distanceKm).toFixed(2);
  const time = +(p.perMinuteCost * durationMin).toFixed(2);
  return +(base + mileage + time).toFixed(2);
}

export function calcActualCost(carType: string, mileage: number, durationMin: number): { baseCost: number; mileageCost: number; overtimeCost: number; totalCost: number } {
  const p = findPricingByType(carType);
  if (!p) return { baseCost: 0, mileageCost: 0, overtimeCost: 0, totalCost: 0 };
  const baseCost = +p.baseCost.toFixed(2);
  const mileageCost = +(p.perKmCost * mileage).toFixed(2);
  const overtimeCost = durationMin > 60 ? +(p.perMinuteCost * (durationMin - 60)).toFixed(2) : 0;
  const totalCost = +(baseCost + mileageCost + overtimeCost).toFixed(2);
  return { baseCost, mileageCost, overtimeCost, totalCost };
}

export function matchVehicleDriver(application: Application): MatchSuggestion {
  const vehicles = findAvailableVehicles(application.startTime, application.endTime, application.carTypePreference);
  const drivers = findAvailableDrivers(application.startTime, application.endTime);
  const { passengers, estimatedDistanceKm } = application;

  const vList = vehicles.map((v) => {
    v = enrichMaintenanceInfo(v);
    let score = 50;
    const reasons: string[] = [];
    if (application.carTypePreference && v.carType === application.carTypePreference) {
      score += 25; reasons.push('车型匹配');
    }
    if (v.seatingCapacity >= (passengers || 1)) {
      score += 15; reasons.push(`可容纳${passengers}人`);
    } else {
      score -= 10;
    }
    if (v.maintenanceAlertLevel === 'normal') {
      score += 10; reasons.push('车况良好');
    } else if (v.maintenanceAlertLevel === 'warning') {
      score -= 5;
    } else {
      score -= 30;
    }
    const milRatio = (estimatedDistanceKm || 50) / (v.currentMileage + 1);
    score += Math.min(10, Math.floor(milRatio * 100));
    return { vehicle: v, score: Math.min(100, Math.max(0, score)), reason: reasons.join('、') || '综合推荐' };
  }).sort((a, b) => b.score - a.score);

  const dList = drivers.map((d) => {
    let score = 50;
    const reasons: string[] = [];
    score += Math.floor(d.avgRating * 6); reasons.push(`评分${d.avgRating}星`);
    score += Math.min(15, Math.floor(d.totalTrips / 30));
    if (d.status === 'on_duty') { score += 10; reasons.push('在岗'); }
    return { driver: d, score: Math.min(100, Math.max(0, score)), reason: reasons.join('、') || '综合推荐' };
  }).sort((a, b) => b.score - a.score);

  return { vehicles: vList.slice(0, 5), drivers: dList.slice(0, 5) };
}

export function validateMileage(
  odometerStart: number,
  odometerEnd: number,
  actualDeparture: string,
  actualArrival: string,
  estimatedDistance?: number | null
): { valid: boolean; anomaly: boolean; message?: string } {
  if (odometerEnd <= odometerStart) {
    return { valid: false, anomaly: false, message: '结束里程必须大于起始里程' };
  }
  const mileage = odometerEnd - odometerStart;
  const dep = new Date(actualDeparture).getTime();
  const arr = new Date(actualArrival).getTime();
  const durationH = Math.max(0.1, (arr - dep) / 3600000);
  const avgSpeed = mileage / durationH;

  if (avgSpeed < 5) {
    return { valid: true, anomaly: true, message: '平均时速过低（<5km/h），请确认里程或联系调度员' };
  }
  if (avgSpeed > 120) {
    return { valid: true, anomaly: true, message: '平均时速过高（>120km/h），请确认里程或联系调度员' };
  }
  if (estimatedDistance && mileage > estimatedDistance * 2.5) {
    return { valid: true, anomaly: true, message: `实际里程（${mileage}km）远超预估（${estimatedDistance}km），请确认` };
  }
  return { valid: true, anomaly: false };
}

export function checkBudget(departmentId: number, estimatedCost: number): { within: boolean; remaining: number; overAmount: number; threshold: number; usedPercent: number } {
  const budget = findBudgetByDept(departmentId);
  if (!budget) return { within: true, remaining: 0, overAmount: 0, threshold: 80, usedPercent: 0 };
  const remaining = (budget.remainingBudget ?? 0);
  const overAmount = Math.max(0, +(estimatedCost - remaining).toFixed(2));
  const usedPercent = +(((budget.usedBudget + estimatedCost) / budget.monthlyBudget) * 100).toFixed(2);
  const within = estimatedCost <= remaining;
  return { within, remaining, overAmount, threshold: budget.alertThreshold, usedPercent };
}

export function genBillNo(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900 + 100);
  return `BILL${y}${m}${day}${rand}`;
}

export function genQrCode(applicationId: number): string {
  return `QR-APP${String(applicationId).padStart(6, '0')}-${Date.now().toString(36).toUpperCase()}`;
}

export function getMaintenanceAlertVehicles(): Array<{
  vehicle: Vehicle; currentMileage: number; nextMaintenanceMileage: number;
  distanceToMaintenance: number; alertLevel: 'normal' | 'warning' | 'danger'; lastMaintenanceDate: string | null;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT v.*,
      v.plate_number as plateNumber, v.seating_capacity as seatingCapacity,
      v.car_type as carType, v.current_mileage as currentMileage,
      v.maintenance_interval as maintenanceInterval,
      v.last_maintenance_mileage as lastMaintenanceMileage,
      v.insurance_expiry as insuranceExpiry,
      v.annual_inspection_expiry as annualInspectionExpiry,
      (v.last_maintenance_mileage + v.maintenance_interval) as nextMaintenanceMileage,
      (v.last_maintenance_mileage + v.maintenance_interval - v.current_mileage) as distanceToMaintenance,
      (SELECT MAX(maintenance_date) FROM maintenance_records mr WHERE mr.vehicle_id = v.id) as lastMaintenanceDate
    FROM vehicles v
    WHERE v.status != 'maintenance'
    AND (v.last_maintenance_mileage + v.maintenance_interval - v.current_mileage) <= 1500
    ORDER BY distanceToMaintenance ASC
  `).all() as Array<Vehicle & { nextMaintenanceMileage: number; distanceToMaintenance: number; lastMaintenanceDate: string | null }>;

  return rows.map((r) => {
    const v: Vehicle = r;
    let alertLevel: 'normal' | 'warning' | 'danger' = 'normal';
    if (r.distanceToMaintenance <= 0) alertLevel = 'danger';
    else if (r.distanceToMaintenance <= 500) alertLevel = 'warning';
    return { vehicle: v, currentMileage: r.currentMileage, nextMaintenanceMileage: r.nextMaintenanceMileage, distanceToMaintenance: r.distanceToMaintenance, alertLevel, lastMaintenanceDate: r.lastMaintenanceDate };
  });
}
