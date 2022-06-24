addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
});
  
async function handleRequest(request) {
    const url = new URL(request.url);
    const key = request.headers.get('X-Dummy-Key'),
        size = request.headers.get('X-Dummy-Size'),
        auth = request.headers.get('Authorization');

    if (!url.pathname.startsWith('/api')) return new Response(undefined, { status: 400 })

    if (request.method === 'PUT' && auth !== AUTH_KEY) return new Response(undefined, { status: 403 })
    else if (!size || !key) return new Response(undefined, { status: 400 })
  
    switch (request.method) {
      case "PUT":
        await DUMMY_BUCKET.put(key, request.body);
        return new Response(`Put ${key} successfully!`, { status: 200 });
    }
}