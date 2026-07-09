## v2.8.0 — 2026-07-09

### Highlights

### Commits

- feat(extension): update rendering of preference notices
- chore(extension): cleanup
- feat(extension): add playtime requirement note to world reviews preference toggle
- feat(extension): client-side playtime check on world review
- feat: require 5 minutes minimum of playtime to review a world
- fix(extension): make navbar background blurry to improve readability when navbar bg is mostly transparent
- fix(extension): site banners disappearing when scrolling with "Sticky Navbar" enabled
- fix(extension): legacy sidebar causes navbar to overflow screen horizontally
- feat(extension): new "World Trends" feature
- feat(extension): improve design of "Expanded Message Glance" feature
- feat(extension): new "Audio Toolbox Previews" feature
- feat(extension): remove announcement
- feat(extension): new "My Posts" feature
- feat(extension): handle missing headshot image in search index
- chore(extension): remove "New" labels from old features
- feat(extension): change color of IRL brick price on navbar
- feat: scrape isStaff, userlink, and thumbnail URL on user indexing cron
- feat(extension): new "Re-enable Sitewide Search" feature
- feat(extension): new "Advanced Forum Search" feature
- style(extension): polish "Disable Infinite Scrolling" feature logic
- fix(extension): random place button squishing world search bar input
- feat(extension): new "Disable Infinite Scrolling" feature
- feat(extension): export avatar sandbox avatar as mesh
- feat(extension): add accessory repositioning to avatar sandbox
- feat(extension): rely on PolyTrack for playtime tracking
- feat(extension): automatic verification method
- feat(extension): add multiple body types to 3d clothing preview
- feat(extension): update updates notice
- feat(extension): pinned world update notifications
- feat(extension): updates notice
- feat(extension): theme delete confirmation modal
- feat(extension): new "Daily Challenges Refreshing" feature
- feat(extension): new "Server Refreshing" feature
- fix(extension): name bones correctly with "Avatar Mesh Downloader"
- fix(extension): attach hats and tools to the player model with "Avatar Mesh Downloader"
- feat(extension): active linked sessions
- feat: session management
- feat: notify on recent users crawl erroring out
- feat: rename "Avatar Sandbox" references to "Character Sandbox"
- chore(extension): update mirror script
- fix(extension): handle spamming changes in "Character Sandbox" avatar renderer
- fix(extension): use new PolyTrack endpoint for "Ranking Positions" feature
- feat(extension): new "World Consumables Tab" feature
- feat(extension): ability to import and export preferences JSON
- fix(extension): fix secondary navbar overlapping primary navbar when scrolling with "Sticky Navbar" enabled
- feat(extension): new "Improved Forum Composer" feature (#83)
- fix(extension): "Creator Comment Labels" failing to find creator ID when "Legacy World View Layout" is enabled
- chore(extension): final clean up
- feat: new "Detailed World Reviews" feature

## v2.7.0 — 2026-06-17

### Highlights

### Commits

- feat(extension): enable "Playtime Tracking" feature (experimenta;)
- chore(extension): clean up
- feat: custom cursors property of "Theme Creator"
- fix(extension): show feedback (like & dislike) buttons with "Legacy World View Layout" feature
- feat(extension): "View Profile" option in friend request notification actions
- fix(extension): include schemas in mirror and fix monorepo structure
- feat: outfits in "Character Sandbox"
- fix(extension): Fix "Character Sandbox" and bring it up to date with recent Polytoria changes
- feat(extension): clean up part 3
- feat: clean up part 2
- chore(extension): clean up part 1
- feat(extension): hide certain preferences on mobile devices
- fix(extension): make "Ranking Positions" card consistent with equipped profile theme
- feat: proxy theme images through Cloudflare Worker
- feat(extension): new "Ranking Positions" feature
- fix(extension): properly fallback on local config if remote config is unreachable
- feat(extension): rely on world server share links for quick friend join from homepage feature
- feat(extension): new "User Notes" feature (#66)
- refactor(extension): split background message handlers into several files

## v2.6.0 — 2026-06-12

### Highlights

### Commits

- feat(extension): disable "Time Played" feature
- fix(extension): keep world management buttons if user is creator of world with "Legacy World View Layout" feature (#72)
- feat(extension): rely on existing joinPlace method for "Legacy World View Layout" feature
- fix(extension): use 2.0 client when world is set to 2.0 only with "Legacy World View Layout" feature (#71)
- feat(extension): polish up preferences static data (#74, #75)
- feat(extension): refine "Reduce "2.0" Label Clutter on Worlds Page" feature
- feat: polish "Time Played" feature
- feat: ability for admins to unpublish themes
- feat(extension): new "Avatar Mesh Downloader" feature
- feat(extension): new "User Creations Tab" feature
- fix(extension): explicitly define no sourcemap for gpl-banner vite plugin
- feat(extension): refine "Avatar Versions" feature
- feat(extension): show v1, v1.5, and v2 badges in "Avatar Versions" dropdown
- feat(extension): exclude broken avatar images from "Avatar Versions" feature
- feat(extension): change license to GPL-3.0
- feat(extension): include license file headers in build output
- feat(extension): remove "Trade Evaluation" feature entirely
- chore(extension): update preference tags
- feat(extension): new "Recent Transactions on Collectibles" feature
- Revert "chore(extension): cleanup"
- chore(extension): cleanup
- feat: remote changelog markdown file
- feat: update scripts
- feat(extension): add license headers
- feat(extension): intuitive extension preferences menu sorting
- feat(extension): update preference categories
- feat(extension): add "About" tab to extension preferences
- feat(extension): refined extension preferences
- feat(extension): rename "Customization" preference category to "Expression"
- feat: option to report themes in theme gallery
- fix(extension): achievement difficulty ratings displaying as undefined

## Kiln v2.5.0 (June 1st, 2026)

The next update of Kiln is here! Mainly focused on the Theme Creator. Hope you enjoy :D
p.s. happy pride month! 🏳️‍🌈

### Highlights

- {New feature:|success} "Pinned Achievements" lets you pin a couple of achievements to your profile, shown to other users of Kiln.
- {New feature:|success} "User Aliases" allows you to rename anyone anything (no filter.. so take that with what you will)!
- {New feature:|success} "Friend Request Notification Quick Actions" lets you quickly act on friend request notifications, allowing you to accept or reject them from the notification tray.
- {New feature:|success} "Legacy World View Layout" lets you view world pages as what they were prior to February 2026.
- {Improvement:|primary} Text is now displayed on the site footer explaining what features Kiln added to the current page, for clarity.
- {Improvement:|primary} Theme Creator has been redesigned to work as a sidebar or windowed editor panel while you traverse the Polytoria website!
- {Improvement:|primary} Theme Creator now has an "Effects" system, allowing you to have more granular control without needing as much custom CSS!
- {Improvement:|primary} Already published themes are now able to be updated without needing to be republished.
- {Improvement:|primary} (for developers) "/json" redirect now works on forum posts.
- {Bug Fix:|warning} 2.0 world downloads are now structured correctly.
- {Bug Fix:|warning} Imported themes from other users no longer show an "Unpublish" button.
- {Bug Fix:|warning} Notification badges are now shown on the Legacy Sidebar.

### Commits

- fix(extension): show notification badges on Legacy Sidebar
- fix(extension): Trade Manager activation button not being shown on all page paths consistently (#68)
- fix(extension): themes not being applied across page paths consistently (#69)
- feat(extension): import & export JSON theme
- feat: "Icon Color" property in Theme Creator
- feat: new "Avatars" effect
- feat(extension): intuitive Theme Creator editor UX
- feat(extension): verifying in Theme Creator editor
- feat: ability to update themes already published
- feat: re-publishing theme keeps same slug
- feat: new effects system for themes
- feat(extension): new "Legacy World View Layout" feature
- feat(extension): polish up Theme Creator editor
- fix(extension): don't show "unpublish" button on imported themes
- feat(extension): redesigned Theme Creator editor as a sidebar
- fix(extension): type errors caused by preferences default state refactor
- feat(extension): new "Friend Request Notification Quick Actions" feature
- feat(extension): support forum posts for "/json" redirect URLs
- refactor(extension): move default preferences logic to be baked into preferences JSON
- feat(extension): finish "User Aliases" feature
- feat(extension): new "User Aliases" feature (WIP, #67)
- feat(extension): finalize "Pinned Achievements" feature
- feat: new "Pinned Achievements" feature
- fix(extension): rename "meta.json" to "project.ptproj" in world exports (#62)
- feat(extension): "Kiln has added the following features: ..." on site footer
- Revert "feat: consolidated remote config system"
- feat: consolidated remote config system

## Kiln v2.4.1 (May 25th, 2026)

A small patch update. I hope to have a new update done soon, but I am getting a bit burnt out so it might be longer than usual till the next one.

### Highlights

- {Improvement:|primary} "Theme Creator" now supports background images
- {Improvement:|primary} "Theme Creator" feature modal has been polished up a bit.
- {Improvement:|primary} You can now choose what membership style of sidebar you want with "Legacy Sidebar", free (default), Plus, or Plus Deluxe. I recommend using the "free" style when pairing with the "Theme Creator" feature to prevent styling issues. All three membership styles are free, ofc. "Free" as in the style of the sidebar when you had neither Plus nor Plus Deluxe when the sidebar existed.
- {Fix:|warning} Themes should no longer run into max storage size issues.
- {Fix:|warning} "Legacy Sidebar" is now styled with whatever theme you set when paired with the "Theme Creator" feature.
- {Fix:|warning} "Legacy Sidebar" no longer links to my inventory instead of your own.
- {Deprecation:|secondary} "Trade Evaluation" has been fully disabled, and will not come back. I apologize for any errors or users that were misled with the data the feature showed. I'd rather no feature than a bad, misleading one. Sorry :(

### Commits

- feat(extension): make "Theme Creator" not labeled experimental
- feat(extension): support legacy sidebar styling with themes
- feat(extension): trim cache if nearing size limit"
- feat(extension): add storage size quota breakdown to debug menu"
- feat(extension): store themes in local storage not sync to bypass size limits"
- "style(extension): clean up"
- feat(extension): deprecate \"Trade Evaluation\" feature"
- "chore(extension): remove unused debug route"
- feat(extension): background images in themes"
- feat(extension): polish \"Legacy Sidebar\" feature"
- feat(extension): improve new theme in \"Theme Creator\" workflow"
- fix(extension): default theme being inaccurate in \"Theme Creator\" feature modal"
- feat: theme gallery for \"Theme Creator\""
- feat(extension): add default limits to remote config schema"
- feat(extension): redesigned \"Theme Creator\" editor"
- Revert \"chore(extension): remove unused popup\""
- feat: limit for number of published themes"
- chore(extension): remove unused popup"

## Kiln v2.4.0 (May 23rd, 2026)

The next update of Kiln is here! Sorry if it isn't as feature-packed as the last version, I've been a lot busier lately :(

### Highlights

- {New feature:|success} "Custom Body Color Hex Codes" allows you to customize the color of your avatar's body parts to the granularity you want!
- {New feature:|success} "Theme Creator" allows you to customize the Polytoria website to your liking!
- {New feature:|success} "Reduce '2.0' Label Clutter on Worlds Page" cleans up the Worlds page from all those ugly "2.0" badges.
- {New feature:|success} "Creator Comment Labels" quickly marks comments if they are made by the creator of the asset or the leader of the guild you're viewing.
- {New feature:|success} "Legacy Item View Layout" lets you view item pages as what they were prior to February 2026.
- {New feature:|success} "Legacy Sidebar" replaces the secondary navbar with the sidebar the site had prior to February 2026.
- {New feature:|success} "Quick Launch Creator Buttons" allows developers to quickly access the 1.0 and 2.0 creators from their dashboard.
- {New feature:|success} (for developers) If you append "/json" to a profile, store item, or guild URL it'll redirect you to the API response for that resource. 
- {Improvement:|primary} You can now view the latest changelog of the extension under the "Changelog" tab of the extension preferences.
- {Improvement:|primary} "Trade Manager" no longer fetches inactive trades until you click on the tab, speeding up the loading of the modal for users with a ton of trade history.
- {Fix:|warning} If a world is unavailable due to the creator being (potentially) permanently banned, you'll be prompted if you want to unpin it since before there was no other way.
- {Fix:|warning} Downloading a 2.0 place file now downloads it correctly as a zip, instead of as a broken legacy 1.0 place file.

### Commits

- feat(website): update security & privacy section
- feat(website): update feature grid
- chore(website): update privacy policy
- feat: update extension tagline
- feat(extension): remove in-development features
- feat(extension): new "Quick Launch Creator Buttons" feature
- feat(extension): decrease layout shifting & load times for "Legacy Sidebar" feature
- fix(extension): sitewide methods not running consistently
- fix(extension): don't try to run profile.content.ts on "/users"
- feat(extension): new "Legacy Sidebar" feature
- feat(extension): new "Legacy Item View Layout" feature
- chore(extension): improved update workflow
- feat(extension): "Changelog" extension preferences tab
- feat(extension): only scrape inactive trades for trade manager when needed
- feat(extension): prompt to unpin world if the creator is banned
- feat: API endpoint documentation & renames
- feat(extension): quick "/json" -> API redirect paths
- feat: finish up "Theme Creator" feature
- feat: prevent duplicate themes from being published
- feat(extension): clean up extension preferences
- feat: admin API routes, config endpoint moved to API, deprecate Discord bot handler
- feat: more progress on "Theme Creator" feature
- feat: WIP "Theme Creator" feature
- feat(extension): reimplement "Creator Comment Labels" feature
- fix(extension): sender side of trades not rendering Not for Trade items correctly
- fix(extension): "Download Place File" downloads 2.0 places as a .poly file instead of a .zip
- feat(extension): new "Reduce '2.0' Label Clutter on Worlds Page" feature
- feat(extension): make feature IDs type safe
- feat(extension): add preference toggles for "Show User ID on Profile" and "AI Bot Forum Warnings"
- feat(extension): WIP "Challenge Reminder Notifications" feature
- chore(extension): clean up old, unused assets
- feat(extension): "Custom Body Color Hex Codes" feature

### Privacy Policy Update

The privacy policy has been updated to detail what data is collected for the new features of this update and the last one. The main gist is what is stored for published themes created with the "Theme Creator" feature.

View the privacy policy here -> https://kiln.indexx.dev/privacy