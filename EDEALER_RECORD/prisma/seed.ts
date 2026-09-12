import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- Platform super-admin login (no dealer/agent link) -------------------
const ADMIN_LOGIN_EMAIL = 'admin@rto.test';
const ADMIN_LOGIN_PASSWORD = 'Admin@1234';

// --- Demo dealer login ---------------------------------------------------
const DEALER_LOGIN_EMAIL = 'dealer@rto.test';
const DEALER_LOGIN_PASSWORD = 'Dealer@1234';

// --- Demo agent login (agent firm "Speedy RTO Agents") -------------------
const AGENT_LOGIN_EMAIL = 'agent.user@rto.test';
const AGENT_LOGIN_PASSWORD = 'Agent@1234';
const AGENT_FIRM_EMAIL = 'agent.owner@rto.test';

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

/** Document categories shown in the create-process wizard for the demo dealer. */
const UPLOAD_CATEGORIES = [
  { categoryName: 'RC', bothSide: true, isRequired: true },
  { categoryName: 'Insurance', bothSide: false, isRequired: false },
  { categoryName: 'PUC', bothSide: false, isRequired: false },
  { categoryName: 'Owner ID', bothSide: false, isRequired: false },
];

/** Per-agent kanban statuses (the API auto-creates these on agent creation; we mirror them here). */
const AGENT_STATUSES = [
  { statusName: 'To-Do', colour: '#3b82f6' },
  { statusName: 'In Progress', colour: '#eab308' },
  { statusName: 'Inward', colour: '#a855f7' },
  { statusName: 'Pending', colour: '#f97316' },
  { statusName: 'Query', colour: '#ef4444' },
  { statusName: 'Complete', colour: '#22c55e' },
];

const DEALER_REFERENCES = [
  { referenceName: 'Walk-in', referenceNumber: '0000000000' },
  { referenceName: 'Agent Ramesh', referenceNumber: '9876500001' },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEALER_LOGIN_PASSWORD, SALT_ROUNDS);

  // 0) Platform super-admin (verified, no dealer/agent link). Used by the Super-Admin panel.
  const adminHash = await bcrypt.hash(ADMIN_LOGIN_PASSWORD, SALT_ROUNDS);
  await prisma.user.upsert({
    where: { emailId: ADMIN_LOGIN_EMAIL },
    update: { password: adminHash, emailVerified: true, isSuperAdmin: true },
    create: {
      userName: 'Platform Admin',
      emailId: ADMIN_LOGIN_EMAIL,
      password: adminHash,
      mobileNo: '9000000000',
      emailVerified: true,
      isSuperAdmin: true,
    },
  });

  // 1) Dealer (firm).
  const dealer = await prisma.dealer.upsert({
    where: { emailId: 'firm@rto.test' },
    update: {},
    create: {
      firmName: 'Demo Motors',
      dealerName: 'Demo Dealer',
      address: '123 MG Road',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380015',
      mobileNo: '9876500100',
      emailId: 'firm@rto.test',
      displayName: 'Demo Motors',
      whatsappNo: '9876500100',
      isSubscribe: true,
    },
  });

  // 2) Login user (email-verified so password login passes the gate).
  const user = await prisma.user.upsert({
    where: { emailId: DEALER_LOGIN_EMAIL },
    update: { password: passwordHash, emailVerified: true },
    create: {
      userName: 'Demo Dealer',
      emailId: DEALER_LOGIN_EMAIL,
      password: passwordHash,
      mobileNo: '9876500101',
      emailVerified: true,
    },
  });

  // 3) Link the user to the dealer (login then returns dealerId -> dealer UI).
  await prisma.dealerWiseUser.upsert({
    where: { userId: user.userId },
    update: { dealerId: dealer.dealerId },
    create: { userId: user.userId, dealerId: dealer.dealerId },
  });

  // 4) Master upload categories + per-dealer "view in step" links.
  for (let i = 0; i < UPLOAD_CATEGORIES.length; i += 1) {
    const c = UPLOAD_CATEGORIES[i];
    const category = await prisma.uploadCategory.upsert({
      where: { categoryName: c.categoryName },
      update: { bothSide: c.bothSide },
      create: { categoryName: c.categoryName, bothSide: c.bothSide, orderRank: i + 1 },
    });

    await prisma.dealerWiseUploadCategory.upsert({
      where: {
        dealerId_uploadCategoryId: {
          dealerId: dealer.dealerId,
          uploadCategoryId: category.categoryId,
        },
      },
      update: { orderRank: i + 1, isRequired: c.isRequired, isViewInStep: true },
      create: {
        dealerId: dealer.dealerId,
        uploadCategoryId: category.categoryId,
        orderRank: i + 1,
        isRequired: c.isRequired,
        isProcess: false,
        isViewInStep: true,
      },
    });
  }

  // 5) A couple of dealer references for the wizard dropdown.
  for (const ref of DEALER_REFERENCES) {
    const existing = await prisma.dealerReference.findFirst({
      where: { dealerId: dealer.dealerId, referenceName: ref.referenceName },
    });
    if (!existing) {
      await prisma.dealerReference.create({
        data: {
          dealerId: dealer.dealerId,
          referenceName: ref.referenceName,
          referenceNumber: ref.referenceNumber,
        },
      });
    }
  }

  // 6) Demo agent (firm) + login user + link + statuses (mirrors the dealer above).
  const agentHash = await bcrypt.hash(AGENT_LOGIN_PASSWORD, SALT_ROUNDS);
  const agent = await prisma.agent.upsert({
    where: { emailId: AGENT_FIRM_EMAIL },
    update: {},
    create: {
      firmName: 'Speedy RTO Agents',
      agentName: 'Ravi Agent',
      displayName: 'Speedy',
      address: 'RTO Circle',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380015',
      mobileNo: '9000000001',
      emailId: AGENT_FIRM_EMAIL,
      isSubscribe: true,
    },
  });

  // 7) Agent login user (email-verified) linked to the agent (login then returns agentId -> agent UI).
  const agentUser = await prisma.user.upsert({
    where: { emailId: AGENT_LOGIN_EMAIL },
    update: { password: agentHash, emailVerified: true },
    create: {
      userName: 'Ravi Owner',
      emailId: AGENT_LOGIN_EMAIL,
      password: agentHash,
      mobileNo: '9000000002',
      emailVerified: true,
    },
  });

  await prisma.agentWiseUser.upsert({
    where: { userId: agentUser.userId },
    update: { agentId: agent.agentId },
    create: { userId: agentUser.userId, agentId: agent.agentId },
  });

  // 8) Agent kanban statuses.
  for (let i = 0; i < AGENT_STATUSES.length; i += 1) {
    const s = AGENT_STATUSES[i];
    await prisma.agentStatus.upsert({
      where: { agentId_statusName: { agentId: agent.agentId, statusName: s.statusName } },
      update: { colour: s.colour, statusRank: i + 1 },
      create: { agentId: agent.agentId, statusName: s.statusName, colour: s.colour, statusRank: i + 1 },
    });
  }

  console.log('\n✅ Seed complete.');
  console.log('   Super-admin login:');
  console.log(`     email:    ${ADMIN_LOGIN_EMAIL}`);
  console.log(`     password: ${ADMIN_LOGIN_PASSWORD}`);
  console.log('   Dealer login:');
  console.log(`     email:    ${DEALER_LOGIN_EMAIL}`);
  console.log(`     password: ${DEALER_LOGIN_PASSWORD}`);
  console.log(`   dealerId:   ${dealer.dealerId}`);
  console.log('   Agent login:');
  console.log(`     email:    ${AGENT_LOGIN_EMAIL}`);
  console.log(`     password: ${AGENT_LOGIN_PASSWORD}`);
  console.log(`   agentId:    ${agent.agentId}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
