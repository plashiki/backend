---
sidebarDepth: 2
---
# Starting point

Welcome to PlaShiki documentation!

We at PlaShiki :heart: FOSS, so our entire stack is available under GPLv3/AGPLv3.
[Check it out!](https://github.com/plashiki).

We are also proud to provide simple yet reliable REST-like API. Let's jump into it!

## General
Our API server is available at `https://plashiki.su/api`. There's no
global rate limit, but please don't flood our server to death :)

## Envelope
All API methods (except ones with _Raw (HTML) response_ which are marked explicitly)
are consistent with their response envelope, which encloses the response. Here it is:

<<< @/docs/envelope.ts

For example:

<<< @/docs/envelope-example-1.json

And another example with error:

<<< @/docs/envelope-example-2.json

All API methods return `200 OK` even if an error has occurred.

## Errors
Most errors follow the **CAPS_SNAKE** naming convention, the ones that do not 
are from older 1.x/2.x times.

Generally, each endpoint has its own set of errors that may happen during execution.
However, there's a bunch of errors that happen to be common for all the endpoints.


<div style="min-width:160px">Error</div> | Description
---|---
`Internal Error` | Unknown internal server error happened.
`Invalid syntax` | Your client issued an invalid request (probably malformed JSON body)
`Malformed request` | Request contained an unprocessable entity.
`Unknown method` | Exactly as it sounds - unknown method (or invalid HTTP method for a valid one, i.e. `GET` instead of `POST`)
`Too many requests` | Rate limit reached.
`CAPTCHA` | Captcha required. Captcha is only used in our internal endpoints (that fact is marked in the description)
`VALIDATION_ERROR` | Validation failed. Check the `description` field to find out what's wrong.
`INVALID_TOKEN` | Authorization token passed is invalid. Like, generally invalid, we didn't even lookup a session
`INVALID_SESSION` | Authorization token was valid... at some time. No longer, probably because user revoked it
`UNKNOWN_USER` | Your session is valid, but it is linked to a non-existent user. Should not occur in normal circumstances, so treat it as Internal Error
`UNKNOWN_FIELD` | One of fields passed in `sort` parameter does not exist on related entity or is not sortable (like `json` or arrays)

## Pagination & sorting
Some endpoints enforce pagination. Each of them support a pair of `?limit` and `?offset`
query parameters to paginate over the set. Most endpoints have a maximum limit, usually
around 50 items. 

Some endpoints additionally support sorting using `?sort` parameter. It is quite flexible
and can be used to sort by multiple fields, both ways, by putting multiple fields with comma.  
For example: `?sort=id,-updated_at,nickname` will produce the following SQL:
`order by id, updated_at desc, nickname`. So, by prepending `-` it sorts in reverse order.

When scrolling through documentation, you may notice 
`PaginatedResponse<T>`, which is used to wrap paginated resources like this:
```typescript
export interface PaginatedResponse<T> {
    count: number
    items: T[]
}
```

## Authorization
No authorization is needed for our mostly used endpoints. It is only needed for 
endpoints that actually update data (so we know who has done that). 

Strictly speaking, we have 2 authorization flows. However, one of them is needed for the
other one to work, so we'll not cover it 😜. Soo, introducing PlaShiki OAuth!

In fact, what we have is nowhere near like the standard OAuth. Mainly because it is
overly complicated for our scale. We know about all the security flaws,
but anyway since our flow is very similar to OAuth, we'll call it OAuth.

### Creating an app
To use OAuth, first of all you'll need to [register an app here](https://plashiki.su/apps).
There you'll receive your `client_id` and `client_secret`. Client Secret is only used
for server-to-server actions (and is not needed when authorizing).

Also, you may want to setup a `redirect_uri`. By default it will be 
[https://plashiki.su/static/oauth.blank.html](https://plashiki.su/static/oauth.blank.html),
and if you are building a standalone app, there's no need in setting up one.

That's pretty much it. You may also want to set up an image for your app, but it's optional

### Implicit Flow
Again, what we have is nowhere near like the standard, but quite similar.

To request a token, you'll need to open a browser page:
```
https://plashiki.su/api/v2/oauth/authorize?client_id=YOUR_CLIENT_ID
```

Then, once a user has clicked one of the buttons, it will be redirected either to
```
REDIRECT_URI?ok=0
```
in case user declined the request, and
```
REDIRECT_URI?ok=1&token=TOKEN
```
in case user accepted the request. Here, the `TOKEN` is the token you'll
want to store safely and use it in further requests like this:
```
Authorization: Bearer TOKEN
```

::: tip
`TOKEN` in URL may have URL-encoded entities (like `%3D`), so you should url-decode it. 
:::


## WebSocket
To deliver real-time stuff like notifications we use a WebSocket. 
It is available at `/api/ws`.

You can pass your `Authorization` header as normal - no need in additional authorization
inside a WebSocket, server will recognize you. However, in case of bad token you'll end up
with a plain HTTP response (`200 OK` but with error inside) instead 
of `101 Switching Protocols`.


### KeepAlive
Since we use CloudFlare for proxying, it has a limit of 100 seconds for a WebSocket to idle.
This way, you have two options: send keep-alive packets or reconnect every time.

To keep things simple™ and to reduce bandwidth, a keep-alive message is 
nothing more than a message containing `KA`. That's it, just `KA`. 
In response, server will send `KAACK` (keep-alive acknowledgement).

> `KAACK` is sent as a plain-text, and only sent in response to `KA`. So, if you don't send
> `KA` packets, you don't need to handle `KAACK`.

### Notifications
Once connected, your client may just idle - it will receive notifications in no time. 
A notification will be sent like this:

<<< @/docs/in-notification.ts

As you may notice, many fields are similar to [Notification](entities/#entity-notification),
but with shorter names to reduce bandwidth. However, in case you want to handle incoming
notifications, you should be aware of all the payload types. You can find them in 
frontend source code:
[here](https://github.com/plashiki/plashiki-frontend/tree/master/src/types/notification.ts)

### API-over-WebSocket

Your may want use the asynchronous nature of WebSockets to send API requests.

::: warning
API-over-WebSocket is currently experimental and may be more error-prone, 
worse at handling concurrency and slower in general.

Use at own risk!  
:::

The interface is very simple:

<<< @/docs/api-over-websocket.ts

So basically everything you'd generally put in your abstract API function is here.

Once sent, after a while the server will respond with an envelope very similar
to the one seen before, but with additional `id` field to map with original request.


## Internationalization
PlaShiki tries to be as open as possible, so if you can't
find your language, PRs are welcome :)  
Currently we support these locales:
 - `ru` for Russian (default)



## Protected resources
To keep our project up and running, we have a bunch of protected internal
resources. To access them, we use the same OAuth apps API, but in a slightly
different way.  
Remember `client_secret`? You can actually use it to communicate with
our server from your server and do some stuff! To authorize you should use:
```
Authorization: Token CLIENT_SECRET
```
However, since those resources are **protected**, you'll actually need
permissions to mess with them. The permissions are available
in `server_scope` attribute of your app (and are visible in the dashboard).  
The only way for you to get the permissions is to 
[get in touch with us](https://t.me/PlashikiSupport) and
describe your use-case.

Some examples of protected actions:
 - Batch translation addition
 - Updating and receiving parsers' source code
 - Publishing notifications
 - and maybe more TBD....
