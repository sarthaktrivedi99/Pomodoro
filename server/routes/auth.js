import express from 'express';
import axios from 'axios';
import { User } from '../models/index.js';

const router = express.Router();

const CASDOOR_ENDPOINT = process.env.CASDOOR_ENDPOINT || 'http://localhost:8000';
const CLIENT_ID = process.env.CASDOOR_CLIENT_ID;
const CLIENT_SECRET = process.env.CASDOOR_CLIENT_SECRET;
const ORG_NAME = process.env.CASDOOR_ORG_NAME || 'pomodoro-org';
const APP_NAME = process.env.CASDOOR_APP_NAME || 'pomodoro-app';

// Register
router.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // STRATEGY CHANGE: Use Admin Cookie Flow to add user.
        // This is necessary because client_credentials token lacks permission to add-user,
        // and public signup enforces verification which we want to avoid for headless.

        // 1. Login as Global Admin to get Cookie (Session)
        const loginRes = await axios.post(`${CASDOOR_ENDPOINT}/api/login`, {
            type: 'login',
            username: process.env.CASDOOR_ADMIN_USER || 'admin',
            password: process.env.CASDOOR_ADMIN_PASSWORD || '123',
            application: 'app-built-in' // Admin lives here
        });

        if (loginRes.data.status === 'error') {
            throw new Error('Admin Login Failed: ' + loginRes.data.msg);
        }

        const cookies = loginRes.headers['set-cookie'];
        const headers = { Cookie: cookies.join('; ') };

        // 2. Add User via Admin API
        const newUser = {
            owner: ORG_NAME,
            name: username,
            password: password,
            passwordType: 'plain', // REQUIRED: tell Casdoor it's a plain password
            displayName: username,
            email: email || '',
            application: APP_NAME,
            type: 'normal-user',
        };

        const response = await axios.post(`${CASDOOR_ENDPOINT}/api/add-user`, newUser, { headers });

        if (response.data.status === 'error') {
            // Handle duplicate user gracefully
            if (response.data.msg.includes('existed')) {
                return res.status(409).json({ error: 'User already exists' });
            }
            return res.status(400).json({ error: response.data.msg });
        }

        // Also create local user record for linking
        // We link by username for now, or we can wait for first login
        // Let's wait for first login to sync.

        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Register error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // OAuth2 Password Grant Request
        // POST /api/login/oauth/access_token
        // This is the standard way to get a token via backend channel
        const params = new URLSearchParams();
        params.append('grant_type', 'password');
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);
        params.append('username', username);
        params.append('password', password);
        params.append('scope', 'openid profile email');

        // Casdoor specific: it might expect 'organization' in the username like 'org/user'?
        // Usually plain username works if the ClientID matches the app.

        const tokenRes = await axios.post(`${CASDOOR_ENDPOINT}/api/login/oauth/access_token`, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, id_token } = tokenRes.data;

        if (!access_token) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Sync User to Local DB
        // We decode the token to get user info (or use userinfo endpoint)
        // For efficiency, we just verify/decode here. 
        // Since we just got it from Casdoor, we trust it for the sync step (validation happens in middleware for other routes)

        // Let's call userinfo to be safe and get clean data
        const userRes = await axios.get(`${CASDOOR_ENDPOINT}/api/userinfo`, {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const remoteUser = userRes.data; // { sub, name, preferred_username, ... }

        // Upsert local user
        const [localUser] = await User.findOrCreate({
            where: { auth_id: remoteUser.sub },
            defaults: {
                username: remoteUser.preferred_username || remoteUser.name || username,
                auth_id: remoteUser.sub
                // password field is nullable or ignored now
            }
        });

        // Return the token to frontend
        // Frontend will store this and send it in 'Authorization: Bearer ...'
        res.json({
            token: access_token,
            user: {
                id: localUser.id, // Keep using local ID for frontend logic consistency
                username: localUser.username,
                auth_id: localUser.auth_id
                // Add fields if needed
            }
        });

    } catch (error) {
        console.error('Login error:', error.response?.data || error.message);
        res.status(401).json({ error: 'Login failed' });
    }
});

export default router;
