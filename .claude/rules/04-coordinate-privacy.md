# Rule: Coordinate Privacy

Never write code that sends event coordinates (`lat`, `lng`) to the client before the player has submitted a guess for that event.

- `GET /api/game/start` must strip coordinates from every event before sending the response.
- Only `POST /api/game/guess` may return true coordinates, and only after the server has scored the guess.

This prevents cheating via DevTools network inspection.
