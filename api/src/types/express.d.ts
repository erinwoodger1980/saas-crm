// api/src/types/express.d.ts
import "express";

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      userId: string;
      tenantId: string;
      email: string;
      iat?: number;
      exp?: number;
    };
  }
}