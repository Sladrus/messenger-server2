const { ConversationModel } = require("../models/conversationModel");
const { StageHistoryModel } = require("../models/stageHistoryModel");
require("dotenv").config();
const _ = require("lodash");
const { StageModel } = require("../models/stageModel");
const { TagModel } = require("../models/tagModel");

function formatDateString(date) {
  const options = {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "numeric",
    timeZone: "Europe/Moscow",
  };

  return date.toLocaleString("ru-RU", options);
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
    const period = body?.period;
    const typeValue = body?.type;
    let type;

    if (typeValue?.value) {
      if (typeValue.value === "group") type = "supergroup";
      if (typeValue.value === "private") type = "private";
    }

    const stages = await StageModel.find({
      type: { $in: [typeValue?.value, "all"] },
    }).sort({
      position: 1,
    });

    const result = await StageHistoryModel.aggregate([
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
          from: "conversations",
          localField: "conversation",
          foreignField: "_id",
          as: "conversation",
        },
      },
      {
        $unwind: "$conversation",
      },
      {
        $lookup: {
          from: "users",
          let: { userId: "$conversation.user" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$userId"] },
              },
            },
          ],
          as: "conversation.user",
        },
      },
      {
        $unwind: {
          path: "$conversation.user",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "conversation.type": type,
        },
      },
      {
        $project: {
          createdAt: {
            $dateFromParts:
              period.value === "week"
                ? {
                    isoWeekYear: { $isoWeekYear: "$createdAt" },
                    isoWeek: { $isoWeek: "$createdAt" },
                  }
                : {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                  },
          },
          stage: 1,
          conversation: 1,
        },
      },
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            week:
              period.value === "week"
                ? { $week: "$createdAt" }
                : { $month: "$createdAt" },
            createdAt: "$createdAt",
          },
          startDate: { $min: "$createdAt" },
          endDate: { $max: "$createdAt" },
          records: { $push: "$$ROOT" },
        },
      },
      {
        $sort: { "_id.week": -1 },
      },
    ]);

    const rows = [];
    // const uniqueChats = new Set(); // Use a Set to store unique chats

    result.forEach((week) => {
      period.value === "week"
        ? week.startDate.setDate(
            week.startDate.getDate() - ((week.startDate.getDay() + 6) % 7)
          )
        : week.startDate.setMonth(week.startDate.getMonth(), 1);
      period.value === "week"
        ? week.endDate.setDate(
            week.endDate.getDate() + (6 - ((week.endDate.getDay() + 6) % 7))
          )
        : week.endDate.setMonth(week.endDate.getMonth() + 1, 0);

      const weekPath = `${period.value === "week" ? "Неделя" : "Месяц"} ${
        week._id.week
      }`;

      const weekRow = {
        path: [weekPath],
        id: [weekPath],
        number: week._id.week,
        date: `${formatDateString(week.startDate)}-${formatDateString(
          week.endDate
        )}`,
        cr: "",
      };
      stages.forEach((stage) => {
        if (stage.value === "active") weekRow[stage.value] = "0";
        else weekRow[stage.value] = "";
      });

      rows.push(weekRow);

      week.records.forEach((record) => {
        const userPath = record.conversation?.user?.username || "Нет менеджера";
        const userRow = {
          path: [weekPath, userPath],
          id: [weekPath, userPath],
          number: week._id.week,
        };
        stages.forEach((stage) => {
          userRow[stage.value] = "";
        });

        if (
          rows.find((row) => row.path.join("/") === `${weekPath}/${userPath}`)
        ) {
          const chatPath = record.conversation?.title;
          const chatRow = {
            path: [weekPath, userPath, chatPath],
            id: [weekPath, userPath, chatPath],
            number: week._id.week,
          };
          stages.forEach((stage) => {
            chatRow[stage.value] = "";
          });
          if (
            !rows.find(
              (row) =>
                row.path.join("/") === `${weekPath}/${userPath}/${chatPath}`
            )
          ) {
            rows.push(chatRow);
          }
        } else {
          rows.push(userRow);
        }
      });
    });

    result.forEach((week) => {
      const weekPath = `${period.value === "week" ? "Неделя" : "Месяц"} ${
        week._id.week
      }`;
      const weekRow = rows.find((row) => row.path.join("/") === weekPath);

      week.records.forEach((record) => {
        const userPath = record.conversation.user?.username || "Нет менеджера";
        const chatPath = record.conversation?.title;

        if (userPath && chatPath) {
          const userRow = rows.find(
            (row) => row.path.join("/") === `${weekPath}/${userPath}`
          );
          const chatRow = rows.find(
            (row) =>
              row.path.join("/") === `${weekPath}/${userPath}/${chatPath}`
          );

          if (userRow && chatRow) {
            userRow[record.stage.value]++;
            chatRow[record.stage.value]++;
            weekRow[record.stage.value]++;
          }
        }
      });
    });

    result.forEach((week) => {
      const number = week._id.week;
      let activeAndRawCount = 0;
      const users = [];
      rows.forEach((row) => {
        if (row.path.length === 3 && row.number === number) {
          const user = users.find((user) => user.username === row.path[1]);

          if (row?.active > 0 && row?.raw > 0) {
            if (user) {
              user.count++;
            } else users.push({ username: row.path[1], count: 1 });
            activeAndRawCount++;
          }
        }
      });
      const weekRow = rows.find((row) => row.number === number);
      weekRow.cr = `${((weekRow.active / weekRow.raw) * 100).toFixed(0)}% (${(
        (activeAndRawCount / weekRow.raw) *
        100
      ).toFixed(0)}%)`;
      weekRow.active = `${weekRow.active} (${activeAndRawCount})`;
      for (const user of users) {
        const userRow = rows.find(
          (row) => row.number === number && user.username === row.path[1]
        );
        userRow.cr = `${((userRow.active / userRow.raw) * 100).toFixed(0)}% (${(
          (user.count / userRow.raw) *
          100
        ).toFixed(0)}%)`;
        userRow.active = `${userRow.active} (${user.count})`;
      }
    });

    const statusColumns = stages.map((stage) => {
      const stageLabel = stage.label;
      const stageValue = stage.value;
      return {
        field: stageValue,
        headerName: stageLabel,
        headerAlign: "center",
        align: "center",
        minWidth: 140,
        flex: 1,
      };
    });

    const columns = [
      {
        field: "date",
        headerName: "Период",
        headerAlign: "center",
        align: "center",
        minWidth: 300,
        flex: 1,
      },
      {
        field: "cr",
        headerName: "CR",
        headerAlign: "center",
        align: "center",
        minWidth: 140,
        flex: 1,
      },
      ...statusColumns,
    ];
    return { rows, columns };
  }

  async getByUsers(body) {
    const startDate = body.dateRange[0]
      ? new Date(body.dateRange[0])
      : new Date(0);
    const endDate = new Date(body.dateRange[1]);

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
      if (type?.value === "group") query.type = "supergroup";
      if (type?.value === "private") query.type = "private";
    }

    const conversations = await ConversationModel.find(query)
      .populate({
        path: "user",
      })
      .populate({ path: "stage" });

    const groupedConversations = conversations.reduce(
      (result, conversation) => {
        const user = conversation.user?.username || "Нет менеджера";
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
          [fieldName]: "✔",
          id: conversation._id,
        };
      });

      Object.assign(userRow, stageCounts);
      for (const stageValue in stageCounts) {
        const stageCount = stageCounts[stageValue].count;
        const totalChatCount = Number(userRow.chatCount.split(" ")[0]);
        const percent = (stageCount / totalChatCount) * 100 || 0;
        const countPercentString = `${stageCount} (${percent.toFixed(0)}%)`;
        userRow[stageValue] = countPercentString;
      }
      return [userRow, ...chatRows];
    });
    const stages = await StageModel.find({
      type: { $in: [type.value, "all"] },
    }).sort({
      position: 1,
    });
    const statusColumns = stages.map((stage) => {
      const stageLabel = stage.label;
      const stageValue = stage.value;
      return {
        field: stageValue,
        headerName: stageLabel,
        headerAlign: "center",
        align: "center",
        minWidth: 140,
        flex: 1,
      };
    });

    const totalRow = {
      path: ["Всего"],
      id: "total",
      date: "",
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
        field: "date",
        headerName: "Дата",
        headerAlign: "center",
        align: "center",
        minWidth: 300,
      },
      ...statusColumns,
      {
        field: "chatCount",
        headerName: "Всего",
        headerAlign: "center",
        align: "center",
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
      if (type?.value === "group") query.type = "supergroup";
      if (type?.value === "private") query.type = "private";
    }

    const conversations = await ConversationModel.find(query)
      .populate("tags")
      .populate("user")
      .populate("stage");

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
          : "Нет менеджера";

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
        field: "chatTitle",
        headerName: "Чат",
        headerAlign: "center",
        align: "center",
        flex: 1,
      },
      {
        field: "chatStatus",
        headerName: "Статус",
        headerAlign: "center",
        align: "center",
        flex: 1,
      },
      {
        field: "chatTags",
        headerName: "Теги",
        headerAlign: "center",
        align: "center",
        flex: 1,
      },
      {
        field: "chatCount",
        headerName: "Количество чатов",
        headerAlign: "center",
        align: "center",
        flex: 1,
      },
      {
        field: "percent",
        headerName: "Процент",
        headerAlign: "center",
        align: "center",
        flex: 1,
      },
    ];

 

    Object.values(groupedRows).forEach((tagRow) => {
      let tagChatCount = 0;
      const userRows = Object.values(tagRow.children).map((userRow) => {
        const chatCount = userRow.chats.length;

        tagChatCount += chatCount;

        const chatRows = userRow.chats.map((chat) => {
          const tagsNames = chat?.tags?.map(function(item) {
            return item['value'];
          });
          rows.push({
            path: [...userRow.path, `${chat.chat_id} (${chat.id})`],
            id: `${userRow.id}-${chat._id}`,
            chatTitle: chat.title,
            chatStatus: chat?.stage?.label,
            chatTags: tagsNames.join(','),
            percent: "",
            ...chat.toObject(),
          });
        });

        return {
          ...userRow,
          chatCount,
          chats: chatRows,
          percent: "",
        };
      });

      Object.values(tagRow.children).forEach((userRow) => {
        const chatCount = userRow.chats.length;
        const percent =
          chatCount > 0
            ? ((chatCount / tagRow.chatCount) * 100).toFixed(0)
            : "";
        userRow.percent = percent + "%";
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
            ? ((tagChatCount / conversations.length) * 100).toFixed(0) + "%"
            : "",
      };
      rows.push(tagRowWithTotal, ...userRows);
    });

    return { rows, columns };
  }
}

module.exports = new StageHistoryService();
