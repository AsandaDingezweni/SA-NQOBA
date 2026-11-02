const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 10;

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 20, match: /^[A-Za-z0-9_]+$/ },
    usernameKey: { type: String, required: true, unique: true },
    // Field name kept as "password" so accounts created before this version still log in.
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['player', 'admin'], default: 'player' },
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

userSchema.pre('validate', function setUsernameKey() {
  if (this.username) this.usernameKey = this.username.toLowerCase();
});

userSchema.methods.setPassword = async function setPassword(plain) {
  this.password = await bcrypt.hash(plain, BCRYPT_ROUNDS);
};

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

// Returns true on success; tracks failures and locks the account after repeated misses.
userSchema.methods.attemptLogin = async function attemptLogin(plain) {
  if (this.isLocked()) return false;
  const ok = await bcrypt.compare(plain, this.password);
  if (ok) {
    this.failedLogins = 0;
    this.lockUntil = null;
    this.lastLoginAt = new Date();
  } else {
    this.failedLogins += 1;
    if (this.failedLogins >= MAX_FAILED_LOGINS) {
      this.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
      this.failedLogins = 0;
    }
  }
  await this.save();
  return ok;
};

userSchema.methods.toPublic = function toPublic() {
  return { id: this._id.toString(), username: this.username, role: this.role, createdAt: this.createdAt };
};

userSchema.statics.findByUsername = function findByUsername(username, { withSecrets = false } = {}) {
  const query = this.findOne({ usernameKey: String(username).toLowerCase() });
  return withSecrets ? query.select('+password +failedLogins +lockUntil') : query;
};

module.exports = mongoose.model('User', userSchema);
