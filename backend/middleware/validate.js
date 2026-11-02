const { AppError } = require('../engine/errors');

// Each rule parses a raw value and either returns the clean value or throws a message.
const rules = {
  string: ({ min = 0, max = 200, pattern, message } = {}) => (raw) => {
    if (typeof raw !== 'string') throw 'must be text';
    const value = raw.trim();
    if (value.length < min || value.length > max) throw `must be ${min}-${max} characters`;
    if (pattern && !pattern.test(value)) throw message ?? 'has an invalid format';
    return value;
  },
  int: ({ min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => (raw) => {
    const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
    if (!Number.isInteger(value) || value < min || value > max) throw `must be a whole number from ${min} to ${max}`;
    return value;
  },
  oneOf: (values) => (raw) => {
    if (!values.includes(raw)) throw `must be one of: ${values.join(', ')}`;
    return raw;
  },
  bool: () => (raw) => {
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true' || raw === 'false') return raw === 'true';
    throw 'must be true or false';
  },
  countryCode: () => rules.string({ min: 3, max: 3, pattern: /^[A-Z]{3}$/, message: 'must be a 3-letter country code' }),
  allocations: () => (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw 'must map country codes to soldiers';
    const entries = Object.entries(raw);
    if (entries.length === 0 || entries.length > 10) throw 'must list 1-10 countries';
    return Object.fromEntries(entries.map(([code, n]) => {
      if (!/^[A-Z]{3}$/.test(code)) throw `has an invalid country code "${code}"`;
      if (!Number.isInteger(n) || n < 0 || n > 500) throw `has an invalid amount for ${code}`;
      return [code, n];
    }));
  },
  optional: (rule, fallback) => ({ optional: true, rule, fallback }),
};

// validate({ body: {...}, query: {...} }) puts parsed values on req.valid; unknown fields are dropped.
function validate(schema) {
  return (req, _res, next) => {
    const errors = {};
    const valid = {};
    for (const [source, fields] of Object.entries(schema)) {
      const input = req[source] ?? {};
      for (const [field, spec] of Object.entries(fields)) {
        const { optional, rule, fallback } = typeof spec === 'function' ? { optional: false, rule: spec } : spec;
        const raw = input[field];
        if (raw === undefined || raw === null || raw === '') {
          if (optional) {
            if (fallback !== undefined) valid[field] = fallback;
            continue;
          }
          errors[field] = 'is required';
          continue;
        }
        try {
          valid[field] = rule(raw);
        } catch (message) {
          errors[field] = typeof message === 'string' ? message : 'is invalid';
        }
      }
    }
    if (Object.keys(errors).length) {
      const summary = Object.entries(errors).map(([f, m]) => `${f} ${m}`).join('; ');
      return next(new AppError(`Please fix: ${summary}.`, { status: 422, code: 'VALIDATION_FAILED', details: errors }));
    }
    req.valid = valid;
    next();
  };
}

module.exports = { validate, rules };
