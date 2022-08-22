# discordarchive

CLI Discord archiving tool, currently only able to archive pins.

**Any tool that automates actions on user accounts, including this one, could result in account termination.**

## Example

### Archive pins

```
node discordarchive.js pins [channel id] --token [discord private token]
```

The command above will save all the pins to a JSON file and download any attachments within those pins - leaving the following directory structure:

```
└── json
    ├── pins-805825015600644116-2022-07-22-T193046.json
└── static
    └── media.discordapp.net
        └── attachments
            └── xxxxxx
                ├── xxxxxx
                │   └── image0.png
                ├── xxxxxx
                │   └── image0.png
```

## Obtaining a Discord token

1. Login to Discord on Chrome.
2. Open the Network tab in the inspector tools.
3. Send a message in Discord.
4. Find the request in the Network tab, and find the "Authorization" header in the request section. The value of this header is your token.
5. Get banned from Discord for doing this - you've been warned!

## Obtaining a channel ID

1. Go to Discord settings.
2. Open the "Advanced" tab under "App Settings".
3. Enable "Developer Mode".
4. Right click any chat/channel and copy the ID.

## Installation

Node.js is required to use this tool. Once the repo is cloned, run `npm install` to install dependencies.
