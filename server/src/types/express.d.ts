// Augment Express Request with userId set by auth middleware
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};

