import { rejectNotOk, toJson } from "./helpers.native";
import {
	type ExtendedRequestOptions,
	requestStream,
} from "./requestStream.native";

export const requestJson = async <T>(
	url: string,
	options: ExtendedRequestOptions = {},
) =>
	requestStream(url, options)
		.then(rejectNotOk)
		.then(toJson<T>);
