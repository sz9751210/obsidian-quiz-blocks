import type { Input } from "@lezer/common";

declare module "@lezer/lr" {
	interface InputStream extends Input {} // eslint-disable-line @typescript-eslint/no-empty-object-type
}
