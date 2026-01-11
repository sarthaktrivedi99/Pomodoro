import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Session = sequelize.define('Session', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'user_id'
    },
    taskId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'task_id'
    },
    startTime: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'start_time'
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'end_time'
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    isExtension: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_extension'
    },
    isBreak: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_break'
    }
}, {
    tableName: 'sessions',
    timestamps: false
});

export default Session;
