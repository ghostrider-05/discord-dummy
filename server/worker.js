addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request).catch(err => console.log(err)));
});

function returnInvalid (status) {
    return new Response(undefined, { status })
}

async function getMetadata () {
    const data = await DUMMY_META_STORAGE.get('metadata')

    return JSON.parse(data)
}
  
async function handleRequest(request) {
    const url = new URL(request.url);
    const key = request.headers.get('X-Dummy-Key'),
        auth = request.headers.get('X-Auth-Key');

    if (!url.pathname.startsWith('/api')) return returnInvalid(400)

    if (url.pathname.startsWith('/api/metadata')) {
        const data = await getMetadata()
        if (!data) return new Response(undefined, {
            status: 500
        })
        const key = url.searchParams.get('key')

        if (key && !Object.keys(data).includes(key)) return new Response(undefined, { 
            status: 400 
        })

        const keyData = key ? data[key] : data

        return new Response(JSON.stringify(keyData), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        })
    }

    if (request.method === 'PUT' && auth !== AUTH_KEY) return returnInvalid(403)
    else if (request.method === 'PUT' && !key) return returnInvalid(400)
  
    switch (request.method) {
        case "PUT": {
            await DUMMY_BUCKET.put(key, request.body);
            return new Response(`Put ${key} successfully!`, { status: 200 });
        }
        case 'GET': {
            const data = await getMetadata()
            const packages = data ? data.packages : undefined
            if (!packages) return returnInvalid(500)

            const queryKey = url.searchParams.get('name')
            const matchedKey = packages.find(([name, size]) => queryKey && name.toLowerCase() === queryKey.toLowerCase())
            
            if (!matchedKey) return returnInvalid(404)
            const value = await DUMMY_BUCKET.get(matchedKey[0])

            return new Response(value.body, {
                status: 200,
                headers: {
                    "Content-Disposition": "attachment; filename=" + `${matchedKey[0]}.${matchedKey[2] ? 'zip' : 'upk'}`,
                    'Content-Type': 'multipart/form-data'
                }
            })
        }
    }
}