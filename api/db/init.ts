import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', '..', 'data.db');

const DDL_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('employee','supervisor','driver','dispatcher','finance','admin')),
  department_id INTEGER,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  supervisor_id INTEGER,
  FOREIGN KEY(supervisor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER UNIQUE NOT NULL,
  monthly_budget DECIMAL(12,2) NOT NULL DEFAULT 50000.00,
  current_month TEXT NOT NULL,
  used_budget DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  alert_threshold DECIMAL(5,2) NOT NULL DEFAULT 80.00,
  FOREIGN KEY(department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plate_number TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  car_type TEXT NOT NULL CHECK(car_type IN ('sedan','suv','van','business')),
  seating_capacity INTEGER NOT NULL,
  current_mileage INTEGER NOT NULL DEFAULT 0,
  maintenance_interval INTEGER NOT NULL DEFAULT 5000,
  last_maintenance_mileage INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','in_use','maintenance','repair')),
  insurance_expiry DATE,
  annual_inspection_expiry DATE,
  purchase_price DECIMAL(12,2)
);

CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  license_number TEXT UNIQUE NOT NULL,
  license_type TEXT NOT NULL,
  license_expiry DATE NOT NULL,
  hire_date DATE NOT NULL,
  avg_rating DECIMAL(3,2) DEFAULT 5.00,
  total_trips INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'on_duty' CHECK(status IN ('on_duty','off_duty','leave','suspended')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  department_id INTEGER NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  estimated_distance_km DECIMAL(8,2),
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  passengers INTEGER NOT NULL CHECK(passengers >= 1),
  car_type_preference TEXT CHECK(car_type_preference IN ('sedan','suv','van','business')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','pending_approval','approved','rejected','dispatched','in_progress','completed','cancelled')),
  rejection_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(applicant_id) REFERENCES users(id),
  FOREIGN KEY(department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER UNIQUE NOT NULL,
  supervisor_id INTEGER NOT NULL,
  estimated_cost DECIMAL(12,2) NOT NULL,
  remaining_budget DECIMAL(12,2) NOT NULL,
  over_amount DECIMAL(12,2) NOT NULL,
  decision TEXT CHECK(decision IN ('approved','rejected','pending')),
  comment TEXT,
  decided_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(application_id) REFERENCES applications(id),
  FOREIGN KEY(supervisor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER UNIQUE NOT NULL,
  vehicle_id INTEGER NOT NULL,
  driver_id INTEGER NOT NULL,
  estimated_cost DECIMAL(12,2) NOT NULL,
  estimated_mileage INTEGER,
  match_score INTEGER,
  qr_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','in_progress','completed','cancelled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(application_id) REFERENCES applications(id),
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY(driver_id) REFERENCES drivers(id)
);

CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispatch_id INTEGER UNIQUE NOT NULL,
  odometer_start INTEGER,
  odometer_end INTEGER,
  actual_departure DATETIME,
  actual_arrival DATETIME,
  actual_duration_min INTEGER,
  actual_mileage INTEGER,
  mileage_anomaly INTEGER DEFAULT 0,
  actual_cost DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','departed','arrived','completed','cancelled')),
  FOREIGN KEY(dispatch_id) REFERENCES dispatches(id)
);

CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER UNIQUE NOT NULL,
  rater_id INTEGER NOT NULL,
  punctuality INTEGER NOT NULL CHECK(punctuality BETWEEN 1 AND 5),
  safety INTEGER NOT NULL CHECK(safety BETWEEN 1 AND 5),
  service INTEGER NOT NULL CHECK(service BETWEEN 1 AND 5),
  vehicle_condition INTEGER NOT NULL CHECK(vehicle_condition BETWEEN 1 AND 5),
  overall_score DECIMAL(3,2) NOT NULL,
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(trip_id) REFERENCES trips(id),
  FOREIGN KEY(rater_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_no TEXT UNIQUE NOT NULL,
  trip_id INTEGER UNIQUE NOT NULL,
  department_id INTEGER NOT NULL,
  applicant_id INTEGER NOT NULL,
  base_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  mileage_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  overtime_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2) NOT NULL,
  audit_status TEXT NOT NULL DEFAULT 'pending' CHECK(audit_status IN ('pending','approved','rejected')),
  auditor_id INTEGER,
  audit_comment TEXT,
  audited_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(trip_id) REFERENCES trips(id),
  FOREIGN KEY(department_id) REFERENCES departments(id),
  FOREIGN KEY(applicant_id) REFERENCES users(id),
  FOREIGN KEY(auditor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('routine','repair','inspection','other')),
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  mileage_at_service INTEGER NOT NULL,
  next_maintenance_mileage INTEGER,
  maintenance_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  related_type TEXT,
  related_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id INTEGER NOT NULL,
  schedule_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK(shift_type IN ('morning','afternoon','night','full','rest','leave')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','changed')),
  remark TEXT,
  UNIQUE(driver_id, schedule_date),
  FOREIGN KEY(driver_id) REFERENCES drivers(id)
);

CREATE TABLE IF NOT EXISTS car_type_pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_type TEXT UNIQUE NOT NULL CHECK(car_type IN ('sedan','suv','van','business')),
  base_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  per_km_cost DECIMAL(12,2) NOT NULL,
  per_minute_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_department ON applications(department_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_start_time ON applications(start_time);
CREATE INDEX IF NOT EXISTS idx_dispatches_vehicle ON dispatches(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_driver ON dispatches(driver_id);
CREATE INDEX IF NOT EXISTS idx_bills_department ON bills(department_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(audit_status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_schedules_driver_date ON schedules(driver_id, schedule_date);
`;

export function initDatabase(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(DDL_SQL);

  const pricingCount = db.prepare('SELECT COUNT(*) as cnt FROM car_type_pricing').get() as { cnt: number };
  if (pricingCount.cnt === 0) {
    seedInitialData(db);
  }

  return db;
}

function seedInitialData(db: Database.Database): void {
  const hash = (pwd: string) => bcrypt.hashSync(pwd, 10);
  const pwdHash = hash('123456');
  const nowMonth = new Date().toISOString().slice(0, 7);

  const insert = db.transaction(() => {
    db.prepare(`INSERT INTO car_type_pricing (car_type, base_cost, per_km_cost, per_minute_cost, description) VALUES
      ('sedan', 30.00, 3.50, 0.50, '普通轿车（帕萨特/迈腾级别）'),
      ('suv', 50.00, 4.50, 0.60, 'SUV越野车（汉兰达/途昂级别）'),
      ('van', 80.00, 5.50, 0.80, '商务面包车（GL8级别，7座）'),
      ('business', 120.00, 7.00, 1.00, '豪华商务车（奔驰V级/埃尔法级别）')`).run();

    db.prepare(`INSERT INTO departments (id, name) VALUES
      (1, '行政部'), (2, '市场部'), (3, '技术部'), (4, '销售部'), (5, '财务部')`).run();

    db.prepare(`INSERT INTO budgets (department_id, monthly_budget, current_month, used_budget, alert_threshold) VALUES
      (1, 30000.00, ?, 12500.00, 80.00),
      (2, 80000.00, ?, 65300.00, 80.00),
      (3, 50000.00, ?, 28900.00, 80.00),
      (4, 120000.00, ?, 98700.00, 85.00),
      (5, 10000.00, ?, 3200.00, 80.00)`).run(nowMonth, nowMonth, nowMonth, nowMonth, nowMonth);

    db.prepare(`INSERT INTO users (username, password_hash, name, role, department_id, phone) VALUES
      ('admin', ?, '系统管理员', 'admin', 1, '13800000000'),
      ('zhang_emp', ?, '张三', 'employee', 3, '13800000001'),
      ('li_emp', ?, '李四', 'employee', 2, '13800000002'),
      ('wang_emp', ?, '王五', 'employee', 4, '13800000003'),
      ('liu_sup', ?, '刘主管', 'supervisor', 3, '13800000004'),
      ('chen_sup', ?, '陈主管', 'supervisor', 2, '13800000005'),
      ('zhao_sup', ?, '赵主管', 'supervisor', 4, '13800000006'),
      ('driver_wang', ?, '王师傅', 'driver', 1, '13800000010'),
      ('driver_li', ?, '李师傅', 'driver', 1, '13800000011'),
      ('driver_zhang', ?, '张师傅', 'driver', 1, '13800000012'),
      ('dispatcher_zheng', ?, '郑调度', 'dispatcher', 1, '13800000020'),
      ('finance_sun', ?, '孙会计', 'finance', 5, '13800000030')`).run(
        pwdHash, pwdHash, pwdHash, pwdHash, pwdHash, pwdHash, pwdHash,
        pwdHash, pwdHash, pwdHash, pwdHash, pwdHash
      );

    db.prepare(`INSERT INTO drivers (user_id, name, phone, license_number, license_type, license_expiry, hire_date, avg_rating, total_trips, status) VALUES
      (8, '王师傅', '13800000010', '京A123456789012', 'A1', '2028-06-30', '2020-03-15', 4.87, 327, 'on_duty'),
      (9, '李师傅', '13800000011', '京B987654321098', 'A1', '2027-12-15', '2019-07-01', 4.93, 413, 'on_duty'),
      (10, '张师傅', '13800000012', '京C555556666677', 'A2', '2029-03-20', '2021-01-10', 4.78, 198, 'on_duty')`).run();

    db.prepare(`INSERT INTO vehicles (plate_number, brand, model, car_type, seating_capacity, current_mileage, maintenance_interval, last_maintenance_mileage, status, insurance_expiry, annual_inspection_expiry) VALUES
      ('京A·12345', '大众', '帕萨特 380TSI', 'sedan', 5, 48500, 5000, 45000, 'idle', '2027-04-20', '2027-06-30'),
      ('京A·67890', '丰田', '凯美瑞 2.5G', 'sedan', 5, 32100, 5000, 30000, 'idle', '2026-11-15', '2027-03-31'),
      ('京B·22222', '丰田', '汉兰达 2.5L', 'suv', 7, 67800, 5000, 65000, 'idle', '2027-02-28', '2027-08-31'),
      ('京B·33333', '别克', 'GL8 陆尊', 'van', 7, 89200, 5000, 85000, 'idle', '2026-09-10', '2027-01-15'),
      ('京C·66666', '奔驰', 'V260L', 'business', 7, 25400, 6000, 24000, 'idle', '2027-08-01', '2028-02-28'),
      ('京C·88888', '大众', '迈腾 380TSI', 'sedan', 5, 43200, 5000, 40000, 'idle', '2026-12-31', '2027-05-20'),
      ('京D·11111', '本田', '奥德赛', 'van', 7, 56700, 5000, 50000, 'maintenance', '2027-05-18', '2027-09-30')`).run();

    db.prepare(`INSERT INTO maintenance_records (vehicle_id, type, cost, description, mileage_at_service, next_maintenance_mileage, maintenance_date) VALUES
      (1, 'routine', 850.00, '常规保养：机油、机滤、空滤更换', 45000, 50000, '2026-04-15'),
      (2, 'routine', 780.00, '常规保养', 30000, 35000, '2026-03-20'),
      (4, 'repair', 3200.00, '刹车片更换+轮胎动平衡', 85000, 90000, '2026-05-10')`).run();

    const daysAgo = (d: number, h = 0, m = 0) => {
      const dt = new Date();
      dt.setDate(dt.getDate() - d);
      dt.setHours(dt.getHours() + h, dt.getMinutes() + m, 0, 0);
      return dt.toISOString();
    };
    const nowAgo = daysAgo;

    db.prepare(`INSERT INTO applications (applicant_id, department_id, origin, destination, estimated_distance_km, start_time, end_time, passengers, car_type_preference, reason, status, created_at) VALUES
      (3, 2, '公司总部', '首都机场T3', 28.5, ?, ?, 3, 'sedan', '市场部接机', 'completed', ?),
      (4, 4, '公司总部', '国贸CBD客户现场', 12.0, ?, ?, 2, 'business', '重要客户拜访', 'completed', ?)`).run(
      daysAgo(3, 9), daysAgo(3, 11), daysAgo(5),
      daysAgo(1, 14), daysAgo(1, 17), daysAgo(3)
    );

    db.prepare(`INSERT INTO approvals (application_id, supervisor_id, estimated_cost, remaining_budget, over_amount, decision, comment, decided_at, created_at) VALUES
      (1, 6, 218.50, 14700.00, 0.00, 'approved', ?, ?, ?),
      (2, 7, 328.00, 21300.00, 0.00, 'approved', '重要客户，请安排好车况', ?, ?)`).run(
      '', daysAgo(5, 2), daysAgo(5, 1),
      daysAgo(3, 1), daysAgo(3, 0, 30)
    );

    db.prepare(`INSERT INTO dispatches (application_id, vehicle_id, driver_id, estimated_cost, estimated_mileage, match_score, qr_code, status, created_at) VALUES
      (1, 1, 1, 218.50, 57, 92, ?, 'completed', ?),
      (2, 5, 2, 328.00, 24, 95, ?, 'completed', ?)`).run(
      'QR-APP001-20260619', daysAgo(5, 3),
      'QR-APP002-20260621', daysAgo(3, 2)
    );

    db.prepare(`INSERT INTO trips (dispatch_id, odometer_start, odometer_end, actual_departure, actual_arrival, actual_duration_min, actual_mileage, mileage_anomaly, actual_cost, status) VALUES
      (1, 47820, 47885, ?, ?, 95, 65, 0, 257.50, 'completed'),
      (2, 25100, 25132, ?, ?, 155, 32, 0, 386.00, 'completed')`).run(
      daysAgo(3, 9, 15), daysAgo(3, 10, 50),
      daysAgo(1, 14, 5), daysAgo(1, 16, 40)
    );

    db.prepare(`INSERT INTO ratings (trip_id, rater_id, punctuality, safety, service, vehicle_condition, overall_score, comment, created_at) VALUES
      (1, 3, 5, 5, 4, 5, 4.75, '司机师傅很准时，车也干净，整体满意', ?),
      (2, 4, 5, 5, 5, 5, 5.00, '商务车体验非常好，李师傅服务专业', ?)`).run(
      daysAgo(3, 12), daysAgo(1, 18)
    );

    const billDate = (d: number) => {
      const dt = new Date();
      dt.setDate(dt.getDate() - d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };
    db.prepare(`INSERT INTO bills (bill_no, trip_id, department_id, applicant_id, base_cost, mileage_cost, overtime_cost, total_cost, audit_status, auditor_id, audit_comment, audited_at, created_at) VALUES
      (?, 1, 2, 3, 30.00, 227.50, 0.00, 257.50, 'approved', 12, ?, ?, ?),
      (?, 2, 4, 4, 120.00, 224.00, 42.00, 386.00, 'approved', 12, ?, ?, ?)`).run(
      `BILL${billDate(3)}001`, '', daysAgo(2), daysAgo(3, 11),
      `BILL${billDate(1)}001`, '', nowAgo(0), daysAgo(1, 17)
    );

    db.prepare(`UPDATE budgets SET used_budget = 65557.50 WHERE department_id = 2`).run();
    db.prepare(`UPDATE budgets SET used_budget = 99086.00 WHERE department_id = 4`).run();

    db.prepare(`INSERT INTO notifications (user_id, type, title, content, related_type, related_id, is_read, created_at) VALUES
      (5, 'approval', '待审批：技术部王五用车申请', '王五申请明日客户拜访，预计费用580元，接近部门预算预警线，请及时审批。', 'application', 3, 0, ?),
      (11, 'maintenance', '保养提醒：京D·11111', '车辆京D·11111当前里程56700km，距离下次保养仅剩3300km，请尽快安排保养。', 'vehicle', 7, 0, ?)`).run(
      daysAgo(0, 0, 30), daysAgo(0, 2)
    );
  });

  insert();
}

export default initDatabase;
