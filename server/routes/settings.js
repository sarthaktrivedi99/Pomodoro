import express from 'express';
import { User } from '../models/index.js';

const router = express.Router();

// Get settings
router.get('/', async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            defaultDuration: user.defaultDuration,
            breakDuration: user.breakDuration
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// Update settings
router.put('/', async (req, res) => {
    try {
        const { defaultDuration, breakDuration } = req.body;

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await user.update({
            defaultDuration: defaultDuration || user.defaultDuration,
            breakDuration: breakDuration || user.breakDuration
        });

        res.json({
            defaultDuration: user.defaultDuration,
            breakDuration: user.breakDuration
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

export default router;
