const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, match: /^[A-Z]{3}$/ },
    iso2: { type: String, required: true, match: /^[a-z]{2}$/ },
    name: { type: String, required: true, trim: true },
    region: { type: String, required: true, enum: ['Africa', 'Asia', 'Europe', 'Americas', 'Oceania'], index: true },
    population: { type: Number, required: true, min: 0 },
    soldiers: { type: Number, required: true, min: 1, max: 9, index: true },
  },
  { timestamps: true, versionKey: false },
);

countrySchema.index({ name: 1 });

module.exports = mongoose.model('Country', countrySchema);
