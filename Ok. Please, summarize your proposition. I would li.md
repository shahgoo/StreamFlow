Here is a concise summary you can share: **StreamFlow should keep its current 1-hour app memory for temporary UI state, but add a separate persistent TMDB cache stored locally in IndexedDB for 14 days, using a stale-while-revalidate strategy: show cached TMDB data immediately, then silently refresh it in the background when it becomes stale.**[^1][^2][^3]

## Summary to share

The proposed architecture is:

- Keep the current 1-hour memory for transient app/session state.[^4]
- Add a dedicated **TMDB cache layer** separate from the UI and separate from Firestore sync.[^3][^4]
- Store TMDB API responses in **IndexedDB** for 14 days, because browser memory alone cannot preserve data across reloads or long sessions.[^2][^5]
- Use **stale-while-revalidate** behavior: if cached TMDB data exists, display it immediately; if it is expired, still display it immediately and refresh it silently in the background.[^6][^7][^1]
- Update the UI only if the refreshed TMDB payload actually changed, to avoid unnecessary visual flicker.[^1][^3]
- Keep **Firestore only for user-synced data** such as watch history, poster corrections, and settings, not for general TMDB catalog caching.[^8][^9][^4]
- Prevent duplicate refresh requests with an in-flight request map, and optionally apply light throttling because TMDB mentions an approximate per-IP rate limit around 40 requests per second.[^10][^11]


## Suggested technical split

Recommended module structure:

- `services/tmdb.ts`: raw TMDB fetch functions only.[^3]
- `services/tmdbCache.ts`: cache logic, TTL, silent refresh, invalidation.[^3]
- `storage/indexedDb.ts`: persistent local storage for TMDB cache entries.[^5][^2]
- `hooks/useTmdbResource.ts`: React hook to consume cached TMDB data in components.[^3]
- `services/firestoreSync.ts`: synchronization of user-owned data only.[^9][^4]


## Recommended TTL rules

Suggested cache durations:

- Movie details, credits, images metadata, collections/sagas: **14 days**.[^7][^12]
- Trending / popular / discover endpoints: **shorter TTL**, for example 6 to 24 hours, because they change more often.[^7]
- Search results: optional shorter TTL, such as 1 to 3 days, depending on how fresh you want search pages to be.[^7]


## One-sentence rationale

This design improves perceived speed, reduces repeated TMDB calls, preserves data across sessions, limits UI flicker, and keeps the architecture clean by separating **local TMDB cache** from **cloud-synced user data**.[^2][^4][^1][^3]

Here is an even shorter version you can paste directly to the other agent:

> StreamFlow should keep its current 1-hour runtime memory for UI state, but introduce a separate local IndexedDB cache for TMDB responses with a 14-day TTL. The cache should use stale-while-revalidate: return cached TMDB data immediately, then silently refresh expired entries in the background and update the UI only if the data changed. Firestore should remain limited to user-synced data like history, poster corrections, and settings, while `tmdb.ts` stays as the raw fetch layer and a new `tmdbCache.ts` handles TTL, invalidation, and de-duplication.[^4][^1][^2][^3]
<span style="display:none">[^13][^14][^15][^16][^17][^18][^19][^20]</span>

<div align="center">⁂</div>

[^1]: https://web.dev/articles/stale-while-revalidate

[^2]: https://sathishsaravanan.com/blog/indexeddb-caching-made-simple/

[^3]: https://www.perplexity.ai/search/67bafc3b-67de-4fc6-ae98-616c0a179832

[^4]: https://www.perplexity.ai/search/f690abf7-c224-4691-8436-6a4a7772315d

[^5]: https://roelofjanelsinga.com/articles/indexeddb-caching-your-data-on-the-client-side/

[^6]: https://stackoverflow.com/questions/60259141/what-does-stale-while-revalidate-cache-strategy-mean

[^7]: https://rbika.com/blog/optimize-caching-with-stale-while-revalidate

[^8]: https://www.perplexity.ai/search/a5f02ce5-06c2-455d-a7e1-ee588908070b

[^9]: https://www.perplexity.ai/search/a111f7fd-886e-4291-84cd-3509739b07eb

[^10]: https://www.themoviedb.org/talk/5d34aec717792c0011bc9bd9

[^11]: https://www.themoviedb.org/talk/66997ca6d3a5dbcf7c3a7994

[^12]: https://www.perplexity.ai/search/c86e5905-96b4-419d-b3e7-f413827803ca

[^13]: https://www.reddit.com/r/webdev/comments/1akkcbb/indexeddb_for_permanent_and_persistent_storage/

[^14]: https://www.reddit.com/r/webdev/comments/2rr53l/best_approach_to_using_ratelimited_web_api/

[^15]: https://www.vergecloud.com/blog/stale-while-revalidate/

[^16]: https://www.npmjs.com/package/stale-while-revalidate-cache

[^17]: https://www.linkedin.com/posts/sathishkumar0416_indexeddb-caching-made-simple-activity-7366416713208254465-Muhs

[^18]: https://github.com/pymedusa/Medusa/issues/5529

[^19]: https://developers.cloudflare.com/cache/concepts/revalidation/

[^20]: https://dev.to/mino/browser-storage-deep-dive-cache-vs-indexeddb-for-scalable-pwas-35f4

