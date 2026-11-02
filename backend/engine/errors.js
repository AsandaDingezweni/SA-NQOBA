class AppError extends Error {
  constructor(message, { status = 400, code = 'BAD_REQUEST', details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class GameRuleError extends AppError {
  constructor(message, code = 'RULE_VIOLATION') {
    super(message, { status: 409, code });
  }
}

module.exports = { AppError, GameRuleError };
