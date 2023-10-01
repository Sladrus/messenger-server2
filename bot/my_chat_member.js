const { default: mongoose } = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const { ConversationModel } = require('../models/conversationModel');
const { MessageModel } = require('../models/messageModel');

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
          tags: 1,
          tasks: 1,
        },
      },
    ];
    const conversations = await ConversationModel.aggregate(pipeline);
    return io.emit('conversation:update', { conversation: conversations[0] });
  };

  const createMessage = async (msg) => {
    if (!msg.new_chat_member.user.is_bot) return;
    const status = msg.new_chat_member.status;
    try {
      if (status === 'administrator') {
        msg.type = 'event';
        msg.text = 'Права администратора установлены.';
        const m = await bot.sendMessage(msg.chat.id, msg.text);
        const message = await MessageModel.create(msg);
        console.log(message);
        await ConversationModel.updateOne(
          { chat_id: msg.chat.id },
          {
            $push: { messages: message._id },
            $set: {
              updatedAt: new Date(),
            },
          }
        );
        const conversation = await ConversationModel.findOne({
          chat_id: msg.chat.id,
        });
        return await findOneConversation(conversation?._id);
      }
    } catch (e) {
      console.log(e);
      io.emit('error', { message: e.message });
    }
  };

  bot.on('my_chat_member', async (msg) => {
    await createMessage(msg);
  });
};