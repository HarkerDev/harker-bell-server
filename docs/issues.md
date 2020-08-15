# Troubleshooting

Experiencing problems? Follow these steps to fix commonly seen issues.

1. If the website isn't working as expected, try resetting the web app by visiting these special URLs in order until the issue is resolved:
   - [bell.harker.org/?force_reset=1](https://bell.harker.org/?force_reset=1): Clears all saved schedules and retrieves a fresh copy.
   - [bell.harker.org/?force_reset=2](https://bell.harker.org/?force_reset=2): Clears all saved schedules, clears cached resources, and resets offline mode.
   - **bell.harker.org/?force_reset=3**: Clears everything stored in the site, including ALL of your settings and customizations. Use this option as a last resort.
2. If the problem persists, try it in Incognito or Private mode first. If that works, you might have a browser extension that's interfering with the site. Try disabling your extensions one-by-one (especially ad blockers) until the issue is resolved.
3. If these steps don't work, please email us at [dev@harker.org](mailto:dev@harker.org).

### Known Issues

- uBlock Origin Ad Blocker: There is currently an issue with the [uBlock Origin](https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm?hl=en) ad blocker where the extension blocks certain scripts from loading, preventing the app from receiving updates. Please whitelist the site or switch to a different ad blocker.
- Internet Explorer 11 Support: IE 11 support is still spotty.

If you encounter any other issues or find a mistake in the bell schedule, let us know by emailing [dev@harker.org](mailto:dev@harker.org).