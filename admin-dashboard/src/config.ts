export const RESTAURANT_NAME = "The Chinu Family Restaurant & Dhaba";
export const RESTAURANT_TAGLINE = "Non-Veg Family Restaurant & Dhaba";

/**
 * Prototype mode: the dashboard opens without a login (the backend must run with PROTOTYPE_OPEN_ADMIN=true).
 * Anyone with the link has full admin access, so switch both off before the restaurant uses it for real.
 */
export const PROTOTYPE_NO_LOGIN = import.meta.env.VITE_PROTOTYPE_NO_LOGIN === "true";

export const USER_STORAGE_KEY = "chinu_admin_user";
export const TOKEN_STORAGE_KEY = "chinu_admin_token";
/** Fired by the API client when the backend rejects the session (expired or deactivated login). */
export const UNAUTHORIZED_EVENT = "chinu:unauthorized";
