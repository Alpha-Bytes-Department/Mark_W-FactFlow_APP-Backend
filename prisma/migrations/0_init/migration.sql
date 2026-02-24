-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."EGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ESubscriptionInterval" AS ENUM ('WEEKLY', 'HALF_MONTHLY', 'MONTHLY', 'TWO_MONTHLY', 'QUARTERLY', 'FOUR_MONTHLY', 'HALF_YEARLY', 'YEARLY', 'TWO_YEARLY');

-- CreateEnum
CREATE TYPE "public"."EUserRole" AS ENUM ('USER');

-- CreateTable
CREATE TABLE "public"."_SeenMessages" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SeenMessages_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_UserChats" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserChats_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."chats" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_ids" TEXT[],

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."context_pages" (
    "page_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "context_pages_pkey" PRIMARY KEY ("page_name")
);

-- CreateTable
CREATE TABLE "public"."fact_checks" (
    "uid" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "verdict" VARCHAR(50),
    "confidence" DOUBLE PRECISION,
    "claim" TEXT,
    "conclusion" TEXT,
    "evidence" JSON,
    "sources" JSON,
    "timestamp" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "fact_checks_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "public"."mails" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" "public"."EUserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "unread" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "chat_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "user_id" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "media_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "stripe_subscription_id" TEXT NOT NULL,
    "stripe_product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "features" TEXT[],
    "price" INTEGER NOT NULL,
    "is_hot" BOOLEAN NOT NULL DEFAULT false,
    "subscribed_user_count" INTEGER NOT NULL DEFAULT 0,
    "subscription_interval" "public"."ESubscriptionInterval" NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transactions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "stripe_transaction_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "subscription_name" TEXT NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_activities" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "unread" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "role" "public"."EUserRole" NOT NULL DEFAULT 'USER',
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "otp_id" INTEGER NOT NULL DEFAULT 0,
    "fb_id" TEXT,
    "google_id" TEXT,
    "avatar" TEXT NOT NULL DEFAULT '/images/placeholder.png',
    "name" TEXT NOT NULL DEFAULT 'Unknown User',
    "gender" "public"."EGender" NOT NULL DEFAULT 'OTHER',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stripe_customer_id" TEXT,
    "stripe_account_id" TEXT,
    "is_stripe_connected" BOOLEAN NOT NULL DEFAULT false,
    "subscription_name" TEXT,
    "subscription_expires_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "_SeenMessages_B_index" ON "public"."_SeenMessages"("B" ASC);

-- CreateIndex
CREATE INDEX "_UserChats_B_index" ON "public"."_UserChats"("B" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "chats_user_ids_key" ON "public"."chats"("user_ids" ASC);

-- CreateIndex
CREATE INDEX "idx_user_timestamp" ON "public"."fact_checks"("user_id" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "ix_fact_checks_timestamp" ON "public"."fact_checks"("timestamp" ASC);

-- CreateIndex
CREATE INDEX "ix_fact_checks_user_id" ON "public"."fact_checks"("user_id" ASC);

-- CreateIndex
CREATE INDEX "ix_fact_checks_verdict" ON "public"."fact_checks"("verdict" ASC);

-- CreateIndex
CREATE INDEX "idx_email" ON "public"."mails"("email" ASC);

-- CreateIndex
CREATE INDEX "idx_remarks" ON "public"."mails"("remarks" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_name_key" ON "public"."subscriptions"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_product_id_key" ON "public"."subscriptions"("stripe_product_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "public"."subscriptions"("stripe_subscription_id" ASC);

-- CreateIndex
CREATE INDEX "idx_user_email" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "idx_user_fb_id" ON "public"."users"("fb_id" ASC);

-- CreateIndex
CREATE INDEX "idx_user_google_id" ON "public"."users"("google_id" ASC);

-- CreateIndex
CREATE INDEX "idx_user_role" ON "public"."users"("role" ASC);

-- CreateIndex
CREATE INDEX "idx_user_stripe_account_id" ON "public"."users"("stripe_account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_user_stripe_customer_id" ON "public"."users"("stripe_customer_id" ASC);

-- AddForeignKey
ALTER TABLE "public"."_SeenMessages" ADD CONSTRAINT "_SeenMessages_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_SeenMessages" ADD CONSTRAINT "_SeenMessages_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_UserChats" ADD CONSTRAINT "_UserChats_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_UserChats" ADD CONSTRAINT "_UserChats_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_subscription_name_fkey" FOREIGN KEY ("subscription_name") REFERENCES "public"."subscriptions"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

