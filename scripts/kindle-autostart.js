#!/usr/bin/env node
// Installs and manages the Kindle-side Upstart launcher over SSH.

const path = require('path');
const {
  connect,
  execCommand,
  shellQuote,
  uploadFile,
} = require('./kssh');

const ROOT = path.resolve(__dirname, '..');
const JOB_NAME = 'kindle-dashboard';
const REMOTE = {
  loop: '/mnt/us/dash-loop.sh',
  launcher: '/mnt/us/dash-autostart.sh',
  environment: '/mnt/us/dash-autostart.env',
  disabled: '/mnt/us/dash-autostart.disabled',
  jobSource: '/mnt/us/kindle-dashboard.conf',
  jobTarget: '/etc/upstart/kindle-dashboard.conf',
};

// Shell helpers shared by install/start/stop/status. Matching the exact loop
// command line keeps SSH commands that merely mention the script out of it.
const LOOP_HELPERS = `
loop_pids() {
  for proc in /proc/[0-9]*; do
    cmd=$(tr '\\000' ' ' < "$proc/cmdline" 2>/dev/null)
    case "$cmd" in
      "sh ${REMOTE.loop} "|"/bin/sh ${REMOTE.loop} ") echo "\${proc#/proc/}" ;;
    esac
  done
}

stop_all_loops() {
  touch /mnt/us/dash-loop.stop
  PIDS=$(loop_pids)
  if [ -n "$PIDS" ]; then
    kill $PIDS 2>/dev/null
    WAIT=5
    while [ -n "$(loop_pids)" ] && [ "$WAIT" -gt 0 ]; do
      sleep 1
      WAIT=$((WAIT - 1))
    done
    REMAIN=$(loop_pids)
    [ -n "$REMAIN" ] && kill -9 $REMAIN 2>/dev/null
  fi
  rm -f /mnt/us/dash-loop.pid
  return 0
}
`;

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function dashboardUrl(value = process.env.DASHBOARD_URL) {
  const candidate = value || '';
  if (!candidate) throw new Error('DASHBOARD_URL is required');

  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('DASHBOARD_URL must use http or https');
  }
  return url.toString();
}

function environmentContents(env = process.env) {
  return [
    `PC=${shellQuote(dashboardUrl(env.DASHBOARD_URL))}`,
    `INTERVAL=${shellQuote(positiveInt(env.KINDLE_REFRESH_INTERVAL, 180))}`,
    `FULL_EVERY=${shellQuote(positiveInt(env.KINDLE_FULL_REFRESH_EVERY, 20))}`,
    `WIFI_RETRY_EVERY=${shellQuote(positiveInt(env.KINDLE_WIFI_RETRY_EVERY, 3))}`,
    '',
  ].join('\n');
}

async function run(client, command, label = 'remote command') {
  const remoteCommand = `PATH=/sbin:/usr/sbin:/bin:/usr/bin\nexport PATH\n${command}`;
  const result = await execCommand(client, remoteCommand);
  if (result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.code}`;
    throw new Error(`${label} failed: ${detail}`);
  }
  return result.stdout.trim();
}

async function uploadAtomic(client, localFile, remoteFile, mode) {
  const temporary = `${remoteFile}.tmp-${process.pid}`;
  await uploadFile(client, localFile, temporary);
  await run(
    client,
    `mv ${shellQuote(temporary)} ${shellQuote(remoteFile)} && chmod ${mode} ${shellQuote(remoteFile)}`,
    `install ${remoteFile}`,
  );
}

async function writeEnvironment(client, env = process.env) {
  const content = environmentContents(env);
  const force = [
    'DASHBOARD_URL',
    'KINDLE_REFRESH_INTERVAL',
    'KINDLE_FULL_REFRESH_EVERY',
    'KINDLE_WIFI_RETRY_EVERY',
  ].some((name) => env[name]) ? '1' : '0';
  const command = [
    `if [ ${shellQuote(force)} = '1' ] || [ ! -f ${shellQuote(REMOTE.environment)} ]; then`,
    `  printf %s ${shellQuote(content)} > ${shellQuote(REMOTE.environment)}`,
    `  chmod 600 ${shellQuote(REMOTE.environment)}`,
    'fi',
  ].join('\n');
  await run(client, command, 'create dashboard environment');
}

async function preflight(client) {
  await run(client, [
    'command -v initctl >/dev/null 2>&1',
    'command -v mntroot >/dev/null 2>&1',
    '[ -f /etc/upstart/kmc.conf ]',
    '[ -d /mnt/us ]',
  ].join(' && '), 'Kindle hotfix preflight');
}

async function install(client, env = process.env) {
  await preflight(client);
  await uploadAtomic(client, path.join(ROOT, 'kindle', 'dash-loop.sh'), REMOTE.loop, '755');
  await uploadAtomic(client, path.join(ROOT, 'kindle', 'dash-autostart.sh'), REMOTE.launcher, '755');
  await uploadAtomic(client, path.join(ROOT, 'kindle', 'kindle-dashboard.conf'), REMOTE.jobSource, '644');
  await writeEnvironment(client, env);

  const command = `
if [ -f ${shellQuote(REMOTE.jobTarget)} ] &&
   ! grep -qE 'PaperDeck|Kindle Dashboard' ${shellQuote(REMOTE.jobTarget)}; then
  echo 'refusing to replace an unknown Upstart job' >&2
  exit 20
fi

mntroot rw || exit 1
RESULT=0
cp ${shellQuote(REMOTE.jobSource)} ${shellQuote(REMOTE.jobTarget)} &&
  chmod 644 ${shellQuote(REMOTE.jobTarget)} || RESULT=$?
mntroot ro >/dev/null 2>&1 || true
[ "$RESULT" -eq 0 ] || exit "$RESULT"

initctl reload-configuration
rm -f ${shellQuote(REMOTE.disabled)}
${LOOP_HELPERS}
stop_all_loops
stop ${JOB_NAME} >/dev/null 2>&1 || true
start ${JOB_NAME} >/dev/null
`;
  await run(client, command, 'install Upstart job');
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

// Starting always rewrites the environment so the Kindle picks up the current
// dashboard URL (e.g. after this computer got a new IP).
async function start(client, env = process.env) {
  await writeEnvironment(client, env);
  await run(client, `
${LOOP_HELPERS}
stop_all_loops
rm -f ${shellQuote(REMOTE.disabled)}
/bin/sh ${shellQuote(REMOTE.launcher)}
`, 'start dashboard');
}

async function stop(client) {
  await run(client, `
touch ${shellQuote(REMOTE.disabled)}
${LOOP_HELPERS}
stop_all_loops
`, 'stop dashboard');
}

async function uninstall(client) {
  await stop(client);
  await run(client, `
if [ -f ${shellQuote(REMOTE.jobTarget)} ] &&
   grep -qE 'PaperDeck|Kindle Dashboard' ${shellQuote(REMOTE.jobTarget)}; then
  mntroot rw || exit 1
  rm -f ${shellQuote(REMOTE.jobTarget)}
  RESULT=$?
  mntroot ro >/dev/null 2>&1 || true
  [ "$RESULT" -eq 0 ] || exit "$RESULT"
fi
initctl reload-configuration
rm -f ${shellQuote(REMOTE.launcher)} ${shellQuote(REMOTE.jobSource)} ${shellQuote(REMOTE.disabled)} \
      ${shellQuote(REMOTE.loop)} ${shellQuote(REMOTE.environment)} \
      /mnt/us/dash-loop.log /mnt/us/dash-autostart.log \
      /mnt/us/dash-loop.stop /mnt/us/dash-loop.pid /mnt/us/dash.png
`, 'uninstall Upstart job');
}

async function status(client) {
  return run(client, `
if [ -f ${shellQuote(REMOTE.jobTarget)} ]; then
  echo 'Autostart : installed'
  if [ -f ${shellQuote(REMOTE.disabled)} ]; then echo 'Enabled   : no'; else echo 'Enabled   : yes'; fi
else
  echo 'Autostart : not installed'
  echo 'Enabled   : n/a'
fi
echo "Upstart   : $(initctl status ${JOB_NAME} 2>/dev/null || echo unavailable)"
${LOOP_HELPERS}
PIDS=$(loop_pids)
COUNT=$(echo "$PIDS" | grep -c .)
if [ "$COUNT" -gt 0 ]; then
  echo "Loop      : running (pid $(echo $PIDS))"
else
  echo 'Loop      : stopped'
fi
echo "Loops     : $COUNT"
BACKEND_URL=$(sed -n "s/^PC=['\\"]\\{0,1\\}\\([^'\\"]*\\).*/\\1/p" ${shellQuote(REMOTE.environment)} 2>/dev/null)
echo "URL       : \${BACKEND_URL:-missing}"
if [ -n "$BACKEND_URL" ]; then
  PING_URL=$(echo "$BACKEND_URL" | sed 's|/dash.png.*$|/api/ping|')
  if curl -fsS --connect-timeout 3 --max-time 5 "$PING_URL" >/dev/null 2>&1; then
    echo 'Backend   : reachable'
  else
    echo 'Backend   : unavailable'
  fi
else
  echo 'Backend   : unavailable (missing DASHBOARD_URL)'
fi
`, 'read dashboard status');
}

function parseStatus(output) {
  const fields = {};
  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator > 0) fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return {
    backendReachable: fields.Backend === 'reachable',
    enabled: fields.Enabled === 'yes',
    installed: fields.Autostart === 'installed',
    output,
    running: /^running(?:\s|$)/.test(fields.Loop || ''),
  };
}

function printUsage() {
  console.error('Usage: node scripts/kindle-autostart.js <install|status|start|stop|uninstall>');
}

async function runAction(action, options = {}) {
  if (!['install', 'status', 'start', 'stop', 'uninstall'].includes(action)) {
    printUsage();
    return { code: 2, output: '' };
  }

  const client = await connect(options.ssh);
  try {
    if (action === 'install') await install(client, options.env || process.env);
    else if (action === 'start') await start(client, options.env || process.env);
    else if (action === 'stop') await stop(client);
    else if (action === 'uninstall') await uninstall(client);

    const output = await status(client);
    return { code: 0, output, status: parseStatus(output) };
  } finally {
    client.end();
  }
}

async function main(args = process.argv.slice(2), options = {}) {
  const [action] = args;
  if (args.length !== 1) {
    printUsage();
    return 2;
  }

  const result = await runAction(action, options);
  if (result.output) console.log(result.output);
  return result.code;
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`kindle-autostart: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  dashboardUrl,
  environmentContents,
  install,
  main,
  parseStatus,
  positiveInt,
  preflight,
  runAction,
  start,
  status,
  stop,
  uninstall,
};
