import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
    const { token, user } = useAuth();
    const [timerState, setTimerState] = useState(null);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isFlowMode, setIsFlowMode] = useState(false);
    const [task, setTask] = useState(null);
    const [actualDuration, setActualDuration] = useState(0);
    const intervalRef = useRef(null);
    const startTimeRef = useRef(null);

    // Fetch timer state on mount
    useEffect(() => {
        if (token) {
            fetchTimerState();
        }
    }, [token]);

    // Tick effect - handles both countdown and count-up
    useEffect(() => {
        if (isRunning) {
            if (!startTimeRef.current) {
                startTimeRef.current = Date.now();
            }

            intervalRef.current = setInterval(() => {
                if (isFlowMode && !timerState?.isBreak) {
                    // Flow mode: count up
                    setElapsedSeconds(prev => prev + 1);
                    setActualDuration(prev => prev + 1);
                } else {
                    // Standard mode: count down
                    setRemainingSeconds(prev => {
                        if (prev <= 1) {
                            setIsRunning(false);
                            return 0;
                        }
                        return prev - 1;
                    });
                    setActualDuration(prev => prev + 1);
                }
            }, 1000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, isFlowMode, timerState?.isBreak]);

    async function fetchTimerState() {
        try {
            const res = await fetch('/api/timer', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    setTimerState(data);
                    setRemainingSeconds(data.remainingSeconds);
                    setIsRunning(data.isRunning);
                    setTask(data.task);
                }
            }
        } catch (error) {
            console.error('Failed to fetch timer:', error);
        }
    }

    async function startTimer(taskData, durationMinutes, isBreak = false) {
        try {
            const res = await fetch('/api/timer/start', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    taskId: taskData?.id,
                    durationMinutes: durationMinutes || user?.defaultDuration || 25,
                    isBreak
                })
            });

            if (res.ok) {
                const data = await res.json();
                setTimerState(data);
                setRemainingSeconds(data.remainingSeconds);
                setElapsedSeconds(0);
                setActualDuration(0);
                setIsRunning(true);
                setTask(taskData);
                startTimeRef.current = Date.now();
            }
        } catch (error) {
            console.error('Failed to start timer:', error);
        }
    }

    function startFlowTimer(taskData) {
        setIsFlowMode(true);
        setTimerState({ isBreak: false, durationMinutes: 0 });
        setElapsedSeconds(0);
        setActualDuration(0);
        setRemainingSeconds(0);
        setIsRunning(true);
        setTask(taskData);
        startTimeRef.current = Date.now();
    }

    function endFlowSession() {
        // Calculate break time: 5 min per 25 min worked
        const breakMinutes = Math.floor(elapsedSeconds / (25 * 60)) * 5;
        return {
            workedMinutes: Math.round(elapsedSeconds / 60),
            breakMinutes: Math.max(5, breakMinutes)
        };
    }

    async function pauseTimer() {
        try {
            const res = await fetch('/api/timer/pause', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setIsRunning(false);
            }
        } catch (error) {
            console.error('Failed to pause timer:', error);
        }
    }

    async function resumeTimer() {
        try {
            const res = await fetch('/api/timer/resume', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setIsRunning(true);
                startTimeRef.current = Date.now();
            }
        } catch (error) {
            console.error('Failed to resume timer:', error);
        }
    }

    async function clearTimer() {
        try {
            await fetch('/api/timer', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            setTimerState(null);
            setRemainingSeconds(0);
            setElapsedSeconds(0);
            setActualDuration(0);
            setIsRunning(false);
            setIsFlowMode(false);
            setTask(null);
            startTimeRef.current = null;
        } catch (error) {
            console.error('Failed to clear timer:', error);
        }
    }

    async function logSession(duration, isBreak = false) {
        try {
            await fetch('/api/timer/session', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    taskId: task?.id,
                    duration: duration || Math.round(actualDuration / 60),
                    isBreak
                })
            });
        } catch (error) {
            console.error('Failed to log session:', error);
        }
    }

    const isFinished = !isFlowMode && remainingSeconds === 0 && timerState !== null;

    return (
        <TimerContext.Provider value={{
            timerState,
            remainingSeconds,
            elapsedSeconds,
            actualDuration,
            isRunning,
            isFinished,
            isFlowMode,
            task,
            startTimer,
            startFlowTimer,
            endFlowSession,
            pauseTimer,
            resumeTimer,
            clearTimer,
            logSession,
            setTask,
            setIsFlowMode
        }}>
            {children}
        </TimerContext.Provider>
    );
}

export function useTimer() {
    const context = useContext(TimerContext);
    if (!context) {
        throw new Error('useTimer must be used within TimerProvider');
    }
    return context;
}
