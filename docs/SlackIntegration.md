# Slack Integration Guide

## Overview

The backend now supports two Slack use-cases using a bot token:

1. Push notifications whenever tasks are created or when their status changes, posted by a bot user into a chosen channel or thread.
2. A slash command (`/task`) that lets users create new tasks or update existing ones from Slack.

Slack-side manual work (creating the app, granting scopes, configuring the slash command) still has to be performed in the Slack admin UI. All other wiring is handled in code.

## Outgoing notifications (bot posts)

- Create or reuse a Slack App and enable the **Bot Token** feature.
- Add the scopes `chat:write` (for channel posts) and optionally `chat:write.public` if the bot needs to post into channels it is not a member of.
- Install the app into your workspace and copy the **Bot User OAuth Token**.
- Add the bot to the channel where notifications should appear.
- Set environment variables in the backend:
  - `SLACK_BOT_TOKEN` – the bot token (starts with `xoxb-`).
  - `SLACK_CHANNEL_ID` – channel ID for notifications (e.g. `C0123456789`).
  - `SLACK_THREAD_TS` – optional message timestamp if you want every notification threaded under an existing message.
- When configured, the API automatically sends notifications from:
  - `CreateTask` (new task created).
  - `UpdateTask` when the status value changes.

If the token or channel ID is missing, the handlers skip the Slack call safely.

## Slash command endpoint (`/task`)

- In the Slack App configuration, add a **Slash Command** such as `/task`.
- Point the command to the Azure Function endpoint: `POST https://<your-app-host>/api/Slack/Command`.
- Copy the app’s **Signing Secret** and set it as `SLACK_SIGNING_SECRET` in the backend environment.
- (Optional) Restrict usage to one workspace by setting `SLACK_ALLOWED_TEAM_ID` to its team ID.

### Supported syntax

All arguments are lowercase-insensitive. Separate fields with a pipe `|`.

```
/task add Kick-off meeting | description=Prepare agenda | status=Started | assignees=Alice,Bob | tags=meeting,Q4 | priority=High | deadline=2025-10-15
/task update TASK_ID | status=Done | assignees=Charlie
/task help
```

Supported fields for `add` and `update` include:

- `status`: Started, Inprogress, Done (aliases such as `todo`, `doing`, `completed` are also accepted)
- `priority`: Low, Medium, High
- `assignees`: comma-separated display names
- `tags`: comma-separated labels
- `category`: category name as stored in the app
- `deadline`: ISO date or any value parsable by `new Date()`
- `description`: free text (alias `desc`)
- `importance`: numeric 0-2 (defaults to 1)
- `title`: only for `update` when you want to rename a task

The slash command replies with an ephemeral message in Slack and relies on the notification hook above to inform the wider channel if a change is made.

## Environment variables summary

| Variable | Required | Purpose |
| --- | --- | --- |
| `SLACK_BOT_TOKEN` | Required for notifications | Bot token used to call Slack Web API |
| `SLACK_CHANNEL_ID` | Required for notifications | Channel ID where the bot posts updates |
| `SLACK_THREAD_TS` | Optional | Posts notifications as replies inside a thread |
| `SLACK_SIGNING_SECRET` | Required for slash command | Validates Slack signatures before processing commands |
| `SLACK_ALLOWED_TEAM_ID` | Optional | Rejects slash commands from other Slack workspaces |

## Manual setup checklist

1. Create a Slack App (or use an existing one) at <https://api.slack.com/apps>.
2. Under **Basic Information → App Credentials**, note the **Signing Secret**.
3. Under **OAuth & Permissions**:
   - Add bot scopes: `chat:write`, `chat:write.public` (optional), and `commands`.
   - Install the app to your workspace and copy the **Bot User OAuth Token**.
4. Invite the bot to the target channel and copy the channel ID (from the channel details → **More** → **Copy channel ID** in Slack).
5. Configure a Slash Command:
   - Command: `/task` (or your preferred name).
   - Request URL: `https://<your-app-host>/api/Slack/Command`.
   - Description and usage hint as desired.
6. In your deployment environment (Azure Functions settings, local `local.settings.json`, etc.) add:
   - `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID`, `SLACK_THREAD_TS` (if needed), `SLACK_SIGNING_SECRET`, and optionally `SLACK_ALLOWED_TEAM_ID`.
7. Redeploy/restart the Functions app so the new settings are picked up.

## Local testing tips

- Use a tunneling tool (ngrok, dev tunnels, etc.) so Slack can reach your local Azure Functions host.
- When testing locally, run `func start` in the `api` directory and point the slash command at the tunnel URL.
- Slash command requests are rejected unless the signing secret matches. Make sure the local environment carries the same secret you configured in Slack.
- The Slack helper logs API issues but never throws; check the function logs if a notification does not arrive.
