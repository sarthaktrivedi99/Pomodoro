import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useAuth } from '../context/AuthContext';
import { useTimer } from '../context/TimerContext';

export default function Tasks() {
    const [tasks, setTasks] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [loading, setLoading] = useState(true);
    const calendarRef = useRef(null);
    const { token } = useAuth();
    const { startTimer, startFlowTimer, isFlowMode } = useTimer();
    const navigate = useNavigate();

    useEffect(() => {
        fetchTasks();

        // Listen for quick-add updates from sidebar
        const handleUpdate = () => fetchTasks();
        window.addEventListener('tasksUpdated', handleUpdate);
        return () => window.removeEventListener('tasksUpdated', handleUpdate);
    }, []);

    async function fetchTasks() {
        try {
            const res = await fetch('/api/tasks', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoading(false);
        }
    }

    // Convert tasks to FullCalendar events
    const events = tasks.map(task => {
        const event = {
            id: task.id.toString(),
            title: task.title,
            backgroundColor: task.completed ? '#4ade80' : '#ff6b6b',
            borderColor: task.completed ? '#22c55e' : '#ef4444',
            textColor: '#ffffff',
            extendedProps: {
                completed: task.completed,
                task: task
            }
        };

        // Use start/end time if available, otherwise use all-day event
        if (task.startTime && task.endTime) {
            event.start = task.startTime;
            event.end = task.endTime;
        } else if (task.scheduledDate) {
            event.date = task.scheduledDate;
            event.allDay = true;
        }

        return event;
    });

    function handleDateClick(info) {
        setSelectedDate(info.dateStr);
        setSelectedTask(null);
        setNewTaskTitle('');

        // Set default times based on click
        if (info.date) {
            const hours = info.date.getHours();
            const minutes = info.date.getMinutes();
            if (hours > 0 || minutes > 0) {
                setStartTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
                setEndTime(`${(hours + 1).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
            } else {
                setStartTime('09:00');
                setEndTime('10:00');
            }
        }

        setShowModal(true);
    }

    function handleEventClick(info) {
        const task = info.event.extendedProps.task;
        setSelectedTask(task);
        setSelectedDate(task.scheduledDate || (task.startTime ? task.startTime.split('T')[0] : null));
        setNewTaskTitle(task.title);

        // Extract times if available
        if (task.startTime) {
            const start = new Date(task.startTime);
            setStartTime(`${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`);
        }
        if (task.endTime) {
            const end = new Date(task.endTime);
            setEndTime(`${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`);
        }

        setShowModal(true);
    }

    async function handleAddTask(e) {
        e.preventDefault();
        if (!newTaskTitle.trim() || !selectedDate) return;

        // Create datetime strings
        const startDateTime = `${selectedDate}T${startTime}:00`;
        const endDateTime = `${selectedDate}T${endTime}:00`;

        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: newTaskTitle,
                    scheduledDate: selectedDate,
                    startTime: startDateTime,
                    endTime: endDateTime
                })
            });

            if (res.ok) {
                setNewTaskTitle('');
                setShowModal(false);
                fetchTasks();
            }
        } catch (error) {
            console.error('Failed to add task:', error);
        }
    }

    async function handleUpdateTask(e) {
        e.preventDefault();
        if (!selectedTask) return;

        const startDateTime = selectedDate ? `${selectedDate}T${startTime}:00` : null;
        const endDateTime = selectedDate ? `${selectedDate}T${endTime}:00` : null;

        try {
            await fetch(`/api/tasks/${selectedTask.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: newTaskTitle,
                    startTime: startDateTime,
                    endTime: endDateTime
                })
            });
            setShowModal(false);
            fetchTasks();
        } catch (error) {
            console.error('Failed to update task:', error);
        }
    }

    async function handleToggleComplete() {
        if (!selectedTask) return;
        try {
            await fetch(`/api/tasks/${selectedTask.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ completed: !selectedTask.completed })
            });
            setShowModal(false);
            fetchTasks();
        } catch (error) {
            console.error('Failed to update task:', error);
        }
    }

    async function handleDeleteTask() {
        if (!selectedTask) return;
        try {
            await fetch(`/api/tasks/${selectedTask.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setShowModal(false);
            fetchTasks();
        } catch (error) {
            console.error('Failed to delete task:', error);
        }
    }

    function handleStartTimer() {
        if (!selectedTask) return;
        if (isFlowMode) {
            startFlowTimer(selectedTask);
        } else {
            startTimer(selectedTask);
        }
        setShowModal(false);
        navigate('/timer');
    }

    async function handleEventDrop(info) {
        const taskId = info.event.id;
        const newStart = info.event.start;
        const newEnd = info.event.end || new Date(newStart.getTime() + 60 * 60 * 1000);

        try {
            await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    startTime: newStart.toISOString(),
                    endTime: newEnd.toISOString()
                })
            });
            fetchTasks();
        } catch (error) {
            console.error('Failed to move task:', error);
            info.revert();
        }
    }

    async function handleEventResize(info) {
        const taskId = info.event.id;
        const newStart = info.event.start;
        const newEnd = info.event.end;

        try {
            await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    startTime: newStart.toISOString(),
                    endTime: newEnd.toISOString()
                })
            });
            fetchTasks();
        } catch (error) {
            console.error('Failed to resize task:', error);
            info.revert();
        }
    }

    function formatDateForDisplay(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function calculatePomodoros(task) {
        if (!task.startTime || !task.endTime) return null;
        const start = new Date(task.startTime);
        const end = new Date(task.endTime);
        const durationMinutes = (end - start) / (1000 * 60);
        const focusDuration = 25;
        const breakDuration = 5;
        const cycleLength = focusDuration + breakDuration;
        const pomodoros = Math.floor(durationMinutes / cycleLength);
        const remainingFocus = Math.floor((durationMinutes % cycleLength));
        return { pomodoros, remainingFocus, totalMinutes: Math.round(durationMinutes) };
    }

    if (loading) {
        return <div className="loading">Loading calendar...</div>;
    }

    return (
        <div className="calendar-wrapper">
            <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
                }}
                events={events}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                editable={true}
                droppable={true}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={true}
                weekends={true}
                height="auto"
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                slotDuration="00:30:00"
                allDaySlot={true}
                nowIndicator={true}
                eventDisplay="block"
                eventTimeFormat={{
                    hour: 'numeric',
                    minute: '2-digit',
                    meridiem: 'short'
                }}
                buttonText={{
                    today: 'Today',
                    month: 'Month',
                    week: 'Week',
                    day: 'Day',
                    list: 'List'
                }}
            />

            {/* Task Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal task-modal" onClick={e => e.stopPropagation()}>
                        <h3>{selectedTask ? 'Edit Time Block' : 'Add Time Block'}</h3>
                        <p className="modal-date">{formatDateForDisplay(selectedDate)}</p>

                        <form onSubmit={selectedTask ? handleUpdateTask : handleAddTask}>
                            <div className="form-group">
                                <label className="form-label">Task</label>
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="What do you want to focus on?"
                                    autoFocus
                                />
                            </div>

                            <div className="time-inputs">
                                <div className="form-group">
                                    <label className="form-label">Start Time</label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">End Time</label>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Pomodoro Preview */}
                            {startTime && endTime && (
                                <div className="pomodoro-preview">
                                    {(() => {
                                        const start = new Date(`2000-01-01T${startTime}`);
                                        const end = new Date(`2000-01-01T${endTime}`);
                                        const durationMinutes = (end - start) / (1000 * 60);
                                        const focusDuration = 25;
                                        const breakDuration = 5;
                                        const cycleLength = focusDuration + breakDuration;
                                        const pomodoros = Math.floor(durationMinutes / cycleLength);
                                        const remaining = Math.floor(durationMinutes % cycleLength);

                                        return (
                                            <>
                                                <div className="pomodoro-count">
                                                    🍅 {pomodoros} Pomodoro{pomodoros !== 1 ? 's' : ''}
                                                    {remaining > 0 && ` + ${remaining}min`}
                                                </div>
                                                <div className="pomodoro-detail">
                                                    {durationMinutes > 0 && (
                                                        <span>{Math.round(durationMinutes)} minutes total • {focusDuration}min focus + {breakDuration}min break</span>
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })}
                                </div>
                            )}

                            {selectedTask && (
                                <div className="task-status">
                                    <span className={`status-badge ${selectedTask.completed ? 'completed' : 'pending'}`}>
                                        {selectedTask.completed ? '✓ Completed' : '○ Pending'}
                                    </span>
                                    {selectedTask.startTime && selectedTask.endTime && (() => {
                                        const info = calculatePomodoros(selectedTask);
                                        return info && (
                                            <span className="pomodoro-info">
                                                🍅 {info.pomodoros} pomodoros ({info.totalMinutes}min)
                                            </span>
                                        );
                                    })()}
                                </div>
                            )}

                            <div className="modal-actions">
                                {selectedTask && !selectedTask.completed && (
                                    <button type="button" className="btn-primary" onClick={handleStartTimer}>
                                        ▶ Start Focus
                                    </button>
                                )}
                                {selectedTask && (
                                    <>
                                        <button type="button" className="btn-secondary" onClick={handleToggleComplete}>
                                            {selectedTask.completed ? 'Reopen' : '✓ Done'}
                                        </button>
                                        <button type="button" className="btn-danger" onClick={handleDeleteTask}>
                                            Delete
                                        </button>
                                    </>
                                )}
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    {selectedTask ? 'Update' : 'Add'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
