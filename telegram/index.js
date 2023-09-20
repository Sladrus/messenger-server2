const { TelegramClient } = require('telegram');
const { StringSession, StoreSession } = require('telegram/sessions');
const input = require('input');
const { NewMessage } = require('telegram/events');
const { ConversationModel } = require('../models/conversationModel');
const { StageModel } = require('../models/stageModel');
const { MessageModel } = require('../models/messageModel');
const { default: mongoose } = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

const apiId = process.env.API_ID;
const apiHash = process.env.API_HASH;
const storeSession = new StoreSession('./telegram/store/');

const findOneConversation = async (id, io) => {
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
  console.log(conversations[0]);

  return io.emit('conversation:update', { conversation: conversations[0] });
};

const createMessage = async (event, io) => {
  const message = event.message;
  const sender = await message.getSender();
  console.log(sender, message);
  const chat_id = parseInt(sender.id.value);
  const peer_id = parseInt(message.peerId.userId.value);

  // if (chat_id === 6366507760) {
  //   return;
  // }

  try {
    let conversation = await ConversationModel.findOne({
      chat_id: chat_id === 6366507760 ? peer_id : chat_id,
    });
    const stage = await StageModel.findOne({ value: 'raw' });
    if (!conversation) {
      const newConversation = await ConversationModel.create({
        title:
          sender?.firstName + sender?.lastName ? ' ' + sender?.lastName : '',
        chat_id: chat_id === 6366507760 ? peer_id : chat_id,
        unreadCount: 0,
        type: 'private',
        stage: stage._id,
        workAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      conversation = newConversation;
    }
    let msg;
    if (message.media && message.media.photo) {
      const media = message.media;
      const buffer = await client.downloadMedia(media, {
        workers: 1,
      });
      const photoId = uuidv4();
      const filePath = `./telegram/photos/${photoId}.jpg`;
      fs.writeFileSync(filePath, buffer);
      console.log(photoId);
      msg = {
        from: {
          id: parseInt(sender.id.value),
          username: sender?.username,
          first_name: sender?.firstName,
          last_name: sender?.lastName,
        },
        date: message.date,
        text: message.message,
        photo: photoId,
        type: 'photo',
      };
    } else {
      msg = {
        from: {
          id: parseInt(sender.id.value),
          username: sender?.username,
          first_name: sender?.firstName,
          last_name: sender?.lastName,
        },
        date: message.date,
        text: message.message,
        type: 'text',
      };
    }

    const createdMessage = await MessageModel.create(msg);
    await ConversationModel.updateOne(
      { _id: conversation?._id },
      {
        $push: { messages: createdMessage._id },
        $set: {
          updatedAt: new Date(),
          unreadCount: conversation?.unreadCount
            ? conversation?.unreadCount + 1
            : 1,
        },
      }
    );

    return await findOneConversation(conversation?._id, io);
  } catch (e) {
    console.log(e);
  }
};

const client = new TelegramClient(storeSession, Number(apiId), apiHash, {
  connectionRetries: 5,
});

async function telegramSendMessage(target, message) {
  const result = await client.sendMessage(target, { message });
  return result;
}

async function initClient(io) {
  console.log('INIT');
  await client.start({
    phoneNumber: async () => await input.text('Please enter your number: '),
    password: async () => await input.text('Please enter your password: '),
    phoneCode: async () =>
      await input.text('Please enter the code you received: '),
    onError: (err) => console.log(err),
  });
  console.log('You should now be connected.');
  client.session.save();

  async function newMessage(event) {
    if (!event.isPrivate) return;
    return await createMessage(event, io);
  }

  client.addEventHandler(newMessage, new NewMessage({}));
}

module.exports = { initClient, telegramSendMessage };
