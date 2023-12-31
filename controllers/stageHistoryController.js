const {
  getByWeeksStatic,
  getByWeeksDynamic,
  getByUsers,
  getByTags,
} = require('../service/stageHistoryService');

class StageHistoryController {
  async getByWeeksStatic(req, res, next) {
    try {
      const body = req.body;
      const result = await getByWeeksStatic(body);
      return res.json(result);
    } catch (e) {
      console.log(e);
      next(e);
    }
  }

  async getByUsers(req, res, next) {
    try {
      const body = req.body;
      const result = await getByUsers(body);
      return res.json(result);
    } catch (e) {
      console.log(e);
      next(e);
    }
  }

  async getByTags(req, res, next) {
    try {
      const body = req.body;
      const result = await getByTags(body);
      return res.json(result);
    } catch (e) {
      console.log(e);
      next(e);
    }
  }
}

module.exports = new StageHistoryController();
