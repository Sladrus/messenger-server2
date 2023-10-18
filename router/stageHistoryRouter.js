const Router = require('express');
const stageHistoryController = require('../controllers/stageHistoryController');
const router = new Router();

router.get('/static/weeks', stageHistoryController.getByWeeksStatic);
router.get('/dynamic/weeks', stageHistoryController.getByWeeksDynamic);

module.exports = router;
