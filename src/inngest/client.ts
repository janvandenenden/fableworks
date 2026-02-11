import { Inngest } from "inngest";

const appId = process.env.INNGEST_APP_ID ?? "fableworks";

export const inngest = new Inngest({
  id: appId,
});
