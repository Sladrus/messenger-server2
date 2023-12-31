const Router = require('express');
const stageHistoryController = require('../controllers/stageHistoryController');
const router = new Router();

router.get('/static/weeks', stageHistoryController.getByWeeksStatic);
router.post('/static/weeks', stageHistoryController.getByWeeksStatic);
router.post('/dynamic/users', stageHistoryController.getByUsers);
router.post('/dynamic/tags', stageHistoryController.getByTags);

module.exports = router;
