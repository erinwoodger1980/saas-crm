// api/src/types/express.d.ts
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      userId: string;
      tenantId: string;
      email?: string;
    };
  }
}