/**
 * seed-demo.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Crea datos de demostración multi-tenant:
 *   • 2 empresas adicionales (DemoCorpA, DemoCorpB)
 *   • 1 SUPER_ADMIN por empresa
 *   • 1 ADMIN por empresa
 *   • 1 USER por empresa
 *   • Departamentos base en cada empresa
 *
 * SOLO para entornos de desarrollo/staging.
 * Usa contraseñas débiles intencionalmente para facilitar pruebas.
 *
 * Uso:
 *   npx tsx prisma/seed-demo.ts
 */

import 'dotenv/config';
import prisma from '../lib/prisma.js';
import { hash } from 'bcryptjs';
import { UserRole } from '../generated/prisma/index.js';

// ── Configuración de empresas demo ───────────────────────────────────────────
const DEMO_COMPANIES = [
  {
    code: 'DEMO-A',
    name: 'DemoCorpA S.A.',
    ruc: '1-111-1111',
    email: 'admin@democorpa.com',
    users: [
      { username: 'super_a',   email: 'super@democorpa.com',  role: UserRole.SUPER_ADMIN, password: 'SuperA123!' },
      { username: 'admin_a',   email: 'admin@democorpa.com',  role: UserRole.ADMIN,       password: 'AdminA123!' },
      { username: 'user_a',    email: 'user@democorpa.com',   role: UserRole.USER,        password: 'UserA123!'  },
    ],
  },
  {
    code: 'DEMO-B',
    name: 'DemoCorpB Ltda.',
    ruc: '2-222-2222',
    email: 'admin@democorpb.com',
    users: [
      { username: 'super_b',   email: 'super@democorpb.com',  role: UserRole.SUPER_ADMIN, password: 'SuperB123!' },
      { username: 'admin_b',   email: 'admin@democorpb.com',  role: UserRole.ADMIN,       password: 'AdminB123!' },
      { username: 'user_b',    email: 'user@democorpb.com',   role: UserRole.USER,        password: 'UserB123!'  },
    ],
  },
];

// ── Counters para códigos únicos ──────────────────────────────────────────────
let companyCodeCounter = 0;
let userCodeCounter    = 0;

async function initCounters() {
  const lastCompany = await prisma.company.findFirst({ orderBy: { code: 'desc' } });
  const match = lastCompany?.code?.match(/\d+$/);
  companyCodeCounter = match ? parseInt(match[0], 10) : 0;

  const lastPerson = await prisma.person.findFirst({ orderBy: { userCode: 'desc' } });
  const matchU = lastPerson?.userCode?.match(/\d+$/);
  userCodeCounter = matchU ? parseInt(matchU[0], 10) : 0;
}

function nextCompanyCode() { return `CO${String(++companyCodeCounter).padStart(3, '0')}`; }
function nextUserCode()    { return `USR${String(++userCodeCounter).padStart(4, '0')}`; }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ seed-demo NO debe ejecutarse en producción.');
    process.exit(1);
  }

  await initCounters();
  console.log('🎭 Iniciando seed de demostración multi-tenant...\n');

  for (const cfg of DEMO_COMPANIES) {
    // ── Empresa ────────────────────────────────────────────────────────────
    const company = await prisma.company.upsert({
      where:  { name: cfg.name },
      update: { isActive: true },
      create: {
        code:     nextCompanyCode(),
        name:     cfg.name,
        ruc:      cfg.ruc,
        email:    cfg.email,
        isActive: true,
      },
    });
    console.log(`🏢 ${company.name} [${company.code}]`);

    // ── Departamento por defecto ───────────────────────────────────────────
    const dept = await prisma.department.upsert({
      where: {
        id: (await prisma.department.findFirst({
          where: { name: 'General', companyId: company.id },
        }))?.id ?? '00000000-0000-0000-0000-000000000000',
      },
      update: {},
      create: {
        name:      'General',
        companyId: company.id,
        isActive:  true,
      },
    });

    // ── Usuarios ──────────────────────────────────────────────────────────
    for (const u of cfg.users) {
      const passwordHash = await hash(u.password, 10);

      const user = await prisma.user.upsert({
        where:  { email: u.email },
        update: { role: u.role, isActive: true },
        create: {
          email:    u.email,
          username: u.username,
          password: passwordHash,
          role:     u.role,
          isActive: true,
        },
      });

      // Vincular a empresa
      await prisma.userCompany.upsert({
        where:  { userId_companyId: { userId: user.id, companyId: company.id } },
        update: {},
        create: { userId: user.id, companyId: company.id },
      });

      // Person
      const existingPerson = await prisma.person.findUnique({ where: { userId: user.id } });
      await prisma.person.upsert({
        where:  { userId: user.id },
        update: {},
        create: {
          userId:       user.id,
          firstName:    u.username,
          lastName:     company.code,
          fullName:     `${u.username} (${company.code})`,
          contactEmail: u.email,
          userCode:     existingPerson?.userCode ?? nextUserCode(),
          companyId:    company.id,
          departmentId: dept.id,
          status:       'Activo',
        },
      });

      console.log(`   👤 ${u.role.padEnd(12)} → ${u.username} <${u.email}>`);
    }
    console.log('');
  }

  console.log('✅ Seed demo finalizado.\n');
  console.log('Credenciales de prueba:');
  for (const cfg of DEMO_COMPANIES) {
    console.log(`\n  ${cfg.name}:`);
    for (const u of cfg.users) {
      console.log(`    ${u.role.padEnd(12)} ${u.email}  /  ${u.password}`);
    }
  }
}

main()
  .catch((err) => {
    console.error('❌ Error en seed-demo:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
