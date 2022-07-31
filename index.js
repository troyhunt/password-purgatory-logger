addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const pathname = new URL(request.url).pathname

  if (pathname === '/log-hell') {
    return logHell(request)
  } else if (pathname === '/get-hell') {
    return getHell(request)
  }
}

async function logHell(request) {
  // Logging requires an API key to ensure the endpoint isn't abused and used to write garbage to KV
  const key = request.headers.get('hell-api-key')
  if (key !== HELL_API_KEY) {
    return new Response('Incorrect API key', { status: 401 })
  }

  const json = await request.json()
  const id = json.id

  const attempt = {
    timestamp: new Date().getTime(),
    criteria: json.criteria,
    password: json.password,
  }

  let history = await PASSWORD_PURGATORY.get(id, { type: 'json' })

  if (history === null) {
    history = [attempt]

    // Send an email on the first logged password so we know a new spammer is on the hook
    send_request = new Request('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: TO_EMAIL, name: TO_EMAIL_NAME }],
          },
        ],
        from: {
          email: FROM_EMAIL,
          name: FROM_EMAIL_NAME,
        },
        subject: 'New spammer hooked!',
        content: [
          {
            type: 'text/plain',
            value: 'View the log of their painful password attempts here: todo',
          },
        ],
      }),
    })
  } else {
    history.push(attempt)
  }

  const jsonHistory = JSON.stringify(history)
  await PASSWORD_PURGATORY.put(id, jsonHistory)

  return new Response(jsonHistory, {
    headers: { 'Content-type': 'application/json;charset=UTF-8' },
  })
}

async function getHell(request) {
  const { searchParams } = new URL(request.url)
  let id = searchParams.get('id')
  let history = await PASSWORD_PURGATORY.get(id, { type: 'json' })
  let pageTitle = ''
  let pageDescription = ''
  let pageContents = ''
  let status = 200

  if (history === null) {
    pageTitle = 'Hell Not Found'
    pageDescription = 'No hell with that ID exists'
    pageContents = '<h1>' + pageDescription + '</h1>'
    status = 404
  } else {
    // This is mostly to make nice Twitter cards for social sharing. Show the last attempt in the meta description as it'll probably be the funniest 🤣
    pageTitle = 'Password Purgatory - Making Life Hell for Spammers'
    pageDescription =
      history[history.length - 1].criteria +
      ': ' +
      history[history.length - 1].password

    history.forEach(
      (attempt, i) =>
        (pageContents +=
          `<h1>Attempt ` +
          (i + 1) +
          (i == 0
            ? ``
            : ` (` +
              Math.round(
                (attempt.timestamp - history[i - 1].timestamp) / 1000,
              ) +
              ` seconds later)`) +
          `</h1>
      <h2>Criteria: ` +
          attempt.criteria +
          `</h2>
      <h2>Password: ` +
          attempt.password +
          `</h2>
      `),
    )

    pageContents +=
      `<p>Spammer burned a total of ` +
      Math.round(
        (history[history.length - 1].timestamp - history[0].timestamp) / 1000,
      ) +
      ` seconds in Password Purgatory 😈</p>`
  }

  const html =
    `<!DOCTYPE html>
    <head>
      <title>` +
    pageTitle +
    `</title>
      <meta name=description content="` +
    pageDescription +
    `">
      <meta name=twitter:title content="` +
    pageTitle +
    `">
      <meta name=twitter:image content="https://passwordpurgatory.com/logo-social.jpg">
      <meta name=twitter:description content="` +
    pageDescription +
    `">
      <meta name=twitter:creator content="@troyhunt">
      <meta name=twitter:card content="summary_large_image">
      <link href="https://passwordpurgatory.com/make-hell-pretty.css" rel="stylesheet" />
    </head>
    <html>
      <body>` +
    pageContents +
    `</body>
    </html>`

  return new Response(html, {
    headers: { 'Content-type': 'text/html;charset=UTF-8' },
    status: status
  })
}
