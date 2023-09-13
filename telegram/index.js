const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const registerTextHandler = require('./text');
const registerPhotoHandler = require('./photo');
const registerDocumentHandler = require('./document');
const registerMigrateToIdHandler = require('./migrate_to_chat_id');
const registerMyMemberHandler = require('./my_chat_member');
const registerLeftMemberHandler = require('./left_chat_member');
const registerNewMemberHandler = require('./new_chat_members');
const registerChatCreatedHandler = require('./group_chat_created');
const registerNewTitleHandler = require('./new_chat_title');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

function registerBotHandlers(io) {
  registerTextHandler(bot, io);
  registerPhotoHandler(bot, io);
  registerDocumentHandler(bot, io);
  registerMigrateToIdHandler(bot, io);
  registerMyMemberHandler(bot, io);
  registerLeftMemberHandler(bot, io);
  registerNewMemberHandler(bot, io);
  registerChatCreatedHandler(bot, io);
  registerNewTitleHandler(bot, io);
}

async function botSendMessage(chat_id, message, options) {
  return await bot.sendMessage(chat_id, message, options);
}

async function exportLink(chat_id) {
  return await bot.exportChatInviteLink(chat_id);
}

module.exports = { bot, registerBotHandlers, botSendMessage, exportLink };
