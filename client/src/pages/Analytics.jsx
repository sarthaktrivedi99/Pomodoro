import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Analytics() {
    const { token } = useAuth();
    const [summary, setSummary] = useState(null);
    const [dailyFocus, setDailyFocus] = useState([]);
    const [heatmapData, setHeatmapData] = useState([]);
    const [plannedVsActual, setPlannedVsActual] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        fetchAllData();
    }, []);

    async function fetchAllData() {
        try {
            const [summaryRes, dailyRes, heatmapRes, pvaRes] = await Promise.all([
                fetch('/api/analytics/summary', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/analytics/daily-focus?days=30', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/analytics/hourly-heatmap?days=30', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/analytics/planned-vs-actual?days=30', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (summaryRes.ok) setSummary(await summaryRes.json());
            if (dailyRes.ok) setDailyFocus(await dailyRes.json());
            if (heatmapRes.ok) setHeatmapData(await heatmapRes.json());
            if (pvaRes.ok) setPlannedVsActual(await pvaRes.json());
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6am to 10pm

    function getHeatmapValue(day, hour) {
        const cell = heatmapData.find(h =>
            parseInt(h.dayOfWeek) === day && parseInt(h.hour) === hour
        );
        return cell ? parseInt(cell.totalMinutes) : 0;
    }

    function getHeatmapColor(minutes) {
        if (minutes === 0) return 'var(--color-bg)';
        if (minutes < 30) return 'rgba(74, 222, 128, 0.2)';
        if (minutes < 60) return 'rgba(74, 222, 128, 0.4)';
        if (minutes < 120) return 'rgba(74, 222, 128, 0.6)';
        return 'rgba(74, 222, 128, 0.8)';
    }

    if (loading) {
        return <div className="loading">Loading analytics...</div>;
    }

    return (
        <div className="analytics-page">
            <h1 className="page-title">Analytics</h1>

            {/* Tab Navigation */}
            <div className="analytics-tabs">
                <button
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={`tab-btn ${activeTab === 'heatmap' ? 'active' : ''}`}
                    onClick={() => setActiveTab('heatmap')}
                >
                    Heatmap
                </button>
                <button
                    className={`tab-btn ${activeTab === 'efficiency' ? 'active' : ''}`}
                    onClick={() => setActiveTab('efficiency')}
                >
                    Efficiency
                </button>
            </div>

            {activeTab === 'overview' && (
                <div className="analytics-overview">
                    {/* Summary Cards */}
                    {summary && (
                        <div className="stats-cards">
                            <div className="stat-card">
                                <div className="stat-card-icon">🍅</div>
                                <div className="stat-card-value">{summary.today.pomodoros}</div>
                                <div className="stat-card-label">Today's Pomodoros</div>
                                <div className="stat-card-sub">{summary.today.minutes} minutes</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-card-icon">✅</div>
                                <div className="stat-card-value">{summary.today.tasksCompleted}/{summary.today.tasksTotal}</div>
                                <div className="stat-card-label">Tasks Completed</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-card-icon">📅</div>
                                <div className="stat-card-value">{summary.week.pomodoros}</div>
                                <div className="stat-card-label">This Week</div>
                                <div className="stat-card-sub">{Math.round(summary.week.minutes / 60)}h {summary.week.minutes % 60}m</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-card-icon">📆</div>
                                <div className="stat-card-value">{summary.month.pomodoros}</div>
                                <div className="stat-card-label">This Month</div>
                                <div className="stat-card-sub">{Math.round(summary.month.minutes / 60)}h focus time</div>
                            </div>
                        </div>
                    )}

                    {/* Daily Focus Chart */}
                    <div className="card chart-card">
                        <h3>Daily Focus Time (Last 30 Days)</h3>
                        <div className="bar-chart">
                            {dailyFocus.map((day, i) => (
                                <div key={i} className="bar-container">
                                    <div
                                        className="bar"
                                        style={{ height: `${Math.min(100, (day.totalMinutes / 120) * 100)}%` }}
                                        title={`${day.date}: ${day.totalMinutes} minutes`}
                                    />
                                    <div className="bar-label">
                                        {new Date(day.date).getDate()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'heatmap' && (
                <div className="analytics-heatmap">
                    <div className="card">
                        <h3>🔥 Productivity Heatmap</h3>
                        <p className="card-subtitle">When are you most productive?</p>

                        <div className="heatmap-container">
                            <div className="heatmap-header">
                                <div className="heatmap-corner"></div>
                                {hours.map(h => (
                                    <div key={h} className="heatmap-hour-label">
                                        {h}:00
                                    </div>
                                ))}
                            </div>
                            {days.map((dayName, dayIndex) => (
                                <div key={dayIndex} className="heatmap-row">
                                    <div className="heatmap-day-label">{dayName}</div>
                                    {hours.map(hour => {
                                        const value = getHeatmapValue(dayIndex, hour);
                                        return (
                                            <div
                                                key={hour}
                                                className="heatmap-cell"
                                                style={{ backgroundColor: getHeatmapColor(value) }}
                                                title={`${dayName} ${hour}:00 - ${value} minutes`}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        <div className="heatmap-legend">
                            <span>Less</span>
                            <div className="legend-cell" style={{ backgroundColor: 'var(--color-bg)' }}></div>
                            <div className="legend-cell" style={{ backgroundColor: 'rgba(74, 222, 128, 0.2)' }}></div>
                            <div className="legend-cell" style={{ backgroundColor: 'rgba(74, 222, 128, 0.4)' }}></div>
                            <div className="legend-cell" style={{ backgroundColor: 'rgba(74, 222, 128, 0.6)' }}></div>
                            <div className="legend-cell" style={{ backgroundColor: 'rgba(74, 222, 128, 0.8)' }}></div>
                            <span>More</span>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'efficiency' && (
                <div className="analytics-efficiency">
                    <div className="card">
                        <h3>📊 Planned vs Actual</h3>
                        <p className="card-subtitle">How accurate are your time estimates?</p>

                        {plannedVsActual.length === 0 ? (
                            <div className="empty-state">
                                <p>No completed tasks with time data yet.</p>
                                <p>Complete some timed tasks to see your efficiency metrics.</p>
                            </div>
                        ) : (
                            <div className="efficiency-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Task</th>
                                            <th>Date</th>
                                            <th>Planned</th>
                                            <th>Actual</th>
                                            <th>Efficiency</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {plannedVsActual.map((task, i) => (
                                            <tr key={i}>
                                                <td>{task.title}</td>
                                                <td>{new Date(task.date).toLocaleDateString()}</td>
                                                <td>{task.plannedMinutes}m</td>
                                                <td>{task.actualMinutes}m</td>
                                                <td>
                                                    <span className={`efficiency-badge ${task.efficiency >= 80 ? 'good' : task.efficiency >= 50 ? 'ok' : 'poor'}`}>
                                                        {task.efficiency}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
