import express from 'express';
import { google } from 'googleapis';
import { User, Task } from '../models/index.js';

const router = express.Router();

// OAuth2 configuration - these would come from environment variables
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/callback'
);

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'];

// Get OAuth URL for user to authorize
router.get('/auth-url', async (req, res) => {
    try {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            state: req.user.id.toString() // Pass user ID in state for callback
        });
        res.json({ authUrl });
    } catch (error) {
        console.error('Generate auth URL error:', error);
        res.status(500).json({ error: 'Failed to generate auth URL' });
    }
});

// OAuth callback - exchanges code for tokens
router.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        const userId = parseInt(state);

        const { tokens } = await oauth2Client.getToken(code);

        // Store tokens in user record
        await User.update({
            googleAccessToken: tokens.access_token,
            googleRefreshToken: tokens.refresh_token
        }, {
            where: { id: userId }
        });

        // Redirect back to app
        res.redirect('/settings?calendar=connected');
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('/settings?calendar=error');
    }
});

// Check if calendar is connected
router.get('/status', async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        const isConnected = !!(user.googleAccessToken);
        res.json({ isConnected });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: 'Failed to check status' });
    }
});

// Disconnect calendar
router.post('/disconnect', async (req, res) => {
    try {
        await User.update({
            googleAccessToken: null,
            googleRefreshToken: null
        }, {
            where: { id: req.user.id }
        });
        res.json({ message: 'Calendar disconnected' });
    } catch (error) {
        console.error('Disconnect error:', error);
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

// Fetch events from Google Calendar
router.get('/events', async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        if (!user.googleAccessToken) {
            return res.status(401).json({ error: 'Calendar not connected' });
        }

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const { timeMin, timeMax } = req.query;

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin || new Date().toISOString(),
            timeMax: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });

        const events = response.data.items.map(event => ({
            id: event.id,
            title: event.summary,
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            source: 'google',
            allDay: !event.start.dateTime
        }));

        res.json(events);
    } catch (error) {
        console.error('Fetch events error:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Sync a task to Google Calendar
router.post('/sync-task/:taskId', async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        const task = await Task.findOne({
            where: { id: req.params.taskId, userId: req.user.id }
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (!user.googleAccessToken) {
            return res.status(401).json({ error: 'Calendar not connected' });
        }

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const event = {
            summary: task.title,
            description: task.details || 'Created from Pomodoro App',
            start: {
                dateTime: task.startTime,
                timeZone: 'UTC'
            },
            end: {
                dateTime: task.endTime,
                timeZone: 'UTC'
            }
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event
        });

        res.json({
            message: 'Task synced to Google Calendar',
            eventId: response.data.id
        });
    } catch (error) {
        console.error('Sync task error:', error);
        res.status(500).json({ error: 'Failed to sync task' });
    }
});

// Import events from Google Calendar as tasks
router.post('/import', async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        if (!user.googleAccessToken) {
            return res.status(401).json({ error: 'Calendar not connected' });
        }

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(today);
        endOfWeek.setDate(endOfWeek.getDate() + 7);

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: today.toISOString(),
            timeMax: endOfWeek.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });

        const importedTasks = [];

        for (const event of response.data.items) {
            if (!event.start.dateTime) continue; // Skip all-day events

            const existingTask = await Task.findOne({
                where: {
                    userId: req.user.id,
                    title: event.summary,
                    startTime: event.start.dateTime
                }
            });

            if (!existingTask) {
                const task = await Task.create({
                    userId: req.user.id,
                    title: event.summary || 'Imported Event',
                    scheduledDate: event.start.dateTime.split('T')[0],
                    startTime: event.start.dateTime,
                    endTime: event.end.dateTime,
                    completed: false
                });
                importedTasks.push(task);
            }
        }

        res.json({
            message: `Imported ${importedTasks.length} events`,
            tasks: importedTasks
        });
    } catch (error) {
        console.error('Import events error:', error);
        res.status(500).json({ error: 'Failed to import events' });
    }
});

export default router;
