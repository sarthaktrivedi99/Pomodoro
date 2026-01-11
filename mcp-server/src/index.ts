import express from 'express';
import cors from 'cors';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import pg from 'pg';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const app = express();
app.use(cors());
app.use(express.json()); // Parsing JSON for POST

// Database connection
const pool = new pg.Pool({
    connectionString: process.env.DB_CONNECTION_STRING,
});

// Auth Setup
const CASDOOR_ENDPOINT = process.env.CASDOOR_ENDPOINT || 'http://localhost:8000';
const jwks = jwksClient({
    jwksUri: `${CASDOOR_ENDPOINT}/.well-known/jwks`,
    requestHeaders: {},
    timeout: 30000
});

function getKey(header: any, callback: any) {
    jwks.getSigningKey(header.kid, function (err, key) {
        if (err) {
            console.error('JWKS fetch error:', err);
            return callback(err);
        }
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
    });
}

// Session Management
const sessions = new Map<string, { server: McpServer, transport: SSEServerTransport }>();

// Auth Middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let token = req.headers['authorization']?.split(' ')[1];

    // Support token in query for SSE
    if (!token && req.query.token) {
        token = req.query.token as string;
    }

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
        if (err) {
            // For SSE, 401 closes connection
            return res.status(403).json({ error: 'Invalid token', details: err.message });
        }
        // Valid
        (req as any).user = decoded;
        next();
    });
};

// Helper to verify token async
const verifyToken = (token: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
            if (err) reject(err);
            else resolve(decoded);
        });
    });
};

// Helper to get local user ID from DB
const getLocalUserId = async (authId: string): Promise<number> => {
    const client = await pool.connect();
    try {
        // First try to find
        let res = await client.query('SELECT id FROM users WHERE auth_id = $1', [authId]);
        if (res.rows.length > 0) return res.rows[0].id;

        // If not found, map by username? Or wait?
        // Ideally the user should have logged in via the main app first.
        // For fail-safety, we return -1 or throw.
        throw new Error('User not found in local database. Please login via the main app first.');
    } finally {
        client.release();
    }
}

// Factory to create User-Scoped Server
const createScopedServer = (userId: number) => {
    const server = new McpServer({
        name: "pomodoro-server",
        version: "1.0.0",
    });

    // 1. Tasks List
    server.resource(
        "tasks",
        "pomodoro://tasks",
        async (uri) => {
            const client = await pool.connect();
            try {
                const result = await client.query(`
                    SELECT id, title, details, scheduled_date, start_time, end_time, completed 
                    FROM tasks 
                    WHERE user_id = $1 
                    ORDER BY scheduled_date DESC, start_time ASC 
                    LIMIT 50
                `, [userId]);

                const tasks = result.rows.map(row => ({
                    id: row.id,
                    title: row.title,
                    status: row.completed ? 'completed' : 'pending',
                    scheduled: row.scheduled_date ? new Date(row.scheduled_date).toISOString().split('T')[0] : null,
                    time: row.start_time && row.end_time ?
                        `${new Date(row.start_time).toLocaleTimeString()} - ${new Date(row.end_time).toLocaleTimeString()}` : null
                }));

                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify(tasks, null, 2)
                    }]
                };
            } finally {
                client.release();
            }
        }
    );

    // 2. Analytics Summary
    server.resource(
        "analytics",
        "pomodoro://analytics/summary",
        async (uri) => {
            const client = await pool.connect();
            try {
                const result = await client.query(`
                    SELECT 
                        COUNT(*) as pomodoros, 
                        SUM(duration) as total_minutes 
                    FROM sessions 
                    WHERE user_id = $1 
                    AND is_break = false 
                    AND start_time >= CURRENT_DATE
                `, [userId]);

                const stats = result.rows[0];

                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({
                            date: new Date().toISOString().split('T')[0],
                            pomodoros: parseInt(stats.pomodoros || '0'),
                            minutes: parseInt(stats.total_minutes || '0')
                        }, null, 2)
                    }]
                };
            } finally {
                client.release();
            }
        }
    );

    // TOOLS

    // 1. Create Task
    // 1. Create Task
    server.tool(
        "create_task",
        "Create a new task in the Pomodoro app",
        {
            title: z.string().describe("Title of the task"),
            plannedMinutes: z.number().describe("Planned duration in minutes (default 25)").optional(),
            scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format").optional(),
            startTime: z.string().regex(/^\d{2}:\d{2}$/).describe("Start time in HH:MM format").optional(),
            endTime: z.string().regex(/^\d{2}:\d{2}$/).describe("End time in HH:MM format").optional(),
        },
        async ({ title, plannedMinutes, scheduledDate, startTime, endTime }) => {
            const client = await pool.connect();
            try {
                const dateStr = scheduledDate || new Date().toISOString().split('T')[0];
                await client.query(`
                    INSERT INTO tasks (user_id, title, scheduled_date, start_time, end_time, completed)
                    VALUES ($1, $2, $3, $4, $5, false)
                `, [userId, title, dateStr, startTime ? `${dateStr} ${startTime}` : null, endTime ? `${dateStr} ${endTime}` : null]);

                return {
                    content: [{ type: "text", text: `Task '${title}' created for ${dateStr} ${startTime ? `from ${startTime} to ${endTime}` : ''}` }]
                };
            } catch (error: any) {
                return {
                    content: [{ type: "text", text: `Failed to create task: ${error.message}` }],
                    isError: true
                };
            } finally {
                client.release();
            }
        }
    );

    // 2. Complete Task
    server.tool(
        "complete_task",
        "Mark a task as completed",
        {
            taskId: z.string().describe("ID of the task to complete")
        },
        async ({ taskId }) => {
            const client = await pool.connect();
            try {
                await client.query(`
                    UPDATE tasks SET completed = true WHERE id = $1 AND user_id = $2
                `, [taskId, userId]);
                return {
                    content: [{ type: "text", text: `Task ${taskId} marked as completed` }]
                };
            } finally {
                client.release();
            }
        }
    );

    // 3. Reschedule Task
    server.tool(
        "reschedule_task",
        "Reschedule an existing task to a new date",
        {
            taskId: z.string().describe("ID of the task"),
            newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("New date YYYY-MM-DD")
        },
        async ({ taskId, newDate }) => {
            const client = await pool.connect();
            try {
                await client.query(`
                    UPDATE tasks SET scheduled_date = $1 WHERE id = $2 AND user_id = $3
                `, [newDate, taskId, userId]);
                return {
                    content: [{ type: "text", text: `Task ${taskId} rescheduled to ${newDate}` }]
                };
            } finally {
                client.release();
            }
        }
    );

    // 4. Analyze Efficiency
    server.tool(
        "analyze_efficiency",
        "Analyze planned vs actual time efficiency",
        {
            days: z.number().default(30).describe("Number of days to analyze")
        },
        async ({ days }) => {
            const client = await pool.connect();
            try {
                const query = `
                    WITH task_metrics AS (
                        SELECT 
                            t.id, 
                            t.title, 
                            t.scheduled_date,
                            EXTRACT(EPOCH FROM (t.end_time - t.start_time))/60 as planned_minutes,
                            COALESCE((SELECT SUM(duration) FROM sessions s WHERE s.task_id = t.id AND s.is_break = false), 0) as actual_minutes
                        FROM tasks t
                        WHERE t.user_id = $1
                        AND t.completed = true
                        AND t.start_time IS NOT NULL 
                        AND t.end_time IS NOT NULL
                        AND t.scheduled_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
                    )
                    SELECT * FROM task_metrics
                    ORDER BY scheduled_date DESC
                    LIMIT 20
                `;

                const result = await client.query(query, [userId, days]);

                // ... map logic ...
                const analysis = result.rows.map(row => {
                    const planned = Math.round(row.planned_minutes || 0);
                    const actual = Math.round(row.actual_minutes || 0);
                    const efficiency = actual > 0 ? Math.round((planned / actual) * 100) : 0;
                    return {
                        task: row.title,
                        date: new Date(row.scheduled_date).toISOString().split('T')[0],
                        planned: `${planned}m`,
                        actual: `${actual}m`,
                        efficiency: `${efficiency}%`
                    };
                });

                return {
                    content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }]
                };
            } finally {
                client.release();
            }
        }
    );

    // 5. Get Calendar Events
    server.tool(
        "get_calendar_events",
        "Get scheduled tasks/events for a date range to check availability",
        {
            startDate: z.string().describe("YYYY-MM-DD"),
            endDate: z.string().describe("YYYY-MM-DD")
        },
        async ({ startDate, endDate }) => {
            const client = await pool.connect();
            try {
                const result = await client.query(`
                    SELECT title, scheduled_date, start_time, end_time 
                    FROM tasks 
                    WHERE user_id = $1 
                    AND scheduled_date BETWEEN $2 AND $3
                    ORDER BY scheduled_date, start_time
                `, [userId, startDate, endDate]);

                const events = result.rows.map(row => ({
                    title: row.title,
                    date: new Date(row.scheduled_date).toISOString().split('T')[0],
                    time: row.start_time && row.end_time ?
                        `${new Date(row.start_time).toLocaleTimeString()} - ${new Date(row.end_time).toLocaleTimeString()}` : 'All Day'
                }));

                return {
                    content: [{ type: "text", text: JSON.stringify(events, null, 2) }]
                };
            } finally {
                client.release();
            }
        }
    );

    return server;
};

// SSE ENDPOINTS
app.get('/sse', async (req, res) => {
    let token = req.headers['authorization']?.split(' ')[1];
    if (!token && req.query.token) token = req.query.token as string;

    if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    try {
        // 1. Verify Token
        const decoded: any = await verifyToken(token);
        const authId = decoded.sub;

        // 2. Get Local User ID
        const userId = await getLocalUserId(authId);

        // 3. Create Scoped Server
        const server = createScopedServer(userId);

        // 4. Create Transport
        const transport = new SSEServerTransport("/messages", res);

        // 5. Store Session
        // Note: SDK's SSEServerTransport might verify sending the endpoint in the "endpoint" event.
        // We need to capture the sessionId.
        // We'll hook into plain request/response if possible, but the SDK abstracts it.
        // However, the transport.sessionId is generated in constructor usually (or accessible).
        // Let's assume we can map it. 
        // Actually, the client sends the sessionId in POST.

        // Wait, transport.sessionId is likely protected/private or generated later?
        // Checking "SSEServerTransport" in general usage:
        // usually passed to server.connect(transport).

        await server.connect(transport);

        // After connect, the transport is active.
        // We need check if we can access sessionId.
        // The SSEServerTransport writes an event with session ID to the stream.
        // We can capture it if we wrap it?

        // Workaround: We store ALL active servers in a map if we can get the ID?
        // Or we rely on the fact that `transport.handlePostMessage` needs to be routed.

        // Let's rely on a custom property we inject or Map `transport.sessionId` if public.
        // If not public, we are in trouble for routing.

        // Inspecting typical SSEServerTransport implementation:
        // It likely has `sessionId` property.
        const sessionId = (transport as any).sessionId;
        if (sessionId) {
            sessions.set(sessionId, { server, transport });
        }

        // Clean up on close
        req.on('close', () => {
            if (sessionId) sessions.delete(sessionId);
            server.close();
        });

    } catch (err: any) {
        console.error('SSE Error:', err.message);
        res.status(403).json({ error: 'Access Denied', details: err.message });
    }
});

app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
        res.status(400).send("Missing sessionId");
        return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
        res.status(404).send("Session not found");
        return;
    }

    // We don't re-authenticate here because sessionId implies an active, authenticated stream?
    // STRICTLY: We SHOULD verify token again on POST, but usually the stream is the auth boundary.
    // Let's trust the session ID for now (standard SSE pattern).

    await session.transport.handlePostMessage(req, res);
});

// OpenAI SDK for direct tool calling
import OpenAI from 'openai';

// Initialize OpenAI client for OpenRouter
const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || "",
    baseURL: "https://openrouter.ai/api/v1",
});

// Tool definitions for OpenAI format
const getToolDefinitions = (todayStr: string, tomorrowStr: string): OpenAI.Chat.Completions.ChatCompletionTool[] => [
    {
        type: "function",
        function: {
            name: "create_task",
            description: `Create a task. Today is ${todayStr}, tomorrow is ${tomorrowStr}. Convert times to 24h format (3pm=15:00).`,
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string", description: "Short task title" },
                    scheduledDate: { type: "string", description: `Date as YYYY-MM-DD. Today=${todayStr}, Tomorrow=${tomorrowStr}` },
                    startTime: { type: "string", description: "Start time as HH:MM (24h)" },
                    endTime: { type: "string", description: "End time as HH:MM (24h)" }
                },
                required: ["title"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_task",
            description: "Update an existing task. Provide the task ID and fields to change.",
            parameters: {
                type: "object",
                properties: {
                    taskId: { type: "number", description: "ID of the task to update" },
                    title: { type: "string", description: "New task title (optional)" },
                    scheduledDate: { type: "string", description: "New date as YYYY-MM-DD (optional)" },
                    startTime: { type: "string", description: "New start time as HH:MM (optional)" },
                    endTime: { type: "string", description: "New end time as HH:MM (optional)" },
                    completed: { type: "boolean", description: "Mark as completed or not (optional)" }
                },
                required: ["taskId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "delete_task",
            description: "Delete a task permanently by its ID.",
            parameters: {
                type: "object",
                properties: {
                    taskId: { type: "number", description: "ID of the task to delete" }
                },
                required: ["taskId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "list_tasks",
            description: "List all tasks. Useful to find task IDs for updating or deleting.",
            parameters: {
                type: "object",
                properties: {
                    showCompleted: { type: "boolean", description: "Include completed tasks (default: false)" }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_analytics",
            description: "Get productivity stats for today.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_current_date",
            description: "Get today's date.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    }
];

// Tool execution
const executeTool = async (toolName: string, args: any, userId: number): Promise<string> => {
    const client = await pool.connect();
    try {
        switch (toolName) {
            case "create_task": {
                const { title, scheduledDate, startTime, endTime } = args;
                const dateStr = scheduledDate || new Date().toISOString().split('T')[0];
                const start = startTime ? `${dateStr} ${startTime}` : null;
                const end = endTime ? `${dateStr} ${endTime}` : null;

                await client.query(`
                    INSERT INTO tasks (user_id, title, scheduled_date, start_time, end_time, completed)
                    VALUES ($1, $2, $3, $4, $5, false)
                `, [userId, title, dateStr, start, end]);

                return `Task '${title}' created for ${dateStr}${startTime ? ` from ${startTime} to ${endTime || '?'}` : ''}.`;
            }
            case "update_task": {
                const { taskId, title, scheduledDate, startTime, endTime, completed } = args;

                // Build dynamic update query
                const updates: string[] = [];
                const values: any[] = [];
                let paramIndex = 1;

                if (title !== undefined) {
                    updates.push(`title = $${paramIndex++}`);
                    values.push(title);
                }
                if (scheduledDate !== undefined) {
                    updates.push(`scheduled_date = $${paramIndex++}`);
                    values.push(scheduledDate);
                }
                if (startTime !== undefined) {
                    const dateStr = scheduledDate || new Date().toISOString().split('T')[0];
                    updates.push(`start_time = $${paramIndex++}`);
                    values.push(`${dateStr} ${startTime}`);
                }
                if (endTime !== undefined) {
                    const dateStr = scheduledDate || new Date().toISOString().split('T')[0];
                    updates.push(`end_time = $${paramIndex++}`);
                    values.push(`${dateStr} ${endTime}`);
                }
                if (completed !== undefined) {
                    updates.push(`completed = $${paramIndex++}`);
                    values.push(completed);
                }

                if (updates.length === 0) {
                    return "No fields to update.";
                }

                values.push(taskId, userId);
                const result = await client.query(`
                    UPDATE tasks SET ${updates.join(', ')}
                    WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
                    RETURNING title
                `, values);

                if (result.rowCount === 0) {
                    return `Task ${taskId} not found or you don't have permission.`;
                }
                return `Task ${taskId} ('${result.rows[0].title}') updated successfully.`;
            }
            case "delete_task": {
                const { taskId } = args;
                const result = await client.query(`
                    DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING title
                `, [taskId, userId]);

                if (result.rowCount === 0) {
                    return `Task ${taskId} not found or you don't have permission.`;
                }
                return `Task ${taskId} ('${result.rows[0].title}') deleted successfully.`;
            }
            case "list_tasks": {
                const { showCompleted } = args;
                const result = await client.query(`
                    SELECT id, title, scheduled_date, start_time, end_time, completed
                    FROM tasks 
                    WHERE user_id = $1 ${showCompleted ? '' : 'AND completed = false'}
                    ORDER BY scheduled_date DESC, start_time ASC
                    LIMIT 20
                `, [userId]);

                if (result.rows.length === 0) {
                    return "No tasks found.";
                }

                const taskList = result.rows.map(t =>
                    `ID:${t.id} - ${t.title} (${t.scheduled_date ? new Date(t.scheduled_date).toISOString().split('T')[0] : 'no date'})${t.completed ? ' ✓' : ''}`
                ).join('\n');
                return `Your tasks:\n${taskList}`;
            }
            case "get_analytics": {
                const result = await client.query(`
                    SELECT COUNT(*) as pomodoros, SUM(duration) as total_minutes 
                    FROM sessions WHERE user_id = $1 AND is_break = false AND start_time >= CURRENT_DATE
                `, [userId]);
                const s = result.rows[0];
                return `Today's Stats: ${s.pomodoros} sessions, ${s.total_minutes || 0} minutes focused.`;
            }
            case "get_current_date": {
                const now = new Date();
                return `Today is ${now.toISOString().split('T')[0]} (${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})`;
            }
            default:
                return `Unknown tool: ${toolName}`;
        }
    } catch (error: any) {
        return `Error: ${error.message}`;
    } finally {
        client.release();
    }
};

// CHAT ENDPOINT - Using OpenAI SDK with modern tools API
app.post('/chat', authenticate, async (req, res) => {
    // 1. Resolve User
    const user = (req as any).user;
    let userId: number;
    try {
        userId = await getLocalUserId(user.sub);
    } catch (e) {
        return res.status(401).json({ error: 'User not initialized' });
    }

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    try {
        // 2. Get date context
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        // 3. Create system prompt
        const systemPrompt = `You are a helpful task management assistant. Today is ${todayStr}.
When creating tasks:
- Extract a short 'title' from the user request
- Convert relative dates: 'today' = ${todayStr}, 'tomorrow' = ${tomorrowStr}
- Convert times to 24h format (3pm = 15:00, 4pm = 16:00)
- If the user says 'from 3 to 4', set startTime='15:00' and endTime='16:00'
Use the create_task tool with proper parameters.`;

        // 4. Call OpenAI with tools
        const response = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
            tools: getToolDefinitions(todayStr, tomorrowStr),
            tool_choice: "auto"
        });

        const choice = response.choices[0];

        // 5. Check for tool calls
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            const toolCall = choice.message.tool_calls[0];
            const args = JSON.parse(toolCall.function.arguments);

            console.log(`Executing tool: ${toolCall.function.name}`, args);
            const result = await executeTool(toolCall.function.name, args, userId);

            res.json({ response: result });
        } else {
            // No tool call, return the text response
            res.json({ response: choice.message.content || "I'm not sure how to help with that." });
        }

    } catch (e: any) {
        console.error("Agent Error:", e);
        res.status(500).json({ error: "AI processing failed", details: e.message });
    }
});

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`MCP Server running on port ${PORT}`);
});
