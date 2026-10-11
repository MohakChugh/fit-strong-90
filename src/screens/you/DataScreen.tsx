import { useEffect, useState } from 'react';
import { ArchiveRestoreIcon, DownloadIcon, FileCheckIcon, HousePlusIcon, MapIcon, RouteIcon, Trash2Icon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { Sheet } from '@/components/hig/Sheet';
import { setWalkSettings, useStore } from '@/store/useStore';
import { CONSENT, consentSummary, walkSettings } from '@/walk/consent';
import { BACKUP_EVERY_DAYS, backupMark, backupNudge, recordSpan } from '@/reminders/backup';
import { InstallSteps } from '@/screens/welcome/InstallSteps';
import { deviceNoun, installContext, readInstallEnv } from '@/screens/welcome/install';
import { Notice, Toggle } from './controls';
import { BackupSheet, DeleteSheet, EraseRoutesSheet } from './DataSheets';
import { backupLine, backupState, installStatus, storageLine } from './dataStatus';
import { RestoreFlow } from './RestoreFlow';
import { countsSentence, plural, privacyLine, recordCounts } from './summaries';

type Open = 'backup' | 'delete' | 'install' | 'erase' | undefined;

/**
 * What is stored, how safe it is, and the only two ways the record leaves or
 * arrives: a backup file the person keeps, and restoring one. Local-only is
 * the point (D23), so it is said as a strength, and the risk that comes with
 * it — one device, one copy — is answered with the backup right beside it.
 */
export function DataScreen() {
  const state = useStore();
  const { settings, persisted } = state;
  const [open, setOpen] = useState<Open>();
  // Read once: none of this changes while the screen is open.
  const [{ now, device, context, offline }] = useState(() => {
    const env = readInstallEnv();
    return {
      now: new Date(),
      device: deviceNoun(env),
      context: installContext(env),
      offline: typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller,
    };
  });

  const counts = recordCounts(state);
  // This phone's own walk answers (B-26), and the routes it keeps.
  const walk = walkSettings(settings);
  const routes = state.records.routes.length;
  // Said once the erase is stored, while this screen is open (K6R-11).
  const [erased, setErased] = useState(false);
  const nudge = backupNudge(now, backupMark(settings.habits), recordSpan(state), state.revision);
  const backup = backupState(settings.habits);
  const install = installStatus(context, device);
  // Storage used (§18.3), as the browser estimates it, again after each stored change.
  const [usage, setUsage] = useState<number>();
  useEffect(() => {
    let live = true;
    navigator.storage?.estimate?.().then(e => { if (live) setUsage(e.usage); }, () => {});
    return () => { live = false; };
  }, [state.revision]);

  return (
    <Screen title="Data" back={{ to: '/me', label: 'Me' }}>
      <Group header={`On this ${device}`} footer={privacyLine(device)}>
        <Row label="Your record" detail={counts.readings + counts.sessions + counts.checkIns > 0 ? countsSentence(counts) : 'Nothing recorded yet'} />
        <Row label="Storage used" value={storageLine(usage)} />
        <Row label={install.label} detail={install.detail} />
        <Row label="Kept safe" value={persisted ? 'Yes' : 'Not guaranteed'} detail={persisted ? `This ${device} has agreed to keep the app’s data.` : 'This browser may clear it to make room. Back up now and then.'} />
        <Row label="Works offline" value={offline ? 'Yes' : 'Not yet'} detail={offline ? 'The app opens without a connection.' : 'Open the app once with a connection and it will work without one.'} />
        {context === 'iosBrowser' && (
          <Row onClick={() => setOpen('install')} icon={<HousePlusIcon />} label="Add to Home Screen" detail="So the record is kept, and reminders and the badge can work." chevron />
        )}
      </Group>

      <Group
        header="Backups"
        footer={`A backup is one file you keep somewhere safe, such as Files or iCloud Drive. Check it reads back with Check a backup. The app suggests one every ${BACKUP_EVERY_DAYS} days when there is something new.`}
      >
        <Row
          onClick={() => setOpen('backup')}
          icon={<DownloadIcon />}
          label="Back up your record"
          detail={nudge.due ? <span className="text-caution">{`${backupLine(backup)}. Time for a new one.`}</span> : backupLine(backup)}
          chevron
        />
        <RestoreFlow
          place="you"
          purpose="check"
          trigger={pick => <Row onClick={pick} icon={<FileCheckIcon />} label="Check a backup" detail="Read a backup file back, to see it is whole. Nothing changes." chevron />}
        />
        <RestoreFlow
          place="you"
          trigger={pick => <Row onClick={pick} icon={<ArchiveRestoreIcon />} label="Restore from a backup" detail="See what is in the file before anything changes." chevron />}
        />
      </Group>

      {/* This phone's two walk answers, each changeable here (journey §9.1, §16), and erasing every route (B-05). */}
      <Group header="Walks and maps" footer="Routes stay on this phone. They go into a backup only when you include them.">
        <Row
          icon={<RouteIcon />}
          label="Keep walk routes"
          detail={walk.saveRoutes === false ? 'New walks don’t keep their route. Routes already kept stay until you erase them.' : consentSummary(walk).routes}
          accessory={<Toggle label="Keep walk routes" checked={walk.saveRoutes === true} onChange={on => void setWalkSettings({ saveRoutes: on })} />}
        />
        <Row
          icon={<MapIcon />}
          label="Map pictures under routes"
          detail={walk.map === 'unasked' ? `${consentSummary(walk).map}. ${CONSENT.mapPictures.detail}` : CONSENT.mapPictures.detail}
          accessory={<Toggle label="Map pictures under routes" checked={walk.map === 'on'} onChange={on => void setWalkSettings({ map: on ? 'on' : 'off' })} />}
        />
        <Row
          onClick={() => setOpen('erase')}
          icon={<Trash2Icon className="text-stop" />}
          label={<span className="text-stop">Erase all routes</span>}
          detail={routes > 0 ? `${plural(routes, 'route')} kept. Walks keep their time, distance and steps.` : 'No saved routes. Erasing also clears the route of a walk not yet saved. The walk stays.'}
          chevron
        />
      </Group>
      {erased && <Notice>All routes erased.</Notice>}

      <Group footer={`Deletes everything the app holds on this ${device} and starts again. It asks twice.`}>
        <Row onClick={() => setOpen('delete')} icon={<Trash2Icon className="text-stop" />} label={<span className="text-stop">Delete everything on this {device}</span>} />
      </Group>

      <BackupSheet open={open === 'backup'} onOpenChange={next => setOpen(next ? 'backup' : undefined)} device={device} />
      <DeleteSheet open={open === 'delete'} onOpenChange={next => setOpen(next ? 'delete' : undefined)} device={device} />
      <EraseRoutesSheet open={open === 'erase'} onOpenChange={next => setOpen(next ? 'erase' : undefined)} device={device} onErased={() => setErased(true)} />
      <Sheet open={open === 'install'} onOpenChange={next => setOpen(next ? 'install' : undefined)} title="Add to Home Screen" detent="large">
        <p className="px-1 text-[length:var(--text-body)] leading-snug">
          On the Home Screen the app is kept apart from Safari, which can clear a website’s data after 7 days without a visit. The Home Screen app starts empty, so back up here first and restore the file there.
        </p>
        <InstallSteps device={device} />
      </Sheet>
    </Screen>
  );
}
