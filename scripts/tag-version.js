import { execFileSync } from 'node:child_process'

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

const versionPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

function createVersionTag() {
  // Bei erneutem Ausführen denselben Commit nicht nochmals taggen.
  const currentTags = git('tag', '--points-at', 'HEAD').split('\n')

  if (currentTags.some((tag) => versionPattern.test(tag))) {
    console.log('Dieser Commit hat bereits einen Versions-Tag.')
    return
  }

  // Höchsten Versions-Tag aus der Historie dieses Branches finden.
  const latestTag = git('tag', '--merged', 'HEAD', '--sort=-version:refname')
    .split('\n')
    .find((tag) => versionPattern.test(tag))

  // Alle Änderungen seit diesem Tag berücksichtigen.
  const range = latestTag ? `${latestTag}..HEAD` : 'HEAD'
  const messages = git('log', '--format=%B%x00', range).split('\0')

  let bump = 0

  for (const message of messages) {
    const text = message.trim()
    const subject = text.split('\n')[0]
    const header = /^([a-z]+)(?:\([^)]+\))?(!)?: .+/i.exec(subject)

    if (!header) continue

    const type = header[1].toLowerCase()
    const breaking =
      Boolean(header[2]) ||
      /^BREAKING[ -]CHANGE: .+/m.test(text)

    if (breaking) {
      bump = Math.max(bump, 3)
    } else if (type === 'feat') {
      bump = Math.max(bump, 2)
    } else if (type === 'fix') {
      bump = Math.max(bump, 1)
    }
  }

  if (bump === 0) {
    console.log('Keine versionsrelevante Änderung: kein neuer Tag.')
    return
  }

  // Ohne bisherigen Tag starten wir für diese Übung bei 0.0.0.
  let [major, minor, patch] = (latestTag ?? 'v0.0.0')
    .slice(1)
    .split('.')
    .map(BigInt)

  if (bump === 3) {
    major += 1n
    minor = 0n
    patch = 0n
  } else if (bump === 2) {
    minor += 1n
    patch = 0n
  } else {
    patch += 1n
  }

  const nextTag = `v${major}.${minor}.${patch}`

  git('tag', '-a', nextTag, '-m', `Release ${nextTag}`, 'HEAD')
  console.log(`Tag erstellt: ${nextTag}`)
}

try {
  createVersionTag()
} catch (error) {
  console.error('Tag konnte nicht erstellt werden:', error.message)
  process.exitCode = 1
}