import { AsyncLocalStorage } from 'node:async_hooks';
import type { PersistentDatabaseState } from './dbEngine';
export interface RequestDatabaseContext {
 state: PersistentDatabaseState;
 revision: string;
 dirty: boolean;
 afterCommit: Array<() => void>;
}
export const requestDatabase = new AsyncLocalStorage<RequestDatabaseContext>();
