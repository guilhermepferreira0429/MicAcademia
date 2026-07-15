import { env } from '$env/dynamic/public';

/**
 * URL of the running platform's source code, exposed for AGPL-3.0 §13
 * compliance (network users must be able to reach the corresponding source of
 * the modified version). Configurable via PUBLIC_SOURCE_CODE_URL — point it at
 * the exact release tag when cutting a release. Defaults to the MicAcademia fork.
 */
export const SOURCE_CODE_URL =
  env.PUBLIC_SOURCE_CODE_URL?.trim() || 'https://github.com/guilhermepferreira0429/MicAcademia';
