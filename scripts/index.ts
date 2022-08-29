import fs from 'fs'

import { config } from 'dotenv'

import { pkgPath, log } from './util.js'
import { fetchOldChangelog } from './changelog.js'
import { generate, upload } from './update.js'

config()

async function run () {
    const packages = fetchOldChangelog(process.env.MANIFEST_ID!, {
        extension: '.upk', 
        prefix: 'TAGame/CookedPCConsole/',
        requiredChar: '_'
    })

    for (const pkgToDelete of packages.delete) {
        const _path = pkgPath(pkgToDelete.path, true, true)
        if (!fs.existsSync(_path)) {
            log('Invalid path: ' + _path)
            continue
        }

        fs.unlinkSync(_path)
    }

    log(`Changelog includes ${packages.update.length} updates and ${packages.delete.length} deletions`)
    await generate(packages.update.map(i => i.path))
    await upload()
}

await run()