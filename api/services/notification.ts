import { getDb } from '../db/index.js';

export type NotificationType = 'approval' | 'dispatch' | 'trip' | 'maintenance' | 'bill' | 'system';

export function pushNotification(
  userId: number,
  type: NotificationType,
  title: string,
  content: string,
  relatedType?: string,
  relatedId?: number
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO notifications (user_id, type, title, content, related_type, related_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `).run(userId, type, title, content, relatedType || null, relatedId ?? null);
}

export function pushMany(userIds: number[], ...args: Parameters<typeof pushNotification> extends [infer _, ...infer Rest] ? Rest : never): void {
  userIds.forEach((uid) => pushNotification(uid, ...args));
}
