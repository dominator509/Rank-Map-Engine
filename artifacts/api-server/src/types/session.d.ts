import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: number;
      tenantId: number;
      email: string;
      fullName: string;
      role: string;
    };
  }
}
