const { StageHistoryModel } = require('../models/stageHistoryModel');
require('dotenv').config();

class StageHistoryService {
  async create({ stageId, convId }) {
    const record = StageHistoryModel.create({
      stage: stageId,
      conversation: convId,
      createdAt: new Date(),
    });
    return record;
  }
}

module.exports = new StageHistoryService();
