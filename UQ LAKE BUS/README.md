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
