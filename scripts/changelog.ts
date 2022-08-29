import fs from 'fs'
import path from 'path'

import { config } from 'dotenv'
import fetch from 'node-fetch'

import { ProcessUtil, PromiseUtil, sleep, chunk, move, pkgPath, log } from './util.js'
import { ZipManager } from './zip.js'

config()

export const depotId = '252951'

const zip = new ZipManager({
    maxSize: 10000,
    levels: {
        compression: 1
    }
})

export function createChangelog (key: string): Record<'packages', Readonly<[string, string]>[]> {
    const files = fs.readdirSync(process.env.PACKAGE_DIR!, { encoding: 'utf8' })
        .map(name => [name, zip.fileSizeRaw(name)] as const)

    return {
        packages: files
    }
}

interface ChangelogFetchOptions {
    extension: string
    prefix: string
    requiredChar: string
}

interface ChangelogItem { 
    action: string 
    path: string 
}

const baseFormatted: Record<'delete' | 'update', ChangelogItem[]> = {
    update: [],
    delete: []
}

/**
 * 
 * @param manifestId The id of the current manifest. Find the latest at: https://steamdb.info/depot/252951/manifests/
 */
export function fetchOldChangelog (manifestId: string | undefined, options: ChangelogFetchOptions) {
    const { prefix } = options
    if (manifestId == undefined) return baseFormatted;
    let additionalItems = []

    if (manifestId.includes(',')) {
        const [baseId, ...ids] = manifestId.split(',')
        manifestId = baseId
        ids.forEach(id => baseFormatted.update.push(...fetchOldChangelog(id, options).update))
    }

    const html = fs.readFileSync(path.resolve('.', `./manifests/${manifestId}.txt`), { encoding: 'utf8' })

    const changelog = html
        .slice(html.indexOf('<ul'), html.lastIndexOf('</ul>'))
        .split('</li>')
        .map(item => {
            return {
                action: item.match(/<li class="diff-(?:.+)">/gm)?.[0].slice(16, -2),
                path: (item.match(/<ins>(?:.+)<\/ins>/gm)?.[0].slice(5, -6) 
                    ?? item.match(/<i>(?:.+)<\/i>/)?.[0].slice(3, -4))
            } as ChangelogItem
        })
        .filter(item => item.action != undefined && item.path != undefined)
        .map(i => {
            const _path = i.path.split('</i>')[0]
            return _path.startsWith(prefix) 
                ? { action: i.action, path: _path.slice(prefix.length) } 
                : i
        })

    const output = formatChangelog(changelog, options);
    if (baseFormatted.update.length > 0) output.update.push(...baseFormatted.update.filter(n => !output.update.some(u => u.path === n.path)));
    return output;
}

function formatChangelog (items: ChangelogItem[], { extension, requiredChar }: ChangelogFetchOptions) {
    const removedAction = 'removed'
    const formatted: Record<'delete' | 'update', ChangelogItem[]> = {
        update: [],
        delete: []
    }

    items.forEach(item => {
            if (item.path.endsWith(extension) && item.path.includes(requiredChar)) {
                if (item.action === removedAction) {
                    formatted.delete.push(item)
                } else {
                    formatted.update.push(item)
                }
            }
        })

    return formatted
}