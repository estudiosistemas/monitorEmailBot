-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" DATETIME,
    "imap_host" TEXT,
    "imap_port" INTEGER,
    "imap_user" TEXT,
    "imap_password" TEXT,
    "imap_tls" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" DATETIME,
    "last_sync_error" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "email_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "emails" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "sender_email" TEXT NOT NULL,
    "sender_name" TEXT,
    "subject" TEXT NOT NULL,
    "received_at" DATETIME NOT NULL,
    "body_text" TEXT NOT NULL,
    "body_hash" TEXT,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "emails_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "email_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_analysis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "requires_response" BOOLEAN NOT NULL,
    "summary" TEXT NOT NULL,
    "sentiment" TEXT,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "analyzed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_analysis_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telegram_destinations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "chat_id" TEXT NOT NULL,
    "username" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "telegram_destinations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "telegram_destination_id" INTEGER,
    "telegram_chat_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" DATETIME,
    "error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_telegram_destination_id_fkey" FOREIGN KEY ("telegram_destination_id") REFERENCES "telegram_destinations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "emails_account_id_idx" ON "emails"("account_id");

-- CreateIndex
CREATE INDEX "emails_processed_idx" ON "emails"("processed");

-- CreateIndex
CREATE UNIQUE INDEX "emails_account_id_provider_message_id_key" ON "emails"("account_id", "provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_analysis_email_id_key" ON "email_analysis"("email_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");
