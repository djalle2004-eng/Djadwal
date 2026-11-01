const base = require('./baseRepository.js');
const entities = require('./entities.js');
const changeLog = require('./changeLogRepository.js');
const impact = require('./impactCalculator.js');

module.exports = {
  ...base,
  ...entities,
  ...changeLog,
  ...impact
};

