import fs from 'fs'
import path from 'path'

import { config } from 'dotenv'
import fetch from 'node-fetch'
import FormData from 'form-data'

import { ProcessUtil, PromiseUtil, sleep, chunk, move, pkgPath, log } from './util.js'
import { ZipManager } from './zip.js'

config()

// Regenerate packages

const zip = new ZipManager({
    maxSize: Number(process.env.MAX_PACKAGE_SIZE),
    levels: {
        compression: <0>Number(process.env.PACKAGE_COMPRESSION_LEVEL)
    }
})

const packages = fs.readdirSync(process.env.PACKAGE_DIR!, { encoding: 'utf8' })
    .filter(n => n.endsWith('.upk') && n.includes('_'))

let totalItems = packages.length, completedItems = 0;

async function generatePackage (name: string[]) {
    const folder = path.resolve('.', `./packages/`)

    const args = [
        `-f "${process.env.PACKAGE_DIR}"`,
        `-u "${folder}"`,
        `-p ${name.join(':')}`,
        '--dummy',
    ]

    return await ProcessUtil.spawnProcess('AssetExtraction', {
        args,
        cwd: process.env.EXPLORER_DIR
    }).then(async () => {
        return await Promise.all(name.map(async pkg => {
            const pkgFolder = pkgPath(pkg)
            if (!fs.existsSync(pkgFolder)) fs.mkdirSync(pkgFolder)

            const pkdDest = pkgPath(pkg, true)
            await move(
                path.resolve('.', `./packages/${pkg}`), 
                pkdDest
            )

            completedItems += 1
            log(`Completed ${completedItems} out of ${totalItems}`, { update: true })
        }))
    })
}

function readGeneratedPackages () {
    return fs.readdirSync(path.resolve('.', './packages/'), { encoding: 'utf8' })
        .flatMap(dir => {
            return !dir.endsWith('.json') 
                ? fs.readdirSync(path.resolve('.', './packages/' + dir)).map(n => n.split('.')) 
                : []
        })
}

async function generate (packages: string[]) {
    log(`Generating ${totalItems} packages...`)
    if (!fs.existsSync(path.resolve('.', './packages/'))) fs.mkdirSync(path.resolve('.', './packages/'))

    const pkgChains = chunk(packages, Number(process.env.PACKAGES_PER_EXE)).map(group => {
        return async () => await generatePackage(group)
    })

    await PromiseUtil.chain(pkgChains, Number(process.env.CONCURRENT_EXES))
    await zip.compress(packages, {
        concurrentGroupSize: 5
    })

    await sleep(5000)

    const generatedPackages = readGeneratedPackages()
        .map(([name, extension]) => [
            name, 
            zip.fileSize([name, extension].join('.')),
            zip.itemSizes.isZipExtension(extension)
        ])

    log(`\nCompleted generation of ${completedItems}/${totalItems} items`)

    return new Promise<void>((resolve) => {
        fs.writeFile(path.resolve('.', './packages/metadata.json'), JSON.stringify({
            version: process.env.RL_VERSION,
            unsupported: packages.filter(n => !generatedPackages.some(k => k[0] === n.split('.')[0])),
            packages: generatedPackages,
        }, null, 4), () => resolve())
    })
}

async function upload () {
    //@ts-ignore
    const { default: data } = await import('../packages/metadata.json')
    const packages = (data as unknown as { packages: [string, string, boolean][] }).packages
    const failed: string[] = []

    async function uploadFile (name: string, index: number, total: number) {
        await sleep(250)
        log(`[${index}/${total}] Uploading ${name}...`, { update: true })

        const form = new FormData()
        const itemPath = pkgPath(name, true, true)

        form.append(name, fs.readFileSync(itemPath), {
            filename: path.basename(itemPath)
        })

        const failedName = await fetch(process.env.DUMMY_UPLOAD_ROUTE!, {
            method: 'PUT',
            body: form,
            headers: {
                'X-Auth-Key': process.env.AUTH_KEY!,
                'Content-Type': 'multipart/form-data',
                'X-Auth-Email': process.env.AUTH_EMAIL!,
                'X-Dummy-Key': name,
            }
        }).then(res => !res.ok ? name : undefined)

        if (failedName) failed.push(failedName)
    }

    await PromiseUtil.chain(packages.map((name, i) => async () => await uploadFile(name[0], i, packages.length)), 20)

    if (failed.length > 0) log('Failed: ' + failed.join(','))

    await fetch(process.env.METADATA_UPLOAD_ROUTE!, {
        method: 'PUT',
        headers: {
            'X-Auth-Key': process.env.AUTH_KEY!,
            'X-Auth-Email': process.env.AUTH_EMAIL!,
            'Content-Type': 'text/plain'
        },
        body: JSON.stringify(data)
    })

    const description = [
        `New version: **${process.env.RL_VERSION}**\n`,
        'Access:',
        `**API**: https://dummy.ghostrider.workers.dev/api?name=<upk_name>`,
        `**Discord**: \`/mapmaking resources package name:<upk_name>\``
    ].join('\n')

    if (process.env.COMPLETED_ACTION === 'upload') await fetch(process.env.COMPLETED_WEBHOOK_URL!, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ embeds: [
            {
                title: `Updated remote dummy assets`,
                color: 0x00FF00,
                description
            }
        ]})
    })
}

generate(packages).then(async () => await upload())
