import { store } from "@neptune";
import type { PlaybackContext } from "./AudioQualityTypes";
import type { CoreState } from "neptune-types/tidal";

type PlaybackControl = CoreState["playbackControls"] & {
	playbackContext: PlaybackContext;
};
export default (): Partial<PlaybackControl> =>
	<PlaybackControl>store.getState()?.playbackControls ?? {};
