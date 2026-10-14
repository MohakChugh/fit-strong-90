/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Board D121: '1' only in the acceptance suite's successor build. */
  readonly VITE_ACCEPTANCE_SUCCESSOR?: string;
}
