const dns = require('node:dns/promises');
const mongoose = require('mongoose');
const Country = require('../models/Country');
const User = require('../models/User');
const catalogue = require('../data/countries');
const { soldierValueFor } = require('../engine/rules');

// Some ISP resolvers fail Atlas SRV lookups; public resolvers make mongodb+srv:// reliable.
dns.setServers(['1.1.1.1', '8.8.8.8']);

async function connectDatabase(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
  await migrateLegacyUsers();
  await seedCountries();
  await User.syncIndexes();
}

// Accounts created by the first prototype have no case-insensitive lookup key.
async function migrateLegacyUsers() {
  await User.updateMany(
    { usernameKey: { $exists: false } },
    [{ $set: { usernameKey: { $toLower: '$username' } } }],
    { updatePipeline: true },
  );
}

// Idempotent: re-running converges the collection to the catalogue.
async function seedCountries() {
  const ops = catalogue.map((c) => ({
    updateOne: {
      filter: { code: c.code },
      update: { $set: { ...c, soldiers: soldierValueFor(c.population) } },
      upsert: true,
    },
  }));
  await Country.bulkWrite(ops, { ordered: false });
  await Country.deleteMany({ code: { $nin: catalogue.map((c) => c.code) } });
}

module.exports = { connectDatabase, seedCountries };
