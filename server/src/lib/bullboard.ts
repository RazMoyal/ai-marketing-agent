import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { publishQueue } from "../queues/publish.js";

export function mountBullBoard(app: any) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  const queueAdapter = new BullMQAdapter(publishQueue as any) as any;
  createBullBoard({
    queues: [queueAdapter as any],
    serverAdapter,
  });

  app.use("/admin/queues", serverAdapter.getRouter());
}
