import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sequelize from './config/database.js';
import { authenticateToken } from './middleware/auth.js';
import { User } from './models/index.js';
import axios from 'axios';

// Routes
import authRoutes from './routes/auth.js';
import tasksRoutes from './routes/tasks.js';
import timerRoutes from './routes/timer.js';
import settingsRoutes from './routes/settings.js';
import calendarRoutes from './routes/calendar.js';
import analyticsRoutes from './routes/analytics.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Public auth routes (login, register)
app.use('/api/auth', authRoutes);

// Protected route for getting current user - must be defined separately
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            id: user.id,
            username: user.username,
            defaultDuration: user.defaultDuration,
            breakDuration: user.breakDuration
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Protected routes
app.use('/api/tasks', authenticateToken, tasksRoutes);
app.use('/api/timer', authenticateToken, timerRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/calendar', authenticateToken, calendarRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Create timer_states table if not exists
async function ensureTimerStatesTable() {
    try {
        await sequelize.query(`
      CREATE TABLE IF NOT EXISTS timer_states (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id),
        task_id INTEGER REFERENCES tasks(id),
        start_time TIMESTAMP WITH TIME ZONE,
        duration_minutes INTEGER,
        remaining_seconds INTEGER,
        is_running BOOLEAN DEFAULT FALSE,
        is_break BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('timer_states table ensured');

        // Add scheduled_date column to tasks if it doesn't exist
        await sequelize.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date DATE;
    `);

        // Add start_time and end_time columns for time-blocked tasks
        await sequelize.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;
    `);
        await sequelize.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;
    `);

        // Add google token columns to users table
        await sequelize.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT;
    `);
        await sequelize.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
    `);

        // Add auth_id column for Casdoor
        await sequelize.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id VARCHAR(255) UNIQUE;
    `);

        // Make password nullable for Casdoor users
        await sequelize.query(`
      ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
    `);

        // Add user_id column to sessions table
        await sequelize.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
    `);

        console.log('Database schema ensured');
    } catch (error) {
        console.error('Error in database migrations:', error);
    }
}

// Start server
async function start() {
    try {
        await sequelize.authenticate();
        console.log('Database connected');

        // Ensure timer_states table exists
        await ensureTimerStatesTable();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// AI Chat Proxy
app.post('/api/chat', async (req, res) => {
    try {
        // Forward to MCP Server via Docker DNS
        // Using 'http://mcp-server:3002/chat' as 'mcp-server' is the service name
        // We need to forward headers to pass authentication
        const response = await axios.post('http://mcp-server:3002/chat', req.body, {
            headers: { Authorization: req.headers.authorization }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Chat Proxy Error:', error.message);
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Failed to connect to AI service' });
        }
    }
});

start();
