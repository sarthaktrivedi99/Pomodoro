import express from 'express';
import { Op } from 'sequelize';
import { Session, Task } from '../models/index.js';
import sequelize from '../config/database.js';

const router = express.Router();

// Get session statistics for date range
router.get('/sessions', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const userId = req.user.id;

        const whereClause = {
            userId,
            ...(startDate && endDate && {
                startTime: {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                }
            })
        };

        const sessions = await Session.findAll({
            where: whereClause,
            order: [['startTime', 'DESC']],
            limit: 500
        });

        res.json(sessions);
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});

// Get daily focus time aggregates
router.get('/daily-focus', async (req, res) => {
    try {
        const userId = req.user.id;
        const { days = 30 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const results = await Session.findAll({
            attributes: [
                [sequelize.fn('DATE', sequelize.col('start_time')), 'date'],
                [sequelize.fn('SUM', sequelize.col('duration')), 'totalMinutes'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'sessionCount']
            ],
            where: {
                userId,
                isBreak: false,
                startTime: {
                    [Op.gte]: startDate
                }
            },
            group: [sequelize.fn('DATE', sequelize.col('start_time'))],
            order: [[sequelize.fn('DATE', sequelize.col('start_time')), 'ASC']]
        });

        res.json(results);
    } catch (error) {
        console.error('Daily focus error:', error);
        res.status(500).json({ error: 'Failed to get daily focus' });
    }
});

// Get hourly heatmap data
router.get('/hourly-heatmap', async (req, res) => {
    try {
        const userId = req.user.id;
        const { days = 30 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const results = await Session.findAll({
            attributes: [
                [sequelize.fn('EXTRACT', sequelize.literal("DOW FROM start_time")), 'dayOfWeek'],
                [sequelize.fn('EXTRACT', sequelize.literal("HOUR FROM start_time")), 'hour'],
                [sequelize.fn('SUM', sequelize.col('duration')), 'totalMinutes'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'sessionCount']
            ],
            where: {
                userId,
                isBreak: false,
                startTime: {
                    [Op.gte]: startDate
                }
            },
            group: [
                sequelize.fn('EXTRACT', sequelize.literal("DOW FROM start_time")),
                sequelize.fn('EXTRACT', sequelize.literal("HOUR FROM start_time"))
            ],
            raw: true
        });

        res.json(results);
    } catch (error) {
        console.error('Hourly heatmap error:', error);
        res.status(500).json({ error: 'Failed to get heatmap data' });
    }
});

// Get task completion stats
router.get('/task-stats', async (req, res) => {
    try {
        const userId = req.user.id;
        const { days = 30 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const results = await Task.findAll({
            attributes: [
                [sequelize.fn('DATE', sequelize.col('scheduled_date')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'totalTasks'],
                [sequelize.fn('SUM', sequelize.literal('CASE WHEN completed THEN 1 ELSE 0 END')), 'completedTasks']
            ],
            where: {
                userId,
                scheduledDate: {
                    [Op.gte]: startDate
                }
            },
            group: [sequelize.fn('DATE', sequelize.col('scheduled_date'))],
            order: [[sequelize.fn('DATE', sequelize.col('scheduled_date')), 'ASC']]
        });

        res.json(results);
    } catch (error) {
        console.error('Task stats error:', error);
        res.status(500).json({ error: 'Failed to get task stats' });
    }
});

// Get planned vs actual duration
router.get('/planned-vs-actual', async (req, res) => {
    try {
        const userId = req.user.id;
        const { days = 30 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const tasks = await Task.findAll({
            where: {
                userId,
                completed: true,
                startTime: { [Op.ne]: null },
                endTime: { [Op.ne]: null },
                scheduledDate: { [Op.gte]: startDate }
            }
        });

        const results = await Promise.all(tasks.map(async (task) => {
            const sessions = await Session.findAll({
                where: {
                    taskId: task.id,
                    isBreak: false
                }
            });

            const plannedMinutes = (new Date(task.endTime) - new Date(task.startTime)) / (1000 * 60);
            const actualMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);

            return {
                taskId: task.id,
                title: task.title,
                date: task.scheduledDate,
                plannedMinutes: Math.round(plannedMinutes),
                actualMinutes: Math.round(actualMinutes),
                efficiency: actualMinutes > 0 ? Math.round((plannedMinutes / actualMinutes) * 100) : 0
            };
        }));

        res.json(results);
    } catch (error) {
        console.error('Planned vs actual error:', error);
        res.status(500).json({ error: 'Failed to get planned vs actual' });
    }
});

// Summary stats for dashboard
router.get('/summary', async (req, res) => {
    try {
        const userId = req.user.id;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());

        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        // Today's stats
        const todaySessions = await Session.findAll({
            where: {
                userId,
                isBreak: false,
                startTime: { [Op.gte]: today }
            }
        });

        const todayMinutes = todaySessions.reduce((sum, s) => sum + s.duration, 0);
        const todayPomodoros = todaySessions.length;

        // This week's stats
        const weekSessions = await Session.findAll({
            where: {
                userId,
                isBreak: false,
                startTime: { [Op.gte]: thisWeekStart }
            }
        });

        const weekMinutes = weekSessions.reduce((sum, s) => sum + s.duration, 0);
        const weekPomodoros = weekSessions.length;

        // This month's stats
        const monthSessions = await Session.findAll({
            where: {
                userId,
                isBreak: false,
                startTime: { [Op.gte]: thisMonthStart }
            }
        });

        const monthMinutes = monthSessions.reduce((sum, s) => sum + s.duration, 0);
        const monthPomodoros = monthSessions.length;

        const todayTasksTotal = await Task.count({ where: { userId, scheduledDate: today } });
        const todayTasksDone = await Task.count({ where: { userId, scheduledDate: today, completed: true } });

        res.json({
            today: {
                minutes: todayMinutes,
                pomodoros: todayPomodoros,
                tasksCompleted: todayTasksDone,
                tasksTotal: todayTasksTotal
            },
            week: {
                minutes: weekMinutes,
                pomodoros: weekPomodoros
            },
            month: {
                minutes: monthMinutes,
                pomodoros: monthPomodoros
            }
        });
    } catch (error) {
        console.error('Summary error:', error);
        res.status(500).json({ error: 'Failed to get summary' });
    }
});

export default router;
