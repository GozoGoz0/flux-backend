import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import teamRoutes from './routes/team.routes';
import initiativeRoutes from './routes/initiative.routes';
import taskRoutes from './routes/task.routes';
import ideaRoutes from './routes/idea.routes';
import noteRoutes from './routes/note.routes';
import approvalRoutes from './routes/approval.routes';
import notificationRoutes from './routes/notification.routes';
import activityRoutes from './routes/activity.routes';

import { errorHandler } from './middleware/error.middleware';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
  abortOnLimit: true,
  createParentPath: true
}));

app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/initiatives', initiativeRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ideas', ideaRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity', activityRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});
