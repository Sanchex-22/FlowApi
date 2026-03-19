import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const AdminConfig = {
  Email:       requireEnv('ADMIN_EMAIL'),
  Password:    requireEnv('ADMIN_PASSWORD'),
  Name:        process.env.ADMIN_NAME     ?? 'Admin',
  LastName:    process.env.ADMIN_LAST_NAME ?? 'User',
};

export const SeedConfig = {
  CompanyName:    process.env.SEED_COMPANY_NAME    ?? null,   // null = no crear compañía
  CompanyCode:    process.env.SEED_COMPANY_CODE    ?? '',     // vacío = auto-generate
  DepartmentName: process.env.SEED_DEPARTMENT_NAME ?? 'IT',
};
