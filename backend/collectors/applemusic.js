// Coletor Apple Music — lê o estado atual do Apple Music via AppleScript nativo no macOS.
const { execFile } = require('child_process');

const SCRIPT = `
tell application "System Events"
  set isRunning to (name of processes) contains "Music"
end tell
if isRunning then
  tell application "Music"
    set pState to (player state as string)
    if pState is not "stopped" then
      set trackName to name of current track
      set trackArtist to artist of current track
      set trackAlbum to album of current track
      set trackPos to player position
      set trackDur to duration of current track
      return pState & "|||" & trackName & "|||" & trackArtist & "|||" & trackAlbum & "|||" & trackPos & "|||" & trackDur
    else
      return "stopped"
    end if
  end tell
else
  return "not_running"
end if
`;

function getMusicState() {
  return new Promise((resolve) => {
    execFile('osascript', ['-e', SCRIPT], { timeout: 3000 }, (error, stdout) => {
      if (error) {
        resolve({ running: false, playing: false });
        return;
      }
      const raw = stdout.trim();
      if (raw === 'not_running' || raw === 'stopped' || !raw) {
        resolve({ running: raw !== 'not_running', playing: false });
        return;
      }
      const parts = raw.split('|||');
      const state = parts[0] || 'unknown';
      const name = parts[1] || 'Unknown';
      const artist = parts[2] || 'Unknown Artist';
      const album = parts[3] || '';
      const position = Number.parseFloat(parts[4] || '0');
      const duration = Number.parseFloat(parts[5] || '0');
      const pct = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;

      resolve({
        running: true,
        playing: state === 'playing',
        state,
        track: name,
        artist,
        album,
        position: Math.round(position),
        duration: Math.round(duration),
        pct,
      });
    });
  });
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

async function collect() {
  const music = await getMusicState();
  if (!music.playing && !music.running) {
    return {
      tool: 'applemusic',
      label: 'Apple Music',
      confidence: 'idle',
      state: 'fechado',
      track: 'Nenhuma música tocando',
      artist: '',
      pct: 0,
    };
  }

  if (music.running && !music.playing) {
    return {
      tool: 'applemusic',
      label: 'Apple Music',
      confidence: 'idle',
      state: 'pausado',
      track: music.track || 'Pausado',
      artist: music.artist || '',
      pct: music.pct || 0,
      posStr: formatTime(music.position || 0),
      durStr: formatTime(music.duration || 0),
    };
  }

  return {
    tool: 'applemusic',
    label: 'Apple Music',
    confidence: 'live',
    state: 'tocando',
    track: music.track,
    artist: music.artist,
    album: music.album,
    pct: music.pct,
    posStr: formatTime(music.position),
    durStr: formatTime(music.duration),
  };
}

module.exports = { collect };
