import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/index.js';
import type { User, UserRole } from '../../shared/types.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'vehicle-dispatch-secret-key-2026';
export const JWT_EXPIRES_IN = '24h';

export interface AuthRequest extends Request {
  user?: User;
}

export function signToken(userId: number, role: UserRole): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function authMiddleware(requiredRoles?: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next({ status: 401, code: 'MISSING_TOKEN', message: '请先登录' });
    }
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: UserRole };
      const db = getDb();
      const row = db.prepare(`
        SELECT id, username, name, role, department_id as departmentId, phone, created_at as createdAt
        FROM users WHERE id = ?
      `).get(decoded.userId) as User | undefined;

      if (!row) return next({ status: 401, code: 'INVALID_TOKEN', message: '登录凭证无效' });
      if (requiredRoles && !requiredRoles.includes(row.role)) {
        return next({ status: 403, code: 'PERMISSION_DENIED', message: '无权限访问该资源' });
      }
      req.user = row;
      next();
    } catch {
      next({ status: 401, code: 'INVALID_TOKEN', message: '登录凭证已过期，请重新登录' });
    }
  };
}

export function createAuthRouter(): Router {
  const router = Router();
  const db = getDb();

  router.post('/login', (req, res, next) => {
    try {
      const { username, password, role } = req.body as { username: string; password: string; role: UserRole };
      if (!username || !password || !role) {
        return next({ status: 400, code: 'INVALID_PARAMS', message: '请填写账号、密码和角色' });
      }
      const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
      const row = db.prepare(`
        SELECT id, username, password_hash, name, role, department_id as departmentId, phone, created_at as createdAt
        FROM users WHERE username = ?
      `).get(username) as (User & { password_hash: string }) | undefined;

      if (!row) return next({ status: 401, code: 'INVALID_CREDENTIALS', message: '账号或密码错误' });
      if (row.role !== role && row.role !== 'admin') {
        return next({ status: 403, code: 'ROLE_MISMATCH', message: `该账号无「${roleLabel(role)}」权限` });
      }
      if (!bcrypt.compareSync(password, row.password_hash)) {
        return next({ status: 401, code: 'INVALID_CREDENTIALS', message: '账号或密码错误' });
      }
      const actualRole = row.role === 'admin' ? role : row.role;
      const token = signToken(row.id, actualRole);
      const { password_hash: _ph, ...userInfo } = row;
      const user: User = { ...userInfo, role: actualRole };

      const department = user.departmentId
        ? db.prepare('SELECT id, name, supervisor_id as supervisorId FROM departments WHERE id = ?').get(user.departmentId)
        : null;

      res.json({ token, user, department });
    } catch (err) {
      next(err);
    }
  });

  router.get('/profile', authMiddleware(), (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  return router;
}

function roleLabel(r: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: '系统管理员', employee: '员工', supervisor: '主管',
    driver: '司机', dispatcher: '调度员', finance: '财务'
  };
  return map[r];
}
