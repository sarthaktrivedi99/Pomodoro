import User from './User.js';
import Task from './Task.js';
import Session from './Session.js';
import TimerState from './TimerState.js';

// Define associations
User.hasMany(Task, { foreignKey: 'userId' });
Task.belongsTo(User, { foreignKey: 'userId' });

Task.hasMany(Session, { foreignKey: 'taskId' });
Session.belongsTo(Task, { foreignKey: 'taskId' });

User.hasOne(TimerState, { foreignKey: 'userId' });
TimerState.belongsTo(User, { foreignKey: 'userId' });

export { User, Task, Session, TimerState };
