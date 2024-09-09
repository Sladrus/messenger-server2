const { TelegramClient } = require("telegram");
const { StringSession, StoreSession } = require("telegram/sessions");
const input = require("input");
const { NewMessage } = require("telegram/events");
const { ConversationModel } = require("../models/conversationModel");
const { StageModel } = require("../models/stageModel");
const { MessageModel } = require("../models/messageModel");
const { default: mongoose } = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { botSendMessage } = require("../bot");
const stageHistoryService = require("../service/stageHistoryService");

require("dotenv").config();

const apiId = process.env.API_ID;
const apiHash = process.env.API_HASH;
const storeSession = new StoreSession("./telegram/store/");

const findOneConversation = async (id, io) => {
  const pipeline = [
    {
      $group: {
        _id: { chat_id: "$chat_id", createdAt: "$createdAt" },
        updatedAt: { $max: "$updatedAt" },
        conversation: { $first: "$$ROOT" },
      },
    },
    {
      $project: {
        _id: "$conversation._id",
        title: "$conversation.title",
        chat_id: "$conversation.chat_id",
        type: "$conversation.type",
        unreadCount: "$conversation.unreadCount",
        createdAt: "$conversation.createdAt",
        updatedAt: "$conversation.updatedAt",
        members: "$conversation.members",
        workAt: "$conversation.workAt",
        lastMessageId: { $arrayElemAt: ["$conversation.messages", -1] },
        stage: "$conversation.stage",
        user: "$conversation.user",
        tags: "$conversation.tags",
      },
    },
    {
      $lookup: {
        from: "messages",
        localField: "lastMessageId",
        foreignField: "_id",
        as: "lastMessage",
      },
    },
    {
      $lookup: {
        from: "stages",
        localField: "stage",
        foreignField: "_id",
        as: "stage",
      },
    },
    {
      $unwind: "$stage",
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "tags",
        localField: "tags",
        foreignField: "_id",
        as: "tags",
      },
    },
    {
      $unwind: {
        path: "$tags",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: "$_id",
        title: {
          $first: "$title",
        },
        chat_id: {
          $first: "$chat_id",
        },
        type: {
          $first: "$type",
        },
        unreadCount: {
          $first: "$unreadCount",
        },
        createdAt: {
          $first: "$createdAt",
        },
        updatedAt: {
          $first: "$updatedAt",
        },
        members: {
          $first: "$members",
        },
        workAt: {
          $first: "$workAt",
        },
        lastMessage: {
          $first: "$lastMessage",
        },
        stage: {
          $first: "$stage",
        },
        user: {
          $first: "$user",
        },
        tags: {
          $addToSet: "$tags",
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
        members: 1,
        workAt: 1,
        lastMessage: { $arrayElemAt: ["$lastMessage", 0] },
        stage: {
          _id: "$stage._id",
          value: "$stage.value",
          label: "$stage.label",
          color: "$stage.color",
        },
        user: 1,
        tags: 1,
      },
    },
  ];
  const conversations = await ConversationModel.aggregate(pipeline);
  console.log(conversations[0]);

  return io.emit("conversation:update", { conversation: conversations[0] });
};

const createMessage = async (event, io) => {
  const message = event.message;
  const sender = await message.getSender();
  // console.log(sender, message);
  const chat_id = parseInt(sender.id.value);
  const peer_id = parseInt(message.peerId.userId.value);

  // if (chat_id === 6366507760) {
  //   return;
  // }
  const user = await client.getMe();
  const user_id = parseInt(user.id.value);
  console.log(chat_id, peer_id, user_id);

  try {
    let conversation = await ConversationModel.findOne({
      chat_id: chat_id === user_id ? peer_id : chat_id,
    });
    console.log(conversation);
    const stage = await StageModel.findOne({ value: "raw" });

    //-1001955007812
    if (!conversation) {
      try {
        await botSendMessage(
          -1001955007812,
          `Пользователь ${
            sender?.firstName + (sender?.lastName ? " " + sender?.lastName : "")
          } написал первое сообщение.\n\n<b>${
            message?.message
          }</b>\n\nUser ID: ${chat_id}\nUsername: ${
            sender?.username ? "@" + sender?.username : "Отсутствует"
          }`,
          { parse_mode: "HTML" }
        );
      } catch (error) {}

      const newConversation = await ConversationModel.create({
        title:
          chat_id === user_id
            ? peer_id
            : sender?.firstName +
              (sender?.lastName ? " " + sender?.lastName : ""),
        chat_id: chat_id === user_id ? peer_id : chat_id,
        unreadCount: 0,
        type: "private",
        stage: stage._id,
        workAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      conversation = newConversation;
      await stageHistoryService.create({
        stageId: stage._id,
        convId: conversation._id,
      });
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
        type: "photo",
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
        type: "text",
      };
    }

    const createdMessage = await MessageModel.create(msg);
    const set =
      chat_id === user_id
        ? {
            updatedAt: new Date(),
            unreadCount: conversation?.unreadCount
              ? conversation?.unreadCount + 1
              : 1,
          }
        : {
            title:
              sender?.firstName +
              (sender?.lastName ? " " + sender?.lastName : ""),
            updatedAt: new Date(),
            unreadCount: conversation?.unreadCount
              ? conversation?.unreadCount + 1
              : 1,
          };

    await ConversationModel.updateOne(
      { _id: conversation?._id },
      {
        $push: { messages: createdMessage._id },
        $set: set,
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
// const client = null;

async function telegramSendMessage(target, message) {
  const result = await client.sendMessage(target, { message });
  return result;
}

async function initClient(io) {
  // return;
  console.log("INIT");
  await client.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () =>
      await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });
  console.log("You should now be connected.");
  client.session.save();

  async function newMessage(event) {
    if (!event.isPrivate) return;
    return await createMessage(event, io);
  }

  client.addEventHandler(newMessage, new NewMessage({}));
}

const getChatHistory = async (chat_id) => {
  try {
    const chat = await client.getEntity(chat_id);
    const messages = [];
    const userCache = {};
    let offsetId = 0;
    const limit = 10;
    let moreMessages = true;

    while (moreMessages) {
      const history = await client.getMessages(chat, {
        limit: limit,
        offsetId: offsetId,
      });

      if (history.length < limit) {
        moreMessages = false;
      }

      for (const message of history) {
        const action = message?.action && message?.action?.className;
        const type = message?.message
          ? "text"
          : message?.media
          ? "photo"
          : "event";
        let text = message?.message;
        let user = null;
        let username = null;
        let fullname = null;

        if (message.senderId) {
          if (userCache[message.senderId]) {
            user = userCache[message.senderId];
            username = user.username;
            fullname = user.fullname;
          } else {
            try {
              const fetchedUser = await client.getEntity(message.senderId);
              username = fetchedUser?.username || null;
              fullname =
                fetchedUser?.firstName + " " + (fetchedUser?.lastName || "");

              userCache[message.senderId] = {
                username: username,
                fullname: fullname,
              };
            } catch (err) {
              console.error(
                `Failed to get user entity for ID ${message.senderId}:`,
                err
              );
            }
          }
        }

        if (type === "event") {
          if (action === "MessageActionChatJoinedByLink")
            text = `Пользователь ${fullname} вошел в чат`;
          if (action === "MessageActionChatDeleteUser")
            text = `Пользователь ${fullname} вышел из чата`;
          if (action === "MessageActionChatEditTitle") {
            const newTitle = message?.action?.title;
            text = `Название чата сменилось на "${newTitle}"`;
          }
        }

        text = type === "photo" ? "Медиа файл" : text;

        messages.push({
          message_id: message.id,
          user_id: Number(message.senderId),
          text: text,
          type,
          action,
          date: message.date,
          username: username,
          fullname: fullname,
        });
      }

      if (history.length > 0) {
        offsetId = history[history.length - 1].id;
      } else {
        moreMessages = false;
      }
    }

    return messages;
  } catch (error) {
    console.error("Failed to get chat history:", error);
  }
};

const getChatHistoryFromPrivate = async (conversation) => {
  // try {
  // const conversation = await ConversationModel.findOne({
  //   _id: new ObjectId(id),
  // });

  const messages = await getChatHistory(conversation?.chat_id);

  // const chat_data = await getChatUrl(conversation?.chat_id);
  // if (!chat_data) throw new Error(`Ошибка при получении ссылки на чат`);

  // const data = await getChatMessages(
  //   conversation?.chat_id,
  //   chat_data?.chat_url
  // );
  // if (!data) throw new Error(`Ошибка при получении списка сообщений`);
  if (!messages?.length > 0)
    throw new Error(`Сообщения в чате ${conversation?.chat_id} отсутствуют`);

  const msgIds = [];

  for (const item of messages) {
    const messageDto = {
      message_id: item?.message_id,
      unread: false,
      from: {
        id: item?.sender_id,
        username: item?.username,
        first_name: item?.fullname,
      },
      text: item?.text,
      photo: [],
      type: item?.type,
      date: item?.date,
    };

    const newMessage = await MessageModel.create(messageDto);
    msgIds.push(newMessage?._id);
  }

  await ConversationModel.updateOne(
    { _id: conversation?._id },
    { $set: { messages: msgIds }, unreadCount: 0 }
  );

  // await getOneConversation({ selectedChatId: conversation?.chat_id });
  // return await findOneConversation(id);
  // } catch (e) {
  // console.log(e);
  // socket.emit("error", { message: e.message });
  // }
};

module.exports = {
  initClient,
  telegramSendMessage,
  getChatHistoryFromPrivate,
};
