import type { AudioQuality, PlaybackContext } from "../AudioQualityTypes";
import { Tracer } from "../trace";
const tracer = Tracer("[TrackInfoCache]");

import { type } from "@inrixia/helpers/object";

import { SharedObjectStoreExpirable } from "../storage/SharedObjectStoreExpirable";
import { type TrackInfo, getTrackInfo } from "../nativeBridge";
import { PlaybackInfoCache } from "./PlaybackInfoCache";

const WEEK = 7 * 24 * 60 * 60 * 1000;
export class TrackInfoCache {
	private static readonly _listeners: Record<
		string,
		((trackInfo: TrackInfo) => void)[]
	> = {};
	private static readonly _store: SharedObjectStoreExpirable<
		[TrackInfo["trackId"], TrackInfo["audioQuality"]],
		TrackInfo
	> = new SharedObjectStoreExpirable("TrackInfoCache", {
		storeSchema: {
			keyPath: ["trackId", "audioQuality"],
		},
		maxAge: WEEK,
	});

	public static async register(
		trackId: TrackInfo["trackId"],
		audioQuality: AudioQuality,
		onTrackInfo: (trackInfoP: TrackInfo) => void,
	): Promise<void> {
		// If actualProductId or actualAudioQuality is null, then this is probabaly a video
		if (audioQuality === null) return undefined;

		const key = `${trackId}${audioQuality}`;
		if (TrackInfoCache._listeners[key]?.push(onTrackInfo) === undefined)
			TrackInfoCache._listeners[key] = [onTrackInfo];
		const { trackInfo } = await TrackInfoCache.getWithExpiry(
			trackId,
			audioQuality,
		);
		if (trackInfo !== undefined) onTrackInfo(trackInfo);
	}

	private static put(trackInfo: TrackInfo): void {
		TrackInfoCache._store.put(trackInfo).catch(tracer.err.withContext("put"));
		for (const listener of TrackInfoCache._listeners[
			`${trackInfo.trackId}${trackInfo.audioQuality}`
		] ?? [])
			listener(trackInfo);
	}

	private static makeKey(
		trackId: TrackInfo["trackId"],
		audioQuality: AudioQuality,
	): [string, AudioQuality] {
		if (type(+trackId) !== "number" || Number.isNaN(+trackId))
			throw new Error(`Invalid trackId ${trackId} is not a number`);
		if (type(audioQuality) !== "string")
			throw new Error(`Invalid audioQuality ${audioQuality} is not a string`);
		return [trackId, audioQuality];
	}

	private static async getWithExpiry(
		trackId: TrackInfo["trackId"],
		audioQuality: AudioQuality,
	) {
		const { expired, value: trackInfo } =
			await TrackInfoCache._store.getWithExpiry(
				TrackInfoCache.makeKey(trackId, audioQuality),
			);
		return { expired, trackInfo };
	}

	private static get(
		trackId: TrackInfo["trackId"],
		audioQuality: AudioQuality,
	) {
		return TrackInfoCache._store.get(
			TrackInfoCache.makeKey(trackId, audioQuality),
		);
	}

	public static async ensure(
		playbackContext: PlaybackContext,
	): Promise<TrackInfo | undefined> {
		const { actualProductId: trackId, actualAudioQuality } = playbackContext;

		// If actualProductId or actualAudioQuality is null, then this is probabaly a video
		if (actualAudioQuality === null) return undefined;

		// If a promise for this key is already in the cache, await it
		const { expired, trackInfo } = await TrackInfoCache.getWithExpiry(
			trackId,
			actualAudioQuality,
		);

		if (trackInfo === undefined) return TrackInfoCache.update(playbackContext);
		// If trackInfo exists but is expired, then update it in the background
		if (expired)
			TrackInfoCache.update(playbackContext).catch(
				tracer.err.withContext("background update"),
			);
		tracer.log("ensure", trackInfo);
		return trackInfo;
	}
	private static async update(
		playbackContext: PlaybackContext,
	): Promise<TrackInfo> {
		const extPlaybackInfo = await PlaybackInfoCache.ensure(
			+playbackContext.actualProductId,
			playbackContext.actualAudioQuality,
		);
		const trackInfo = await getTrackInfo(playbackContext, extPlaybackInfo);
		TrackInfoCache.put(trackInfo);
		tracer.log("update", trackInfo);
		return trackInfo;
	}
}
