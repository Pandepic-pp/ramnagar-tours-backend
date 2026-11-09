import { Request, Response, NextFunction, RequestHandler } from 'express';

// Generic allows controllers to specify a narrower request type (e.g. AuthRequest)
// while still returning a RequestHandler compatible with Express's router.
const asyncHandler = <TReq extends Request = Request>(
  fn: (req: TReq, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler =>
  (req, res, next): void => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };

export default asyncHandler;
