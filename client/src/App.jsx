import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTimer } from './context/TimerContext';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import Tasks from './pages/Tasks';
import Timer from './pages/Timer';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import Signup from './pages/Signup';

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="auth-container">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    return children;
}

function Layout({ children }) {
    const { user, logout, token } = useAuth();
    const {
        timerState,
        task,
        remainingSeconds,
        elapsedSeconds,
        isRunning,
        isFlowMode,
        isFinished,
        pauseTimer,
        resumeTimer,
        setIsFlowMode
    } = useTimer();
    const location = useLocation();
    const navigate = useNavigate();

    const [stats, setStats] = useState({ todayPomodoros: 0, todayMinutes: 0, todayTasks: 0 });
    const [quickTask, setQuickTask] = useState('');

    // Fetch today's stats
    useEffect(() => {
        if (token) {
            fetchStats();
        }
    }, [token]);

    async function fetchStats() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`/api/tasks?date=${today}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const tasks = await res.json();
                const completed = tasks.filter(t => t.completed).length;
                setStats(prev => ({ ...prev, todayTasks: completed, totalTasks: tasks.length }));
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }

    async function handleQuickAdd(e) {
        e.preventDefault();
        if (!quickTask.trim()) return;

        const now = new Date();
        const startHour = now.getHours();
        const today = now.toISOString().split('T')[0];
        const startTime = `${today}T${startHour.toString().padStart(2, '0')}:00:00`;
        const endTime = `${today}T${(startHour + 1).toString().padStart(2, '0')}:00:00`;

        try {
            await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: quickTask,
                    scheduledDate: today,
                    startTime,
                    endTime
                })
            });
            setQuickTask('');
            fetchStats();
            // Trigger refresh in Tasks component
            window.dispatchEvent(new Event('tasksUpdated'));
        } catch (error) {
            console.error('Failed to add task:', error);
        }
    }

    function formatTime(seconds) {
        const mins = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.abs(seconds) % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    const hasActiveTimer = timerState || task;
    const displayTime = isFlowMode && !timerState?.isBreak ? elapsedSeconds : remainingSeconds;

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    🍅 Pomodoro
                </div>

                {/* Quick Add */}
                <form className="quick-add" onSubmit={handleQuickAdd}>
                    <input
                        type="text"
                        value={quickTask}
                        onChange={(e) => setQuickTask(e.target.value)}
                        placeholder="+ Quick add task..."
                        className="quick-add-input"
                    />
                </form>

                {/* Active Timer in Sidebar */}
                {hasActiveTimer && location.pathname !== '/timer' && (
                    <div
                        className={`sidebar-timer ${timerState?.isBreak ? 'break' : ''} ${isFinished ? 'finished' : ''}`}
                        onClick={() => navigate('/timer')}
                    >
                        <div className="sidebar-timer-icon">
                            {timerState?.isBreak ? '☕' : (isFlowMode ? '🌊' : '🍅')}
                        </div>
                        <div className="sidebar-timer-info">
                            <div className="sidebar-timer-time">
                                {isFlowMode && !timerState?.isBreak && '↑'}
                                {formatTime(displayTime)}
                            </div>
                            <div className="sidebar-timer-task">{task?.title || 'Focus'}</div>
                        </div>
                        <button
                            className="sidebar-timer-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                isRunning ? pauseTimer() : resumeTimer();
                            }}
                        >
                            {isRunning ? '⏸' : '▶'}
                        </button>
                    </div>
                )}

                {/* Mode Toggle */}
                <div className="sidebar-mode">
                    <span className="mode-label">Timer Mode</span>
                    <div className="mode-switch">
                        <button
                            className={`mode-option ${!isFlowMode ? 'active' : ''}`}
                            onClick={() => setIsFlowMode(false)}
                            title="Fixed 25-min sessions"
                        >
                            🍅
                        </button>
                        <button
                            className={`mode-option ${isFlowMode ? 'active' : ''}`}
                            onClick={() => setIsFlowMode(true)}
                            title="Work until you're ready to break"
                        >
                            🌊
                        </button>
                    </div>
                </div>

                {/* Today's Stats */}
                <div className="sidebar-stats">
                    <div className="stats-header">Today</div>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <div className="stat-value">{stats.todayTasks || 0}</div>
                            <div className="stat-label">Done</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{stats.totalTasks || 0}</div>
                            <div className="stat-label">Total</div>
                        </div>
                    </div>
                    {stats.totalTasks > 0 && (
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${(stats.todayTasks / stats.totalTasks) * 100}%` }}
                            />
                        </div>
                    )}
                </div>

                <nav className="sidebar-nav">
                    <NavLink
                        to="/tasks"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        📅 Calendar
                    </NavLink>
                    <NavLink
                        to="/timer"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        ⏱️ Timer
                    </NavLink>
                    <NavLink
                        to="/analytics"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        📊 Analytics
                    </NavLink>
                    <NavLink
                        to="/settings"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        ⚙️ Settings
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">{user?.username}</div>
                    <button className="btn-secondary btn-sm" onClick={logout}>
                        Logout
                    </button>
                </div>
            </aside>
            <main className="main-content">
                {children}
            </main>
            <KeyboardShortcuts />
        </div>
    );
}

import AIAssistant from './components/AIAssistant';

export default function App() {
    return (
        <>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route
                    path="/tasks"
                    element={
                        <ProtectedRoute>
                            <Layout><Tasks /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/timer"
                    element={
                        <ProtectedRoute>
                            <Layout><Timer /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/settings"
                    element={
                        <ProtectedRoute>
                            <Layout><Settings /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/analytics"
                    element={
                        <ProtectedRoute>
                            <Layout><Analytics /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route path="/" element={<Navigate to="/tasks" />} />
            </Routes>
            <AIAssistant />
        </>
    );
}
