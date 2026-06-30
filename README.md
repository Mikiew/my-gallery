# Photo Gallery

Personal photo gallery. You (the owner) can upload and delete photos.
Everyone else can only view them — no upload, no delete, no edit access.

---

## How the "only me" part works

- Uploading and deleting both require a secret token sent in an
  `x-upload-token` header.
- The token lives in a Railway **environment variable** called
  `UPLOAD_TOKEN` — it is never written into the code, never committed to
  GitHub, and never visible in the page source.
- You unlock owner mode in your browser by visiting your site once with
  `?key=YOUR_SECRET_TOKEN` in the URL. The script saves it to
  `localStorage` on your device and immediately scrubs it from the visible
  URL. Other visitors never see this — they just get the read-only gallery.
- Photos are stored on a **Railway Volume**, not inside the git repo, so
  your library survives every redeploy and is never accidentally pushed
  somewhere public.

---

## 1. Create the GitHub repo

```bash
cd photo-gallery
git add .
git commit -m "Initial commit"
```

Then on GitHub: New repository → (any name, e.g. `photo-gallery`) →
**do not** initialize with a README (you already have one) → Create.

GitHub will show you a remote URL. Back in your terminal:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/photo-gallery.git
git push -u origin main
```

Double check `uploads/` did NOT get pushed (it shouldn't — `.gitignore`
excludes everything in it except the placeholder `.gitkeep`).

## 2. Create the Railway project

1. Go to railway.app → New Project → **Deploy from GitHub repo** → pick the
   repo you just pushed.
2. Railway will detect Node.js automatically and run `npm install` then
   `node server.js` (defined in `railway.json`).

## 3. Add a Volume (critical — this is the persistent storage folder)

1. In your Railway project, click your service → **Volumes** tab → **New
   Volume**.
2. Set the **mount path** to: `/data/uploads`
3. Done. Railway will keep this folder alive across every redeploy.

## 4. Set environment variables

In the service → **Variables** tab, add:

| Variable        | Value                                  |
|-----------------|------------------------------------------|
| `UPLOAD_TOKEN`  | any long random secret you generate (see below) |
| `UPLOAD_DIR`    | `/data/uploads` (matches the volume mount path) |

Generate a strong random token (run locally, don't make one up by hand):

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Copy the output, paste it as `UPLOAD_TOKEN`'s value. Keep it private —
treat it like a password.

## 5. Deploy

Railway redeploys automatically on every push to `main`. Once it's live,
Railway gives you a public URL like `https://your-app.up.railway.app`.

## 6. Unlock owner mode (only do this on your own device/browser)

Visit:

```
https://your-app.up.railway.app/?key=PASTE_YOUR_UPLOAD_TOKEN_HERE
```

once. The page will store the token locally and clean the URL bar
immediately after. From then on, that browser shows the Upload button and
the Delete button in the lightbox. Any other visitor, on any other device,
sees a plain read-only gallery with no upload/delete UI at all — and even
if they tried to call the API directly, the server rejects them without
the correct token.

To log out of owner mode on a device, open the browser console and run:

```js
localStorage.removeItem('uploadToken')
```

---

## Local development

```bash
npm install
UPLOAD_TOKEN=devsecret npm start
```

Then visit `http://localhost:3000/?key=devsecret` once to unlock owner mode
locally.
