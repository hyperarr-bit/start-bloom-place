/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
/** 10/10: true só no build de TESTE da loja (RC_MOCK=1) — ver src/lib/rc-mock.ts. */
declare const __RC_MOCK__: boolean | undefined;
