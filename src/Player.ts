import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Main from '@girs/gnome-shell/ui/main';
import { type Radio } from './extension';

type PlayerCommandString = string;
type PlayerCommand = {
  command: Array<string | boolean>;
};

export default class Player {
  private readonly _mpvSocket: string = '/tmp/quicklofi-socket';
  private _isPlaying: boolean = false;
  private _isCommandRunning: boolean = false;
  private _process: Gio.Subprocess | null = null;

  constructor(private _settings: Gio.Settings) {}

  public init(): void {
    this._settings.connect('changed::volume', (settings, key) => {
      if (this._process !== null && !this._isCommandRunning) {
        const volume = settings.get_int(key);
        const command = this.createCommand({
          command: ['set_property', 'volume', volume],
        });
        this.sendCommandToMpvSocket(command);
      }
    });
  }

  public stopPlayer(): void {
    if (this._process !== null) {
      this._process.force_exit();
      this._isPlaying = false;
      this._process = null;
      return;
    }
  }

  public startPlayer(radio: Radio): void {
    this.stopPlayer();
    try {
      this._isPlaying = true;
      this._process = Gio.Subprocess.new(
        [
          'mpv',
          radio.radioUrl,
          `--volume=${this._settings.get_int('volume')}`,
          `--input-ipc-server=${this._mpvSocket}`,
          '--no-video',
        ],
        Gio.SubprocessFlags.NONE,
      );
    } catch (e) {
      this._isPlaying = false;
      this._process = null;
      Main.notifyError(
        'MPV not found',
        'Did you have mpv installed?\nhttps://github.com/EuCaue/gnome-shell-quick-lofi?tab=readme-ov-file#dependencies',
      );
    }
  }

  private createCommand(command: PlayerCommand): PlayerCommandString {
    const cmd: PlayerCommandString = `echo '${JSON.stringify(command)}'`;
    return cmd;
  }

  private sendCommandToMpvSocket(mpvCommand: PlayerCommandString): void {
    //  TODO: use native socket with GJS in the future.
    this._isCommandRunning = true;
    const socatCommand = ['|', 'socat', '-', this._mpvSocket];
    const [success, _] = GLib.spawn_async(
      null,
      ['/bin/sh', '-c', mpvCommand + ' ' + socatCommand.join(' ')],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null,
    );
    this._isCommandRunning = false;
    if (!success) {
      Main.notifyError(
        'Socat not found',
        'Did you have socat installed?\nhttps://github.com/EuCaue/gnome-shell-quick-lofi?tab=readme-ov-file#dependencies',
      );
    }
  }
}
