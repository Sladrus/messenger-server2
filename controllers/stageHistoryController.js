const {
  getByWeeks,
  getByWeeksStatic,
  getByWeeksDynamic,
  getByUsers,
} = require('../service/stageHistoryService');

class StageHistoryController {
  async getByWeeksStatic(req, res, next) {
    try {
      const body = req.body;
      const result = await getByWeeksStatic();
      return res.json(result);
    } catch (e) {
      console.log(e);
      next(e);
    }
  }

  async getByWeeksDynamic(req, res, next) {
    try {
      const body = req.body;
      const result = await getByWeeksDynamic();
      return res.json(result);
    } catch (e) {
      console.log(e);
      next(e);
    }
  }

  async getByUsers(req, res, next) {
    try {
      const body = req.body;
      console.log(body);
      const result = await getByUsers(body);
      return res.json(result);
    } catch (e) {
      console.log(e);
      next(e);
    }
  }
}

module.exports = new StageHistoryController();
