const { ConversationModel } = require('../models/conversationModel');
const { StageHistoryModel } = require('../models/stageHistoryModel');
require('dotenv').config();
const _ = require('lodash');
const { StageModel } = require('../models/stageModel');
const { TagModel } = require('../models/tagModel');

function formatDateString(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  return `${day}.${month}.${year}`;
}

class StageHistoryService {
  async create({ stageId, convId }) {
    const record = StageHistoryModel.create({
      stage: stageId,
      conversation: convId,
      createdAt: new Date(),
    });
    return record;
  }

  async getByWeeksStatic(body) {
    const startDate = body.dateRange[0]
      ? new Date(body.dateRange[0])
      : new Date(0);
    const endDate = new Date(body.dateRange[1]);

    const type = body?.type;
    const stages = await StageModel.find({
      type: { $in: [type.value, 'all'] },
    }).sort({
      position: 1,
    });
    const result = await StageHistoryModel.aggregate([
      {
        $lookup: {
          from: 'stages',
          localField: 'stage',
          foreignField: '_id',
          as: 'stage',
        },
      },
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversation',
          foreignField: '_id',
          as: 'conversation',
        },
      },
      {
        $project: {
          createdAt: {
            $dateFromParts: {
              isoWeekYear: { $isoWeekYear: '$createdAt' },
              isoWeek: { $isoWeek: '$createdAt' },
            },
          },
          stage: 1,
          conversation: 1,
        },
      },
      {
        $group: {
          _id: { week: { $week: '$createdAt' }, createdAt: '$createdAt' },
          startDate: { $min: '$createdAt' },
          endDate: { $max: '$createdAt' },
          records: { $push: '$$ROOT' },
        },
      },
    ]);
    result.forEach((week) => {
      week.startDate.setDate(
        week.startDate.getDate() - ((week.startDate.getDay() + 6) % 7)
      );
      week.endDate.setDate(
        week.endDate.getDate() + (6 - ((week.endDate.getDay() + 6) % 7))
      );
    });
    console.log(result);
    const rows = [];
    const uniqueChats = new Set(); // Use a Set to store unique chats

    result.forEach((week) => {
      let totalCount = 0; // Initialize the total count of chats

      const weekPath = `Неделя ${week._id.week}`;
      const chatCountByStatus = {}; // Initialize an object to store the count of chats by status

      week.records.forEach((record) => {
        let chatCount = 0;

        const chatStatus = record.stage[0]?.value;

        if (!(chatStatus in chatCountByStatus)) {
          chatCountByStatus[chatStatus] = ''; // Initialize the count for a new status with an empty string
        }

        if (!uniqueChats.has(record.conversation[0]?.title)) {
          // Check if the chat has already been added
          chatCountByStatus[chatStatus]++; // Increment the count for the status
          uniqueChats.add(record.conversation[0]?.title); // Add the chat to the set of unique chats

          const chatStatusCount = {};
          stages.forEach((stage) => {
            const stageValue = stage.value;
            chatStatusCount[stageValue] = '';
          });
          chatStatusCount[chatStatus]++;
          console.log(chatStatusCount);
          chatCount += Object.values(chatStatusCount).reduce(
            (a, b) => Number(a) + Number(b),
            0
          );

          rows.push({
            id: `${week._id.week}-${record.conversation[0]?._id}`,
            path: [weekPath, `${record.conversation[0]?.title}`],
            date: formatDateString(week._id.createdAt),
            ...chatStatusCount,
            chatCount: chatCount,
          });
        } else {
          const existingChatRow = rows.find(
            (row) =>
              row.id === `${week._id.week}-${record.conversation[0]?._id}`
          );

          if (existingChatRow) {
            existingChatRow[chatStatus]++;
            existingChatRow.chatCount++;
          }
          chatCountByStatus[chatStatus]++;
        }
      });

      totalCount += week.records.length;

      rows.push({
        id: `${week._id.week}`,
        path: [weekPath],
        date: `${formatDateString(week.startDate)}-${formatDateString(
          week.endDate
        )}`,
        ...chatCountByStatus,
        chatCount: totalCount,
      });
    });

    const statusColumns = stages.map((stage) => {
      const stageLabel = stage.label;
      const stageValue = stage.value;
      return {
        field: stageValue,
        headerName: stageLabel,
        headerAlign: 'center',
        align: 'center',
        minWidth: 140,
        flex: 1,
      };
    });

    const columns = [
      {
        field: 'date',
        headerName: 'Date',
        headerAlign: 'center',
        align: 'center',
        minWidth: 140,
        flex: 1,
      },
      ...statusColumns,
      {
        field: 'chatCount',
        headerName: 'Всего',
        headerAlign: 'center',
        align: 'center',
        minWidth: 140,
        flex: 1,
      },
    ];
    console.log(rows);
    return { rows, columns };
  }

  async getByWeeksDynamic() {
    function getWeekNumber(date) {
      if (!date) return;

      const onejan = new Date(date.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(
        ((date - onejan) / 86400000 + onejan.getDay() + 1) / 7
      );
      return weekNumber;
    }

    function formatDateString(date) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);

      return `${day}.${month}.${year}`;
    }

    function getWeekStartDate(week) {
      const year = new Date().getFullYear();
      const weekNumber = parseInt(week.split(' ')[0]);

      const firstDayOfYear = new Date(year, 0, 1);
      const firstWeekDay = firstDayOfYear.getDay();

      const startDate = new Date(
        year,
        0,
        (weekNumber - 1) * 7 + 2 - firstWeekDay
      );

      return formatDateString(startDate);
    }

    function getWeekEndDate(week) {
      const year = new Date().getFullYear();
      const weekNumber = parseInt(week.split(' ')[0]);

      const firstDayOfYear = new Date(year, 0, 1);
      const firstWeekDay = firstDayOfYear.getDay();

      const endDate = new Date(year, 0, weekNumber * 7 - firstWeekDay + 1);

      return formatDateString(endDate);
    }

    const conversations = await ConversationModel.find()
      .populate({
        path: 'user',
      })
      .populate({ path: 'stage' });
    const groupedConversations = conversations.reduce(
      (result, conversation) => {
        console.log(conversation);
        const week = `${getWeekNumber(conversation?.workAt)} неделя `; // Get the week number from the conversation's createdAt date
        const user = conversation.user?.username || 'Нет менеджера';
        const chat = conversation.title;
        const stage = conversation.stage?.label; // Добавляем получение статуса чата

        result[week] = result[week] || {};
        result[week][user] = result[week][user] || {};
        result[week][user][chat] = conversation;

        return result;
      },
      {}
    );

    const rows = Object.keys(groupedConversations).flatMap((week) => {
      const weekRow = {
        path: [week],
        date: `${getWeekStartDate(week)}-${getWeekEndDate(week)}`,
        id: `${week}`,
        chatCount: Object.keys(groupedConversations[week]).reduce(
          (count, user) => {
            return count + Object.keys(groupedConversations[week][user]).length;
          },
          0
        ),
      };
      const userRows = Object.keys(groupedConversations[week]).flatMap(
        (user) => {
          const userRow = {
            path: [week, user],
            date: `${getWeekStartDate(week)} - ${getWeekEndDate(week)}`,
            id: `${week}-${user}`,
            chatCount: Object.keys(groupedConversations[week][user]).length,
          };
          const chatRows = Object.keys(groupedConversations[week][user]).map(
            (chat, index) => {
              const conversation = groupedConversations[week][user][chat];
              const fieldName = conversation.stage;

              return {
                path: [week, user, chat],
                date: conversation.updatedAt,
                [fieldName]: conversation.stage,
                id: conversation._id,
              };
            }
          );

          return [userRow, ...chatRows];
        }
      );

      return [weekRow, ...userRows];
    });
    return rows;
  }

  async getByUsers(body) {
    const startDate = body.dateRange[0]
      ? new Date(body.dateRange[0])
      : new Date(0);
    const endDate = new Date(body.dateRange[1]);
    console.log(startDate, endDate);
    const type = body?.type;

    const query = {
      workAt: {
        $ne: null,
        $gte: startDate,
        $lte: endDate,
      },
      stage: { $ne: null },
    };

    if (type?.value) {
      if (type?.value === 'group') query.type = 'supergroup';
      if (type?.value === 'private') query.type = 'private';
    }

    const conversations = await ConversationModel.find(query)
      .populate({
        path: 'user',
      })
      .populate({ path: 'stage' });

    const groupedConversations = conversations.reduce(
      (result, conversation) => {
        const user = conversation.user?.username || 'Нет менеджера';
        const chat = conversation.title;

        result[user] = result[user] || {};
        result[user][chat] = conversation;

        return result;
      },
      {}
    );

    const rows = Object.keys(groupedConversations).flatMap((user) => {
      const userRow = {
        path: [user],
        id: user,
        date: `${formatDateString(startDate)}-${formatDateString(endDate)}`,
        chatCount: `${Object.keys(groupedConversations[user]).length} (${(
          (Object.keys(groupedConversations[user]).length /
            conversations.length) *
            100 || 0
        ).toFixed(0)}%)`,
      };
      let stageCounts = {};

      const chatRows = Object.keys(groupedConversations[user]).map((chat) => {
        const conversation = groupedConversations[user][chat];
        const fieldName = conversation.stage?.value;

        if (fieldName) {
          stageCounts[fieldName] = stageCounts[fieldName] || {
            count: 0,
            percent: 0,
          };
          stageCounts[fieldName].count++;
        }

        return {
          path: [user, `${chat} (${conversation.chat_id})`],
          date: formatDateString(new Date(conversation?.workAt)),
          [fieldName]: '✔',
          id: conversation._id,
        };
      });

      Object.assign(userRow, stageCounts);
      for (const stageValue in stageCounts) {
        const stageCount = stageCounts[stageValue].count;
        const totalChatCount = Number(userRow.chatCount.split(' ')[0]);
        const percent = (stageCount / totalChatCount) * 100 || 0;
        const countPercentString = `${stageCount} (${percent.toFixed(0)}%)`;
        userRow[stageValue] = countPercentString;
      }
      return [userRow, ...chatRows];
    });
    const stages = await StageModel.find({
      type: { $in: [type.value, 'all'] },
    }).sort({
      position: 1,
    });
    const statusColumns = stages.map((stage) => {
      const stageLabel = stage.label;
      const stageValue = stage.value;
      return {
        field: stageValue,
        headerName: stageLabel,
        headerAlign: 'center',
        align: 'center',
        minWidth: 140,
        flex: 1,
      };
    });

    const totalRow = {
      path: ['Всего'],
      id: 'total',
      date: '',
      chatCount: conversations.length,
    };

    for (const stage of stages) {
      const stageCount = conversations.filter(
        (conversation) => conversation.stage?.value === stage.value
      ).length;
      const percent = (stageCount / totalRow.chatCount) * 100 || 0;
      const countPercentString = `${stageCount} (${percent.toFixed(0)}%)`;
      if (stageCount !== 0) totalRow[stage.value] = countPercentString;
    }

    rows.push(totalRow);

    const columns = [
      {
        field: 'date',
        headerName: 'Дата',
        headerAlign: 'center',
        align: 'center',
        minWidth: 140,
      },
      ...statusColumns,
      {
        field: 'chatCount',
        headerName: 'Всего',
        headerAlign: 'center',
        align: 'center',
        minWidth: 120,
      },
    ];
    return { rows: [...rows], columns };
  }

  async getByTags(body) {
    const startDate = body.dateRange[0]
      ? new Date(body.dateRange[0])
      : new Date(0);
    const endDate = new Date(body.dateRange[1]);

    const type = body?.type;

    const stages = body?.stages;
    const stagesIds = stages.map((stage) => stage._id);

    const tags = body?.tags || [];
    const tagIds = tags.map((tag) => tag._id);

    const users = body?.users || [];
    const userIds = users.map((user) => user._id);

    const query = {
      workAt: {
        $ne: null,
        $gte: startDate,
        $lte: endDate,
      },
    };

    if (userIds && Object.keys(userIds).length > 0) {
      query.user = { $in: userIds };
    }

    if (tagIds && Object.keys(tagIds).length > 0) {
      query.tags = { $in: tagIds };
    }

    if (stages && Object.keys(stages).length > 0) {
      query.stage = { $in: stagesIds };
    }

    if (type?.value) {
      if (type?.value === 'group') query.type = 'supergroup';
      if (type?.value === 'private') query.type = 'private';
    }

    const conversations = await ConversationModel.find(query)
      .populate('tags')
      .populate('user')
      .populate('stage');

    const groupedRows = {};

    tags.forEach((tag) => {
      groupedRows[tag._id] = {
        id: tag._id,
        path: [tag.value],
        children: {},
        chatCount: 0,
      };
    });

    conversations.forEach((conversation) => {
      const tagIds = conversation.tags.map((tag) => tag._id);

      tagIds.forEach((tagId) => {
        if (!groupedRows[tagId]) return;
        groupedRows[tagId].chatCount++;

        const tagValue = groupedRows[tagId].path[0];

        const userName = conversation?.user
          ? conversation.user.username
          : 'Нет менеджера';

        if (!groupedRows[tagId].children[userName]) {
          groupedRows[tagId].children[userName] = {
            id: `${tagId}-${userName}`,
            path: [tagValue, userName],
            chats: [],
            chatCount: 0,
          };
        }

        groupedRows[tagId].children[userName].chats.push(conversation);
      });
    });

    const rows = [];
    const columns = [
      {
        field: 'chatStatus',
        headerName: 'Статус',
        headerAlign: 'center',
        align: 'center',
        flex: 1,
      },
      {
        field: 'chatCount',
        headerName: 'Количество чатов',
        headerAlign: 'center',
        align: 'center',
        flex: 1,
      },
      {
        field: 'percent',
        headerName: 'Процент',
        headerAlign: 'center',
        align: 'center',
        flex: 1,
      },
    ];

    Object.values(groupedRows).forEach((tagRow) => {
      let tagChatCount = 0;
      const userRows = Object.values(tagRow.children).map((userRow) => {
        const chatCount = userRow.chats.length;

        tagChatCount += chatCount;

        const chatRows = userRow.chats.map((chat) => {
          rows.push({
            path: [...userRow.path, `${chat.title} (${chat.chat_id})`],
            id: `${userRow.id}-${chat._id}`,
            chatStatus: chat?.stage?.label,
            percent: '',
            ...chat.toObject(),
          });
        });

        return {
          ...userRow,
          chatCount,
          chats: chatRows,
          percent: '',
        };
      });

      Object.values(tagRow.children).forEach((userRow) => {
        const chatCount = userRow.chats.length;
        const percent =
          chatCount > 0
            ? ((chatCount / tagRow.chatCount) * 100).toFixed(0)
            : '';
        userRow.percent = percent + '%';
        const matchingUserRow = userRows.find((row) => row.id === userRow.id);
        if (matchingUserRow) {
          matchingUserRow.percent = userRow.percent;
        }
      });
      const tagRowWithTotal = {
        ...tagRow,
        chatCount: tagChatCount,
        chats: userRows.flatMap((userRow) => userRow.chats),
        percent:
          tagChatCount > 0
            ? ((tagChatCount / conversations.length) * 100).toFixed(0) + '%'
            : '',
      };
      rows.push(tagRowWithTotal, ...userRows);
    });

    return { rows, columns };
  }
}

module.exports = new StageHistoryService();
