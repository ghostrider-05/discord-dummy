const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const { config } = require('dotenv')
const JSZip = require('jszip')

config()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const chunk = (arr, len) => {
    const chunks = []
    const n = arr.length
    
    let i = 0
  
    while (i < n) {
        chunks.push(arr.slice(i, i += len));
    }
  
    return chunks;
}

function move(oldPath, newPath, callback) {
    fs.rename(oldPath, newPath, function (err) {
        if (err) {
            if (err.code === 'EXDEV') {
                copy();
            } else {
                callback(err);
            }
            return;
        }
        callback();
    });

    function copy() {
        let readStream = fs.createReadStream(oldPath);
        let writeStream = fs.createWriteStream(newPath);

        readStream.on('error', callback);
        writeStream.on('error', callback);

        readStream.on('close', function () {
            fs.unlink(oldPath, callback);
        });

        readStream.pipe(writeStream);
    }
}

const logHandler = (msg) => {
    // const log = msg.toString().split('\n')
}

/**
 * @param {string[]} args 
 */
const spawnChild = async (args) => {
    const child = spawn('AssetExtraction', args, { 
        cwd: process.env.EXPLORER_DIR,
    })

    child.stdout.on('data', logHandler)
    child.stderr.on('data', logHandler)
    child.on('message', logHandler)

    return await new Promise((resolve, reject) => {
        child.on('close', resolve)
    })
}


// Regenerate packages

const maxSize = Number(process.env.MAX_PACKAGE_SIZE)
const packages = fs.readdirSync(process.env.PACKAGE_DIR, { encoding: 'utf8' })
    .filter(n => n.endsWith('.upk') && n.includes('_'))

async function generatePackage (name) {
    const folder = path.resolve('.', `./packages/`)

    const Arguments = [
        `-f "${process.env.PACKAGE_DIR}"`,
        `-u "${folder}"`,
        `-p ${name.join(':')}`,
        '--dummy',
    ]
    
    return await spawnChild(Arguments).then(() => {
        console.log('Completed: ' + name.join(':'))

        for (const pkg of name) {
            const pkgFolder = path.resolve('.', `./packages//${pkg.toLowerCase().split('_')[0]}/`)
            if (!fs.existsSync(pkgFolder)) fs.mkdirSync(pkgFolder)

            const pkdDest = path.resolve('.', `./packages//${pkg.toLowerCase().split('_')[0]}/${pkg}`)
            move(
                path.resolve('.', `./packages/${pkg}`), 
                pkdDest, 
                () => {}
            )

            const size = Math.round(fs.statSync(pkdDest).size / 1000)

            // if (size > maxSize) {
            //     const zip = new JSZip()
            //     zip.file(pkdDest, fs.readFileSync(pkdDest, { encoding: 'utf8' }))
            // }
        }
    })
}

function readGeneratedPackages () {
    return fs.readdirSync(path.resolve('.', './packages/'), { encoding: 'utf8' })
        .flatMap(dir => !dir.endsWith('.json') ? fs.readdirSync(path.resolve('.', './packages/' + dir)) : [])
}

async function generate (packages) {
    for (const names of chunk(packages, 500)) {
        await Promise.all(chunk(names, 50).map(async group => {
            return await generatePackage(group)
        }))
    }

    await sleep(5000)

    const generatedPackages = readGeneratedPackages()

    fs.writeFileSync(path.resolve('.', './packages/metadata.json'), JSON.stringify({
        version: process.env.RL_VERSION,
        unsupported: packages.filter(n => !generatedPackages.includes(n)),
        packages: generatedPackages.map(name => [name, Math.round(0).toString()]),
    }, null, 4))
}

async function upload () {
    const packages = readGeneratedPackages()
    const data = require('../packages/metadata.json')

    for (const name of packages) {
        await fetch(process.env.DUMMY_UPLOAD_ROUTE, {
            method: 'PUT',
            body: fs.readFileSync(),
            headers: {
                'Authorization': process.env.AUTH_KEY,
                'X-Dummy-Key': name,
            }
        })
    }

    await fetch(process.env.METADATA_UPLOAD_ROUTE, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

generate(packages).then(async () => await upload())
