import type { UserDocument } from '../models/User.js';

// Augments Express.Request globally so non-generic middleware can set req.user.
// Authenticated controllers should use AuthRequest (exported from middleware/auth.ts)
// which makes `user` non-optional and provides full type safety.
declare global {
  namespace Express {
    interface Request {
      user?: UserDocument;
    }
  }
}

export {};
