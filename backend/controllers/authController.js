const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { AppError } = require('../engine/errors');

const session = (user) => ({ token: signToken(user), user: user.toPublic() });

async function register(req, res) {
  const { username, password } = req.valid;
  if (await User.findByUsername(username)) {
    throw new AppError('That username is taken.', { status: 409, code: 'USERNAME_TAKEN' });
  }
  const user = new User({ username });
  await user.setPassword(password);
  await user.save();
  res.status(201).json(session(user));
}

async function login(req, res) {
  const { username, password } = req.valid;
  const user = await User.findByUsername(username, { withSecrets: true });
  if (user?.isLocked()) {
    throw new AppError('Too many failed attempts. Try again in a few minutes.', { status: 423, code: 'LOCKED' });
  }
  // Same message for unknown user and wrong password, so usernames cannot be probed.
  if (!user || !(await user.attemptLogin(password))) {
    throw new AppError('Invalid username or password.', { status: 401, code: 'BAD_CREDENTIALS' });
  }
  res.json(session(user));
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, me };
