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
    console.log(conversations[0]);
    return io.emit('conversation:update', { conversation: conversations[0] });
  };

  const gradeType = (grade) => {
    if (grade === 'low') return 'Плохо';
    if (grade === 'middle') return 'Нормально';
    if (grade === 'high') return 'Хорошо';
  };

  const createMessage = async (msg, grade) => {
    try {
      const conversation = await ConversationModel.findOne({
        chat_id: Number(msg.chat.id),
      });
      if (!conversation) {
        return;
      }
      msg.type = 'text';
      msg.unread = true;
      msg.text = `Оценка: ${gradeType(grade)}`;
      const message = await MessageModel.create(msg);
      await ConversationModel.updateOne(
        { _id: conversation?._id },
        {
          $push: { messages: message._id },
          $set: {
            title: msg.chat.title,
            grade: grade,
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

  bot.on('callback_query', async (query) => {
    console.log(query);
    const chatId = query.message.chat.id;
    query.message.from = query.from;
    const msg = query.message;
    const grade = query.data.split('_')[1];
    await createMessage(msg, grade);
    await bot.deleteMessage(chatId, msg.message_id);
    await bot.sendMessage(chatId, 'Спасибо за Ваше обращение! ');
    return await bot.answerCallbackQuery(query.id);
  });
};
