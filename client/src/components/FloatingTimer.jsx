import { useTimer } from '../context/TimerContext';
import { useNavigate } from 'react-router-dom';

export default function FloatingTimer() {
    const {
        remainingSeconds,
        elapsedSeconds,
        isRunning,
        isFinished,
        task,
        timerState,
        isFlowMode,
        pauseTimer,
        resumeTimer
    } = useTimer();
    const navigate = useNavigate();

    // Don't show if no active timer
    if (!timerState && !task) return null;

    function formatTime(seconds) {
        const mins = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.abs(seconds) % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    const displayTime = isFlowMode ? elapsedSeconds : remainingSeconds;
    const isBreak = timerState?.isBreak;

    return (
        <div
            className={`floating-timer ${isBreak ? 'break' : ''} ${isFinished ? 'finished' : ''} ${!isRunning && !isFinished ? 'paused' : ''}`}
            onClick={() => navigate('/timer')}
        >
            <div className="floating-timer-icon">
                {isBreak ? '☕' : '🍅'}
            </div>
            <div className="floating-timer-content">
                <div className="floating-timer-time">
                    {isFlowMode && !isBreak && '↑ '}
                    {formatTime(displayTime)}
                </div>
                {task && (<div className="floating-timer-task">{task.title}</div>)}
            </div>
            <div className="floating-timer-controls">
                {!isFinished && (
                    <button
                        className="floating-timer-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            isRunning ? pauseTimer() : resumeTimer();
                        }}
                    >
                        {isRunning ? '⏸' : '▶'}
                    </button>
                )}
                {isFinished && (
                    <span className="floating-timer-alert">⏰</span>
                )}
            </div>
        </div>
    );
}
