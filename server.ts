import env from './src/config/env.js';
import app from './src/app.js';
import connectDB from './src/config/db.js';

connectDB().then(() => {
  app.listen(env.port, () => {
    console.log(`[server] running on port ${env.port} in ${env.nodeEnv} mode`);
  });
});
