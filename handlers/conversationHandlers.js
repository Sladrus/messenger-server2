const { default: mongoose } = require('mongoose');
const { ConversationModel } = require('../models/conversationModel');
const { MessageModel } = require('../models/messageModel');
const { TagModel } = require('../models/tagModel');
const { TaskTypeModel } = require('../models/taskTypeModel');
const { bot, botSendMessage, exportLink } = require('../telegram');
const { default: axios } = require('axios');
const { StageModel } = require('../models/stageModel');
const ObjectId = mongoose.Types.ObjectId;

const token = process.env.API_TOKEN;

const baseApi = axios.create({
  baseURL: 'http://20.67.242.227/bot',
  headers: { 'x-api-key': `${token}` },
});

async function createMoneysendApi(body) {
  try {
    const response = await baseApi.post(`/task/moneysend`, body);
    return response.data;
  } catch (error) {
    console.log(error);
  }
}

module.exports = (io, socket) => {
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

  const getConversations = async ({ filter }) => {
    try {
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

      if (filter?.user && filter.user !== 'all' && filter.user !== 'nobody') {
        const userId = new ObjectId(filter.user);
        pipeline.unshift({ $match: { user: userId } });
      }
      if (filter?.user === 'nobody') {
        pipeline.unshift({ $match: { user: null } });
      }
      if (filter?.stage && filter.stage !== 'all') {
        const stageId = new ObjectId(filter.stage);
        pipeline.unshift({ $match: { stage: stageId } });
      }
      if (filter.unread === true) {
        pipeline.unshift({ $match: { unreadCount: { $gt: 0 } } });
      }
      if (filter.unread === false) {
        pipeline.unshift({ $match: { unreadCount: { $eq: 0 } } });
      }
      if (filter?.tags && filter.tags.length > 0) {
        const tagIds = filter.tags.map((tag) => new ObjectId(tag._id));
        pipeline.unshift({ $match: { tags: { $in: tagIds } } });
      }
      if (filter.dateRange) {
        const startDate = filter.dateRange?.startDate
          ? new Date(filter.dateRange.startDate)
          : new Date(0);
        const endDate = new Date(filter.dateRange.endDate);

        pipeline.unshift({
          $match: {
            workAt: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        });
      }
      const conversations = await ConversationModel.aggregate(pipeline);

      return socket.emit('conversations:set', { conversations });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };

  const getSearchedConversations = async ({ searchInput }) => {
    try {
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
            title: {
              $regex: searchInput,
              $options: 'i',
            },
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

      return socket.emit('conversations:setSearch', { conversations });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };

  const getOneConversation = async ({ selectedChatId }) => {
    try {
      const conversation = await ConversationModel.findOne({
        chat_id: selectedChatId,
      })
        .populate('messages')
        .populate('user')
        .populate({ path: 'stage', select: '-conversations' })
        .populate({ path: 'tags', select: '-conversations' });
      return socket.emit('conversations:setOne', { conversation });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };

  const updateStage = async ({ id, stageId }) => {
    console.log(id);
    try {
      await ConversationModel.updateOne(
        {
          _id: new ObjectId(id),
        },
        { $set: { stage: new ObjectId(stageId), updatedAt: new Date() } }
      );

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
    } catch (e) {
      console.log(e);

      socket.emit('error', { message: e.message });
    }
  };

  const updateUser = async ({ id, userId }) => {
    try {
      await ConversationModel.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            user: userId ? new ObjectId(userId) : null,
            updatedAt: new Date(),
          },
        }
      );

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
    } catch (e) {
      console.log(e);

      socket.emit('error', { message: e.message });
    }
  };

  const updateTags = async ({ id, tags }) => {
    console.log(id, tags);

    try {
      await ConversationModel.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            tags:
              tags?.length > 0 ? tags.map((tag) => new ObjectId(tag._id)) : [],
            updatedAt: new Date(),
          },
        }
      );

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
    } catch (e) {
      console.log(e);

      socket.emit('error', { message: e.message });
    }
    await getOneConversation({ id });
  };

  const createTag = async ({ id, value }) => {
    try {
      const tag = await TagModel.create({ value: value });
      await ConversationModel.updateOne(
        { _id: id },
        { $push: { tags: tag._id }, $set: { updatedAt: new Date() } }
      );

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
      io.emit('conversation:update', { conversation: conversations[0] });

      const tags = await TagModel.find();
      return io.emit('tags:set', { tags });
    } catch (e) {
      console.log(e);

      socket.emit('error', { message: e.message });
    }
  };

  const createComment = async ({ id, value }) => {
    await getOneConversation({ selectedChatId: id });
  };

  const sendMessage = async ({ id, text, type, user }) => {
    try {
      const conversation = await ConversationModel.findOne({
        _id: id,
      });
      const botMessage = await botSendMessage(conversation?.chat_id, text);

      botMessage.type = type;
      botMessage.from.id = user._id;
      botMessage.from.first_name = user.username;
      botMessage.unread = false;

      const message = await MessageModel.create(botMessage);
      await ConversationModel.updateOne(
        { _id: id },
        {
          $push: { messages: message._id },
          $set: { updatedAt: new Date(), unreadCount: 0 },
        }
      );
      const messages = conversation.messages;
      const messageIds = messages.map((message) => message._id);
      await MessageModel.updateMany(
        { _id: { $in: messageIds } },
        { unread: false }
      );

      return await findOneConversation(id);
    } catch (e) {
      console.log(e);

      socket.emit('error', { message: e.message });
    }
  };

  const createMoneysend = async ({ id, data }) => {
    try {
      const conversation = await ConversationModel.findOne({
        _id: new ObjectId(id),
      });
      console.log('TYT', data, conversation);

      if (!data?.link) {
        try {
          const link = await exportLink(conversation.chat_id);
          await ConversationModel.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: { link },
            }
          );
          data.link = link;
        } catch (e) {
          console.log(e);
          socket.emit('error', { message: e.message });
        }
      }
      var timestamp = Date.now();
      var date = new Date(timestamp);
      var formatOptions = {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      };
      var formattedDate = date.toLocaleDateString('ru-RU', formatOptions);
      const text = `${data.title} от ${data.user.username}\n\n→ ${data?.link}\n\n<pre>Объем: ${data?.volume}\n\n← Отдают: ${data?.give}\n→ Получают: ${data?.take}\n\n• Регулярность: ${data?.regularity}\n• Сроки: ${data?.date}\n• Комментарий: ${data?.comment}\n\nУсловия: ${data?.conditions}</pre>\n\n———\nChat ID: ${conversation.chat_id}\nДата: ${formattedDate}`;
      const response = await createMoneysendApi({
        chat_id: conversation.chat_id,
        task: text,
        manager_id: 1,
        create_date: Date.now(),
      });
      const message = await botSendMessage(-1001815632960, text, {
        parse_mode: 'HTML',
      });
      message.type = 'text';
      message.from.id = data.user._id;
      message.from.first_name = data.user.username;
      message.unread = false;

      const createdMessage = await MessageModel.create(message);
      await ConversationModel.updateOne(
        { _id: new ObjectId(id) },
        {
          $push: { messages: createdMessage._id },
          $set: {
            updatedAt: new Date(),
          },
        }
      );
      const msg = await botSendMessage(
        conversation.chat_id,
        `Отлично! Задача зарегестрированна под номером ${response?.id}, уже зову специалиста отдела процессинга. Пожалуйста, ожидайте.\n\n<pre>Объем: ${data?.volume}\n\n← Отдают: ${data?.give}\n→ Получают: ${data?.take}\n\n• Регулярность: ${data?.regularity}\n• Сроки: ${data?.date}\n• Комментарий: ${data?.comment}\n\nУсловия: ${data?.conditions}</pre>`,
        {
          parse_mode: 'HTML',
        }
      );
      msg.type = 'text';
      msg.from.id = data.user._id;
      msg.from.first_name = data.user.username;
      msg.unread = false;
      const crtMsg = await MessageModel.create(msg);
      await ConversationModel.updateOne(
        { _id: new ObjectId(id) },
        {
          $push: { messages: crtMsg._id },
          $set: {
            updatedAt: new Date(),
          },
        }
      );

      const stage = await StageModel.findOne({ value: 'task' });
      await ConversationModel.updateOne(
        {
          _id: new ObjectId(id),
        },
        { $set: { stage: new ObjectId(stage._id), updatedAt: new Date() } }
      );
      return await findOneConversation(id);
    } catch (e) {
      console.log(e);
      socket.emit('error', { message: e.message });
    }
  };

  socket.on('conversations:get', getConversations);
  socket.on('conversations:getSearch', getSearchedConversations);
  socket.on('conversations:getOne', getOneConversation);

  socket.on('conversation:updateStage', updateStage);
  socket.on('conversation:updateUser', updateUser);
  socket.on('conversation:updateTags', updateTags);
  socket.on('conversation:createTag', createTag);
  socket.on('conversation:createComment', createComment);
  socket.on('conversation:createMoneysend', createMoneysend);

  socket.on('message:sendMessage', sendMessage);
};
