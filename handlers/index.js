const registerUserHandlers = require("./userHandlers");
const registerConversationHandlers = require("./conversationHandlers");
const registerStageHandlers = require("./stageHandlers");
const registerTagsHandlers = require("./tagsHandlers");
const registerTaskTypesHandlers = require("./taskTypeHandlers");
const registerTasksHandlers = require("./taskHandlers");
const registerOrdersHandlers = require("./ordersHandlers");

const registerHandlers = (io, socket) => {
  registerUserHandlers(io, socket);
  registerConversationHandlers(io, socket);
  registerStageHandlers(io, socket);
  registerTagsHandlers(io, socket);
  registerTaskTypesHandlers(io, socket);
  registerTasksHandlers(io, socket);
  registerOrdersHandlers(io, socket);
};

module.exports = { registerHandlers };
