import { useState } from 'react';
import { ArchiveRestoreIcon, DownloadIcon, HousePlusIcon, Trash2Icon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { Sheet } from '@/components/hig/Sheet';
import { useStore } from '@/store/useStore';
import { BACKUP_EVERY_DAYS, backupMark, backupNudge, recordSpan } from '@/reminders/backup';
import { InstallSteps } from '@/screens/welcome/InstallSteps';
import { deviceNoun, installContext, readInstallEnv } from '@/screens/welcome/install';
import { BackupSheet, DeleteSheet } from './DataSheets';
import { shortDate } from './dates';
import { RestoreFlow } from './RestoreFlow';
import { countsSentence, plural, recordCounts } from './summaries';

type Open = 'backup' | 'delete' | 'install' | undefined;

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
  const lastBackup = settings.habits?.lastExportAt;
  const nudge = backupNudge(now, backupMark(settings.habits), recordSpan(state), state.revision);
  const installed = context === 'installed';

  const protection = persisted
    ? `This ${device} has agreed to keep the app’s data.`
    : installed
      ? `This ${device} decides what to keep, so back up now and then.`
      : context === 'iosBrowser'
        ? 'In Safari, data can be cleared after 7 days without a visit. Add the app to your Home Screen to keep it.'
        : 'Clearing this browser’s data would delete it. Back up now and then.';

  return (
    <Screen title="Data & offline" back={{ to: '/you', label: 'You' }}>
      <Group header={`On this ${device}`} footer="No account, no server, nothing sent anywhere: the only copy is the one here, and the backups you make.">
        <Row label="Your record" detail={counts.readings + counts.sessions + counts.checkIns > 0 ? countsSentence(counts) : 'Nothing recorded yet'} />
        <Row label="Kept safe" value={persisted ? 'Yes' : 'Not guaranteed'} detail={protection} />
        <Row label="Works offline" value={offline ? 'Yes' : 'Not yet'} detail={offline ? 'The app opens without a connection.' : 'Open the app once with a connection and it will work without one.'} />
        {context === 'iosBrowser' && (
          <Row onClick={() => setOpen('install')} icon={<HousePlusIcon />} label="Add to Home Screen" detail="So the record is kept, and reminders and the badge can work." chevron />
        )}
      </Group>

      <Group
        header="Backups"
        footer={`A backup is one file you keep somewhere safe, such as Files or iCloud Drive. The app suggests one every ${BACKUP_EVERY_DAYS} days when there is something new.`}
      >
        <Row
          onClick={() => setOpen('backup')}
          icon={<DownloadIcon />}
          label="Back up your record"
          detail={nudge.due
            ? <span className="text-caution">{lastBackup ? `Time for a new one: the last was ${plural(nudge.daysSince ?? 0, 'day')} ago.` : 'You have not made one yet.'}</span>
            : lastBackup ? `Last backup ${shortDate(lastBackup)}` : 'No backup yet'}
          chevron
        />
        <RestoreFlow
          place="you"
          trigger={pick => <Row onClick={pick} icon={<ArchiveRestoreIcon />} label="Restore from a backup" detail="See what is in the file before anything changes." chevron />}
        />
      </Group>

      <Group footer={`Deletes everything the app holds on this ${device} and starts again. It asks first.`}>
        <Row onClick={() => setOpen('delete')} icon={<Trash2Icon className="text-stop" />} label={<span className="text-stop">Delete everything on this {device}</span>} />
      </Group>

      <BackupSheet open={open === 'backup'} onOpenChange={next => setOpen(next ? 'backup' : undefined)} device={device} />
      <DeleteSheet open={open === 'delete'} onOpenChange={next => setOpen(next ? 'delete' : undefined)} device={device} />
      <Sheet open={open === 'install'} onOpenChange={next => setOpen(next ? 'install' : undefined)} title="Add to Home Screen" detent="large">
        <p className="px-1 text-[length:var(--text-body)] leading-snug">
          On the Home Screen the app is kept apart from Safari, which can clear a website’s data after 7 days without a visit. The Home Screen app starts empty, so back up here first and restore the file there.
        </p>
        <InstallSteps device={device} />
      </Sheet>
    </Screen>
  );
}
