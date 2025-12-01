import { pgTable, uuid, varchar, text, timestamp, decimal, date, boolean, jsonb, integer } from 'drizzle-orm/pg-core';

// Attendance table - MATCHES hrDb.sql EXACTLY
export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull(),
  date: date('date').notNull(),
  checkInTime: timestamp('check_in_time', { withTimezone: true }),
  checkOutTime: timestamp('check_out_time', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('Present'),
  workHours: decimal('work_hours', { precision: 5, scale: 2 }),
  overtimeHours: decimal('overtime_hours', { precision: 5, scale: 2 }).default('0'),
  notes: text('notes'),
  locationCheckIn: varchar('location_check_in', { length: 255 }),
  locationCheckOut: varchar('location_check_out', { length: 255 }),
  ipAddressCheckIn: varchar('ip_address_check_in', { length: 45 }),
  ipAddressCheckOut: varchar('ip_address_check_out', { length: 45 }),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// HR Activity Logs table
export const hrActivityLogs = pgTable('hr_activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  hrPersonnelId: uuid('hr_personnel_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
