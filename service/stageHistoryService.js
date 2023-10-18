const { ConversationModel } = require('../models/conversationModel');
const { StageHistoryModel } = require('../models/stageHistoryModel');
require('dotenv').config();

class StageHistoryService {
  async create({ stageId, convId }) {
    const record = StageHistoryModel.create({
      stage: stageId,
      conversation: convId,
      createdAt: new Date(),
    });
    return record;
  }

  async getByWeeksStatic() {
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
    // console.log(result);
    return result;
  }

  async getByWeeksDynamic() {
    // const result = await ConversationModel.aggregate([
    //   {
    //     $match: {
    //       workAt: { $ne: null }, // Exclude documents without a workAt value
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: 'stages',
    //       localField: 'stage',
    //       foreignField: '_id',
    //       as: 'stage',
    //     },
    //   },
    //   {
    //     $project: {
    //       workAt: {
    //         $dateFromParts: {
    //           isoWeekYear: { $isoWeekYear: '$workAt' },
    //           isoWeek: { $isoWeek: '$workAt' },
    //         },
    //       },
    //       stage: 1,
    //       conversation: 1,
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: { week: { $week: '$workAt' }, createdAt: '$workAt' },
    //       startDate: { $min: '$workAt' },
    //       endDate: { $max: '$workAt' },
    //       records: { $push: '$$ROOT' },
    //     },
    //   },
    // ]);
    // result.forEach((week) => {
    //   if (week.startDate && week.endDate) {
    //     week.startDate.setDate(
    //       week.startDate.getDate() - ((week.startDate.getDay() + 6) % 7)
    //     );
    //     week.endDate.setDate(
    //       week.endDate.getDate() + (6 - ((week.endDate.getDay() + 6) % 7))
    //     );
    //   }
    // });
    // console.log(result);
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
              return {
                path: [week, user, chat],
                date: conversation.updatedAt,
                id: conversation._id,
              };
            }
          );

          return [userRow, ...chatRows];
        }
      );

      return [weekRow, ...userRows];
    });
    console.log(rows);
    return rows;
  }
}

module.exports = new StageHistoryService();
