const Country = require('../models/Country');

const SORTS = {
  name: { name: 1 },
  population: { population: -1 },
  soldiers: { soldiers: -1, name: 1 },
};

async function list(req, res) {
  const { search, region, minSoldiers, maxSoldiers, sort } = req.valid;
  const filter = { soldiers: { $gte: minSoldiers, $lte: maxSoldiers } };
  if (region) filter.region = region;
  if (search) filter.name = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const countries = await Country.find(filter).select('-_id -createdAt -updatedAt').sort(SORTS[sort]).lean();
  res.json({ countries, total: countries.length });
}

module.exports = { list };
