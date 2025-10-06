// Tell TypeScript that Express.Request has an `auth` property we attach in middleware.
import "express";

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      userId: string;
      tenantId: string;
      email: string;
    };
  }
}