import 'dotenv/config';
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { checkConnection } from './database/db.js';
import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import dailyUpdatesRouter from './routes/dailyUpdates.js';
import activityRouter from './routes/activity.js';
import notificationsRouter from './routes/notifications.js';
import usersRouter from './routes/users.js';
import departmentsRouter from './routes/departments.js';
import teamsRouter from './routes/teams.js';
import chatRouter from './routes/chat.js';
import { attachSocket } from './socket/index.js';

const app = express();
app.use(cors());
// Raised from Express's 100kb default so a chat image (sent as a base64
// data URI in the JSON body) fits — uploadChatImage itself caps the actual
// decoded file at 8MB, this just needs to be comfortably above the ~33%
// base64 inflation of that.
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await checkConnection();
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});
app.use('/api/auth', authRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/daily-updates', dailyUpdatesRouter);
app.use('/api/activity', activityRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/users', usersRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/chat', chatRouter);

// Catches anything forwarded via next(err) — every async route/middleware is
// wrapped in asyncRoute specifically so a rejected promise ends up here
// instead of just hanging the request. Express 4 doesn't do this
// automatically the way Express 5 does.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// A plain http.Server wrapping the Express app, rather than the implicit
// one app.listen() creates on its own — Socket.io needs the actual
// http.Server instance to attach to, and app.listen() doesn't hand one back.
const httpServer = createServer(app);
attachSocket(httpServer);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`TaskFlow API (+ chat websocket) listening on http://localhost:${PORT}`));
