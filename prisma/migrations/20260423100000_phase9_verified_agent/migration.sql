-- Phase 9: add isVerified to Agent
ALTER TABLE "Agent" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
