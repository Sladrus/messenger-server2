const Router = require('express').Router;
const stageHistoryRouter = require('./stageHistoryRouter');

const router = new Router();

router.use('/analytics', stageHistoryRouter);

module.exports = router;
