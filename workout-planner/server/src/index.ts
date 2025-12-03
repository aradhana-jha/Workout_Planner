import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

import authRouter, { authMiddleware } from './auth';
import profileRouter from './profile';
import workoutRouter from './workout';

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/workout', workoutRouter);

app.get('/', (req, res) => {
    res.send('Hello from Server!');
});

app.get('/api/protected', authMiddleware, (req, res) => {
    res.json({ message: 'You are authenticated', user: (req as any).user });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
