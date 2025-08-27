
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS "student_fee_concessions" CASCADE;
DROP TABLE IF EXISTS "receipt_items" CASCADE;
DROP TABLE IF EXISTS "receipts" CASCADE;
DROP TABLE IF EXISTS "expenses" CASCADE;
DROP TABLE IF EXISTS "expense_categories" CASCADE;
DROP TABLE IF EXISTS "installments" CASCADE;
DROP TABLE IF EXISTS "concessions" CASCADE;
DROP TABLE IF EXISTS "student_fee_payments" CASCADE;
DROP TABLE IF EXISTS "fee_categories" CASCADE;

-- Fee Categories Table
-- Stores the basic types of fees (e.g., Tuition, Lab, Sports).
CREATE TABLE "fee_categories" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "description" text,
  "amount" numeric(10, 2), -- Optional default amount
  "school_id" uuid NOT NULL REFERENCES "schools" ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  UNIQUE("name", "school_id")
);

-- Installments Table
-- Defines payment periods or installments (e.g., First Term, Q2 Fees).
CREATE TABLE "installments" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "school_id" uuid NOT NULL REFERENCES "schools" ON DELETE CASCADE,
  "title" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "last_date" date NOT NULL, -- The final due date for this installment
  "description" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  UNIQUE("title", "school_id")
);

-- Concessions Table
-- Defines types of discounts (e.g., Sibling Discount, Scholarship).
CREATE TABLE "concessions" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "school_id" uuid NOT NULL REFERENCES "schools" ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  UNIQUE("title", "school_id")
);

-- Student Fee Payments Table
-- This is the central table linking students to specific fees.
CREATE TABLE "student_fee_payments" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "student_id" uuid NOT NULL REFERENCES "students" ON DELETE CASCADE,
  "fee_category_id" uuid NOT NULL REFERENCES "fee_categories" ON DELETE CASCADE,
  "installment_id" uuid REFERENCES "installments" ON DELETE SET NULL, -- Link to an installment
  "academic_year_id" uuid REFERENCES "academic_years" ON DELETE SET NULL,
  "school_id" uuid NOT NULL REFERENCES "schools" ON DELETE CASCADE,
  "assigned_amount" numeric(10, 2) NOT NULL,
  "paid_amount" numeric(10, 2) NOT NULL DEFAULT 0,
  "due_date" date,
  "payment_date" date,
  "status" text CHECK (status IN ('Pending', 'Paid', 'Partially Paid', 'Overdue', 'Failed')) NOT NULL DEFAULT 'Pending',
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

-- Student Fee Concessions Table
-- Tracks which concessions have been applied to which fee payments.
CREATE TABLE "student_fee_concessions" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "student_fee_payment_id" uuid NOT NULL REFERENCES "student_fee_payments" ON DELETE CASCADE,
  "concession_id" uuid NOT NULL REFERENCES "concessions" ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students" ON DELETE CASCADE,
  "school_id" uuid NOT NULL REFERENCES "schools" ON DELETE CASCADE,
  "concession_amount" numeric(10, 2) NOT NULL,
  "applied_by_user_id" uuid REFERENCES "users" ON DELETE SET NULL,
  "applied_at" timestamptz DEFAULT now(),
  "notes" text
);

-- Expense Categories Table
-- Defines categories for school expenses (e.g., Salaries, Utilities).
CREATE TABLE "expense_categories" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "school_id" uuid NOT NULL REFERENCES "schools" ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamptz DEFAULT now(),
  UNIQUE("name", "school_id")
);

-- Expenses Table
-- Logs all school expenditures.
CREATE TABLE "expenses" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "school_id" uuid NOT NULL REFERENCES "schools" ON DELETE CASCADE,
  "category_id" uuid NOT NULL REFERENCES "expense_categories" ON DELETE CASCADE,
  "title" text NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "date" date NOT NULL,
  "receipt_url" text,
  "notes" text,
  "recorded_by_user_id" uuid REFERENCES "users" ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

-- Receipts Table
-- Stores header info for general receipts (non-student fee payments).
CREATE TABLE "receipts" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "school_id" uuid NOT NULL REFERENCES "schools" ON DELETE CASCADE,
  "receipt_no" serial UNIQUE,
  "narration" text,
  "payment_date" date NOT NULL,
  "payment_mode" text NOT NULL,
  "total_amount" numeric(10, 2) NOT NULL,
  "created_by_user_id" uuid REFERENCES "users" ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

-- Receipt Items Table
-- Stores line items for each receipt.
CREATE TABLE "receipt_items" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "receipt_id" uuid NOT NULL REFERENCES "receipts" ON DELETE CASCADE,
  "school_id" uuid NOT NULL REFERENCES "schools" ON DELETE CASCADE,
  "ledger" text NOT NULL,
  "description" text,
  "amount" numeric(10, 2) NOT NULL
);

-- Create Indexes for performance
CREATE INDEX idx_student_fee_payments_student_id ON "student_fee_payments" ("student_id");
CREATE INDEX idx_expenses_school_id ON "expenses" ("school_id");
CREATE INDEX idx_receipts_school_id ON "receipts" ("school_id");

-- RLS Policies
ALTER TABLE "fee_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read fee categories" ON "fee_categories" FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow admin to manage fee categories" ON "fee_categories" FOR ALL USING (
    (SELECT school_id FROM users WHERE id = auth.uid()) = school_id
    AND (SELECT role from users WHERE id = auth.uid()) = 'admin'
);

ALTER TABLE "installments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read installments" ON "installments" FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow admin to manage installments" ON "installments" FOR ALL USING (
    (SELECT school_id FROM users WHERE id = auth.uid()) = school_id
    AND (SELECT role from users WHERE id = auth.uid()) = 'admin'
);

ALTER TABLE "concessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read concessions" ON "concessions" FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow admin to manage concessions" ON "concessions" FOR ALL USING (
    (SELECT school_id FROM users WHERE id = auth.uid()) = school_id
    AND (SELECT role from users WHERE id = auth.uid()) = 'admin'
);

ALTER TABLE "student_fee_payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow admin/accountant to manage fee payments" ON "student_fee_payments" FOR ALL USING (
    (SELECT school_id FROM users WHERE id = auth.uid()) = school_id
    AND (SELECT role from users WHERE id = auth.uid()) IN ('admin', 'accountant')
);
CREATE POLICY "Allow students to see their own fee payments" ON "student_fee_payments" FOR SELECT USING (
    (SELECT id FROM students WHERE user_id = auth.uid()) = student_id
);

ALTER TABLE "student_fee_concessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow admin/accountant to manage concessions" ON "student_fee_concessions" FOR ALL USING (
    (SELECT school_id FROM users WHERE id = auth.uid()) = school_id
    AND (SELECT role from users WHERE id = auth.uid()) IN ('admin', 'accountant')
);
CREATE POLICY "Allow students to see their own concessions" ON "student_fee_concessions" FOR SELECT USING (
    (SELECT id FROM students WHERE user_id = auth.uid()) = student_id
);

ALTER TABLE "expense_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow admin/accountant to manage expense categories" ON "expense_categories" FOR ALL USING (
    (SELECT school_id FROM users WHERE id = auth.uid()) = school_id
    AND (SELECT role from users WHERE id = auth.uid()) IN ('admin', 'accountant')
);

ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow admin/accountant to manage expenses" ON "expenses" FOR ALL USING (
    (SELECT school_id FROM users WHERE id = auth.uid()) = school_id
    AND (SELECT role from users WHERE id = auth.uid()) IN ('admin', 'accountant')
);

ALTER TABLE "receipts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow admin/accountant to manage receipts" ON "receipts" FOR ALL USING (
    (SELECT school_id FROM users WHERE id = auth.uid()) = school_id
    AND (SELECT role from users WHERE id = auth.uid()) IN ('admin', 'accountant')
);

ALTER TABLE "receipt_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow admin/accountant to manage receipt items" ON "receipt_items" FOR ALL USING (
    (SELECT school_id FROM users WHERE id = auth.uid()) = school_id
    AND (SELECT role from users WHERE id = auth.uid()) IN ('admin', 'accountant')
);
