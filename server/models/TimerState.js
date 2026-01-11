import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TimerState = sequelize.define('TimerState', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        field: 'user_id'
    },
    taskId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'task_id'
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'start_time'
    },
    durationMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'duration_minutes'
    },
    remainingSeconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'remaining_seconds'
    },
    isRunning: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_running'
    },
    isBreak: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_break'
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    }
}, {
    tableName: 'timer_states',
    timestamps: false
});

export default TimerState;
