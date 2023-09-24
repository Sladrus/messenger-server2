const { default: mongoose } = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
require('dotenv').config();

const { ConversationModel } = require('../models/conversationModel');
const { MessageModel } = require('../models/messageModel');
const { StageModel } = require('../models/stageModel');
const { default: axios } = require('axios');

const token = process.env.API_TOKEN;
const officeToken = process.env.OFFICE_TOKEN;
const officeApi = axios.create({
  baseURL: 'http://app.moneyport.ru/office',
  headers: { 'x-api-key': `${token}` },
});

async function getOrder(chat_id) {
  try {
    const response = await officeApi.get(
      `/order?chat_id=${chat_id}&api_key=${officeToken}`
    );
    return response.data;
  } catch (error) {
    return;
  }
}

module.exports = (bot, io) => {
  const findOneConversation = async (id) => {
    const pipeline = [
      {
        $group: {
          _id: { chat_id: '$chat_id', createdAt: '$createdAt' },
          updatedAt: { $max: '$updatedAt' },
          conversation: { $first: '$$ROOT' },
        },
      },
      {
        $project: {
          _id: '$conversation._id',
          title: '$conversation.title',
          chat_id: '$conversation.chat_id',
          type: '$conversation.type',
          unreadCount: '$conversation.unreadCount',
          createdAt: '$conversation.createdAt',
          updatedAt: '$conversation.updatedAt',
          workAt: '$conversation.workAt',
          lastMessageId: { $arrayElemAt: ['$conversation.messages', -1] },
          stage: '$conversation.stage',
          user: '$conversation.user',
          tags: '$conversation.tags',
        },
      },
      {
        $lookup: {
          from: 'messages',
          localField: 'lastMessageId',
          foreignField: '_id',
          as: 'lastMessage',
        },
      },
      {
        $lookup: {
          from: 'stages',
          localField: 'stage',
          foreignField: '_id',
          as: 'stage',
        },
      },
      {
        $unwind: '$stage',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'tags',
          localField: 'tags',
          foreignField: '_id',
          as: 'tags',
        },
      },
      {
        $unwind: {
          path: '$tags',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$_id',
          title: {
            $first: '$title',
          },
          chat_id: {
            $first: '$chat_id',
          },
          type: {
            $first: '$type',
          },
          unreadCount: {
            $first: '$unreadCount',
          },
          createdAt: {
            $first: '$createdAt',
          },
          updatedAt: {
            $first: '$updatedAt',
          },
          workAt: {
            $first: '$workAt',
          },
          lastMessage: {
            $first: '$lastMessage',
          },
          stage: {
            $first: '$stage',
          },
          user: {
            $first: '$user',
          },
          tags: {
            $addToSet: '$tags',
          },
        },
      },
      {
        $match: {
          _id: new ObjectId(id),
        },
      },
      {
        $match: {
          workAt: {
            $gte: new Date(0),
            $lte: new Date(
              new Date().getFullYear(),
              new Date().getMonth(),
              new Date().getDate(),
              23,
              59,
              59
            ),
          },
        },
      },
      { $sort: { updatedAt: -1 } },
      {
        $project: {
          _id: 1,
          title: 1,
          chat_id: 1,
          type: 1,
          unreadCount: 1,
          createdAt: 1,
          updatedAt: 1,
          workAt: 1,
          lastMessage: { $arrayElemAt: ['$lastMessage', 0] },
          stage: {
            _id: '$stage._id',
            value: '$stage.value',
            label: '$stage.label',
            color: '$stage.color',
          },
          user: 1,
          tags: 1,
        },
      },
    ];
    const conversations = await ConversationModel.aggregate(pipeline);
    return io.emit('conversation:update', { conversation: conversations[0] });
  };

  const createMessage = async (msg) => {
    console.log(msg);

    try {
      const conversation = await ConversationModel.findOne({
        chat_id: Number(msg.chat.id),
      });
      if (!conversation) {
        return;
      }
      const order = await getOrder(Number(msg.chat.id));

      const fullName = msg.new_chat_member?.last_name
        ? msg.new_chat_member.first_name + ' ' + msg.new_chat_member?.last_name
        : msg.new_chat_member.first_name;

      msg.type = 'event';
      msg.text = `Пользователь ${fullName} вошел в чат. ${
        !conversation?.members?.length && order && order['how_to_send']
          ? `\n1. Хотите совершить перевод: ${order['how_to_send']} \n2. Валюта получения: ${order['symbol']}\n3. Сумма к получению: ${order['summ']}`
          : ''
      }`;
      msg.unread = true;

      const message = await MessageModel.create(msg);
      await ConversationModel.updateOne(
        { _id: conversation?._id },
        {
          $push: { messages: message._id, members: msg.new_chat_member },
          $set: {
            updatedAt: new Date(),
            unreadCount: conversation?.unreadCount
              ? conversation?.unreadCount + 1
              : 1,
          },
        }
      );

      return await findOneConversation(conversation?._id);
    } catch (e) {
      console.log(e);
    }
  };

  const updateStage = async (msg) => {
    try {
      let conversation = await ConversationModel.findOne({
        chat_id: Number(msg.chat.id),
      });
      const stage = await StageModel.findOne({ value: 'raw' });
      if (!conversation) {
        const newConversation = await ConversationModel.create({
          title: msg.chat.title,
          chat_id: msg.chat.id,
          unreadCount: 0,
          type: msg.chat.type,
          stage: stage._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        conversation = newConversation;
      } else {
        if (!conversation?.workAt) {
          await ConversationModel.updateOne(
            {
              _id: new ObjectId(conversation?._id),
            },
            {
              $set: {
                title: msg.chat.title,
                stage: new ObjectId(stage._id),
                workAt: Date.now(),
                updatedAt: Date.now(),
              },
            }
          );
          await bot.sendMessage(
            -1001955007812,
            `Пользователь ${
              msg.new_chat_member?.last_name
                ? msg.new_chat_member.first_name +
                  ' ' +
                  msg.new_chat_member?.last_name
                : msg.new_chat_member.first_name
            } зашел в чат\n\n<b>${msg.chat.title}</b>\n\nChat ID: ${
              msg.chat.id
            }\nUsername: ${
              msg.new_chat_member?.username
                ? '@' + msg.new_chat_member?.username
                : 'Отсутствует'
            }`,
            { parse_mode: 'HTML' }
          );
        }
      }
      if (!conversation?.link) {
        try {
          const link = await bot.exportChatInviteLink(conversation.chat_id);
          await ConversationModel.updateOne(
            {
              _id: new ObjectId(conversation?._id),
            },
            {
              $set: {
                link,
              },
            }
          );
        } catch (e) {
          console.log(e);
        }
      }
    } catch (e) {
      console.log(e);
    }
  };

  const createConversation = async (msg) => {
    const conversation = await ConversationModel.findOne({
      chat_id: Number(msg.chat.id),
    });
    if (conversation) return;
    const stage = await StageModel.findOne({ value: 'ready' });
    await ConversationModel.create({
      title: msg.chat.title,
      chat_id: msg.chat.id,
      unreadCount: 0,
      type: msg.chat.type,
      stage: stage._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  bot.on('new_chat_members', async (msg) => {
    console.log(msg);
    const me = await bot.getMe();
    if (msg.new_chat_member.id == 6174655831) return;
    if (me.id != msg.new_chat_member.id) {
      await updateStage(msg);
      await createMessage(msg);
    } else {
      await createConversation(msg);
    }
  });
};
