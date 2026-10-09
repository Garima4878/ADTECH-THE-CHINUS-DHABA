// Loads the shared restaurant menu and the dining tables into MongoDB. Safe to run more than once.
//
//   npm run seed                 # 17 dishes + tables T01-T10
//   SEED_TABLES=15 npm run seed  # tables T01-T15
//
// The menu comes from ai-assistant/data/restaurant-knowledge-base.json, the same list the website
// (MENU_SEED in app.js) and the AI assistant use, so names and prices match everywhere.
// Set SEED_ADMIN_PASSWORD (and optionally SEED_ADMIN_USERNAME, default "admin", and SEED_ADMIN_EMAIL)
// to create the first admin login for the restaurant dashboard.
require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Category = require('../src/models/Category');
const MenuItem = require('../src/models/MenuItem');
const Table = require('../src/models/Table');
const User = require('../src/models/User');

const KNOWLEDGE_BASE = path.join(__dirname, '..', 'ai-assistant', 'data', 'restaurant-knowledge-base.json');

const seed = async ({ tableCount = Number(process.env.SEED_TABLES) || 10, log = console.log } = {}) => {
  const kb = require(KNOWLEDGE_BASE);

  const categoryByKey = {};
  for (const category of kb.categories) {
    if (!kb.items.some((item) => item.category === category.id)) continue;
    categoryByKey[category.id] = await Category.findOneAndUpdate(
      { name: category.name },
      { name: category.name, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  for (const item of kb.items) {
    await MenuItem.findOneAndUpdate(
      { name: item.name },
      {
        name: item.name,
        category: categoryByKey[item.category]._id,
        price: item.price,
        description: item.description,
        imageUrl: `assets/menu/${item.id}.jpg`,
        isAvailable: item.available,
        isVeg: Boolean(item.is_veg),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  for (let number = 1; number <= tableCount; number += 1) {
    const tableId = `T${String(number).padStart(2, '0')}`;
    await Table.findOneAndUpdate(
      { tableId },
      { tableNumber: number, tableId, qrIdentifier: `chinu-${tableId}`, status: 'active' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  // First admin for the dashboard. Other staff accounts are then created on the dashboard's Staff page.
  const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
  const adminUsername = (process.env.SEED_ADMIN_USERNAME || 'admin').toLowerCase();
  if (SEED_ADMIN_PASSWORD) {
    const lookup = [{ username: adminUsername }];
    if (SEED_ADMIN_EMAIL) lookup.push({ email: SEED_ADMIN_EMAIL.toLowerCase() });
    const admin = (await User.findOne({ $or: lookup })) || new User();
    admin.name = admin.name || 'Restaurant Admin';
    admin.username = adminUsername;
    if (SEED_ADMIN_EMAIL) admin.email = SEED_ADMIN_EMAIL.toLowerCase();
    admin.role = 'admin';
    admin.isActive = true;
    admin.password = SEED_ADMIN_PASSWORD;
    await admin.save();
    log(`Admin login ready: username "${adminUsername}"${SEED_ADMIN_EMAIL ? ` or ${SEED_ADMIN_EMAIL}` : ''}`);
  }

  log(`Seeded ${Object.keys(categoryByKey).length} categories, ${kb.items.length} menu items, tables T01-T${String(tableCount).padStart(2, '0')}.`);
  log('QR link for a table: https://<website>/?table=T01');
};

if (require.main === module) {
  connectDB()
    .then(() => seed())
    .then(() => mongoose.disconnect())
    .catch(async (error) => {
      console.error('Seeding failed:', error.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { seed };
