import express from 'express';
import { TimerState, Task, Session } from '../models/index.js';

const router = express.Router();

// Get timer state
router.get('/', async (req, res) => {
    try {
        const state = await TimerState.findOne({
            where: { userId: req.user.id }
        });

        if (!state) {
            return res.json(null);
        }

        // If running, calculate actual remaining time
        let remainingSeconds = state.remainingSeconds;
        if (state.isRunning && state.startTime) {
            const elapsed = Math.floor((Date.now() - new Date(state.startTime).getTime()) / 1000);
            remainingSeconds = Math.max(0, state.remainingSeconds - elapsed);
        }

        // Get associated task if exists
        let task = null;
        if (state.taskId) {
            task = await Task.findByPk(state.taskId);
        }

        res.json({
            ...state.toJSON(),
            remainingSeconds,
            task
        });
    } catch (error) {
        console.error('Get timer error:', error);
        res.status(500).json({ error: 'Failed to get timer state' });
    }
});

// Start timer
router.post('/start', async (req, res) => {
    try {
        const { taskId, durationMinutes, isBreak } = req.body;

        const durationSeconds = (durationMinutes || 25) * 60;

        const [state, created] = await TimerState.upsert({
            userId: req.user.id,
            taskId: taskId || null,
            startTime: new Date(),
            durationMinutes: durationMinutes || 25,
            remainingSeconds: durationSeconds,
            isRunning: true,
            isBreak: isBreak || false,
            updatedAt: new Date()
        }, {
            returning: true
        });

        res.json(state);
    } catch (error) {
        console.error('Start timer error:', error);
        res.status(500).json({ error: 'Failed to start timer' });
    }
});

// Pause timer
router.put('/pause', async (req, res) => {
    try {
        const state = await TimerState.findOne({
            where: { userId: req.user.id }
        });

        if (!state) {
            return res.status(404).json({ error: 'No active timer' });
        }

        // Calculate remaining time
        let remainingSeconds = state.remainingSeconds;
        if (state.isRunning && state.startTime) {
            const elapsed = Math.floor((Date.now() - new Date(state.startTime).getTime()) / 1000);
            remainingSeconds = Math.max(0, state.remainingSeconds - elapsed);
        }

        await state.update({
            isRunning: false,
            remainingSeconds,
            updatedAt: new Date()
        });

        res.json(state);
    } catch (error) {
        console.error('Pause timer error:', error);
        res.status(500).json({ error: 'Failed to pause timer' });
    }
});

// Resume timer
router.put('/resume', async (req, res) => {
    try {
        const state = await TimerState.findOne({
            where: { userId: req.user.id }
        });

        if (!state) {
            return res.status(404).json({ error: 'No active timer' });
        }

        await state.update({
            isRunning: true,
            startTime: new Date(),
            updatedAt: new Date()
        });

        res.json(state);
    } catch (error) {
        console.error('Resume timer error:', error);
        res.status(500).json({ error: 'Failed to resume timer' });
    }
});

// Stop/Clear timer
router.delete('/', async (req, res) => {
    try {
        await TimerState.destroy({
            where: { userId: req.user.id }
        });

        res.json({ message: 'Timer cleared' });
    } catch (error) {
        console.error('Clear timer error:', error);
        res.status(500).json({ error: 'Failed to clear timer' });
    }
});

// Log session (when timer completes)
router.post('/session', async (req, res) => {
    try {
        const { taskId, startTime, endTime, duration, isExtension, isBreak } = req.body;

        const session = await Session.create({
            userId: req.user.id,
            taskId,
            startTime: startTime || new Date(),
            endTime: endTime || new Date(),
            duration,
            isExtension: isExtension || false,
            isBreak: isBreak || false
        });

        res.status(201).json(session);
    } catch (error) {
        console.error('Log session error:', error);
        res.status(500).json({ error: 'Failed to log session' });
    }
});

export default router;
