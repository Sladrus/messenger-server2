const Router = require('express');
const stageHistoryController = require('../controllers/stageHistoryController');
const router = new Router();

router.get('/static/weeks', stageHistoryController.getByWeeksStatic);
router.get('/dynamic/weeks', stageHistoryController.getByWeeksDynamic);
router.post('/dynamic/users', stageHistoryController.getByUsers);

module.exports = router;
