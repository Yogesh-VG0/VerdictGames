import type { RawgListItem } from './rawg';
export function compactRawgGame(row: RawgListItem): RawgListItem;
export function collectRawgPages(readPage: (page:number)=>Promise<{count:number;results:unknown[]}>, limit?: number): Promise<{results:RawgListItem[];count:number;complete:boolean}>;
