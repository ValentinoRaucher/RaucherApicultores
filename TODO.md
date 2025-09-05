# Project Preparation for Deployment

## Frontend Organization
- [x] Create `public/` folder
- [x] Move `index.html` to `public/`
- [x] Move `styles.css` to `public/`
- [x] Move `script.js` to `public/`
- [x] Move `lazy-loading.js` to `public/`
- [x] Move `Miel/` folder to `public/`
- [x] Update `server.js` to serve static files from `public/`

## Backend Security
- [x] Remove exposed MercadoPago access token fallback in `server.js`
- [x] Remove exposed SMTP credentials fallbacks in `server.js`
- [x] Ensure all sensitive data is in environment variables

## Version Control
- [x] Create `.gitignore` to exclude `.env` and `database.sqlite`

## Optimization (Manual)
- [ ] Compress images in `public/Miel/` for better performance
- [ ] Minify CSS and JS files if needed

## Verification
- [x] Test that the server starts correctly
- [x] Verify that static files are served properly
- [x] Check that all paths in HTML are correct
