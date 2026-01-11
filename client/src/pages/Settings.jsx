import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';

export default function Settings() {
    const { user, token, updateBreakDuration, updateDefaultDuration } = useAuth();
    const [defaultDuration, setDefaultDuration] = useState(25);
    const [breakDuration, setBreakDuration] = useState(5);
    const [isCalendarConnected, setIsCalendarConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const location = useLocation();

    useEffect(() => {
        if (user) {
            setDefaultDuration(user.defaultDuration || 25);
            setBreakDuration(user.breakDuration || 5);
            checkCalendarStatus();
        }
    }, [user]);

    useEffect(() => {
        // Check for success/error query params
        const params = new URLSearchParams(location.search);
        if (params.get('calendar') === 'connected') {
            setSuccessMsg('✅ Google Calendar connected successfully!');
            setTimeout(() => setSuccessMsg(''), 5000);
            checkCalendarStatus();
        } else if (params.get('calendar') === 'error') {
            setErrorMsg('❌ Failed to connect Google Calendar.');
            setTimeout(() => setErrorMsg(''), 5000);
        }
    }, [location]);

    async function checkCalendarStatus() {
        try {
            const res = await fetch('/api/calendar/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setIsCalendarConnected(data.isConnected);
            }
        } catch (error) {
            console.error('Failed to check calendar status');
        }
    }

    async function handleConnectCalendar() {
        setIsConnecting(true);
        try {
            const res = await fetch('/api/calendar/auth-url', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const { authUrl } = await res.json();
                window.location.href = authUrl;
            }
        } catch (error) {
            setErrorMsg('Failed to initiate connection');
            setIsConnecting(false);
        }
    }

    async function handleDisconnectCalendar() {
        try {
            const res = await fetch('/api/calendar/disconnect', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setIsCalendarConnected(false);
                setSuccessMsg('Calendar disconnected.');
                setTimeout(() => setSuccessMsg(''), 3000);
            }
        } catch (error) {
            setErrorMsg('Failed to disconnect');
        }
    }

    async function handleImportEvents() {
        try {
            const res = await fetch('/api/calendar/import', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSuccessMsg(`✅ ${data.message}`);
                setTimeout(() => setSuccessMsg(''), 5000);
            }
        } catch (error) {
            setErrorMsg('Failed to import events');
        }
    }

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await updateDefaultDuration(defaultDuration);
            await updateBreakDuration(breakDuration);
            alert('Settings saved!');
        } catch (error) {
            console.error(error);
            alert('Failed to save settings');
        }
    };

    return (
        <div className="settings-page">
            <h1 className="page-title">Settings</h1>

            {successMsg && <div className="alert success">{successMsg}</div>}
            {errorMsg && <div className="alert error">{errorMsg}</div>}

            <div className="card settings-card">
                <h2>⏱️ Timer Preferences</h2>
                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label>Pomodoro Duration (minutes)</label>
                        <input
                            type="number"
                            value={defaultDuration}
                            onChange={(e) => setDefaultDuration(parseInt(e.target.value))}
                            min="1"
                            max="60"
                        />
                    </div>

                    <div className="form-group">
                        <label>Break Duration (minutes)</label>
                        <input
                            type="number"
                            value={breakDuration}
                            onChange={(e) => setBreakDuration(parseInt(e.target.value))}
                            min="1"
                            max="30"
                        />
                    </div>

                    <button type="submit" className="btn-primary">Save Timer Settings</button>
                </form>
            </div>

            <div className="card settings-card">
                <h2>📅 Calendar Integrations</h2>
                <p className="settings-desc">
                    Connect your Google Calendar to sync events and tasks.
                </p>

                <div className="integration-item">
                    <div className="integration-info">
                        <span className="integration-icon">🇬</span>
                        <div>
                            <h3>Google Calendar</h3>
                            <p className="status-text">
                                {isCalendarConnected ? '✅ Connected' : '⚪ Not connected'}
                            </p>
                        </div>
                    </div>

                    <div className="integration-actions">
                        {isCalendarConnected ? (
                            <div className="connected-actions">
                                <button
                                    className="btn-secondary"
                                    onClick={handleImportEvents}
                                >
                                    Import Events
                                </button>
                                <button
                                    className="btn-danger-outline"
                                    onClick={handleDisconnectCalendar}
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <button
                                className="btn-primary"
                                onClick={handleConnectCalendar}
                                disabled={isConnecting}
                            >
                                {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="card settings-card">
                <h2>🔒 Security</h2>
                <button className="btn-secondary">Change Password</button>
            </div>
        </div>
    );
}
