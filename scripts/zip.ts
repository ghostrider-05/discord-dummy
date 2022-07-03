import fs from 'fs'
import path from 'path'

import * as fflate from 'fflate'

import { ItemSizeMap, log, pkgPath, PromiseUtil, chunk } from './util.js'

interface ZipFileOptions {
    maxSize: number
    levels: {
        compression: DeflateLevel
        memory?: MemoryLevel
    }
}

interface FilesCompressOptions {
    concurrentGroupSize: number
}

// Types are not exported for some reason
type DeflateLevel = NonNullable<NonNullable<Parameters<typeof fflate.deflateSync>[1]>['level']>
type MemoryLevel = 
    | DeflateLevel 
    | 10 
    | 11 
    | 12

const compress = (
    name: string, 
    data: Uint8Array, 
    levels: ZipFileOptions['levels'],
    directory: string,
) => new Promise<[number, number] | undefined>((resolve, reject) => {
    fflate.zip({
        [`${name}.upk`]: data
    }, { level: levels.compression, mem: levels.memory }, (err, data) => {
        if (err) resolve(undefined) // Resolve for now, maybe reject later?
        else {
            fs.writeFileSync(path.resolve('.', `./${directory}/${name.split('_')[0]}/${name}.zip`), data)

            const pkdDest = pkgPath(name, true) + '.upk'
            const readSize = (name: string) => Math.round(fs.statSync(name).size / 1000)

            const size = readSize(pkdDest)
            const zipSize = readSize(pkdDest.replace('.upk', '.zip'))

            fs.unlinkSync(pkdDest)

            resolve([zipSize, (size - zipSize)])
        }
    })
})

export class ZipManager {
    public savedSize = 0
    public zippedItems = 0

    public itemSizes: ItemSizeMap
    public options: ZipFileOptions

    constructor(options: ZipFileOptions) {
        this.options = options

        this.itemSizes = new ItemSizeMap(options.maxSize)
    }

    public addCompletedItem (name: string, size: number, savedSize: number) {
        this.zippedItems += 1

        log(`Zipped items: ${this.zippedItems}`, { update: true })

        this.savedSize += savedSize
        this.itemSizes.update(name, size?.toString())
    }

    public async compressFile (name: string) {
        const data = fs.readFileSync(pkgPath(name, true))

        return await compress(
            name.split('.')[0], 
            data, 
            this.options.levels, 
            'packages'
        )
    }

    public async compress (names: string[], options: FilesCompressOptions) {
        const { maxSize } = this.options

        const packageNames = names.filter(name => {
            return fs.existsSync(pkgPath(name, true)) && this.fileSize(name) > maxSize
        })

        log(`Zipping ${packageNames.length} files...`)

        const chains = packageNames.map(name => {
            return async () => {
                this.itemSizes.add(name, this.fileSize(name)?.toString())

                const [savedSize, zippedSize] = (await this.compressFile(name)) ?? []

                this.addCompletedItem(name, zippedSize!, savedSize!)
            }
        })

        await PromiseUtil.chain(chains, options.concurrentGroupSize)

        log(`Zipped ${this.zippedItems} items and saved ${this.savedSize} kB`)
    }

    public fileSize (name: string) {
        return Math.round(fs.statSync(pkgPath(name, true)).size / 1000)
    }
}