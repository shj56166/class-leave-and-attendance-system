const path = require('path');
require('../server/node_modules/dotenv').config({
  path: path.resolve(__dirname, '..', 'server', '.env')
});

const sequelize = require('../server/src/config/database');
const { rebuildAllLeaveHistoryArchives } = require('../server/src/utils/leaveHistoryArchive');

async function main() {
  try {
    await sequelize.authenticate();
    await sequelize.transaction(async (transaction) => {
      await rebuildAllLeaveHistoryArchives(transaction);
    });
    console.log(`Leave history archives rebuilt for database ${process.env.DB_NAME}`);
    await sequelize.close();
  } catch (error) {
    console.error('Failed to rebuild leave history archives:', error);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

main();
