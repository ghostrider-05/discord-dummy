// Template from https://gist.github.com/devsnek/77275f6e3f810a9545440931ed314dc1

function hex2bin(hex) {
    const buf = new Uint8Array(Math.ceil(hex.length / 2));
    for (var i = 0; i < buf.length; i++) {
        buf[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return buf;
}

const PUBLIC_KEY = crypto.subtle.importKey(
    'raw',
    hex2bin(DISCORD_PUBLIC_KEY),
    {
        name: 'NODE-ED25519',
        namedCurve: 'NODE-ED25519',
        public: true,
    },
    true,
    ['verify'],
);

const encoder = new TextEncoder();

const filterNames = (initial) => (compare) => {
    const value = typeof compare === 'string' ? compare : compare[0]

    return initial === value
        || initial === value.toLowerCase()
        || initial.toLowerCase() === value.toLowerCase()
        || value.toLowerCase().includes(initial)
}

class Interaction {
    static async callback (data, version, body) {
        const url = `https://discord.com/api/v${version}/interactions/${data.id}/${data.token}/callback`

        return await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body)
        })
    }

    static formatComponents (rows) {
        return rows.map(row => {
            return {
                type: 1,
                components: row
            }
        })
    }
}

async function handleInteraction (data) {
    const subCommandOption = (data, name) => data.data.options[0].options[0].options.find(x => x.name === name).value

    switch (data.type) {
        case 2: {
            const value = subCommandOption(data, 'name')

            const metadata = await DUMMY_META_STORAGE.get('metadata', { type: 'json' })
            if (!metadata) return new Response('internal error', { status: 500 })

            const isValid = !metadata.unsupported.some(filterNames(value))
            const name = isValid ? metadata.packages.find(filterNames(value)) : undefined

            const message = !name && isValid ? {
                content: 'Unable to find package: ' + value, 
                flags: 64
            } : (!isValid ? {
                content: 'Unable to decrypt package: ' + value,
                flags: 64
            } : {
                flags: 64,
                embeds: [
                    {
                        title: name[0],
                        description: `File size: ${name[1]}kB ${name[2] ? ' (zip)' : ''}\nVersion: ${metadata.version}`
                    }
                ],
                components: Interaction.formatComponents([
                    {
                        type: 2,
                        label: 'Download package',
                        style: 5,
                        url: `https://dummy.ghostrider.workers.dev/api?name=${name[0]}`
                    }
                ])
            })
            
            return Interaction.callback(data, 10, {
                type: 4,
                data: message
            })
        }
        case 4: {
            const value = subCommandOption(data, 'name').toLowerCase()

            const metadata = await DUMMY_META_STORAGE.get('metadata', { type: 'json' })
            if (!metadata) return new Response('internal error', { status: 500 })

            const choices = metadata.packages.filter(filterNames(value)).filter((_, i) => i < 25).map(([n]) => ({ name: n, value: n }))

            return Interaction.callback(data, 10, {
                type: 8,
                data: {
                    choices
                }
            })    
        }
    }
}

async function handleRequest(request) {
    if (request.method !== 'POST') {
        return new Response('invalid method', { status: 405 });
    }
    const signature = hex2bin(request.headers.get('X-Signature-Ed25519'));
    const timestamp = request.headers.get('X-Signature-Timestamp');
    const unknown = await request.text();

    const verified = await crypto.subtle.verify(
        'NODE-ED25519',
        await PUBLIC_KEY,
        signature,
        encoder.encode(timestamp + unknown),
    );
    if (!verified) {
        return new Response('invalid request', { status: 401 });
    }

    const data = JSON.parse(unknown);

    switch (data.type) {
        case 1:
            return new Response(JSON.stringify({ type: 1 }), {
                headers: { 'Content-Type': 'application/json' },
            });
        case 2: 
        case 4:
            return await handleInteraction(data)
        default:
            return new Response('invalid request', { status: 400 });
    }
}

addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event.request)
        .catch(() => new Response('internal error', { status: 500 })));
});
