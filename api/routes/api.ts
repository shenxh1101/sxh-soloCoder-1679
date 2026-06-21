import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import type { UserRole, Application } from '../../shared/types.js';
import {
  estimateCost, matchVehicleDriver, validateMileage, checkBudget,
  calcActualCost, genBillNo, genQrCode, getMaintenanceAlertVehicles
} from '../services/business.js';
import {
  checkUserTimeConflict, findApplicationById, findDispatchByApplicationId,
  findTripByDispatchId, findVehicleById, findDriverById, enrichMaintenanceInfo
} from '../repositories/common.js';
import { pushNotification } from '../services/notification.js';

const json = (o: unknown) => o;

export function createApiRouter(): Router {
  const router = Router();
  const db = getDb();

  const runCUD = (stmtReturn: Database.RunResult, successData?: unknown) => {
    if (stmtReturn.changes === 0) {
      throw { status: 400, code: 'NO_CHANGES', message: '操作未产生变化' };
    }
    return successData ?? { success: true, id: stmtReturn.lastInsertRowid };
  };

  // ==================== 用车申请模块 ====================
  router.post('/applications', authMiddleware(['employee', 'admin']), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      const body = req.body as {
        origin: string; destination: string; startTime: string; endTime: string;
        passengers: number; carTypePreference?: string; reason: string; estimatedDistanceKm?: number;
      };
      const { origin, destination, startTime, endTime, passengers, reason } = body;
      if (!origin || !destination || !startTime || !endTime || !passengers || !reason) {
        return next({ status: 400, code: 'INVALID_PARAMS', message: '请填写完整的用车信息' });
      }
      if (new Date(startTime).getTime() <= Date.now() + 5 * 60 * 1000) {
        return next({ status: 400, code: 'INVALID_TIME', message: '用车开始时间必须晚于当前时间5分钟以上' });
      }
      if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
        return next({ status: 400, code: 'INVALID_TIME_RANGE', message: '结束时间必须晚于开始时间' });
      }
      if (passengers < 1) return next({ status: 400, code: 'INVALID_PASSENGERS', message: '乘车人数至少为1人' });
      if (checkUserTimeConflict(u.id, startTime, endTime)) {
        return next({ status: 400, code: 'TIME_CONFLICT', message: '该时段您已有其他用车申请，请调整时间' });
      }

      const deptId = u.departmentId!;
      const carPref = body.carTypePreference || null;
      const estDist = body.estimatedDistanceKm ?? 30;
      const estCost = estimateCost(carPref || 'sedan', estDist, 60);

      const budgetCheck = checkBudget(deptId, estCost);
      const needApproval = !budgetCheck.within || budgetCheck.usedPercent >= budgetCheck.threshold;

      const tx = db.transaction(() => {
        const info = db.prepare(`
          INSERT INTO applications (applicant_id, department_id, origin, destination, estimated_distance_km,
            start_time, end_time, passengers, car_type_preference, reason, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          u.id, deptId, origin, destination, estDist, startTime, endTime, passengers, carPref, reason,
          needApproval ? 'pending_approval' : 'pending'
        );
        const appId = info.lastInsertRowid as number;

        if (needApproval) {
          const supervisor = db.prepare('SELECT supervisor_id as sid FROM departments WHERE id = ?').get(deptId) as { sid: number | null } | undefined;
          const supId = supervisor?.sid || (db.prepare("SELECT id FROM users WHERE role = 'supervisor' AND department_id = ? LIMIT 1").get(deptId) as { id: number } | undefined)?.id || 0;
          if (supId) {
            db.prepare(`
              INSERT INTO approvals (application_id, supervisor_id, estimated_cost, remaining_budget, over_amount, decision, created_at)
              VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
            `).run(appId, supId, estCost, budgetCheck.remaining, budgetCheck.overAmount);
            pushNotification(supId, 'approval', `待审批：${u.name}用车申请`,
              `${u.name}申请${startTime.slice(5, 16)}用车，预估费用¥${estCost}，${budgetCheck.overAmount > 0 ? `超出预算¥${budgetCheck.overAmount}` : `预算使用率${budgetCheck.usedPercent}%`}，请及时审批。`,
              'application', appId);
          }
        }
        return appId;
      });
      const appId = tx();

      if (!needApproval) {
        const dispatchResult = matchAndDispatch(appId);
        res.json(json({ id: appId, needApproval, estimatedCost: estCost, budgetCheck, dispatched: dispatchResult.dispatched, dispatchReason: dispatchResult.reason }));
      } else {
        res.json(json({ id: appId, needApproval, estimatedCost: estCost, budgetCheck }));
      }
    } catch (e) { next(e); }
  });

  function matchAndDispatch(appId: number): { dispatched: boolean; reason?: string } {
    const app = findApplicationById(appId);
    if (!app) return { dispatched: false, reason: '申请不存在' };
    const suggestion = matchVehicleDriver(app);
    if (suggestion.vehicles.length === 0 || suggestion.drivers.length === 0) {
      db.prepare("UPDATE applications SET status = 'pending' WHERE id = ? AND status NOT IN ('dispatched','completed','cancelled')").run(appId);
      const reason = suggestion.vehicles.length === 0 ? '当前时段无空闲车辆' : '当前时段无可用司机';
      pushNotification(app.applicantId, 'system', '派车待分配',
        `您的用车申请暂时无法自动派车（${reason}），已转交调度员手动分配。`,
        'application', appId);
      const dispatchers = db.prepare("SELECT id FROM users WHERE role = 'dispatcher'").all() as { id: number }[];
      dispatchers.forEach(({ id }) => {
        pushNotification(id, 'dispatch', '待手动派车',
          `申请#${appId}自动匹配失败（${reason}），请尽快手动分配。`,
          'application', appId);
      });
      return { dispatched: false, reason };
    }
    const vehicle = suggestion.vehicles[0].vehicle;
    const driver = suggestion.drivers[0].driver;
    const carType = vehicle.carType;
    const estCost = estimateCost(carType, app.estimatedDistanceKm || 30, 60);
    const qrCode = genQrCode(appId);
    const tx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO dispatches (application_id, vehicle_id, driver_id, estimated_cost, estimated_mileage, match_score, qr_code, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'assigned', CURRENT_TIMESTAMP)
      `).run(appId, vehicle.id, driver.id, estCost, app.estimatedDistanceKm, suggestion.vehicles[0].score, qrCode);
      const dispatchId = info.lastInsertRowid as number;
      db.prepare(`INSERT INTO trips (dispatch_id, status) VALUES (?, 'pending')`).run(dispatchId);
      db.prepare("UPDATE applications SET status = 'dispatched' WHERE id = ?").run(appId);
      db.prepare("UPDATE vehicles SET status = 'in_use' WHERE id = ?").run(vehicle.id);
    });
    tx();
    pushNotification(app.applicantId, 'dispatch', '派车成功',
      `您的用车申请已派车：${vehicle.plateNumber} ${vehicle.brand}${vehicle.model}，司机：${driver.name} ${driver.phone}`,
      'application', appId);
    if (driver.userId) {
      pushNotification(driver.userId, 'dispatch', '新派车任务',
        `${app.startTime.slice(5, 16)}  ${app.origin} → ${app.destination}，车辆：${vehicle.plateNumber}`,
        'dispatch', appId);
    }
    return { dispatched: true };
  }

  router.get('/applications', authMiddleware(), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      const { status, page = '1', size = '10' } = req.query as Record<string, string>;
      const pageN = Math.max(1, +page);
      const sizeN = Math.min(100, Math.max(1, +size));

      const where: string[] = [];
      const params: unknown[] = [];
      if (u.role === 'employee') {
        where.push('a.applicant_id = ?'); params.push(u.id);
      } else if (u.role === 'supervisor') {
        where.push('a.department_id = ?'); params.push(u.departmentId!);
      }
      if (status && status !== 'all') {
        where.push('a.status = ?'); params.push(status);
      }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

      const { cnt } = db.prepare(`SELECT COUNT(*) as cnt FROM applications a ${whereSql}`).get(...params) as { cnt: number };
      const list = db.prepare(`
        SELECT a.*,
          a.applicant_id as applicantId, a.department_id as departmentId,
          a.estimated_distance_km as estimatedDistanceKm, a.start_time as startTime,
          a.end_time as endTime, a.car_type_preference as carTypePreference,
          a.rejection_reason as rejectionReason, a.created_at as createdAt,
          u.name as applicantName, d.name as departmentName
        FROM applications a
        LEFT JOIN users u ON a.applicant_id = u.id
        LEFT JOIN departments d ON a.department_id = d.id
        ${whereSql}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, sizeN, (pageN - 1) * sizeN);
      res.json(json({ list, total: cnt, page: pageN, size: sizeN }));
    } catch (e) { next(e); }
  });

  router.get('/applications/:id', authMiddleware(), (req: AuthRequest, res, next) => {
    try {
      const id = +req.params.id;
      const row = db.prepare(`
        SELECT a.*,
          a.applicant_id as applicantId, a.department_id as departmentId,
          a.estimated_distance_km as estimatedDistanceKm, a.start_time as startTime,
          a.end_time as endTime, a.car_type_preference as carTypePreference,
          a.rejection_reason as rejectionReason, a.created_at as createdAt,
          u.name as applicantName, d.name as departmentName
        FROM applications a
        LEFT JOIN users u ON a.applicant_id = u.id
        LEFT JOIN departments d ON a.department_id = d.id
        WHERE a.id = ?
      `).get(id) as Record<string, unknown>;
      if (!row) return next({ status: 404, code: 'NOT_FOUND', message: '申请不存在' });
      const dispatch = findDispatchByApplicationId(id);
      if (dispatch) {
        const v = findVehicleById(dispatch.vehicleId);
        const dr = findDriverById(dispatch.driverId);
        if (v) dispatch.vehicle = enrichMaintenanceInfo(v);
        if (dr) dispatch.driver = dr;
        const trip = findTripByDispatchId(dispatch.id);
        if (trip) dispatch.trip = trip;
        (row as unknown as Record<string, unknown>).dispatch = dispatch;
      }
      const approval = db.prepare(`
        SELECT ap.*, ap.supervisor_id as supervisorId, ap.estimated_cost as estimatedCost,
          ap.remaining_budget as remainingBudget, ap.over_amount as overAmount,
          ap.decided_at as decidedAt, ap.created_at as createdAt, u.name as supervisorName
        FROM approvals ap LEFT JOIN users u ON ap.supervisor_id = u.id WHERE ap.application_id = ?
      `).get(id);
      if (approval) (row as unknown as Record<string, unknown>).approval = approval;
      const bill = db.prepare(`
        SELECT b.*, b.bill_no as billNo, b.trip_id as tripId, b.department_id as departmentId,
          b.applicant_id as applicantId, b.base_cost as baseCost, b.mileage_cost as mileageCost,
          b.overtime_cost as overtimeCost, b.total_cost as totalCost, b.audit_status as auditStatus,
          b.audit_user_id as auditUserId, b.audited_at as auditedAt, b.audit_comment as auditComment,
          b.created_at as createdAt
        FROM bills b WHERE b.trip_id IN (SELECT t.id FROM trips t JOIN dispatches d ON t.dispatch_id = d.id WHERE d.application_id = ?)
        LIMIT 1
      `).get(id);
      if (bill) (row as unknown as Record<string, unknown>).bill = bill;
      res.json(json(row));
    } catch (e) { next(e); }
  });

  // ==================== 审批模块 ====================
  router.get('/approvals', authMiddleware(['supervisor', 'admin']), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      const { status } = req.query as Record<string, string>;
      const where: string[] = ['ap.supervisor_id = ?'];
      const params: unknown[] = [u.id];
      if (status && status !== 'all') {
        where.push('ap.decision = ?'); params.push(status);
      }
      const list = db.prepare(`
        SELECT ap.*, ap.supervisor_id as supervisorId, ap.estimated_cost as estimatedCost,
          ap.remaining_budget as remainingBudget, ap.over_amount as overAmount,
          ap.decided_at as decidedAt, ap.created_at as createdAt,
          a.origin, a.destination, a.start_time as startTime, a.end_time as endTime,
          a.reason, a.status as applicationStatus,
          u.name as applicantName, d.name as departmentName
        FROM approvals ap
        JOIN applications a ON ap.application_id = a.id
        LEFT JOIN users u ON a.applicant_id = u.id
        LEFT JOIN departments d ON a.department_id = d.id
        WHERE ${where.join(' AND ')}
        ORDER BY ap.created_at DESC
      `).all(...params);
      res.json(json(list));
    } catch (e) { next(e); }
  });

  router.post('/approvals/:id/decision', authMiddleware(['supervisor', 'admin']), (req: AuthRequest, res, next) => {
    try {
      const id = +req.params.id;
      const u = req.user!;
      const { approved, comment } = req.body as { approved: boolean; comment?: string };
      const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as { application_id: number; decision: string | null; supervisor_id: number } | undefined;
      if (!approval) return next({ status: 404, code: 'NOT_FOUND', message: '审批记录不存在' });
      if (approval.decision && approval.decision !== 'pending') {
        return next({ status: 409, code: 'ALREADY_PROCESSED', message: '该申请已被处理' });
      }
      if (approval.supervisor_id !== u.id) {
        return next({ status: 403, code: 'PERMISSION_DENIED', message: '无权处理此审批' });
      }
      const decision = approved ? 'approved' : 'rejected';
      const tx = db.transaction(() => {
        db.prepare(`UPDATE approvals SET decision = ?, comment = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .run(decision, comment || '', id);
        const appId = approval.application_id;
        db.prepare(`UPDATE applications SET status = ? WHERE id = ?`)
          .run(approved ? 'approved' : 'rejected', appId);
        if (!approved && comment) {
          db.prepare(`UPDATE applications SET rejection_reason = ? WHERE id = ?`).run(comment, appId);
        }
        if (approved) matchAndDispatch(appId);
        const app = findApplicationById(appId);
        if (app) {
          pushNotification(app.applicantId, 'approval', approved ? '审批通过：用车申请' : '审批未通过：用车申请',
            approved ? '您的用车申请已通过审批，正在安排派车。' : `抱歉，您的用车申请未通过。原因：${comment || '无'}`,
            'application', appId);
        }
      });
      tx();
      res.json(json({ success: true }));
    } catch (e) { next(e); }
  });

  // ==================== 派车中心模块 ====================
  router.get('/dispatch/pending-applications', authMiddleware(['dispatcher', 'admin']), (_req, res, next) => {
    try {
      const rows = db.prepare(`
        SELECT a.*,
          a.applicant_id as applicantId, a.department_id as departmentId,
          a.estimated_distance_km as estimatedDistanceKm, a.start_time as startTime,
          a.end_time as endTime, a.car_type_preference as carTypePreference,
          a.created_at as createdAt, u.name as applicantName, d.name as departmentName,
          a.passengers, a.reason, a.origin, a.destination, a.status
        FROM applications a
        LEFT JOIN users u ON a.applicant_id = u.id
        LEFT JOIN departments d ON a.department_id = d.id
        WHERE a.status IN ('pending','approved')
        ORDER BY a.start_time ASC
      `).all() as Array<Record<string, unknown>>;
      const list = rows.map((row) => {
        const app = row as unknown as Application;
        const suggestion = matchVehicleDriver(app);
        let failReason: string | null = null;
        if (suggestion.vehicles.length === 0 && suggestion.drivers.length === 0) {
          failReason = '无可用车辆及司机';
        } else if (suggestion.vehicles.length === 0) {
          failReason = app.carTypePreference ? `无${app.carTypePreference}可用车辆` : '无空闲车辆';
        } else if (suggestion.drivers.length === 0) {
          failReason = '该时段无司机排班';
        } else if (app.status === 'pending' || app.status === 'approved') {
          failReason = '等待调度员确认';
        }
        return { ...row, autoDispatchFailed: !!failReason, failReason };
      });
      res.json(json(list));
    } catch (e) { next(e); }
  });

  router.get('/dispatch/suggest/:appId', authMiddleware(['dispatcher', 'admin']), (req, res, next) => {
    try {
      const appId = +req.params.appId;
      const app = findApplicationById(appId);
      if (!app) return next({ status: 404, code: 'NOT_FOUND', message: '申请不存在' });
      const suggestion = matchVehicleDriver(app);
      const { startTime, endTime } = app;
      const allVehicles = db.prepare(`SELECT v.*, v.plate_number as plateNumber, v.seating_capacity as seatingCapacity, v.car_type as carType, v.current_mileage as currentMileage, v.maintenance_interval as maintenanceInterval, v.last_maintenance_mileage as lastMaintenanceMileage, v.insurance_expiry as insuranceExpiry, v.annual_inspection_expiry as annualInspectionExpiry FROM vehicles v`).all() as Array<Record<string, unknown>>;
      const allDrivers = db.prepare(`SELECT d.* FROM drivers d`).all() as Array<Record<string, unknown>>;
      const busyVehicles = db.prepare(`
        SELECT DISTINCT d.vehicle_id as id FROM dispatches d JOIN applications a ON d.application_id = a.id
        WHERE d.status IN ('assigned','in_progress') AND a.start_time < ? AND a.end_time > ?
      `).all(endTime, startTime).map((r: { id: number }) => r.id);
      const busyDrivers = db.prepare(`
        SELECT DISTINCT d.driver_id as id FROM dispatches d JOIN applications a ON d.application_id = a.id
        WHERE d.status IN ('assigned','in_progress') AND a.start_time < ? AND a.end_time > ?
      `).all(endTime, startTime).map((r: { id: number }) => r.id);
      const en = (id: number, ids: number[]) => ids.includes(id);
      const enrichedVehicles = suggestion.vehicles.map(({ vehicle, score, reason }) => {
        const conflicts: string[] = [];
        const orig = allVehicles.find((v) => v.id === vehicle.id);
        if (app.carTypePreference && vehicle.carType !== app.carTypePreference) conflicts.push(`车型不匹配：期望${app.carTypePreference}，实际${vehicle.carType}`);
        if (vehicle.seatingCapacity < (app.passengers || 1)) conflicts.push(`座位不足：${vehicle.seatingCapacity}座<${app.passengers}人`);
        if (vehicle.status === 'maintenance' || vehicle.status === 'repair') conflicts.push('车辆处于维修保养状态');
        if (en(vehicle.id, busyVehicles)) conflicts.push('该时段已有派车任务');
        if ((orig?.maintenanceAlertLevel as string) === 'danger') conflicts.push('即将到达保养里程');
        return { vehicle, score, reason, conflicts, conflict: conflicts[0] || '无冲突，自动派车候选' };
      });
      const enrichedDrivers = suggestion.drivers.map(({ driver, score, reason }) => {
        const conflicts: string[] = [];
        if (driver.status !== 'on_duty') conflicts.push(`司机当前${driver.status === 'leave' ? '请假中' : '未在岗'}`);
        if (en(driver.id, busyDrivers)) conflicts.push('该时段已有派车任务');
        void allDrivers;
        return { driver, score, reason, conflicts, conflict: conflicts[0] || '无冲突，自动派车候选' };
      });
      res.json(json({ vehicles: enrichedVehicles, drivers: enrichedDrivers }));
    } catch (e) { next(e); }
  });

  router.post('/dispatch/assign/:appId', authMiddleware(['dispatcher', 'admin']), (req, res, next) => {
    try {
      const appId = +req.params.appId;
      const { vehicleId, driverId } = req.body as { vehicleId: number; driverId: number };
      const app = findApplicationById(appId);
      if (!app) return next({ status: 404, code: 'NOT_FOUND', message: '申请不存在' });
      const v = findVehicleById(vehicleId); const dr = findDriverById(driverId);
      if (!v || v.status !== 'idle') return next({ status: 409, code: 'VEHICLE_BUSY', message: '该车辆当前不可用' });
      if (!dr || dr.status !== 'on_duty') return next({ status: 409, code: 'DRIVER_UNAVAILABLE', message: '该司机当前不可用' });
      const existing = findDispatchByApplicationId(appId);
      if (existing) return next({ status: 409, code: 'ALREADY_DISPATCHED', message: '该申请已派车' });
      const estCost = estimateCost(v.carType, app.estimatedDistanceKm || 30, 60);
      const qrCode = genQrCode(appId);
      const tx = db.transaction(() => {
        const info = db.prepare(`
          INSERT INTO dispatches (application_id, vehicle_id, driver_id, estimated_cost, estimated_mileage, match_score, qr_code, status)
          VALUES (?, ?, ?, ?, ?, 80, ?, 'assigned')
        `).run(appId, vehicleId, driverId, estCost, app.estimatedDistanceKm, qrCode);
        const dispatchId = info.lastInsertRowid as number;
        db.prepare(`INSERT INTO trips (dispatch_id, status) VALUES (?, 'pending')`).run(dispatchId);
        db.prepare("UPDATE applications SET status = 'dispatched' WHERE id = ?").run(appId);
        db.prepare("UPDATE vehicles SET status = 'in_use' WHERE id = ?").run(vehicleId);
      });
      tx();
      pushNotification(app.applicantId, 'dispatch', '派车成功',
        `${v.plateNumber} ${v.brand}${v.model}，司机：${dr.name} ${dr.phone}`, 'application', appId);
      if (dr.userId) pushNotification(dr.userId, 'dispatch', '新派车任务',
        `${app.startTime.slice(5, 16)} ${app.origin}→${app.destination}，车辆：${v.plateNumber}`, 'dispatch', appId);
      res.json(json({ success: true }));
    } catch (e) { next(e); }
  });

  // ==================== 司机任务模块 ====================
  router.get('/driver/tasks/today', authMiddleware(['driver', 'admin']), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      const today = new Date().toISOString().slice(0, 10);
      const driver = db.prepare('SELECT * FROM drivers WHERE user_id = ?').get(u.id) as { id: number } | undefined;
      if (!driver) return next({ status: 404, code: 'NO_DRIVER_PROFILE', message: '未找到司机档案' });
      const list = db.prepare(`
        SELECT
          t.id as tripId, d.id as dispatchId, a.id as applicationId,
          d.qr_code as qrCode, a.origin, a.destination,
          a.start_time as startTime, a.end_time as endTime, a.passengers,
          a.estimated_distance_km as estimatedDistance, d.estimated_cost as estimatedCost,
          u.name as applicantName, u.phone as applicantPhone,
          v.plate_number as vehiclePlateNumber, v.brand as vehicleBrand, v.model as vehicleModel,
          t.status, t.odometer_start as odometerStart, t.odometer_end as odometerEnd,
          t.actual_departure as actualDeparture, t.actual_arrival as actualArrival,
          t.actual_mileage as actualMileage, t.actual_duration_min as actualDurationMin,
          t.actual_cost as actualCost, t.mileage_anomaly as mileageAnomaly,
          b.base_cost as baseCost, b.mileage_cost as mileageCost, b.overtime_cost as overtimeCost
        FROM dispatches d
        JOIN applications a ON d.application_id = a.id
        JOIN trips t ON t.dispatch_id = d.id
        LEFT JOIN users u ON a.applicant_id = u.id
        JOIN vehicles v ON d.vehicle_id = v.id
        LEFT JOIN bills b ON b.trip_id = t.id
        WHERE d.driver_id = ? AND DATE(a.start_time) = ?
        ORDER BY a.start_time ASC
      `).all(driver.id, today);
      res.json(json(list));
    } catch (e) { next(e); }
  });

  router.post('/driver/trips/:tripId/depart', authMiddleware(['driver', 'admin']), (req: AuthRequest, res, next) => {
    try {
      const tripId = +req.params.tripId;
      const { odometerStart } = req.body as { odometerStart: number };
      const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId) as { dispatch_id: number; status: string } | undefined;
      if (!trip) return next({ status: 404, code: 'NOT_FOUND', message: '行程不存在' });
      if (trip.status !== 'pending') return next({ status: 400, code: 'TRIP_NOT_READY', message: '当前状态不可出发' });
      if (typeof odometerStart !== 'number' || odometerStart <= 0) {
        return next({ status: 400, code: 'INVALID_ODO', message: '起始里程不合法' });
      }
      const dispatch = db.prepare('SELECT * FROM dispatches WHERE id = ?').get(trip.dispatch_id) as { vehicle_id: number; application_id: number };
      db.transaction(() => {
        db.prepare(`UPDATE trips SET odometer_start = ?, actual_departure = CURRENT_TIMESTAMP, status = 'departed' WHERE id = ?`)
          .run(odometerStart, tripId);
        db.prepare("UPDATE dispatches SET status = 'in_progress' WHERE id = ?").run(trip.dispatch_id);
        db.prepare("UPDATE applications SET status = 'in_progress' WHERE id = ?").run(dispatch.application_id);
        db.prepare('UPDATE vehicles SET current_mileage = ? WHERE id = ?').run(odometerStart, dispatch.vehicle_id);
      })();
      res.json(json({ success: true, time: new Date().toISOString() }));
    } catch (e) { next(e); }
  });

  router.post('/driver/trips/:tripId/arrive', authMiddleware(['driver', 'admin']), (req: AuthRequest, res, next) => {
    try {
      const tripId = +req.params.tripId;
      const { odometerEnd } = req.body as { odometerEnd: number };
      const tripRow = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId) as {
        id: number; dispatch_id: number; status: string; odometer_start: number | null; actual_departure: string | null;
      } | undefined;
      if (!tripRow) return next({ status: 404, code: 'NOT_FOUND', message: '行程不存在' });
      if (tripRow.status !== 'departed') return next({ status: 400, code: 'NOT_DEPARTED', message: '请先扫码出发' });
      if (typeof odometerEnd !== 'number') return next({ status: 400, code: 'INVALID_ODO', message: '里程不合法' });
      const dispatch = db.prepare(`
        SELECT d.*, v.car_type as carType, a.estimated_distance_km as estDist
        FROM dispatches d JOIN vehicles v ON d.vehicle_id = v.id
        JOIN applications a ON d.application_id = a.id
        WHERE d.id = ?
      `).get(tripRow.dispatch_id) as { id: number; vehicle_id: number; application_id: number; carType: string; estDist: number | null };
      const app = findApplicationById(dispatch.application_id)!;

      const nowStr = new Date().toISOString();
      const validation = validateMileage(
        tripRow.odometer_start!, odometerEnd, tripRow.actual_departure!, nowStr, dispatch.estDist
      );
      if (!validation.valid) {
        return next({ status: 400, code: 'MILEAGE_TOO_LOW', message: validation.message });
      }
      const mileage = odometerEnd - tripRow.odometer_start!;
      const durationMin = Math.max(1, Math.round((new Date(nowStr).getTime() - new Date(tripRow.actual_departure!).getTime()) / 60000));
      const cost = calcActualCost(dispatch.carType, mileage, durationMin);
      const { baseCost, mileageCost, overtimeCost, totalCost } = cost;
      const billNo = genBillNo();
      let anomalyHandled = true;
      if (validation.anomaly) anomalyHandled = false;

      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE trips SET odometer_end = ?, actual_arrival = ?, actual_duration_min = ?,
            actual_mileage = ?, mileage_anomaly = ?, actual_cost = ?, status = 'completed'
          WHERE id = ?
        `).run(odometerEnd, nowStr, durationMin, mileage, validation.anomaly ? 1 : 0, totalCost, tripId);
        db.prepare("UPDATE dispatches SET status = 'completed' WHERE id = ?").run(tripRow.dispatch_id);
        db.prepare("UPDATE applications SET status = 'completed' WHERE id = ?").run(dispatch.application_id);
        db.prepare('UPDATE vehicles SET current_mileage = ?, status = ? WHERE id = ?').run(odometerEnd, 'idle', dispatch.vehicle_id);
        db.prepare(`
          INSERT INTO bills (bill_no, trip_id, department_id, applicant_id, base_cost, mileage_cost, overtime_cost, total_cost, audit_status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
        `).run(billNo, tripId, app.departmentId, app.applicantId, baseCost, mileageCost, overtimeCost, totalCost);
        db.prepare('UPDATE budgets SET used_budget = used_budget + ? WHERE department_id = ?').run(totalCost, app.departmentId);
        const financeUsers = db.prepare("SELECT id FROM users WHERE role = 'finance'").all() as { id: number }[];
        financeUsers.forEach(({ id }) => pushNotification(id, 'bill', '新账单待审核',
          `账单${billNo} ¥${totalCost}，${app.departmentName || ''} ${app.applicantId}，请审核。`, 'bill', tripId));
        if (validation.anomaly) {
          const dispatchers = db.prepare("SELECT id FROM users WHERE role = 'dispatcher'").all() as { id: number }[];
          dispatchers.forEach(({ id }) => pushNotification(id, 'system', '里程异常提醒',
            `${validation.message}，行程ID：${tripId}`, 'trip', tripId));
        }
      });
      tx();
      res.json(json({
        success: true,
        anomaly: validation.anomaly,
        anomalyMessage: validation.message,
        cost: { mileage, durationMin, totalCost }
      }));
      void anomalyHandled;
    } catch (e) { next(e); }
  });

  router.get('/driver/trips', authMiddleware(['driver', 'admin']), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      const { page = '1', size = '10' } = req.query as Record<string, string>;
      const driver = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(u.id) as { id: number } | undefined;
      if (!driver) return res.json({ list: [], total: 0 });
      const pageN = Math.max(1, +page); const sizeN = Math.min(100, +size);
      const { cnt } = db.prepare(`
        SELECT COUNT(*) as cnt FROM dispatches d WHERE d.driver_id = ?
      `).get(driver.id) as { cnt: number };
      const list = db.prepare(`
        SELECT
          t.id as tripId, d.id as dispatchId, a.id as applicationId,
          a.origin, a.destination, a.start_time as startTime, a.end_time as endTime,
          t.actual_mileage as actualMileage, t.actual_duration_min as actualDurationMin,
          t.actual_cost as actualCost, t.status,
          t.actual_departure as actualDeparture, t.actual_arrival as actualArrival,
          v.plate_number as plateNumber, v.brand, v.model
        FROM dispatches d
        JOIN applications a ON d.application_id = a.id
        JOIN trips t ON t.dispatch_id = d.id
        JOIN vehicles v ON d.vehicle_id = v.id
        WHERE d.driver_id = ?
        ORDER BY a.start_time DESC
        LIMIT ? OFFSET ?
      `).all(driver.id, sizeN, (pageN - 1) * sizeN);
      res.json(json({ list, total: cnt, page: pageN, size: sizeN }));
    } catch (e) { next(e); }
  });

  router.get('/schedules', authMiddleware(['driver', 'dispatcher', 'admin']), (req: AuthRequest, res, next) => {
    try {
      const { driverId, month } = req.query as Record<string, string>;
      let uDriverId: number | undefined;
      if (req.user!.role === 'driver') {
        const d = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
        uDriverId = d?.id;
      }
      const targetDriver = driverId ? +driverId : uDriverId;
      const where: string[] = []; const params: unknown[] = [];
      if (targetDriver) { where.push('s.driver_id = ?'); params.push(targetDriver); }
      if (month) { where.push("strftime('%Y-%m', s.schedule_date) = ?"); params.push(month); }
      const list = db.prepare(`
        SELECT s.*, s.driver_id as driverId, s.schedule_date as scheduleDate,
          s.shift_type as shiftType, s.status, dr.name as driverName
        FROM schedules s LEFT JOIN drivers dr ON s.driver_id = dr.id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY s.schedule_date ASC
      `).all(...params);
      res.json(json(list));
    } catch (e) { next(e); }
  });

  // ==================== 评分模块 ====================
  router.post('/ratings', authMiddleware(['employee', 'admin']), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      const { tripId, punctuality, safety, service, vehicleCondition, comment } = req.body as {
        tripId: number; punctuality: number; safety: number; service: number; vehicleCondition: number; comment?: string;
      };
      if (!tripId || ![punctuality, safety, service, vehicleCondition].every((n) => n >= 1 && n <= 5)) {
        return next({ status: 400, code: 'INVALID_PARAMS', message: '请填写完整的评分（每项1-5星）' });
      }
      const existing = db.prepare('SELECT id FROM ratings WHERE trip_id = ?').get(tripId);
      if (existing) return next({ status: 409, code: 'ALREADY_RATED', message: '该行程已评分' });
      const trip = db.prepare(`
        SELECT t.*, d.driver_id as driverId
        FROM trips t JOIN dispatches d ON t.dispatch_id = d.id WHERE t.id = ?
      `).get(tripId) as { id: number; dispatch_id: number; driverId: number } | undefined;
      if (!trip) return next({ status: 404, code: 'NOT_FOUND', message: '行程不存在' });
      const overall = +((punctuality + safety + service + vehicleCondition) / 4).toFixed(2);
      db.transaction(() => {
        db.prepare(`
          INSERT INTO ratings (trip_id, rater_id, punctuality, safety, service, vehicle_condition, overall_score, comment, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(tripId, u.id, punctuality, safety, service, vehicleCondition, overall, comment || '');
        const stats = db.prepare(`
          SELECT COUNT(*) as cnt, AVG(overall_score) as avg
          FROM ratings r JOIN trips t ON r.trip_id = t.id
          JOIN dispatches d ON t.dispatch_id = d.id WHERE d.driver_id = ?
        `).get(trip.driverId) as { cnt: number; avg: number };
        if (stats.cnt > 0) {
          db.prepare('UPDATE drivers SET avg_rating = ?, total_trips = ? WHERE id = ?')
            .run(+stats.avg.toFixed(2), stats.cnt, trip.driverId);
        }
      })();
      res.json(json({ success: true, overallScore: overall }));
    } catch (e) { next(e); }
  });

  router.get('/ratings/trip/:tripId', authMiddleware(), (req, res, next) => {
    try {
      const row = db.prepare(`
        SELECT r.*, r.rater_id as raterId, r.vehicle_condition as vehicleCondition,
          r.overall_score as overallScore, r.created_at as createdAt,
          u.name as raterName
        FROM ratings r LEFT JOIN users u ON r.rater_id = u.id WHERE r.trip_id = ?
      `).get(+req.params.tripId);
      res.json(json(row || null));
    } catch (e) { next(e); }
  });

  // ==================== 车辆管理模块 ====================
  router.get('/vehicles', authMiddleware(), (_req, res, next) => {
    try {
      const { status } = _req.query as Record<string, string>;
      const where = status && status !== 'all' ? 'WHERE status = ?' : '';
      const params = status && status !== 'all' ? [status] : [];
      const rows = db.prepare(`
        SELECT *, plate_number as plateNumber, seating_capacity as seatingCapacity,
          car_type as carType, current_mileage as currentMileage,
          maintenance_interval as maintenanceInterval,
          last_maintenance_mileage as lastMaintenanceMileage,
          insurance_expiry as insuranceExpiry,
          annual_inspection_expiry as annualInspectionExpiry
        FROM vehicles ${where} ORDER BY id ASC
      `).all(...params) as Array<Record<string, unknown>>;
      res.json(json(rows.map((r) => enrichMaintenanceInfo(r as unknown as Parameters<typeof enrichMaintenanceInfo>[0]))));
    } catch (e) { next(e); }
  });

  router.post('/vehicles', authMiddleware(['dispatcher', 'admin']), (req, res, next) => {
    try {
      const b = req.body as Record<string, unknown>;
      const required = ['plateNumber', 'brand', 'model', 'carType', 'seatingCapacity', 'currentMileage', 'maintenanceInterval'];
      for (const k of required) if (!b[k]) return next({ status: 400, code: 'INVALID_PARAMS', message: `缺少字段：${k}` });
      const existing = db.prepare('SELECT id FROM vehicles WHERE plate_number = ?').get(b.plateNumber as string);
      if (existing) return next({ status: 409, code: 'PLATE_EXISTS', message: '车牌号已存在' });
      const info = db.prepare(`
        INSERT INTO vehicles (plate_number, brand, model, car_type, seating_capacity, current_mileage, maintenance_interval,
          last_maintenance_mileage, status, insurance_expiry, annual_inspection_expiry)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        b.plateNumber, b.brand, b.model, b.carType, b.seatingCapacity,
        b.currentMileage, b.maintenanceInterval, b.lastMaintenanceMileage || b.currentMileage,
        b.status || 'idle', b.insuranceExpiry || null, b.annualInspectionExpiry || null
      );
      res.json(json(runCUD(info)));
    } catch (e) { next(e); }
  });

  router.put('/vehicles/:id', authMiddleware(['dispatcher', 'admin']), (req, res, next) => {
    try {
      const id = +req.params.id; const b = req.body as Record<string, unknown>;
      const info = db.prepare(`
        UPDATE vehicles SET
          plate_number = COALESCE(?, plate_number),
          brand = COALESCE(?, brand),
          model = COALESCE(?, model),
          car_type = COALESCE(?, car_type),
          seating_capacity = COALESCE(?, seating_capacity),
          current_mileage = COALESCE(?, current_mileage),
          maintenance_interval = COALESCE(?, maintenance_interval),
          last_maintenance_mileage = COALESCE(?, last_maintenance_mileage),
          status = COALESCE(?, status),
          insurance_expiry = COALESCE(?, insurance_expiry),
          annual_inspection_expiry = COALESCE(?, annual_inspection_expiry)
        WHERE id = ?
      `).run(
        b.plateNumber ?? null, b.brand ?? null, b.model ?? null, b.carType ?? null,
        b.seatingCapacity ?? null, b.currentMileage ?? null, b.maintenanceInterval ?? null,
        b.lastMaintenanceMileage ?? null, b.status ?? null, b.insuranceExpiry ?? null,
        b.annualInspectionExpiry ?? null, id
      );
      res.json(json(runCUD(info)));
    } catch (e) { next(e); }
  });

  router.delete('/vehicles/:id', authMiddleware(['dispatcher', 'admin']), (req, res, next) => {
    try {
      const info = db.prepare('DELETE FROM vehicles WHERE id = ?').run(+req.params.id);
      res.json(json(runCUD(info)));
    } catch (e) { next(e); }
  });

  // ==================== 司机管理模块 ====================
  router.get('/drivers', authMiddleware(), (_req, res, next) => {
    try {
      const { status } = _req.query as Record<string, string>;
      const where = status && status !== 'all' ? 'WHERE status = ?' : '';
      const params = status && status !== 'all' ? [status] : [];
      const rows = db.prepare(`
        SELECT *, user_id as userId, license_number as licenseNumber,
          license_type as licenseType, license_expiry as licenseExpiry,
          hire_date as hireDate, avg_rating as avgRating, total_trips as totalTrips
        FROM drivers ${where} ORDER BY id ASC
      `).all(...params);
      res.json(json(rows));
    } catch (e) { next(e); }
  });

  router.post('/drivers', authMiddleware(['dispatcher', 'admin']), (req, res, next) => {
    try {
      const b = req.body as Record<string, unknown>;
      const required = ['name', 'phone', 'licenseNumber', 'licenseType', 'licenseExpiry', 'hireDate'];
      for (const k of required) if (!b[k]) return next({ status: 400, code: 'INVALID_PARAMS', message: `缺少字段：${k}` });
      const info = db.prepare(`
        INSERT INTO drivers (user_id, name, phone, license_number, license_type, license_expiry, hire_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(b.userId || null, b.name, b.phone, b.licenseNumber, b.licenseType, b.licenseExpiry, b.hireDate, b.status || 'on_duty');
      res.json(json(runCUD(info)));
    } catch (e) { next(e); }
  });

  // ==================== 保养提醒模块 ====================
  router.get('/maintenance/alerts', authMiddleware(['dispatcher', 'admin']), (_req, res, next) => {
    try {
      void _req;
      res.json(json(getMaintenanceAlertVehicles()));
    } catch (e) { next(e); }
  });

  router.get('/maintenance/records', authMiddleware(['dispatcher', 'admin']), (req, res, next) => {
    try {
      const { vehicleId } = req.query as Record<string, string>;
      const where = vehicleId ? 'WHERE m.vehicle_id = ?' : '';
      const params = vehicleId ? [+vehicleId] : [];
      const list = db.prepare(`
        SELECT m.*, m.vehicle_id as vehicleId, m.type, m.cost, m.description,
          m.mileage_at_service as mileageAtService,
          m.next_maintenance_mileage as nextMaintenanceMileage,
          m.maintenance_date as maintenanceDate, m.created_at as createdAt,
          v.plate_number as plateNumber, v.brand, v.model
        FROM maintenance_records m LEFT JOIN vehicles v ON m.vehicle_id = v.id
        ${where} ORDER BY m.maintenance_date DESC
      `).all(...params);
      res.json(json(list));
    } catch (e) { next(e); }
  });

  router.post('/maintenance/records', authMiddleware(['dispatcher', 'admin']), (req, res, next) => {
    try {
      const b = req.body as {
        vehicleId: number; type: string; cost: number; description: string;
        mileageAtService: number; nextMaintenanceMileage?: number; maintenanceDate: string;
      };
      const { vehicleId, type, cost, description, mileageAtService, maintenanceDate } = b;
      if (!vehicleId || !type || !description || !mileageAtService || !maintenanceDate) {
        return next({ status: 400, code: 'INVALID_PARAMS', message: '请填写完整保养信息' });
      }
      const nextMil = b.nextMaintenanceMileage ?? mileageAtService + 5000;
      const info = db.prepare(`
        INSERT INTO maintenance_records (vehicle_id, type, cost, description, mileage_at_service, next_maintenance_mileage, maintenance_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(vehicleId, type, cost ?? 0, description, mileageAtService, nextMil, maintenanceDate);
      db.prepare(`
        UPDATE vehicles SET last_maintenance_mileage = ?, status = 'idle', current_mileage = MAX(current_mileage, ?)
        WHERE id = ?
      `).run(mileageAtService, mileageAtService, vehicleId);
      res.json(json(runCUD(info)));
    } catch (e) { next(e); }
  });

  // ==================== 财务模块 ====================
  router.get('/finance/bills', authMiddleware(['finance', 'admin', 'employee', 'supervisor']), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      const q = req.query as Record<string, string>;
      const { status, departmentId, startDate, endDate, month, carType, page = '1', size = '10' } = q;
      const where: string[] = []; const params: unknown[] = [];
      if (status && status !== 'all') { where.push('b.audit_status = ?'); params.push(status); }
      if (departmentId) { where.push('b.department_id = ?'); params.push(+departmentId); }
      if (u.role === 'employee') { where.push('b.applicant_id = ?'); params.push(u.id); }
      if (u.role === 'supervisor') { where.push('b.department_id = ?'); params.push(u.departmentId!); }
      if (month) { where.push("strftime('%Y-%m', b.created_at) = ?"); params.push(month); }
      if (startDate) { where.push('DATE(b.created_at) >= ?'); params.push(startDate); }
      if (endDate) { where.push('DATE(b.created_at) <= ?'); params.push(endDate); }
      if (carType && carType !== 'all') { where.push('v.car_type = ?'); params.push(carType); }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
      const pageN = Math.max(1, +page); const sizeN = Math.min(100, +size);
      const { cnt } = db.prepare(`SELECT COUNT(*) as cnt FROM bills b LEFT JOIN trips t ON b.trip_id = t.id LEFT JOIN dispatches dp ON t.dispatch_id = dp.id LEFT JOIN vehicles v ON dp.vehicle_id = v.id ${whereSql}`).get(...params) as { cnt: number };
      const list = db.prepare(`
        SELECT b.*, b.bill_no as billNo, b.trip_id as tripId, b.department_id as departmentId,
          b.applicant_id as applicantId, b.base_cost as baseCost, b.mileage_cost as mileageCost,
          b.overtime_cost as overtimeCost, b.total_cost as totalCost,
          b.audit_status as auditStatus, b.auditor_id as auditorId,
          b.audit_comment as auditComment, b.audited_at as auditedAt, b.created_at as createdAt,
          u.name as applicantName, d.name as departmentName,
          t.actual_mileage as actualMileage, t.actual_duration_min as actualDurationMin,
          v.plate_number as plateNumber, v.car_type as carType
        FROM bills b
        LEFT JOIN users u ON b.applicant_id = u.id
        LEFT JOIN departments d ON b.department_id = d.id
        LEFT JOIN trips t ON b.trip_id = t.id
        LEFT JOIN dispatches dp ON t.dispatch_id = dp.id
        LEFT JOIN vehicles v ON dp.vehicle_id = v.id
        ${whereSql}
        ORDER BY b.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, sizeN, (pageN - 1) * sizeN);
      const kpi = db.prepare(`
        SELECT
          COUNT(*) as totalBills,
          COALESCE(SUM(CASE WHEN b.audit_status = 'pending' THEN 1 ELSE 0 END),0) as pendingCount,
          COALESCE(SUM(CASE WHEN b.audit_status = 'approved' THEN 1 ELSE 0 END),0) as approvedCount,
          COALESCE(SUM(CASE WHEN b.audit_status = 'rejected' THEN 1 ELSE 0 END),0) as rejectedCount,
          COALESCE(SUM(b.total_cost),0) as totalCost,
          COALESCE(SUM(CASE WHEN b.audit_status = 'pending' THEN b.total_cost ELSE 0 END),0) as pendingCost,
          COALESCE(SUM(CASE WHEN b.audit_status = 'approved' THEN b.total_cost ELSE 0 END),0) as approvedCost,
          COALESCE(SUM(b.base_cost),0) as baseCost,
          COALESCE(SUM(b.mileage_cost),0) as mileageCost,
          COALESCE(SUM(b.overtime_cost),0) as overtimeCost
        FROM bills b
        LEFT JOIN trips t ON b.trip_id = t.id
        LEFT JOIN dispatches dp ON t.dispatch_id = dp.id
        LEFT JOIN vehicles v ON dp.vehicle_id = v.id
        ${whereSql}
      `).get(...params);
      res.json(json({ list, total: cnt, page: pageN, size: sizeN, kpi }));
    } catch (e) { next(e); }
  });

  router.get('/finance/bills/summary', authMiddleware(['finance', 'admin', 'supervisor']), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      const q = req.query as Record<string, string>;
      const { groupBy = 'department', status, departmentId, month, carType, startDate, endDate } = q;
      const where: string[] = []; const params: unknown[] = [];
      if (status && status !== 'all') { where.push('b.audit_status = ?'); params.push(status); }
      if (departmentId) { where.push('b.department_id = ?'); params.push(+departmentId); }
      if (u.role === 'supervisor') { where.push('b.department_id = ?'); params.push(u.departmentId!); }
      if (month) { where.push("strftime('%Y-%m', b.created_at) = ?"); params.push(month); }
      if (startDate) { where.push('DATE(b.created_at) >= ?'); params.push(startDate); }
      if (endDate) { where.push('DATE(b.created_at) <= ?'); params.push(endDate); }
      if (carType && carType !== 'all') { where.push('v.car_type = ?'); params.push(carType); }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
      let labelCol = 'd.name';
      let joinExtra = '';
      if (groupBy === 'month') labelCol = "strftime('%Y-%m', b.created_at)";
      else if (groupBy === 'carType') {
        labelCol = `CASE v.car_type WHEN 'sedan' THEN '普通轿车' WHEN 'suv' THEN 'SUV' WHEN 'van' THEN '商务面包' WHEN 'business' THEN '豪华商务' ELSE '未分类' END`;
        joinExtra = ` LEFT JOIN trips t ON b.trip_id = t.id LEFT JOIN dispatches dp ON t.dispatch_id = dp.id LEFT JOIN vehicles v ON dp.vehicle_id = v.id `;
      }
      if (groupBy === 'department') {
        joinExtra = '';
      } else if (groupBy === 'month') {
        joinExtra = '';
      }
      let sql = `
        SELECT ${labelCol} as label,
          b.department_id as departmentId,
          COUNT(*) as count,
          COALESCE(SUM(b.total_cost),0) as totalCost,
          COALESCE(AVG(b.total_cost),0) as avgCost,
          COALESCE(SUM(b.base_cost),0) as baseCost,
          COALESCE(SUM(b.mileage_cost),0) as mileageCost,
          COALESCE(SUM(b.overtime_cost),0) as overtimeCost,
          COALESCE(SUM(CASE WHEN b.audit_status = 'pending' THEN b.total_cost ELSE 0 END),0) as pendingCost,
          COALESCE(SUM(CASE WHEN b.audit_status = 'approved' THEN b.total_cost ELSE 0 END),0) as approvedCost
        FROM bills b
        ${groupBy === 'department' ? 'LEFT JOIN departments d ON b.department_id = d.id' : ''}
        ${joinExtra}
        ${whereSql}
        GROUP BY ${groupBy === 'department' ? 'b.department_id' : groupBy === 'month' ? "strftime('%Y-%m', b.created_at)" : 'v.car_type'}
        ORDER BY totalCost DESC
      `;
      if (groupBy === 'department') {
        sql = `
          SELECT d.name as label,
            b.department_id as departmentId,
            COUNT(*) as count,
            COALESCE(SUM(b.total_cost),0) as totalCost,
            COALESCE(AVG(b.total_cost),0) as avgCost,
            COALESCE(SUM(b.base_cost),0) as baseCost,
            COALESCE(SUM(b.mileage_cost),0) as mileageCost,
            COALESCE(SUM(b.overtime_cost),0) as overtimeCost,
            COALESCE(SUM(CASE WHEN b.audit_status = 'pending' THEN b.total_cost ELSE 0 END),0) as pendingCost,
            COALESCE(SUM(CASE WHEN b.audit_status = 'approved' THEN b.total_cost ELSE 0 END),0) as approvedCost
          FROM bills b
          LEFT JOIN departments d ON b.department_id = d.id
          ${whereSql}
          GROUP BY b.department_id
          ORDER BY totalCost DESC
        `;
      }
      if (groupBy === 'month') {
        sql = `
          SELECT strftime('%Y-%m', b.created_at) as label,
            NULL as departmentId,
            COUNT(*) as count,
            COALESCE(SUM(b.total_cost),0) as totalCost,
            COALESCE(AVG(b.total_cost),0) as avgCost,
            COALESCE(SUM(b.base_cost),0) as baseCost,
            COALESCE(SUM(b.mileage_cost),0) as mileageCost,
            COALESCE(SUM(b.overtime_cost),0) as overtimeCost,
            COALESCE(SUM(CASE WHEN b.audit_status = 'pending' THEN b.total_cost ELSE 0 END),0) as pendingCost,
            COALESCE(SUM(CASE WHEN b.audit_status = 'approved' THEN b.total_cost ELSE 0 END),0) as approvedCost
          FROM bills b
          ${whereSql}
          GROUP BY 1
          ORDER BY 1 DESC
        `;
      }
      if (groupBy === 'carType') {
        sql = `
          SELECT CASE v.car_type
              WHEN 'sedan' THEN '普通轿车' WHEN 'suv' THEN 'SUV'
              WHEN 'van' THEN '商务面包' WHEN 'business' THEN '豪华商务' ELSE '未分类' END as label,
            NULL as departmentId,
            COUNT(*) as count,
            COALESCE(SUM(b.total_cost),0) as totalCost,
            COALESCE(AVG(b.total_cost),0) as avgCost,
            COALESCE(SUM(b.base_cost),0) as baseCost,
            COALESCE(SUM(b.mileage_cost),0) as mileageCost,
            COALESCE(SUM(b.overtime_cost),0) as overtimeCost,
            COALESCE(SUM(CASE WHEN b.audit_status = 'pending' THEN b.total_cost ELSE 0 END),0) as pendingCost,
            COALESCE(SUM(CASE WHEN b.audit_status = 'approved' THEN b.total_cost ELSE 0 END),0) as approvedCost
          FROM bills b
          LEFT JOIN trips t ON b.trip_id = t.id
          LEFT JOIN dispatches dp ON t.dispatch_id = dp.id
          LEFT JOIN vehicles v ON dp.vehicle_id = v.id
          ${whereSql}
          GROUP BY v.car_type
          ORDER BY totalCost DESC
        `;
      }
      const list = db.prepare(sql).all(...params);
      const kpi = db.prepare(`
        SELECT
          COUNT(*) as totalBills,
          COALESCE(SUM(b.total_cost),0) as totalCost,
          COALESCE(SUM(CASE WHEN b.audit_status = 'pending' THEN 1 ELSE 0 END),0) as pendingCount,
          COALESCE(SUM(CASE WHEN b.audit_status = 'approved' THEN 1 ELSE 0 END),0) as approvedCount,
          COALESCE(SUM(CASE WHEN b.audit_status = 'pending' THEN b.total_cost ELSE 0 END),0) as pendingCost,
          COALESCE(SUM(CASE WHEN b.audit_status = 'approved' THEN b.total_cost ELSE 0 END),0) as approvedCost
        FROM bills b
        LEFT JOIN trips t ON b.trip_id = t.id
        LEFT JOIN dispatches dp ON t.dispatch_id = dp.id
        LEFT JOIN vehicles v ON dp.vehicle_id = v.id
        ${whereSql}
      `).get(...params);
      res.json(json({ list, kpi }));
    } catch (e) { next(e); }
  });

  router.post('/finance/bills/:id/audit', authMiddleware(['finance', 'admin']), (req: AuthRequest, res, next) => {
    try {
      const id = +req.params.id; const u = req.user!;
      const { approved, comment } = req.body as { approved: boolean; comment?: string };
      const bill = db.prepare('SELECT audit_status as s, total_cost as c, department_id as dept, trip_id as trip FROM bills WHERE id = ?').get(id) as { s: string; c: number; dept: number; trip: number } | undefined;
      if (!bill) return next({ status: 404, code: 'NOT_FOUND', message: '账单不存在' });
      if (bill.s !== 'pending') return next({ status: 409, code: 'ALREADY_AUDITED', message: '账单已审核' });
      const status = approved ? 'approved' : 'rejected';
      db.prepare(`
        UPDATE bills SET audit_status = ?, auditor_id = ?, audit_comment = ?, audited_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(status, u.id, comment || '', id);
      if (!approved) {
        db.prepare('UPDATE budgets SET used_budget = MAX(0, used_budget - ?) WHERE department_id = ?').run(bill.c, bill.dept);
      }
      const app = db.prepare(`
        SELECT a.applicant_id as aid FROM applications a
        JOIN dispatches d ON a.id = d.application_id JOIN trips t ON t.dispatch_id = d.id
        WHERE t.id = ?
      `).get(bill.trip) as { aid: number } | undefined;
      if (app) pushNotification(app.aid, 'bill', approved ? '账单已审核通过' : '账单审核未通过',
        approved ? `您的用车账单¥${bill.c}已审核通过。` : `账单¥${bill.c}未通过：${comment || '无'}`, 'bill', id);
      res.json(json({ success: true }));
    } catch (e) { next(e); }
  });

  router.get('/finance/statistics', authMiddleware(['finance', 'admin', 'supervisor']), (req: AuthRequest, res, next) => {
    try {
      const { type = 'monthly', startDate, endDate } = req.query as Record<string, string>;
      const u = req.user!;
      const where: string[] = ["b.audit_status = 'approved'"];
      const params: unknown[] = [];
      if (u.role === 'supervisor') { where.push('b.department_id = ?'); params.push(u.departmentId!); }
      if (startDate) { where.push('DATE(b.created_at) >= ?'); params.push(startDate); }
      if (endDate) { where.push('DATE(b.created_at) <= ?'); params.push(endDate); }
      const whereSql = 'WHERE ' + where.join(' AND ');
      let data: unknown[] = [];
      if (type === 'monthly') {
        data = db.prepare(`
          SELECT strftime('%Y-%m', b.created_at) as label, SUM(b.total_cost) as value
          FROM bills b ${whereSql} GROUP BY 1 ORDER BY 1 ASC
        `).all(...params);
      } else if (type === 'department') {
        data = db.prepare(`
          SELECT d.name as label, SUM(b.total_cost) as value
          FROM bills b LEFT JOIN departments d ON b.department_id = d.id
          ${whereSql} GROUP BY d.id ORDER BY value DESC
        `).all(...params);
      } else if (type === 'carType') {
        data = db.prepare(`
          SELECT CASE v.car_type
            WHEN 'sedan' THEN '普通轿车' WHEN 'suv' THEN 'SUV' WHEN 'van' THEN '商务面包' WHEN 'business' THEN '豪华商务' END as label,
            SUM(b.total_cost) as value
          FROM bills b
            JOIN trips t ON b.trip_id = t.id
            JOIN dispatches d ON t.dispatch_id = d.id
            JOIN vehicles v ON d.vehicle_id = v.id
          ${whereSql} GROUP BY v.car_type
        `).all(...params);
      }
      const summary = db.prepare(`
        SELECT
          COUNT(*) as totalBills,
          COALESCE(SUM(b.total_cost),0) as totalCost,
          COALESCE(AVG(b.total_cost),0) as avgCost
        FROM bills b ${whereSql}
      `).get(...params);
      res.json(json({ data, summary }));
    } catch (e) { next(e); }
  });

  // ==================== 部门预算模块 ====================
  router.get('/budgets/:departmentId', authMiddleware(), (req, res, next) => {
    try {
      void next;
      const deptId = +req.params.departmentId;
      const row = db.prepare(`
        SELECT b.*, b.department_id as departmentId, b.monthly_budget as monthlyBudget,
          b.current_month as currentMonth, b.used_budget as usedBudget, b.alert_threshold as alertThreshold,
          d.name as departmentName
        FROM budgets b LEFT JOIN departments d ON b.department_id = d.id WHERE b.department_id = ?
      `).get(deptId) as Record<string, unknown> | undefined;
      if (!row) return res.json(null);
      const mb = +(row.monthlyBudget as number);
      const ub = +(row.usedBudget as number);
      row.remainingBudget = +(mb - ub).toFixed(2);
      row.usagePercent = +((ub / mb) * 100).toFixed(2);
      res.json(json(row));
    } catch (e) { next(e); }
  });

  router.put('/budgets/:departmentId', authMiddleware(['supervisor', 'finance', 'admin']), (req, res, next) => {
    try {
      const deptId = +req.params.departmentId;
      const { monthlyBudget, alertThreshold } = req.body as { monthlyBudget?: number; alertThreshold?: number };
      const info = db.prepare(`
        UPDATE budgets SET
          monthly_budget = COALESCE(?, monthly_budget),
          alert_threshold = COALESCE(?, alert_threshold)
        WHERE department_id = ?
      `).run(monthlyBudget ?? null, alertThreshold ?? null, deptId);
      res.json(json(runCUD(info)));
    } catch (e) { next(e); }
  });

  router.get('/departments', authMiddleware(), (_req, res, next) => {
    try {
      void _req; void next;
      const list = db.prepare(`
        SELECT d.*, d.supervisor_id as supervisorId, u.name as supervisorName
        FROM departments d LEFT JOIN users u ON d.supervisor_id = u.id
        ORDER BY d.id ASC
      `).all();
      res.json(json(list));
    } catch (e) { next(e); }
  });

  // ==================== 通知模块 ====================
  router.get('/notifications', authMiddleware(), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      const { read = 'all' } = req.query as Record<string, string>;
      const where: string[] = ['n.user_id = ?'];
      const params: unknown[] = [u.id];
      if (read === 'unread') { where.push('n.is_read = 0'); }
      else if (read === 'read') { where.push('n.is_read = 1'); }
      const list = db.prepare(`
        SELECT n.*, n.related_type as relatedType, n.related_id as relatedId,
          n.is_read as isRead, n.created_at as createdAt
        FROM notifications n
        WHERE ${where.join(' AND ')}
        ORDER BY n.created_at DESC LIMIT 100
      `).all(...params);
      const unreadCount = (db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0').get(u.id) as { cnt: number }).cnt;
      res.json(json({ list, unreadCount }));
    } catch (e) { next(e); }
  });

  router.post('/notifications/:id/read', authMiddleware(), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      const info = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(+req.params.id, u.id);
      res.json(json(runCUD(info, { success: true })));
    } catch (e) { next(e); }
  });

  router.post('/notifications/read-all', authMiddleware(), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(u.id);
      void next;
      res.json(json({ success: true }));
    } catch (e) { next(e); }
  });

  // ==================== 仪表盘数据 ====================
  router.get('/dashboard/summary', authMiddleware(), (req: AuthRequest, res, next) => {
    try {
      const u = req.user!;
      const result: Record<string, unknown> = {};
      if (u.role === 'employee' || u.role === 'admin') {
        const stats = db.prepare(`
          SELECT
            SUM(CASE WHEN status NOT IN ('completed','rejected','cancelled') THEN 1 ELSE 0 END) as ongoing,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            COUNT(*) as total
          FROM applications WHERE applicant_id = ?
        `).get(u.id) as Record<string, number>;
        result.employeeStats = stats;
      }
      if (u.role === 'supervisor' || u.role === 'admin') {
        const ap = db.prepare(`
          SELECT COUNT(*) as pending FROM approvals
          WHERE supervisor_id = ? AND (decision = 'pending' OR decision IS NULL)
        `).get(u.id) as { pending: number };
        result.supervisorStats = { pendingApprovals: ap.pending };
      }
      if (u.role === 'driver' || u.role === 'admin') {
        const driver = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(u.id) as { id: number } | undefined;
        if (driver) {
          const today = new Date().toISOString().slice(0, 10);
          const ds = db.prepare(`
            SELECT COUNT(*) as todayTasks,
              SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as todayCompleted
            FROM dispatches d JOIN applications a ON d.application_id = a.id
            LEFT JOIN trips t ON t.dispatch_id = d.id
            WHERE d.driver_id = ? AND DATE(a.start_time) = ?
          `).get(driver.id, today) as Record<string, number>;
          result.driverStats = ds;
        }
      }
      if (['dispatcher', 'finance', 'admin'].includes(u.role)) {
        const vs = db.prepare(`SELECT status, COUNT(*) as cnt FROM vehicles GROUP BY status`).all() as Array<{ status: string; cnt: number }>;
        const vehicleStats: Record<string, number> = {};
        vs.forEach((r) => (vehicleStats[r.status] = r.cnt));
        result.vehicleStats = vehicleStats;
        const maint = getMaintenanceAlertVehicles();
        result.maintenanceAlertCount = maint.filter((m) => m.alertLevel !== 'normal').length;
        const pendingBills = (db.prepare("SELECT COUNT(*) as cnt FROM bills WHERE audit_status = 'pending'").get() as { cnt: number }).cnt;
        result.pendingBills = pendingBills;
      }
      res.json(json(result));
    } catch (e) { next(e); }
  });

  return router;
}

import type Database from 'better-sqlite3';
