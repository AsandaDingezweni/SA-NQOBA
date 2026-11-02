const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { AppError } = require('../engine/errors');

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env.jwtSecret, { expiresIn: env.jwtExpiresIn, algorithm: 'HS256' });
}

async function userFromRequest(req) {
  const header = req.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const { sub } = jwt.verify(header.slice(7), env.jwtSecret, { algorithms: ['HS256'] });
    const user = await User.findById(sub);
    return user ? { id: user._id.toString(), username: user.username, role: user.role } : null;
  } catch {
    return null;
  }
}

async function requireAuth(req, _res, next) {
  req.user = await userFromRequest(req);
  if (!req.user) return next(new AppError('Please log in to play.', { status: 401, code: 'UNAUTHENTICATED' }));
  next();
}

// Spectators are welcome; a valid token just lets the response say whether the viewer owns the game.
async function optionalAuth(req, _res, next) {
  req.user = await userFromRequest(req);
  next();
}

module.exports = { signToken, requireAuth, optionalAuth };
