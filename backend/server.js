import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './database/db.js';
import { seedIfEmpty } from './database/seed.js';
import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import dailyUpdatesRouter from './routes/dailyUpdates.js';
import activityRouter from './routes/activity.js';
import notificationsRouter from './routes/notifications.js';
import usersRouter from './routes/users.js';
import departmentsRouter from './routes/departments.js';
import teamsRouter from './routes/teams.js';

seedIfEmpty(db);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/daily-updates', dailyUpdatesRouter);
app.use('/api/activity', activityRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/users', usersRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/teams', teamsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`TaskFlow API listening on http://localhost:${PORT}`));
