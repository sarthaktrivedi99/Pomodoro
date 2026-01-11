import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTimer } from '../context/TimerContext';
import FocusSounds from '../components/FocusSounds';

export default function Timer() {
    const { user, token } = useAuth();
    const {
        remainingSeconds,
        elapsedSeconds,
        actualDuration,
        isRunning,
        isFinished,
        isFlowMode,
        task,
        timerState,
        startTimer,
        startFlowTimer,
        endFlowSession,
        pauseTimer,
        resumeTimer,
        clearTimer,
        logSession,
        setIsFlowMode
    } = useTimer();
    const navigate = useNavigate();

    const [currentPomodoro, setCurrentPomodoro] = useState(1);
    const [totalPomodoros, setTotalPomodoros] = useState(1);
    const [sessionHistory, setSessionHistory] = useState([]);

    // Calculate pomodoros when task changes
    useEffect(() => {
        if (task && task.startTime && task.endTime) {
            const start = new Date(task.startTime);
            const end = new Date(task.endTime);
            const durationMinutes = (end - start) / (1000 * 60);
            const focusDuration = user?.defaultDuration || 25;
            const breakDuration = user?.breakDuration || 5;
            const cycleLength = focusDuration + breakDuration;
            const pomodoros = Math.max(1, Math.floor(durationMinutes / cycleLength));
            setTotalPomodoros(pomodoros);
            setCurrentPomodoro(1);
            setSessionHistory([]);
        }
    }, [task?.id]);

    function formatTime(seconds) {
        const mins = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.abs(seconds) % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function getTimeRemaining() {
        if (!task?.endTime) return null;
        const now = new Date();
        const end = new Date(task.endTime);
        const remaining = Math.max(0, Math.floor((end - now) / 1000));
        return remaining;
    }

    async function handleDone() {
        if (task) {
            await fetch(`/api/tasks/${task.id}/complete`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }
        const duration = isFlowMode ? Math.round(elapsedSeconds / 60) : (timerState?.durationMinutes || 25);
        logSession(duration, false);
        setSessionHistory(prev => [...prev, { type: 'focus', duration }]);
        clearTimer();
        navigate('/tasks');
    }

    function handleFlowBreak() {
        const { workedMinutes, breakMinutes } = endFlowSession();
        logSession(workedMinutes, false);
        setSessionHistory(prev => [...prev, { type: 'focus', duration: workedMinutes }]);
        startTimer(task, breakMinutes, true);
    }

    function handleNextPomodoro() {
        const focusDuration = user?.defaultDuration || 25;
        logSession(focusDuration, false);
        setSessionHistory(prev => [...prev, { type: 'focus', duration: focusDuration }]);

        if (currentPomodoro < totalPomodoros) {
            setCurrentPomodoro(prev => prev + 1);
            startTimer(task, user?.breakDuration || 5, true);
        } else {
            handleDone();
        }
    }

    function handleBreak() {
        const duration = isFlowMode ? Math.round(elapsedSeconds / 60) : (timerState?.durationMinutes || 25);
        logSession(duration, false);
        setSessionHistory(prev => [...prev, { type: 'focus', duration }]);
        startTimer(task, user?.breakDuration || 5, true);
    }

    function handleEndBreak() {
        logSession(timerState?.durationMinutes || 5, true);
        setSessionHistory(prev => [...prev, { type: 'break', duration: timerState?.durationMinutes || 5 }]);

        if (isFlowMode) {
            startFlowTimer(task);
        } else {
            startTimer(task, user?.defaultDuration || 25, false);
        }
    }

    function handleSkipBreak() {
        if (isFlowMode) {
            startFlowTimer(task);
        } else {
            startTimer(task, user?.defaultDuration || 25, false);
        }
    }

    function handleExtend() {
        logSession(timerState?.durationMinutes || 25, false);
        startTimer(task, 5, false);
    }

    function handleBack() {
        clearTimer();
        navigate('/tasks');
    }

    function toggleMode() {
        if (timerState || task) return; // Can't switch during active session
        setIsFlowMode(!isFlowMode);
    }

    // No active timer
    if (!timerState && !task) {
        return (
            <div>
                <h1 className="page-title">Timer</h1>

                {/* Mode Toggle */}
                <div className="mode-toggle-container">
                    <div className="mode-toggle">
                        <button
                            className={`mode-btn ${!isFlowMode ? 'active' : ''}`}
                            onClick={() => setIsFlowMode(false)}
                        >
                            🍅 Pomodoro
                        </button>
                        <button
                            className={`mode-btn ${isFlowMode ? 'active' : ''}`}
                            onClick={() => setIsFlowMode(true)}
                        >
                            🌊 Flow Mode
                        </button>
                    </div>
                    <p className="mode-description">
                        {isFlowMode
                            ? "Timer counts up. Take a break when you're ready - break time scales with work time."
                            : "Classic 25-minute focus sessions with 5-minute breaks."
                        }
                    </p>
                </div>

                <div className="empty-state">
                    <h3>No timer active</h3>
                    <p>Go to Tasks and click on a time block to start a {isFlowMode ? 'Flow' : 'Pomodoro'} session</p>
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/tasks')}
                        style={{ marginTop: '20px' }}
                    >
                        Go to Tasks
                    </button>
                </div>
            </div>
        );
    }

    const isBreak = timerState?.isBreak;
    const timeRemaining = getTimeRemaining();
    const displayTime = isFlowMode && !isBreak ? elapsedSeconds : remainingSeconds;

    return (
        <div>
            <h1 className="page-title">Timer</h1>

            <div className="card timer-container">
                {/* Header with mode and sounds */}
                <div className="timer-header">
                    <div className="timer-mode-badge">
                        {isFlowMode ? '🌊 Flow Mode' : '🍅 Pomodoro'}
                    </div>
                    <FocusSounds />
                </div>

                {task && (
                    <>
                        <div className="timer-task-title">{task.title}</div>
                        {task.startTime && task.endTime && (
                            <div className="timer-schedule">
                                {new Date(task.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                {' - '}
                                {new Date(task.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </div>
                        )}
                    </>
                )}

                {/* Pomodoro Progress (only in standard mode) */}
                {!isFlowMode && totalPomodoros > 1 && (
                    <div className="pomodoro-progress">
                        <div className="progress-label">
                            Pomodoro {currentPomodoro} of {totalPomodoros}
                        </div>
                        <div className="progress-dots">
                            {Array.from({ length: totalPomodoros }).map((_, i) => (
                                <span
                                    key={i}
                                    className={`progress-dot ${i < currentPomodoro - 1 ? 'done' : ''} ${i === currentPomodoro - 1 && !isBreak ? 'active' : ''}`}
                                >
                                    🍅
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="timer-display">
                    {isFlowMode && !isBreak && <span className="flow-arrow">↑</span>}
                    {formatTime(displayTime)}
                </div>
                <div className="timer-label">
                    {isBreak ? '☕ Break Time' : (isFlowMode ? '🌊 In the Flow' : '🍅 Focus Time')}
                </div>

                {/* Worked time indicator in flow mode */}
                {isFlowMode && !isBreak && elapsedSeconds > 0 && (
                    <div className="flow-stats">
                        Earned break: {Math.max(5, Math.floor(elapsedSeconds / (25 * 60)) * 5)} min
                    </div>
                )}

                {/* Time block remaining */}
                {timeRemaining !== null && timeRemaining > 0 && !isBreak && (
                    <div className="time-block-remaining">
                        Time block ends in {Math.floor(timeRemaining / 60)} min
                    </div>
                )}

                {/* Flow mode controls when running */}
                {isFlowMode && !isBreak && !isFinished && (
                    <div className="timer-controls">
                        {isRunning ? (
                            <button className="btn-primary" onClick={pauseTimer}>
                                ⏸ Pause
                            </button>
                        ) : (
                            <button className="btn-primary" onClick={resumeTimer}>
                                ▶ Resume
                            </button>
                        )}
                        <button className="btn-secondary" onClick={handleFlowBreak}>
                            ☕ Take Break
                        </button>
                        <button className="btn-secondary" onClick={handleDone}>
                            ✓ Done
                        </button>
                        <button className="btn-secondary" onClick={handleBack}>
                            ✕ Cancel
                        </button>
                    </div>
                )}

                {/* Standard mode finished */}
                {!isFlowMode && isFinished && (
                    <div className="timer-prompt">
                        <h3>{isBreak ? '☕ Break Complete!' : '⏰ Pomodoro Complete!'}</h3>
                        <p style={{ color: 'var(--color-text-dim)', marginBottom: '20px' }}>
                            {isBreak ? 'Ready to focus again?' : 'What would you like to do?'}
                        </p>
                        <div className="timer-controls">
                            {isBreak ? (
                                <>
                                    <button className="btn-primary" onClick={handleEndBreak}>
                                        🍅 Start Next Pomodoro
                                    </button>
                                    <button className="btn-secondary" onClick={handleDone}>
                                        ✓ Done for now
                                    </button>
                                </>
                            ) : (
                                <>
                                    {currentPomodoro < totalPomodoros ? (
                                        <button className="btn-primary" onClick={handleNextPomodoro}>
                                            ☕ Break → Next Pomodoro
                                        </button>
                                    ) : (
                                        <button className="btn-primary" onClick={handleDone}>
                                            ✓ Complete Task
                                        </button>
                                    )}
                                    <button className="btn-secondary" onClick={handleBreak}>
                                        ☕ Just Take Break
                                    </button>
                                    <button className="btn-secondary" onClick={handleExtend}>
                                        +5 Minutes
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Break finished (both modes) */}
                {isBreak && isFinished && (
                    <div className="timer-prompt">
                        <h3>☕ Break Complete!</h3>
                        <p style={{ color: 'var(--color-text-dim)', marginBottom: '20px' }}>
                            Ready to get back in the flow?
                        </p>
                        <div className="timer-controls">
                            <button className="btn-primary" onClick={handleEndBreak}>
                                {isFlowMode ? '🌊 Resume Flow' : '🍅 Start Next Pomodoro'}
                            </button>
                            <button className="btn-secondary" onClick={handleDone}>
                                ✓ Done for now
                            </button>
                        </div>
                    </div>
                )}

                {/* Standard mode running */}
                {!isFlowMode && !isFinished && !isBreak && (
                    <div className="timer-controls">
                        {isRunning ? (
                            <button className="btn-primary" onClick={pauseTimer}>
                                ⏸ Pause
                            </button>
                        ) : (
                            <button className="btn-primary" onClick={resumeTimer}>
                                ▶ Resume
                            </button>
                        )}
                        <button className="btn-secondary" onClick={handleBack}>
                            ✕ Cancel
                        </button>
                    </div>
                )}

                {/* Break running (both modes) */}
                {isBreak && !isFinished && (
                    <div className="timer-controls">
                        {isRunning ? (
                            <button className="btn-primary" onClick={pauseTimer}>
                                ⏸ Pause
                            </button>
                        ) : (
                            <button className="btn-primary" onClick={resumeTimer}>
                                ▶ Resume
                            </button>
                        )}
                        <button className="btn-secondary" onClick={handleSkipBreak}>
                            Skip Break
                        </button>
                        <button className="btn-secondary" onClick={handleBack}>
                            ✕ Cancel
                        </button>
                    </div>
                )}

                {/* Session History */}
                {sessionHistory.length > 0 && (
                    <div className="session-history">
                        <h4>Session History</h4>
                        <div className="history-list">
                            {sessionHistory.map((session, i) => (
                                <span key={i} className={`history-item ${session.type}`}>
                                    {session.type === 'focus' ? '🍅' : '☕'} {session.duration}m
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
