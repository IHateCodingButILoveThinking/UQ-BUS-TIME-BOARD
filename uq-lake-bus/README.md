# UQ Lakes Bus Board

A minimal React app for the upcoming buses around UQ Lakes station.

## Run

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Open:

```text
http://127.0.0.1:4173
```

If you want the built single-server version instead:

```bash
npm run build
npm run start
```

Then open:

```text
http://127.0.0.1:8787
```

The frontend is React with Vite, and the backend is a tiny Express endpoint that:

- reads the official Translink UQ Lakes station metadata
- loads each UQ Lakes stop's full timetable page for today
- extracts the structured departure payload embedded in the official page
- merges the upcoming departures into one clean board

## Favourites and reminders

- Users can save favourite routes in the browser with `localStorage`.
- Optional reminder notifications can be set for one specific upcoming departure.
- Current reminders are browser notifications and in-app toasts that warn again at about 5, 3, and 1 minute before departure while the page is still open, then clear themselves after the bus departs.
- True push notifications after the tab is closed will need a service worker plus a server-side database for push subscriptions and saved favourites.
