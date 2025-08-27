-- src/db/fees_management_schema.sql

-- Drop existing enums and tables if they exist to ensure a clean slate.
-- Use "if exists" to prevent errors on first run.
drop type if exists "public"."fee_type_installment_type";

-- FEE TYPE INSTALLMENT ENUM
create type "public"."fee_type_installment_type" as enum ('installments', 'extra_charge');

-- EXPENSE CATEGORIES
-- Used to categorize different types of school expenditures.
create table if not exists "public"."expense_categories" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "school_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    constraint expense_categories_pkey primary key (id),
    constraint expense_categories_school_id_fkey foreign key (school_id) references schools (id) on delete cascade,
    constraint expense_categories_name_school_id_key unique (name, school_id)
);
alter table "public"."expense_categories" enable row level security;
create policy "Enable all for service role" on "public"."expense_categories" for all using (true) with check (true);


-- EXPENSES
-- Records individual expense transactions made by the school.
create table if not exists "public"."expenses" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "amount" numeric not null,
    "category_id" uuid not null,
    "date" date not null,
    "receipt_url" text,
    "notes" text,
    "school_id" uuid not null,
    "recorded_by_user_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    constraint expenses_pkey primary key (id),
    constraint expenses_category_id_fkey foreign key (category_id) references expense_categories (id),
    constraint expenses_school_id_fkey foreign key (school_id) references schools (id) on delete cascade,
    constraint expenses_recorded_by_user_id_fkey foreign key (recorded_by_user_id) references users (id)
);
alter table "public"."expenses" enable row level security;
create policy "Enable all for service role" on "public"."expenses" for all using (true) with check (true);


-- INSTALLMENTS
-- Defines installment periods for fee collection (e.g., Term 1, Q1).
create table if not exists "public"."installments" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "title" text not null,
    "description" text,
    "amount" numeric,
    "start_date" date not null,
    "end_date" date not null,
    "last_date" date not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    constraint installments_pkey primary key (id),
    constraint installments_school_id_fkey foreign key (school_id) references schools (id) on delete cascade
);
alter table "public"."installments" enable row level security;
create policy "Enable all for service role" on "public"."installments" for all using (true) with check (true);


-- FEE TYPES
-- Defines specific types of fees, such as 'Late Fee' or 'T-Shirt Fee'.
create table if not exists "public"."fee_types" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "display_name" text not null,
    "description" text,
    "installment_type" fee_type_installment_type not null default 'installments'::fee_type_installment_type,
    "fee_category_id" uuid not null,
    "is_refundable" boolean not null default false,
    "school_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "amount" numeric,
    constraint fee_types_pkey primary key (id),
    constraint fee_types_fee_category_id_fkey foreign key (fee_category_id) references fee_categories (id),
    constraint fee_types_school_id_fkey foreign key (school_id) references schools (id) on delete cascade
);
alter table "public"."fee_types" enable row level security;
create policy "Enable all for service role" on "public"."fee_types" for all using (true) with check (true);


-- FEE TYPE GROUPS
-- Allows bundling multiple fee types together for easy assignment.
create table if not exists "public"."fee_type_groups" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "school_id" uuid not null,
    "fee_type_ids" uuid[] not null,
    constraint fee_type_groups_pkey primary key (id),
    constraint fee_type_groups_school_id_fkey foreign key (school_id) references schools (id) on delete cascade
);
alter table "public"."fee_type_groups" enable row level security;
create policy "Enable all for service role" on "public"."fee_type_groups" for all using (true) with check (true);


-- CONCESSIONS
-- Defines different types of fee concessions (discounts, waivers).
create table if not exists "public"."concessions" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text,
    "school_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    constraint concessions_pkey primary key (id),
    constraint concessions_school_id_fkey foreign key (school_id) references schools (id) on delete cascade
);
alter table "public"."concessions" enable row level security;
create policy "Enable all for service role" on "public"."concessions" for all using (true) with check (true);


-- STUDENT FEE CONCESSIONS (linking table)
-- Records which concession was applied to which specific student fee payment.
create table if not exists "public"."student_fee_concessions" (
    "id" uuid not null default gen_random_uuid(),
    "student_fee_payment_id" uuid not null,
    "concession_id" uuid not null,
    "concession_amount" numeric not null,
    "student_id" uuid not null,
    "school_id" uuid not null,
    "applied_by_user_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    constraint student_fee_concessions_pkey primary key (id),
    constraint student_fee_concessions_applied_by_user_id_fkey foreign key (applied_by_user_id) references users (id),
    constraint student_fee_concessions_concession_id_fkey foreign key (concession_id) references concessions (id),
    constraint student_fee_concessions_school_id_fkey foreign key (school_id) references schools (id) on delete cascade,
    constraint student_fee_concessions_student_id_fkey foreign key (student_id) references students (id),
    constraint student_fee_concessions_student_fee_payment_id_fkey foreign key (student_fee_payment_id) references student_fee_payments (id)
);
alter table "public"."student_fee_concessions" enable row level security;
create policy "Enable all for service role" on "public"."student_fee_concessions" for all using (true) with check (true);


-- FEE STRUCTURES
-- Defines the fee amounts for various categories for a specific class in an academic year.
create table if not exists "public"."fee_structures" (
    "id" uuid not null default gen_random_uuid(),
    "class_id" uuid not null,
    "academic_year_id" uuid not null,
    "school_id" uuid not null,
    "structure" jsonb not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    constraint fee_structures_pkey primary key (id),
    constraint fee_structures_academic_year_id_fkey foreign key (academic_year_id) references academic_years (id),
    constraint fee_structures_class_id_fkey foreign key (class_id) references classes (id),
    constraint fee_structures_school_id_fkey foreign key (school_id) references schools (id) on delete cascade,
    constraint fee_structures_class_id_academic_year_id_key unique (class_id, academic_year_id)
);
alter table "public"."fee_structures" enable row level security;
create policy "Enable all for service role" on "public"."fee_structures" for all using (true) with check (true);


-- RECEIPTS
-- Header table for general receipt vouchers.
create table if not exists "public"."receipts" (
    "id" uuid not null default gen_random_uuid(),
    "receipt_no" serial,
    "narration" text,
    "payment_date" date not null,
    "payment_mode" text not null,
    "total_amount" numeric not null,
    "school_id" uuid not null,
    "created_by_user_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    constraint receipts_pkey primary key (id),
    constraint receipts_school_id_fkey foreign key (school_id) references schools (id) on delete cascade,
    constraint receipts_created_by_user_id_fkey foreign key (created_by_user_id) references users (id)
);
alter table "public"."receipts" enable row level security;
create policy "Enable all for service role" on "public"."receipts" for all using (true) with check (true);


-- RECEIPT ITEMS
-- Line items for each receipt, detailing the specific ledgers.
create table if not exists "public"."receipt_items" (
    "id" uuid not null default gen_random_uuid(),
    "receipt_id" uuid not null,
    "ledger" text not null,
    "description" text,
    "amount" numeric not null,
    "school_id" uuid not null,
    constraint receipt_items_pkey primary key (id),
    constraint receipt_items_receipt_id_fkey foreign key (receipt_id) references receipts (id) on delete cascade,
    constraint receipt_items_school_id_fkey foreign key (school_id) references schools (id) on delete cascade
);
alter table "public"."receipt_items" enable row level security;
create policy "Enable all for service role" on "public"."receipt_items" for all using (true) with check (true);

-- Adding new optional columns to 'student_fee_payments'
alter table "public"."student_fee_payments" add column if not exists "fee_type_id" uuid;
alter table "public"."student_fee_payments" add column if not exists "fee_type_group_id" uuid;
alter table "public"."student_fee_payments" add column if not exists "installment_id" uuid;

-- Add foreign key constraints for the new columns
alter table "public"."student_fee_payments" add constraint student_fee_payments_fee_type_id_fkey foreign key (fee_type_id) references fee_types(id) on delete set null;
alter table "public"."student_fee_payments" add constraint student_fee_payments_fee_type_group_id_fkey foreign key (fee_type_group_id) references fee_type_groups(id) on delete set null;
alter table "public"."student_fee_payments" add constraint student_fee_payments_installment_id_fkey foreign key (installment_id) references installments(id) on delete set null;

-- Add academic_year_id to student_fee_payments if it doesn't exist
alter table "public"."student_fee_payments" add column if not exists "academic_year_id" uuid;
alter table "public"."student_fee_payments" add constraint student_fee_payments_academic_year_id_fkey foreign key (academic_year_id) references academic_years(id) on delete set null;
