export const ADMIN_ID = "2c896992-6849-4ca6-9a66-5c2414bb9424";
export const ADMIN_EMAIL = "jv20101958@gmail.com";

export const isAdmin = (userId: string | undefined, email?: string | null): boolean =>
  userId === ADMIN_ID || email === ADMIN_EMAIL;
