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
    try {
      const conversation = await ConversationModel.findOne({
        chat_id: Number(msg.chat.id),
      });
      if (!conversation) {
        return;
      }
      msg.type = 'event';
      msg.text = `Название чата сменилось на "${msg.new_chat_title}"`;
      msg.unread = true;

      const message = await MessageModel.create(msg);
      await ConversationModel.updateOne(
        { _id: conversation?._id },
        {
          $push: { messages: message._id },
          $set: {
            title: msg.new_chat_title,
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
      io.emit('error', { message: e.message });
    }
  };

  bot.on('new_chat_title', async (msg) => {
    await createMessage(msg);
  });
};
