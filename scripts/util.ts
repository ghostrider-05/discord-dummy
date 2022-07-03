import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { spawn } from 'child_process'

import chalk from 'chalk'

export class ItemSizeMap extends Map {
    public maxSize: number;

    constructor(maxSize: number) {
        super()

        this.maxSize = maxSize
    }

    public isZipFile(name: string): boolean {
        return this.get(name) > this.maxSize
    }

    public isZipped(size: number): boolean {
        return size > this.maxSize
    }

    public isZipExtension(extension: string): boolean {
        return extension === 'zip'
    }

    public add(name: string, size?: string): string {
        const hasItem = this.has(name)

        if (!hasItem && size != undefined) this.set(name, size)

        return !hasItem ? size : this.get(name)
    }

    public update(name: string, newValue?: string) {
        if (this.has(name) && newValue != undefined) this.set(name, newValue)
    }
}

export class PromiseUtil {
    public static async chain<R, T extends (() => Promise<R>)>(values: T[], concurrent?: number) {
        const concurrentProcesses = concurrent ?? 1
        if (concurrentProcesses < 1) throw new Error('Cannot chain less than 0 processes')

        let currentIndex = 0

        const findNewProcess = async (): Promise<void> => {
            if (currentIndex === (1 + values.length)) return

            const process = values[currentIndex]
            if (process == undefined) return
            currentIndex += 1

            return await process().then(async () => {
                return await findNewProcess()
            })
        }

        const chains = Array.from(Array(concurrentProcesses).keys()).map(async () => {
            return await findNewProcess()
        })

        return Promise.all(chains)
    }

    public static toFunction<R, T extends Promise<R>>(promise: T): () => Promise<R> {
        return async () => {
            return await promise
        }
    }
}

interface ProcessSpawnOptions {
    args: string[]
    msgHandler?: (msg: unknown) => void
    cwd?: string
}

export class ProcessUtil {
    public static async spawnProcess(name: string, options: ProcessSpawnOptions): Promise<void> {
        const child = spawn(name, options.args, {
            cwd: options.cwd,
        })

        const handler = options.msgHandler ?? (() => { })

        child.stdout.on('data', handler)
        child.stderr.on('data', handler)
        child.on('message', handler)

        return await new Promise<void>((resolve) => {
            child.on('close', resolve)
            child.on('exit', resolve)
        })
    }
}

const pkgPath = (name: string, addName?: boolean, solveExtension?: boolean) => {
    const itemPath = path.resolve('.', `./packages/${name.toLowerCase().split('_')[0]}/${addName ? name : ''}`)

    if (!solveExtension) return itemPath
    else return (itemPath + (fsSync.existsSync(itemPath + '.upk') ? '.upk' : '.zip'))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const chunk = <T>(arr: T[], len: number): T[][] => {
    const chunks = []
    const n = arr.length

    let i = 0

    while (i < n) {
        chunks.push(arr.slice(i, i += len));
    }

    return chunks;
}

function updateLog(newLine: string) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(newLine);
}

const log = (msg: string, { update }: { update?: boolean } = {}) => {
    const fn = update ? updateLog : console.log

    fn(chalk.yellow(msg))
}

async function move(oldPath: string, newPath: string) {
    try {
        await fs.rename(oldPath, newPath).catch(async () => {
            await copy()
        });
    } catch (err) {
        await copy()
    }

    async function copy() {
        if ([oldPath, newPath].some(p => !fsSync.existsSync(p))) return

        let readStream = fsSync.createReadStream(oldPath);
        let writeStream = fsSync.createWriteStream(newPath);

        return await new Promise((resolve, reject) => {
            readStream.on('error', reject);
            writeStream.on('error', reject);

            readStream.on('close', () => {
                fs.unlink(oldPath).then(() => resolve)
            });

            readStream.pipe(writeStream);
        })
    }
}

export {
    pkgPath,
    sleep,
    chunk,
    log,
    move
}