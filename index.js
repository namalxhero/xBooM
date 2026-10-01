// xBooM WhatsApp Bot - single file
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from 'xboom-baileys'
import P from 'pino'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ---------------- CONFIG ----------------
const CONFIG = {
  botName: 'xBooM',
  prefix: '.',
  // In GitHub Actions these come from repo Secrets (PHONE, OWNER)
  phone: process.env.PHONE || '94771234567',                       // country code, no +
  owner: (process.env.OWNER || '94771234567').split(','),          // owner numbers
  logo: 'assets/xboom-logo.png'
}
// ----------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const startedAt = Date.now()

const logoPath = path.join(__dirname, CONFIG.logo)
const logo = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null

const fmtUptime = (ms) => {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${d}d ${h}h ${m}m ${s % 60}s`
}

// ---------------- COMMANDS ----------------
const commands = {
  ping: {
    desc: 'Check bot speed',
    run: async ({ sock, from, msg }) => {
      const t = Date.now()
      const sent = await sock.sendMessage(from, { text: 'Pinging...' }, { quoted: msg })
      await sock.sendMessage(from, { text: `🏓 Pong! ${Date.now() - t}ms`, edit: sent.key })
    }
  },

  alive: {
    desc: 'Show bot status',
    run: async ({ sock, from, msg }) => {
      const caption =
        `*${CONFIG.botName} is alive* ✅\n\n` +
        `⏱ Uptime: ${fmtUptime(Date.now() - startedAt)}\n` +
        `🔧 Prefix: ${CONFIG.prefix}\n\n` +
        `Type ${CONFIG.prefix}menu for commands`
      if (logo) await sock.sendMessage(from, { image: logo, caption }, { quoted: msg })
      else await sock.sendMessage(from, { text: caption }, { quoted: msg })
    }
  },

  menu: {
    desc: 'Show all commands',
    run: async ({ sock, from, msg }) => {
      const list = Object.entries(commands)
        .map(([name, c]) => `▫️ ${CONFIG.prefix}${name} - ${c.desc}`)
        .join('\n')
      const caption = `*${CONFIG.botName} MENU*\n\n${list}`
      if (logo) await sock.sendMessage(from, { image: logo, caption }, { quoted: msg })
      else await sock.sendMessage(from, { text: caption }, { quoted: msg })
    }
  },

  say: {
    desc: 'Repeat your text',
    run: async ({ sock, from, msg, args }) => {
      await sock.sendMessage(from, { text: args.join(' ') || 'Give me some text.' }, { quoted: msg })
    }
  },

  runtime: {
    desc: 'Bot uptime',
    run: async ({ sock, from, msg }) => {
      await sock.sendMessage(from, { text: `⏱ ${fmtUptime(Date.now() - startedAt)}` }, { quoted: msg })
    }
  },

  jid: {
    desc: 'Show this chat ID',
    run: async ({ sock, from, msg }) => {
      await sock.sendMessage(from, { text: from }, { quoted: msg })
    }
  },

  tagall: {
    desc: 'Mention all group members (group only)',
    run: async ({ sock, from, msg, args, isGroup }) => {
      if (!isGroup) return sock.sendMessage(from, { text: 'Groups only.' }, { quoted: msg })
      const meta = await sock.groupMetadata(from)
      const ids = meta.participants.map(p => p.id)
      const text = (args.join(' ') || 'Attention everyone!') + '\n\n' +
        ids.map(id => `@${id.split('@')[0]}`).join(' ')
      await sock.sendMessage(from, { text, mentions: ids }, { quoted: msg })
    }
  }
}
// ------------------------------------------

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'))
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: [CONFIG.botName, 'Chrome', '1.0.0']
  })

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(CONFIG.phone)
        console.log('\n🔢 Pairing code:', code)
        console.log('WhatsApp > Linked devices > Link with phone number\n')
      } catch (e) {
        console.log('Pairing failed:', e?.message || e)
      }
    }, 3000)
  }

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') console.log(`✅ ${CONFIG.botName} connected`)
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        console.log('Reconnecting...')
        startBot()
      } else {
        console.log('Logged out. Clearing auth and exiting.')
        fs.rmSync(path.join(__dirname, 'auth'), { recursive: true, force: true })
        process.exit(42)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg?.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      ''
    if (!text.startsWith(CONFIG.prefix)) return

    const [name, ...args] = text.slice(CONFIG.prefix.length).trim().split(/\s+/)
    const cmd = commands[name.toLowerCase()]
    if (!cmd) return

    try {
      await cmd.run({ sock, from, msg, args, isGroup: from.endsWith('@g.us') })
    } catch (e) {
      console.log(`Error in ${name}:`, e?.message || e)
      await sock.sendMessage(from, { text: '⚠️ Something went wrong.' }, { quoted: msg })
    }
  })
}

startBot()
