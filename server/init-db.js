const sequelize = require('./src/config/database');
const { seedDemoData } = require('./seed-demo-data');

async function initDatabase() {
  try {
    console.log('Initializing demo data on top of the migrated schema...');
    console.log('For a full backup + reset flow, run `npm run db:reset:demo` from the project root.');

    await seedDemoData({ logger: console });
    process.exit(0);
  } catch (error) {
    console.error('Demo data initialization failed:', error.message);
    console.error('Make sure migrations are applied first with `cd server && npx sequelize-cli db:migrate`.');
    process.exit(1);
  } finally {
    await sequelize.close().catch(() => {});
  }
}

initDatabase();
