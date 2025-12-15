declare module 'sql.js' {
  interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  interface Statement {
    bind(params: any[]): boolean;
    step(): boolean;
    getAsObject(): any;
    free(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer) => Database;
  }

  export interface InitSqlJsOptions {
    locateFile?: (file: string, prefix: string) => string;
  }

  export default function initSqlJs(config?: InitSqlJsOptions): Promise<SqlJsStatic>;
  export { Database };
}
