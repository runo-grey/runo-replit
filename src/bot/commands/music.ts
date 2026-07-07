import { EmbedBuilder, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import playdl from "play-dl";
import { getOrCreateQueue, getQueue } from "../music/player.js";
import { errorEmbed } from "../embeds.js";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function handlePlay(i: ChatInputCommandInteraction, query: string): Promise<void> {
  await i.deferReply();

  const member = i.member as GuildMember;
  const vc = member.voice?.channel;
  if (!vc) {
    await i.editReply({ embeds: [errorEmbed("You must be in a voice channel to use `/play`.")] });
    return;
  }

  let videoUrl: string;
  let title: string;
  let duration: string;

  try {
    if (query.startsWith("http")) {
      const info = await playdl.video_info(query);
      videoUrl = query;
      title = info.video_details.title ?? "Unknown";
      duration = formatDuration(info.video_details.durationInSec ?? 0);
    } else {
      const results = await playdl.search(query, { source: { youtube: "video" }, limit: 1 });
      if (!results.length) {
        await i.editReply({ embeds: [errorEmbed("No results found for that search.")] });
        return;
      }
      const video = results[0]!;
      videoUrl = video.url;
      title = video.title ?? "Unknown";
      duration = formatDuration(video.durationInSec ?? 0);
    }
  } catch (err) {
    console.error({ err }, "Music search/info error");
    await i.editReply({ embeds: [errorEmbed("Could not find or load that track.")] });
    return;
  }

  const queue = getOrCreateQueue(i.guildId!);

  try {
    await queue.join(vc);
  } catch {
    await i.editReply({ embeds: [errorEmbed("Could not join your voice channel.")] });
    return;
  }

  const track = { title, url: videoUrl, duration, requestedBy: i.user.username };
  const isPlaying = queue.current !== null;
  queue.tracks.push(track);

  if (!isPlaying) {
    await queue.playNext();
    await i.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🎵 Now Playing")
          .setDescription(`**[${title}](${videoUrl})**`)
          .addFields(
            { name: "Duration", value: duration, inline: true },
            { name: "Requested by", value: i.user.username, inline: true },
          )
          .setTimestamp(),
      ],
    });
  } else {
    await i.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("📋 Added to Queue")
          .setDescription(`**[${title}](${videoUrl})**`)
          .addFields(
            { name: "Duration", value: duration, inline: true },
            { name: "Position", value: `#${queue.tracks.length}`, inline: true },
            { name: "Requested by", value: i.user.username, inline: true },
          )
          .setTimestamp(),
      ],
    });
  }
}

export async function handleSkip(i: ChatInputCommandInteraction): Promise<void> {
  const queue = getQueue(i.guildId!);
  if (!queue?.current) {
    await i.reply({ embeds: [errorEmbed("Nothing is playing right now.")], ephemeral: true });
    return;
  }
  const skipped = queue.current.title;
  queue.player.stop();
  await i.reply({
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("⏭️ Skipped").setDescription(`Skipped **${skipped}**`)],
  });
}

export async function handleStop(i: ChatInputCommandInteraction): Promise<void> {
  const queue = getQueue(i.guildId!);
  if (!queue) {
    await i.reply({ embeds: [errorEmbed("Nothing is playing right now.")], ephemeral: true });
    return;
  }
  queue.destroy();
  await i.reply({
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("⏹️ Stopped").setDescription("Music stopped and queue cleared.")],
  });
}

export async function handlePause(i: ChatInputCommandInteraction): Promise<void> {
  const queue = getQueue(i.guildId!);
  if (!queue?.current) {
    await i.reply({ embeds: [errorEmbed("Nothing is playing right now.")], ephemeral: true });
    return;
  }
  queue.player.pause();
  await i.reply({
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("⏸️ Paused").setDescription("Playback paused. Use `/resume` to continue.")],
  });
}

export async function handleResume(i: ChatInputCommandInteraction): Promise<void> {
  const queue = getQueue(i.guildId!);
  if (!queue) {
    await i.reply({ embeds: [errorEmbed("Nothing is paused right now.")], ephemeral: true });
    return;
  }
  queue.player.unpause();
  await i.reply({
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("▶️ Resumed").setDescription("Playback resumed!")],
  });
}

export async function handleQueue(i: ChatInputCommandInteraction): Promise<void> {
  const queue = getQueue(i.guildId!);
  if (!queue || (!queue.current && queue.tracks.length === 0)) {
    await i.reply({ embeds: [errorEmbed("The queue is empty.")], ephemeral: true });
    return;
  }

  const lines: string[] = [];
  if (queue.current) {
    lines.push(`▶️ **Now Playing:** [${queue.current.title}](${queue.current.url}) \`${queue.current.duration}\``);
  }
  if (queue.tracks.length > 0) {
    lines.push("\n**Up Next:**");
    queue.tracks.slice(0, 10).forEach((t, idx) => {
      lines.push(`\`${idx + 1}.\` [${t.title}](${t.url}) \`${t.duration}\``);
    });
    if (queue.tracks.length > 10) lines.push(`*...and ${queue.tracks.length - 10} more*`);
  }

  await i.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("📋 Queue")
        .setDescription(lines.join("\n"))
        .setTimestamp(),
    ],
  });
}

export async function handleNowPlaying(i: ChatInputCommandInteraction): Promise<void> {
  const queue = getQueue(i.guildId!);
  if (!queue?.current) {
    await i.reply({ embeds: [errorEmbed("Nothing is playing right now.")], ephemeral: true });
    return;
  }
  const t = queue.current;
  await i.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎵 Now Playing")
        .setDescription(`**[${t.title}](${t.url})**`)
        .addFields(
          { name: "Duration", value: t.duration, inline: true },
          { name: "Requested by", value: t.requestedBy, inline: true },
          { name: "Volume", value: `${queue.volume}%`, inline: true },
        )
        .setTimestamp(),
    ],
  });
}

export async function handleVolume(i: ChatInputCommandInteraction, vol: number): Promise<void> {
  const queue = getQueue(i.guildId!);
  if (!queue) {
    await i.reply({ embeds: [errorEmbed("Nothing is playing right now.")], ephemeral: true });
    return;
  }
  queue.setVolume(vol);
  await i.reply({
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("🔊 Volume").setDescription(`Volume set to **${vol}%**`)],
  });
}

export async function handleLeave(i: ChatInputCommandInteraction): Promise<void> {
  const queue = getQueue(i.guildId!);
  if (!queue) {
    await i.reply({ embeds: [errorEmbed("I'm not in a voice channel.")], ephemeral: true });
    return;
  }
  queue.destroy();
  await i.reply({
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("👋 Left").setDescription("Left the voice channel and cleared the queue.")],
  });
}

export async function handleMusicGuide(i: ChatInputCommandInteraction): Promise<void> {
  await i.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎵 Music Guide")
        .setDescription("Here's everything you need to know about the Runo music player!")
        .addFields(
          {
            name: "▶️ Playback",
            value: [
              "`/play <song name or URL>` — Search YouTube & play, or add to queue",
              "`/pause` — Pause the current track",
              "`/resume` — Resume paused playback",
              "`/skip` — Skip to the next track in the queue",
              "`/stop` — Stop music & clear the entire queue",
              "`/leave` — Disconnect the bot from voice",
            ].join("\n"),
          },
          {
            name: "📋 Info & Settings",
            value: [
              "`/queue` — View the current song queue",
              "`/nowplaying` — See what's currently playing",
              "`/volume <1–100>` — Adjust the player volume",
            ].join("\n"),
          },
          {
            name: "💡 Tips",
            value: [
              "• You must be **in a voice channel** to use `/play`",
              "• Supports **YouTube links** or plain **search terms**",
              "• Songs are **queued** if something is already playing",
              "• Bot **auto-leaves** after 30 seconds of inactivity",
            ].join("\n"),
          },
        )
        .setFooter({ text: "Runo Bot • Music Player" })
        .setTimestamp(),
    ],
  });
}
