import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  type VoiceConnection,
  type AudioPlayer,
} from "@discordjs/voice";
import playdl from "play-dl";
import type { VoiceBasedChannel } from "discord.js";

export interface QueueTrack {
  title: string;
  url: string;
  duration: string;
  requestedBy: string;
}

export class MusicQueue {
  public tracks: QueueTrack[] = [];
  public current: QueueTrack | null = null;
  public connection: VoiceConnection | null = null;
  public player: AudioPlayer;
  public volume = 50;
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(public readonly guildId: string) {
    this.player = createAudioPlayer();
    this.player.on(AudioPlayerStatus.Idle, () => {
      this.current = null;
      void this.playNext();
    });
    this.player.on("error", (err) => {
      console.error({ err }, "Music player error");
      this.current = null;
      void this.playNext();
    });
  }

  async join(channel: VoiceBasedChannel): Promise<void> {
    if (this.leaveTimer) {
      clearTimeout(this.leaveTimer);
      this.leaveTimer = null;
    }
    if (this.connection) return;
    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });
    this.connection.subscribe(this.player);
    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000);
    } catch {
      this.connection.destroy();
      this.connection = null;
      throw new Error("Could not connect to voice channel.");
    }
  }

  async playNext(): Promise<void> {
    if (this.tracks.length === 0) {
      this.scheduleLeave();
      return;
    }
    const track = this.tracks.shift()!;
    this.current = track;
    try {
      const stream = await playdl.stream(track.url, { quality: 2 });
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
      resource.volume?.setVolume(this.volume / 100);
      this.player.play(resource);
    } catch (err) {
      console.error({ err }, "Failed to play track — skipping");
      this.current = null;
      await this.playNext();
    }
  }

  setVolume(vol: number): void {
    this.volume = vol;
  }

  scheduleLeave(): void {
    this.leaveTimer = setTimeout(() => {
      if (!this.current && this.tracks.length === 0) {
        this.destroy();
      }
    }, 30_000);
  }

  destroy(): void {
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.tracks = [];
    this.current = null;
    this.player.stop(true);
    this.connection?.destroy();
    this.connection = null;
    queues.delete(this.guildId);
  }
}

const queues = new Map<string, MusicQueue>();

export function getQueue(guildId: string): MusicQueue | undefined {
  return queues.get(guildId);
}

export function getOrCreateQueue(guildId: string): MusicQueue {
  const existing = queues.get(guildId);
  if (existing) return existing;
  const q = new MusicQueue(guildId);
  queues.set(guildId, q);
  return q;
}
