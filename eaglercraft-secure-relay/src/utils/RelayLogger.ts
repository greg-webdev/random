import chalk from 'chalk';
import { RelayConfig } from './RelayConfig';

export class RelayLogger {
  private static format (msg: any, ...args: any[]): string {
    let ret = msg;
    for (const arg of args) ret = ret.replace('{}', typeof arg === 'object' ? JSON.stringify(arg) : String(arg));
    return ret;
  }

  private static print (color: (txt: string) => string, level: string, msg: string, ...args: any[]): void {
    console.log(`${String(chalk.gray(new Date().toLocaleTimeString()))} ${color(level.padEnd(6))} ${this.format(msg, ...args)}`);
  }

  public static info (msg: any, ...args: any[]): void {
    this.print(chalk.blue, 'INFO', msg, ...args);
  }

  public static warn (msg: any, ...args: any[]): void {
    this.print(chalk.yellow, 'WARN', msg, ...args);
  }

  public static error (msg: any, ...args: any[]): void {
    this.print(chalk.red, 'ERROR', msg, ...args);
  }

  public static success (msg: any, ...args: any[]): void {
    this.print(chalk.green, 'OK', msg, ...args);
  }

  public static debug (msg: any, ...args: any[]): void {
    if (RelayConfig.isDebug()) this.print(chalk.magenta, 'DEBUG', msg, ...args);
  }
}
