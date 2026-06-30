# Privacy Policy — Pace

_Last updated: 2026-06-19_

Pace is a browser-extension focus timer. It is built privacy-first: by default
**nothing you do leaves your computer**. This policy explains exactly what the
extension stores, what it does not, and the one optional feature that sends a
network request — only when you turn it on.

## Summary

- **No accounts, no sign-in, no tracking, no analytics.**
- **No data is collected by the developer.** There is no Pace server.
- All settings and timer state are stored **locally on your device** using the
  browser's `storage` API.
- The extension contains **no remote code** — everything it runs is bundled in
  the package you install.
- One feature, **cross-device break reminders, is off by default**. When you
  enable it, the extension sends a short, generic notification to a third-party
  push service (ntfy.sh). Details below.

## What Pace stores locally

To work as a timer, Pace keeps the following in your browser's local storage on
your own device. None of it is transmitted to the developer or any server:

- Your settings (focus/break lengths, number of sessions, chosen ambient sound,
  mute state).
- The current run's timer state (which phase you're in and when it ends).
- For the optional reminder feature: an on/off flag and a randomly generated
  topic name (see below).

You can clear all of it at any time by removing the extension.

## Page access

Pace runs a content script on the pages you have open so it can:

- draw the full-screen recovery-break overlay when a break begins, and
- pause audio/video on the page during a break.

It does **not** read, collect, store, or transmit the content of the pages you
visit, your browsing history, your form input, or your URLs. The page access
exists solely to display the break overlay and pause media locally.

## Optional cross-device break reminders (off by default)

If — and only if — you turn on **cross-device reminders**, Pace sends a push
notification to your phone or other device at break boundaries, so you get a
nudge even when you've stepped away from the computer.

How it works:

- The notification is delivered through **[ntfy.sh](https://ntfy.sh)**, a
  free, open-source publish/subscribe notification service operated by a third
  party. You subscribe to your topic in the ntfy app to receive the buzz.
- When you first enable the feature, Pace generates a **random, unguessable
  topic name** (e.g. `pace-willow-quartz-7k3m9pqd`) on your device. This topic
  is the only address used; it contains no personal information.
- The messages Pace sends contain **only generic timer text** — for example
  "Time for a break · Short break · 5 min", "Back to focus — session 2 of 4",
  or "All sessions complete". They include **no personal data, no page content,
  no identifiers** other than the random topic you generated.
- Because ntfy topics are public to anyone who knows the topic name, Pace
  generates a long random one. Keep your topic name private if you don't want
  others to subscribe to it.
- ntfy.sh's own handling of the messages it relays is governed by its operator's
  policy: see <https://ntfy.sh> and <https://docs.ntfy.sh/privacy/>.

Turning the feature off stops all network requests; nothing is sent. The
extension makes **no network requests at all** while this feature is disabled.

## Children's privacy

Pace is a general-purpose productivity tool and is not directed at children. It
collects no personal information from anyone.

## Changes to this policy

If this policy changes, the "Last updated" date above will change and the new
version will be published at the same location.

## Contact

Questions about this policy: **hello@pacewell.dev**
