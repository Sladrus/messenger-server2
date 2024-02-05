const { default: mongoose } = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
require('dotenv').config();

const { ConversationModel } = require('../models/conversationModel');
const { MessageModel } = require('../models/messageModel');
const { StageModel } = require('../models/stageModel');
const { default: axios } = require('axios');
const stageHistoryService = require('../service/stageHistoryService');
const { TagModel } = require('../models/tagModel');

const token = process.env.API_TOKEN;
const mpToken = process.env.MP_API_TOKEN;

const officeToken = process.env.OFFICE_TOKEN;
const officeApi = axios.create({
  baseURL: 'http://app.moneyport.ru/office',
  headers: { 'x-api-key': `${token}` },
});

const mpApi = axios.create({
  baseURL: 'http://api.moneyport.world/',
  headers: { 'X-Api-Key': `${mpToken}` },
});

const screenApi = axios.create({
  baseURL: 'http://client.1210059-cn07082.tw1.ru',
});

const linkApi = axios.create({
  baseURL: 'http://link.1210059-cn07082.tw1.ru',
});

async function getOrder(chat_id) {
  try {
    const response = await mpApi.get(`/bot/get_order?chat_id=${chat_id}`);
    return response.data;
  } catch (error) {
    return;
  }
}

async function getChatInfo(chat_id) {
  try {
    const response = await mpApi.get(`/getChat?chat_id=${chat_id}`);
    return response.data;
  } catch (error) {
    return;
  }
}

async function getUser(value, type) {
  try {
    const response = await screenApi.get(`/user/${value}/${type}`);
    return response.data;
  } catch (error) {
    return;
  }
}

async function getLinkByUser(userId) {
  try {
    const response = await linkApi.get(`/link?userId=${userId}`);
    return response.data;
  } catch (error) {
    return;
  }
}

async function checkUser(value) {
  try {
    const response = await screenApi.post(`/user`, {
      value: value,
      type: 'TGID',
    });
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
          members: '$conversation.members',
          workAt: '$conversation.workAt',
          lastMessageId: { $arrayElemAt: ['$conversation.messages', -1] },
          stage: '$conversation.stage',
          user: '$conversation.user',
          grade: '$conversation.grade',
          tags: '$conversation.tags',
          tasks: '$conversation.tasks',
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
        $lookup: {
          from: 'tasks',
          localField: 'tasks',
          foreignField: '_id',
          as: 'tasks',
        },
      },
      {
        $unwind: {
          path: '$tasks',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'lastMessage.task',
          foreignField: '_id',
          as: 'messageTask',
        },
      },
      {
        $unwind: {
          path: '$messageTask',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'task_types',
          localField: 'messageTask.type',
          foreignField: '_id',
          as: 'messageTask.type',
        },
      },
      {
        $unwind: {
          path: '$messageTask.type',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'task_types',
          localField: 'tasks.type',
          foreignField: '_id',
          as: 'tasks.type',
        },
      },
      {
        $unwind: {
          path: '$tasks.type',
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
          members: {
            $first: '$members',
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
          grade: {
            $first: '$grade',
          },
          tags: {
            $addToSet: '$tags',
          },
          tasks: {
            $addToSet: '$tasks',
          },
          messageTask: {
            $first: '$messageTask',
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
      {
        $sort: { updatedAt: -1 },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          chat_id: 1,
          type: 1,
          unreadCount: 1,
          createdAt: 1,
          updatedAt: 1,
          members: 1,
          workAt: 1,
          lastMessage: {
            $mergeObjects: [
              { $arrayElemAt: ['$lastMessage', 0] }, // Extract the first element
              { task: '$messageTask' }, // Nest the task field inside lastMessage
            ],
          },
          stage: {
            _id: '$stage._id',
            value: '$stage.value',
            label: '$stage.label',
            color: '$stage.color',
          },
          user: 1,
          grade: 1,
          tags: 1,
          tasks: 1,
        },
      },
    ];
    const conversations = await ConversationModel.aggregate(pipeline);
    return io.emit('conversation:update', { conversation: conversations[0] });
  };

  const addTag = async ({ id, value }) => {
    let tag = await TagModel.findOne({ value: value });
    console.log(tag);
    if (!tag) tag = await TagModel.create({ value });
    console.log(tag);
    const conversation = await ConversationModel.findById(id);
    if (!conversation?.tags?.includes(tag._id)) {
      await ConversationModel.updateOne(
        { _id: id },
        { $push: { tags: tag._id }, $set: { updatedAt: new Date() } }
      );
    }
    return tag;
  };

  const createMessage = async (msg) => {
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
          await stageHistoryService.create({
            stageId: stage._id,
            convId: conversation._id,
          });
          const chatInfo = await getChatInfo(Number(conversation?.chat_id));
          if (chatInfo?.issued_by) {
            const tag = await addTag({
              id: conversation?._id,
              value: chatInfo?.issued_by,
            });
            console.log(tag);
          }
          const links = await getLinkByUser(msg.new_chat_member?.id);
          console.log(links);
          if (links?.length > 0) {
            await ConversationModel.updateOne(
              {
                _id: new ObjectId(conversation?._id),
              },
              {
                $set: {
                  refLink: links,
                },
              }
            );
            for (const link of links) {
              await addTag({
                id: conversation?._id,
                value: link?.name,
              });
            }
          }
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
          if (msg.new_chat_member?.id) {
            // const byName = await getUser(
            //   msg.new_chat_member?.username,
            //   'TGNAME'
            // );
            const byId = await getUser(msg.new_chat_member?.id, 'TGID');
            if (!byId) {
              const response = await checkUser(msg.new_chat_member?.id);
            }
          }
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
          // console.log(e);
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
