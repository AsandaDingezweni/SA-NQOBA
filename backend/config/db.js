const dns = require('node:dns');
const mongoose = require('mongoose');
const Country = require('../models/Country');
const User = require('../models/User');
const catalogue = require('../data/countries');
const { soldierValueFor } = require('../engine/rules');

const PUBLIC_RESOLVERS = ['1.1.1.1', '8.8.8.8'];
const OPTIONS = { serverSelectionTimeoutMS: 15000 };

// Some home/ISP resolvers cannot answer the SRV lookups behind mongodb+srv:// URIs.
// Use the host's resolver first and fall back to public DNS only if that lookup fails,
// so locked-down servers that block outbound DNS still work.
async function connectDatabase(uri) {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, OPTIONS);
  } catch (err) {
    const srvFailure = /querySrv|ENOTFOUND|ECONNREFUSED|ETIMEOUT/.test(String(err.message));
    if (!uri.startsWith('mongodb+srv://') || !srvFailure) throw err;
    console.warn(`Atlas SRV lookup failed with the system resolver (${err.message}); retrying with public DNS.`);
    dns.setServers(PUBLIC_RESOLVERS);
    await mongoose.connect(uri, OPTIONS);
  }
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

// Idempotent: re-running converges the collection to the catalogue, so a brand-new database works.
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
