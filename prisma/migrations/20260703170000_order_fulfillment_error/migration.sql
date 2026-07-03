-- Track why auto-fulfillment to SMMStone failed (e.g. low provider balance).
ALTER TABLE "orders" ADD COLUMN "fulfillmentError" TEXT;
