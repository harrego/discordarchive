#!/usr/bin/node

const axios = require("axios").default
const { program } = require("commander")
const path = require("path")
const fs = require("fs")
const process = require("process")

var verboseLogging = false

const LogLevel = {
    info: "info",
    verbose: "verbose",
    error: "error",
    warning: "warning"
}

const defaultUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"

program
    .name("discordarchive")
    .description("CLI Discord archiving tool, currently only able to archive pins")
    .version("0.0.1")

program
    .requiredOption("-t, --token <token>", "Discord token")
    .option("-v, --verbose", "Use verbose logging")
    .option("-A, --user-agent <user agent>", "Set a custom user agent when making Discord API requests")

program.command("pins")
    .description("Archive pinned messages from a channel")
    .argument("<channel>", "Discored channel ID to archive")
    .option("-D, --delete", "Delete pinned message after archive")
    .action(async (channelId, commandOptions) => {
        const options = program.opts()
        if (options.verbose) {
            verboseLogging = true
        }

        const pinsData = await scrapePins(channelId, options.token, options.userAgent)
        if (commandOptions.delete) {            
            for (pin of pinsData) {
                log(LogLevel.verbose, `deleting pin ${pin.id}`)
                try {
                    await deletePin(pin.channel_id, pin.id, options.token, options.userAgent)
                } catch (err) {
                    if (err.response.status == 429) {
                        // rate limit
                        log(LogLevel.verbose, `rate limited deleting pin ${pin.id}, attempting in ${retryAfter * 1000}ms`)
                        const retryAfter = err.response.data.retry_after
                        await timeout(retryAfter * 1000)
                        log(LogLevel.verbose, `attempting to delete pin again ${pin.id}`)
                        try {
                            await deletePin(pin.channel_id, pin.id, options.token, options.userAgent) 
                        } catch (err) {
                            log(LogLevel.error, `failed to delete pin ${pin.id} again, response code: ${err.response.status}`)
                        }
                    } else {
                        log (LogLevel.error, `failed to delete pin ${pin.id}, response code: ${err.response.status}`)
                    }
                }
            }
        }
    })

program.addHelpText("after", `
********************************************************
Any tool that automates actions on user accounts,
including this one, could result in account termination.
********************************************************

Obtaining a Discord token:
  1. Login to Discord on Chrome.
  2. Open the Network tab in the inspector tools.
  3. Send a message in Discord.
  4. Find the request in the Network tab, and find the "Authorization" header in the request
     section. The value of this header is your token.
  5. Get banned from Discord for doing this - you've been warned!

Obtaining a channel ID:
  1. Go to Discord settings.
  2. Open the "Advanced" tab under "App Settings".
  3. Enable "Developer Mode".
  4. Right click any chat/channel and copy the ID.`)

program.parse(process.argv)

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function scrapePins(channelId, token, userAgent = undefined) {
    userAgent = userAgent || defaultUserAgent

    log(LogLevel.verbose, `getting pins for channel id ${channelId}`)
    const response = await axios.get(`https://discord.com/api/v9/channels/${channelId}/pins`, {
        headers: {
            "authorization": token,
            "user-agent": userAgent
        }
    })
    log(LogLevel.info, `found ${response.data.length} pins in channel ${channelId}`)
    await parsePinsResponse(response.data)
    await savePinsResponse(response.data, channelId)
    return response.data
}

async function parsePinsResponse(data) {
    var totalAttachments = 0
    for (pin of data) {
        totalAttachments += pin.attachments.length
        for (attachment of pin.attachments) {
            await archiveFile(attachment.proxy_url)
        }
    }
    log(LogLevel.info, `saved ${totalAttachments} attachments`)
}

async function savePinsResponse(data, channelId) {
    const newDirectory = path.join(process.cwd(), "json")
    try {
        log(LogLevel.verbose, `creating new directory for pins archive ${newDirectory}`)
        await fs.promises.mkdir(newDirectory)
    } catch (err) {
        if (err.code != "EEXIST") { throw err }
    }
    const newPath = path.join(newDirectory, `pins-${channelId}-${formattedDate()}.json`)
    log(LogLevel.verbose, `writing pins files to ${newPath}`)
    await fs.promises.writeFile(newPath, JSON.stringify(data))
    log(LogLevel.info, `saved pins to ${newPath}`)
}

function zeroPad(int) {
    return int.toString().padStart(2, 0)
}

function formattedDate(date = new Date()) {
    return `${date.getFullYear()}-${zeroPad(date.getMonth())}-${zeroPad(date.getDate())}-T${zeroPad(date.getHours())}${zeroPad(date.getMinutes())}${zeroPad(date.getSeconds())}`
}

async function deletePin(channelId, messageId, token, userAgent = undefined) {
    userAgent = userAgent || defaultUserAgent
    log(LogLevel.verbose, `deleting pin in channel ${channelId} with message id ${messageId}`)
    const response = await axios({
        method: "DELETE",
        url: `https://discord.com/api/v9/channels/${channelId}/pins/${messageId}`,
        headers: {
            "authorization": token,
            "user-agent": userAgent
        }
    })
}

async function archiveFile(rawUrl, userAgent = undefined) {
    log(LogLevel.verbose, `downloading attachment ${rawUrl}`)
    const url = new URL(rawUrl)
    const newDirectory = path.join(process.cwd(), "static", url.hostname, path.dirname(url.pathname))
    const newPath = path.join(newDirectory, path.basename(url.pathname))

    if (fs.existsSync(newPath)) {
        log(LogLevel.verbose, `attachment already exists, skipping ${newPath}`)
        return
    }

    try {
        log(LogLevel.verbose, `creating directory for attachment ${newDirectory}`)
        await fs.promises.mkdir(newDirectory, { recursive: true })
    } catch (err) {
        if (err.code != "EEXIST") { throw err }
    }

    const response = await axios({
        method: "get",
        url: rawUrl,
        responseType: "stream"
    })
    log(LogLevel.verbose, `saving attachment at ${newPath}`)
    response.data.pipe(fs.createWriteStream(newPath))
}

// LOGGING

function log(level, msg) {
    if (level == LogLevel.verbose && !verboseLogging) {
        return
    }
    console.log(`[${level}] ${msg}`)
}