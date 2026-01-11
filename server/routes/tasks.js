import express from 'express';
import { Op } from 'sequelize';
import { Task } from '../models/index.js';

const router = express.Router();

// Get all tasks for user
router.get('/', async (req, res) => {
    try {
        const { date } = req.query;
        const where = { userId: req.user.id };

        if (date) {
            where.scheduledDate = date;
        }

        const tasks = await Task.findAll({
            where,
            order: [['startTime', 'ASC'], ['scheduledDate', 'ASC'], ['id', 'ASC']]
        });
        res.json(tasks);
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
    }
});

// Get tasks grouped by date (for timeboxing view)
router.get('/by-date', async (req, res) => {
    try {
        const tasks = await Task.findAll({
            where: { userId: req.user.id },
            order: [['startTime', 'ASC'], ['scheduledDate', 'ASC'], ['id', 'ASC']]
        });

        // Group tasks by date
        const grouped = {};
        const unscheduled = [];

        tasks.forEach(task => {
            const dateKey = task.scheduledDate || (task.startTime ? task.startTime.split('T')[0] : null);
            if (dateKey) {
                if (!grouped[dateKey]) {
                    grouped[dateKey] = [];
                }
                grouped[dateKey].push(task);
            } else {
                unscheduled.push(task);
            }
        });

        res.json({ grouped, unscheduled });
    } catch (error) {
        console.error('Get tasks by date error:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
    }
});

// Create task
router.post('/', async (req, res) => {
    try {
        const { title, scheduledDate, startTime, endTime } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // Calculate date from startTime if not provided
        let date = scheduledDate;
        if (!date && startTime) {
            date = new Date(startTime).toISOString().split('T')[0];
        }

        const task = await Task.create({
            userId: req.user.id,
            title,
            scheduledDate: date || null,
            startTime: startTime || null,
            endTime: endTime || null,
            completed: false
        });

        res.status(201).json(task);
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// Update task
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, details, scheduledDate, startTime, endTime, completed } = req.body;

        const task = await Task.findOne({
            where: { id, userId: req.user.id }
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Build update object
        const updates = {};
        if (title !== undefined) updates.title = title;
        if (details !== undefined) updates.details = details;
        if (scheduledDate !== undefined) updates.scheduledDate = scheduledDate;
        if (startTime !== undefined) updates.startTime = startTime;
        if (endTime !== undefined) updates.endTime = endTime;
        if (completed !== undefined) updates.completed = completed;

        // Update scheduledDate from startTime if startTime changes
        if (startTime !== undefined && startTime) {
            updates.scheduledDate = new Date(startTime).toISOString().split('T')[0];
        }

        await task.update(updates);

        res.json(task);
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// Delete task
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const task = await Task.findOne({
            where: { id, userId: req.user.id }
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        await task.destroy();
        res.json({ message: 'Task deleted' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// Mark task complete
router.post('/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;

        const task = await Task.findOne({
            where: { id, userId: req.user.id }
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        await task.update({ completed: true });
        res.json(task);
    } catch (error) {
        console.error('Complete task error:', error);
        res.status(500).json({ error: 'Failed to complete task' });
    }
});

export default router;
