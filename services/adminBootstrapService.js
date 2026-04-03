import AdminUser from '../models/adminUser.js';

export const ensureSeedAdminUser = async () => {
  const existingCount = await AdminUser.countDocuments();
  if (existingCount > 0) {
    return;
  }

  const email = process.env.ADMIN_SEED_EMAIL || 'admin@local.dev';
  const password = process.env.ADMIN_SEED_PASSWORD || 'Admin@12345';
  const name = process.env.ADMIN_SEED_NAME || 'Platform Admin';

  await AdminUser.create({
    email,
    password,
    name,
  });

  console.log(`[AdminBootstrap] Seeded default admin user: ${email}`);
};
