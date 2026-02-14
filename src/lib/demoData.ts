import type { Paste } from './api';
import { DEMO_PASTES as RAW_PASTES } from './demoPastes';

export const DEMO_PASTES: Paste[] = RAW_PASTES as unknown as Paste[];
