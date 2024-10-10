import { store } from "@neptune";
import type {
	TrackItem,
	MediaItem as TidalMediaItem,
	ItemId,
	VideoItem,
} from "neptune-types/tidal";
import { interceptPromise } from "../intercept/interceptPromise";
import type { PlaybackContext } from "../AudioQualityTypes";
import getPlaybackControl from "../getPlaybackControl";

import { libTrace } from "../trace";

export type MediaItem = TrackItem | VideoItem;
export class MediaItemCache {
	private static readonly _cache: Record<ItemId, MediaItem> = {};
	public static current(playbackContext?: PlaybackContext) {
		playbackContext ??= getPlaybackControl()?.playbackContext;
		if (playbackContext?.actualProductId === undefined) return undefined;
		return MediaItemCache.ensure(playbackContext.actualProductId);
	}
	public static async ensureTrack(itemId?: ItemId) {
		const mediaItem = await MediaItemCache.ensure(itemId);
		if (mediaItem?.contentType === "track") return mediaItem;
		return undefined;
	}
	public static async ensureVideo(itemId?: ItemId) {
		const mediaItem = await MediaItemCache.ensure(itemId);
		if (mediaItem?.contentType === "video") return mediaItem;
		return undefined;
	}
	public static async ensure(itemId?: ItemId) {
		if (itemId === undefined) return undefined;

		const mediaItem = MediaItemCache._cache[itemId];
		if (mediaItem !== undefined) return mediaItem;

		const mediaItems: Record<number, TidalMediaItem> =
			store.getState().content.mediaItems;
		for (const itemId in mediaItems) {
			const item = mediaItems[itemId]?.item;
			MediaItemCache._cache[itemId] = item;
		}

		if (MediaItemCache._cache[itemId] === undefined) {
			const currentPage = window.location.pathname;

			const loadedTrack = await interceptPromise(
				() => neptune.actions.router.replace(<any>`/track/${itemId}`),
				["page/IS_DONE_LOADING"],
				[],
			)
				.then(() => true)
				.catch(
					libTrace.warn.withContext(
						`TrackItemCache.ensure failed to load track ${itemId}`,
					),
				);
			// If we fail to load the track, maybe its a video, try that instead as a last ditch attempt
			if (!loadedTrack) {
				await interceptPromise(
					() => neptune.actions.router.replace(<any>`/video/${itemId}`),
					["page/IS_DONE_LOADING"],
					[],
				).catch(
					libTrace.warn.withContext(
						`TrackItemCache.ensure failed to load video ${itemId}`,
					),
				);
			}
			neptune.actions.router.replace(<any>currentPage);

			const mediaItems: Record<number, TidalMediaItem> =
				store.getState().content.mediaItems;
			const trackItem = mediaItems[+itemId]?.item;
			MediaItemCache._cache[itemId] = trackItem;
		}

		return MediaItemCache._cache[itemId];
	}
}
