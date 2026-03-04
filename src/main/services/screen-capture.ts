import { desktopCapturer } from 'electron'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const SS_DIR = join(process.cwd(), 'ss')

const LEAGUE_WINDOW_NAMES = [
  'league of legends',
  'league client',
  'champion select',
  'leagueclient',
]

export async function captureScreenAsBase64(): Promise<string> {
  // Try to find the League of Legends window first
  const windowSources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 1920, height: 1080 }
  })

  const leagueWindow = windowSources.find(s =>
    LEAGUE_WINDOW_NAMES.some(name => s.name.toLowerCase().includes(name))
  )

  if (leagueWindow) {
    console.log(`[TopDiff] Found League window: "${leagueWindow.name}"`)
    const pngBuffer = leagueWindow.thumbnail.toPNG()
    saveToDisk(pngBuffer)
    return pngBuffer.toString('base64')
  }

  console.log('[TopDiff] No League window found, falling back to full screen capture')

  // Fallback: full screen
  const screenSources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  })

  if (screenSources.length === 0) {
    throw new Error('No screen sources available. Check Screen Recording permission in System Settings.')
  }

  const primary = screenSources[0]
  const pngBuffer = primary.thumbnail.toPNG()
  saveToDisk(pngBuffer)
  return pngBuffer.toString('base64')
}

function saveToDisk(pngBuffer: Buffer): void {
  try {
    mkdirSync(SS_DIR, { recursive: true })
    const filename = `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
    writeFileSync(join(SS_DIR, filename), pngBuffer)
    console.log(`[screenshot] saved to ss/${filename}`)
  } catch (e) {
    console.warn('[screenshot] could not save to disk:', e)
  }
}
