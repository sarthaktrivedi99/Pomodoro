import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    auth_id: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true // Nullable for auth-provider users
    },
    defaultDuration: {
        type: DataTypes.INTEGER,
        defaultValue: 25,
        field: 'default_duration'
    },
    breakDuration: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
        field: 'break_duration'
    },
    googleAccessToken: {
        type: DataTypes.TEXT,
        field: 'google_access_token'
    },
    googleRefreshToken: {
        type: DataTypes.TEXT,
        field: 'google_refresh_token'
    }
}, {
    tableName: 'users',
    timestamps: false
});

export default User;
