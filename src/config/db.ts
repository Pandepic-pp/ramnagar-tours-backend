import mongoose from 'mongoose';
import env from './env.js';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.mongodbUri);
    console.log(`[mongodb] connected to ${conn.connection.host}`);
  } catch (err) {
    console.error('[mongodb] connection failed:', (err as Error).message);
    process.exit(1);
  }
};

export default connectDB;
