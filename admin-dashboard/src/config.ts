export const RESTAURANT_NAME = "The Chinu Family Restaurant & Dhaba";
export const RESTAURANT_TAGLINE = "Non-Veg Family Restaurant & Dhaba";

/**
 * Prototype mode: the dashboard opens without a login (the backend must run with PROTOTYPE_OPEN_ADMIN=true).
 * Anyone with the link has full admin access, so switch both off before the restaurant uses it for real.
 */
export const PROTOTYPE_NO_LOGIN = import.meta.env.VITE_PROTOTYPE_NO_LOGIN === "true";

/** Customer website, e.g. https://chinu-dhaba.netlify.app. Dish photos live there. */
export const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL || "").replace(/\/+$/, "");

/**
 * Dish photos are stored as website paths (assets/menu/veg-thali.jpg), which only resolve on the website.
 * Full URLs are used as they are; website paths need VITE_WEBSITE_URL, otherwise no photo is shown.
 */
export function dishImageSrc(url?: string | null): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return WEBSITE_URL ? `${WEBSITE_URL}/${url.replace(/^\/+/, "")}` : null;
}

export const USER_STORAGE_KEY = "chinu_admin_user";
export const TOKEN_STORAGE_KEY = "chinu_admin_token";
/** Fired by the API client when the backend rejects the session (expired or deactivated login). */
export const UNAUTHORIZED_EVENT = "chinu:unauthorized";
