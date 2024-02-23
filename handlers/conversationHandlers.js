const { default: mongoose } = require('mongoose');
const { ConversationModel } = require('../models/conversationModel');
const { MessageModel } = require('../models/messageModel');
const { TagModel } = require('../models/tagModel');
const { TaskTypeModel } = require('../models/taskTypeModel');
const { bot, botSendMessage, exportLink } = require('../bot');
const { default: axios } = require('axios');
const { StageModel } = require('../models/stageModel');
const { telegramSendMessage } = require('../telegram');
const { TaskModel } = require('../models/taskModel');
const stageHistoryService = require('../service/stageHistoryService');
const { ReadHistoryModel } = require('../models/readHistoryModel');
const ObjectId = mongoose.Types.ObjectId;

const token = process.env.API_TOKEN;

const BOT_API_URL = process.env.BOT_API_URL;

const baseApi = axios.create({
  baseURL: BOT_API_URL,
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

async function sendChatApi() {
  try {
    const response = await baseApi.get(`/chat/empty`);
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
      if (filter?.type && filter.type !== 'all') {
        if (filter?.type === 'private')
          pipeline.unshift({ $match: { type: 'private' } });
        else
          pipeline.unshift({
            $match: { type: { $in: ['group', 'supergroup'] } },
          });
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
      console.log(e);
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
            grade: '$conversation.grade',

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
            grade: {
              $first: '$grade',
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
            grade: 1,
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

  const getOneTask = async ({ id }) => {
    try {
      const task = await TaskModel.findOne({ _id: id })
        .populate('conversation')
        .populate('type');
      io.emit('task:update', { task });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };

  const getOneConversation = async ({ selectedChatId }) => {
    try {
      const conversation = await ConversationModel.findOne({
        chat_id: selectedChatId,
      })
        .populate({
          path: 'messages',
          populate: { path: 'task', populate: { path: 'type' } },
        })
        .populate({
          path: 'user',
        })
        .populate({ path: 'stage', select: '-conversations' })
        .populate({ path: 'tags', select: '-conversations' })
        .populate({
          path: 'tasks',
          select: '-conversation',
          populate: { path: 'type' },
        });

      return socket.emit('conversations:setOne', { conversation });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };

  const updateStage = async ({ id, stageId }) => {
    try {
      await ConversationModel.updateOne(
        {
          _id: new ObjectId(id),
        },
        { $set: { stage: new ObjectId(stageId), updatedAt: new Date() } }
      );
      const history = await stageHistoryService.create({
        stageId: new ObjectId(stageId),
        convId: new ObjectId(id),
      });
      console.log(history);
      return await findOneConversation(id);
    } catch (e) {
      console.log(e);

      socket.emit('error', { message: e.message });
    }
  };

  const editStage = async ({ id, stage }) => {
    try {
      await StageModel.updateOne(
        {
          _id: new ObjectId(id),
        },
        { $set: stage }
      );
      const stages = await StageModel.find().sort({ position: 1 });

      return io.emit('stages:set', { stages });
    } catch (e) {
      console.log(e);
      socket.emit('error', { message: e.message });
    }
  };

  const deleteStage = async ({ id, stage }) => {
    try {
      const conversationsWithStage = await ConversationModel.find({ stage });

      if (conversationsWithStage.length > 0) {
        throw new Error('Нельзя удалить, так как есть чаты с этим статусом.');
      }
      await StageModel.deleteOne({
        _id: new ObjectId(id),
      });
      const stages = await StageModel.find().sort({ position: 1 });

      return io.emit('stages:set', { stages });
    } catch (e) {
      console.log(e);
      socket.emit('error', { message: e.message });
    }
  };

  const moveStage = async ({ id, position }) => {
    try {
      const totalRecords = await StageModel.count();

      if (position < 0 || position >= totalRecords) {
        throw new Error('Неверная позиция');
      }
      const recordToMove = await StageModel.findOne({
        _id: new ObjectId(id),
      });
      if (!recordToMove) {
        throw new Error('Такой записи не существует');
      }
      const currentPosition = recordToMove.position;
      await StageModel.updateOne(
        { position },
        { $set: { position: currentPosition } }
      );
      recordToMove.position = position;
      await recordToMove.save();

      const stages = await StageModel.find().sort({ position: 1 });

      return io.emit('stages:set', { stages });
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

      return await findOneConversation(id);
    } catch (e) {
      console.log(e);

      socket.emit('error', { message: e.message });
    }
  };

  const updateTags = async ({ id, tags }) => {
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

      return await findOneConversation(id);
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

      await findOneConversation(id);

      const tags = await TagModel.find();
      return io.emit('tags:set', { tags });
    } catch (e) {
      console.log(e);

      socket.emit('error', { message: e.message });
    }
  };

  const removeTag = async ({ id }) => {
    try {
      const tag = await TagModel.findOne({ _id: id });
      const conversations = await ConversationModel.find({ tags: tag });
      if (conversations.length > 0) {
        throw new Error(
          'Есть чаты с таким тегом. Сначала уберите тег с чата, чтобы удалить тег.'
        );
      }
      await TagModel.deleteOne({ _id: id });

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

  const createTask = async ({ id, data }) => {
    try {
      const conversation = await ConversationModel.findOne({ chat_id: id });
      let type = await TaskTypeModel.findOne({ title: data?.type });
      if (!type) {
        type = await TaskTypeModel.create({ title: data?.type });
      }
      const task = await TaskModel.create({
        ...data,
        type,
        conversation,
        createdAt: new Date(),
      });
      await ConversationModel.updateOne(
        { chat_id: id },
        { $push: { tasks: task._id }, $set: { updatedAt: new Date() } }
      );
      const message = {
        type: 'task',
        task: task,
        from: { is_bot: true },
        unread: false,
        date: new Date(),
      };

      const createdMessage = await MessageModel.create(message);

      await ConversationModel.updateOne(
        { chat_id: id },
        {
          $push: { messages: createdMessage._id },
          $set: {
            updatedAt: new Date(),
          },
        }
      );
      await getOneTask({ id: task?._id });
      // await getOneConversation({ selectedChatId: id });

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
            _id: conversation._id,
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
      return io.emit('conversation:update', { conversation: conversations[0] });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };

  const doneTask = async ({ id }) => {
    try {
      const task = await TaskModel.findOne({ _id: id }).populate(
        'conversation'
      );
      await TaskModel.updateOne({ _id: id }, { $set: { done: true } });
      await getOneTask({ id: task?._id });
      await getOneConversation({ selectedChatId: task?.conversation.chat_id });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };

  const sendMessage = async ({ id, text, type, user }) => {
    try {
      const conversation = await ConversationModel.findOne({
        _id: id,
      });
      let botMessage;
      let dtoMessage;

      if (conversation.type === 'private') {
        botMessage = await telegramSendMessage(conversation?.chat_id, text);
        dtoMessage = {
          message_id: botMessage.id,
          from: {
            id: user._id,
            first_name: user.username,
            is_bot: true,
          },
          chat: {
            id: conversation?.chat_id,
            type: 'private',
          },
          date: botMessage.date,
          text: botMessage.message,
          type: 'text',
          unread: false,
        };
      } else {
        dtoMessage = await botSendMessage(conversation?.chat_id, text);
        dtoMessage.type = type;
        dtoMessage.from.id = user._id;
        dtoMessage.from.first_name = user.username;
        dtoMessage.unread = false;
      }

      const message = await MessageModel.create(dtoMessage);

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

  const addTag = async ({ id, value }) => {
    const tag = await TagModel.findOne({ value: value });
    await ConversationModel.updateOne(
      { _id: id },
      { $push: { tags: tag._id }, $set: { updatedAt: new Date() } }
    );
    return tag;
  };

  const getCounterAgentStatus = (status) => {
    const statusList = [
      { value: 'CHECK', label: 'На проверке' },
      { value: 'RECHECK', label: 'Требует уточнения' },
      { value: 'FAIL', label: 'На проверке' },
      { value: 'ACTIVE', label: 'На проверке' },
    ];
    return statusList.find((item) => item.value === status);
  };

  const createMoneysend = async ({ id, data }) => {
    console.log(data);
    try {
      const conversation = await ConversationModel.findOne({
        _id: new ObjectId(id),
      });
      const tag = await addTag({
        id: conversation?._id,
        value: 'Задача',
      });

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
      const text = `${data.title} от ${data.user.username}\n\n→ ${
        data?.link
      }\n\n<pre>Объем: ${data?.volume}\n\n← Отдают: ${
        data?.give
      }\n→ Получают: ${data?.take}\n\n${
        data?.type?.name ? `• Тип перевода: ${data?.type?.name}\n` : ''
      }${
        data?.counteragent?.name
          ? `• Контрагент: ${data?.counteragent?.name} (Статус: ${
              getCounterAgentStatus(data?.counteragent?.status)?.label
            })\n`
          : ''
      }${
        data?.requisites ? `• Реквизиты: ${data?.requisites}\n` : ''
      }• Регулярность: ${data?.regularity}\n• Сроки: ${
        data?.date
      }\n• Комментарий: ${data?.comment}\n\nУсловия: ${
        data?.conditions
      }</pre>\n\n———\nChat ID: ${conversation.chat_id}\nДата: ${formattedDate}`;
      const response = await createMoneysendApi({
        chat_id: conversation.chat_id,
        task: text,
        manager_id: 1,
        counteragent_id: data?.counteragent?.id,
        type: data?.type?.value,
        create_date: Date.now(),
      });
      console.log(response);
      //-1001815632960
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
        `Отлично! Задача зарегестрированна под номером ${
          response?.id
        }, уже зову специалиста отдела процессинга. Пожалуйста, ожидайте.\n\n<pre>Объем: ${
          data?.volume
        }\n\n← Отдают: ${data?.give}\n→ Получают: ${data?.take}\n\n${
          data?.type?.name ? `• Тип перевода: ${data?.type?.name}\n` : ''
        }• Сроки: ${data?.date}\n${
          data?.counteragent?.name
            ? `• Контрагент: ${data?.counteragent?.name} (Статус: ${
                getCounterAgentStatus(data?.counteragent?.status)?.label
              })\n`
            : ''
        }• Реквизиты: ${data?.requisites}\n• Регулярность: ${
          data?.regularity
        }\n• Сроки: ${data?.date}\n• Комментарий: ${
          data?.comment
        }\n\nУсловия: ${data?.conditions}</pre>`,
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
      await stageHistoryService.create({
        stageId: stage._id,
        convId: new ObjectId(id),
      });
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

  const read = async ({ id, user }) => {
    try {
      const conversation = await ConversationModel.findOne({
        _id: new ObjectId(id),
      });
      const record = await ReadHistoryModel.create({
        conversation: new ObjectId(id),
        user: new ObjectId(user._id),
        createdAt: new Date(),
      });

      await ConversationModel.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: { unreadCount: 0 },
        }
      );
      const messages = conversation.messages;
      const messageIds = messages?.map((message) => message._id);
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

  const sendChat = async ({ id, user }) => {
    try {
      const stage = await StageModel.findOne({ value: 'created_chat' });
      const tag = await TagModel.findOne({ value: 'Личка' });
      await ConversationModel.updateOne(
        { _id: id },
        {
          $set: { updatedAt: new Date(), stage: stage._id },
        }
      );

      const chat = await sendChatApi();
      // const chat = {
      //   id: 5230,
      //   chat_url: 'Ссылка на чат: https://t.me/+V8lzItXiiqFmYzIy',
      //   active: 1,
      //   chat_id: '-1001806491854',
      //   issued_by: 'chat',
      //   date_of_issue: '2023-09-19 15:16:41',
      // };
      const conversation = await ConversationModel.findOne({
        chat_id: Number(chat?.chat_id),
      });

      if (!conversation.tags.includes(tag._id)) {
        await ConversationModel.updateOne(
          { chat_id: Number(chat?.chat_id) },
          {
            $set: { updatedAt: new Date() },
            $push: { tags: tag._id },
          }
        );
      }
      return await sendMessage({
        id,
        text: `Личный кабинет Moneyport #${chat.id}: ${chat.chat_url}`,
        type: 'text',
        user,
      });
    } catch (e) {
      console.log(e);

      socket.emit('error', { message: e.message });
    }
  };

  const sendGrade = async ({ id, user }) => {
    try {
      const conversation = await ConversationModel.findOne({
        _id: id,
      });

      const msg = await botSendMessage(
        conversation?.chat_id,
        'Спасибо за Ваше обращение!\n\nВ целях повышения качества обслуживания клиентов, просим Вас оценить консультацию менеджера.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Хорошо', callback_data: 'grade_high' }],
              [{ text: 'Нормально', callback_data: 'grade_middle' }],
              [{ text: 'Плохо', callback_data: 'grade_low' }],
            ],
          },
        }
      );
      msg.type = 'text';
      msg.from.id = user._id;
      msg.from.first_name = user.username;
      msg.unread = false;

      const message = await MessageModel.create(msg);

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

  socket.on('conversations:get', getConversations);
  socket.on('conversations:getSearch', getSearchedConversations);
  socket.on('conversations:getOne', getOneConversation);

  socket.on('conversation:updateStage', updateStage);
  socket.on('conversation:editStage', editStage);
  socket.on('conversation:deleteStage', deleteStage);
  socket.on('conversation:moveStage', moveStage);

  socket.on('conversation:updateUser', updateUser);
  socket.on('conversation:updateTags', updateTags);
  socket.on('conversation:createTag', createTag);
  socket.on('conversation:removeTag', removeTag);

  socket.on('conversation:createComment', createComment);
  socket.on('conversation:createTask', createTask);
  socket.on('conversation:doneTask', doneTask);

  socket.on('conversation:createMoneysend', createMoneysend);
  socket.on('conversation:read', read);
  socket.on('conversation:sendChat', sendChat);
  socket.on('conversation:sendGrade', sendGrade);

  socket.on('message:sendMessage', sendMessage);
};
