# Fixtures: Reaching a State on Purpose

Many states in the inventory never appear on their own in the dev preview: an error path, a large count, long text, a slow response. This is the recipe that worked on a real signed-in app. It keeps every fixture out of the repo.

## Work in a Scratch Copy

Copy the built app, or its static files, into the session scratchpad. Never add fixture code to the repo, and never commit it. Serve the copy on its own port.

## Add One Fixture Script

Append one script to the copy's own JavaScript, so it runs inside the app. Key each fixture by a query value, such as `?fx=upload-error`. For the matching key, the script:

1. Mocks the endpoints the state needs, by wrapping `fetch` (or the app's own API client) and returning a synthetic response for those paths only. Every other request goes through.
2. Drives the UI into the state: clicks, typed text, an opened menu.
3. Blurs the element the script focused, unless the state is the focus state.
4. Sets `data-fx-ready` on `<html>` when the state is on screen.

Then capture with `--wait-for '[data-fx-ready]'`, so no shot is taken before the state is ready:

```bash
node <skill>/scripts/capture.mjs --url 'http://localhost:5174/settings?fx=upload-error' --wait-for '[data-fx-ready]' --blur --cookies <scratch>/cookies.json --out <scratch>/shots --name upload-error
```

A mocked response must be one the server can really send. Check it against the server contract (Step 1 of the skill). A mock that the server could never produce makes an impossible state.

## Sign In Without Showing the Session

For a page behind a sign-in, write a small script that signs in to the dev server with a test account, then writes the session cookie to `<scratch>/cookies.json` as a CDP cookie array (`name`, `value`, `domain` or `url`, `path`). The script never prints the cookie value, and the file stays in the scratchpad. Pass the file with `--cookies`.

Use only a test account that exists for the dev server. Never use a person's real credentials.
