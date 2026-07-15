import { env } from '$env/dynamic/public';

/**
 * Central user-facing platform/brand name for this self-hosted fork.
 *
 * Prefers the operator-configured `PUBLIC_APP_TITLE` (SvelteKit public env)
 * and falls back to the MicAcademia brand when unset.
 */
export const PLATFORM_NAME = env.PUBLIC_APP_TITLE?.trim() || 'MicAcademia';
