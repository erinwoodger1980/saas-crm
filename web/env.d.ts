/* eslint-disable no-unused-vars */
/// <reference types="next" />
/// <reference types="next/types/global" />

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_BASE_URL?: string;
    NEXT_PUBLIC_API_BASE?: string; // legacy
  }
}

export {};
